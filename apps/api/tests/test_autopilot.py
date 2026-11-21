"""
Unit tests for GTA 6 Autopilot, 6-clip scheduling, low-CPU rendering, and immediate disk cleanup.
"""

import json
import os
import time
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock, AsyncMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.autopilot import autopilot_manager, AutopilotManager
from app.schemas import AutopilotClipItem, AutopilotBatch


@pytest.fixture(autouse=True)
def reset_autopilot():
    """Resets autopilot manager to a clean state before each test."""
    autopilot_manager.is_running = False
    autopilot_manager.state = "idle"
    autopilot_manager.current_batch = None
    autopilot_manager.daily_uploads_count = 0
    autopilot_manager.daily_upload_limit = 6
    autopilot_manager.upload_interval_seconds = 3600
    autopilot_manager.cooldown_until = None
    autopilot_manager.disk_space_cleaned_mb = 0.0
    autopilot_manager.recent_logs = []
    yield
    autopilot_manager.is_running = False
    autopilot_manager.state = "idle"
    autopilot_manager.current_batch = None


@pytest.fixture
def client():
    return TestClient(app)


def test_autopilot_status_endpoint(client):
    resp = client.get("/api/autopilot/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["daily_upload_limit"] == 6
    assert data["cpu_mode"] == "low_load_threads_2"
    assert "disk_space_cleaned_mb" in data
    assert "state" in data


def test_autopilot_start_and_pause(client):
    resp = client.post("/api/autopilot/start")
    assert resp.status_code == 200
    assert resp.json()["is_running"] is True

    resp_pause = client.post("/api/autopilot/pause")
    assert resp_pause.status_code == 200
    assert resp_pause.json()["is_running"] is False
    assert resp_pause.json()["state"] == "paused"

    resp_stop = client.post("/api/autopilot/stop")
    assert resp_stop.status_code == 200
    assert resp_stop.json()["state"] == "idle"


def test_cancel_active_run_cleans_partial_files(tmp_path):
    with patch("app.autopilot.DOWNLOAD_DIR", tmp_path):
        part_file = tmp_path / "test_download.mp4.part"
        part_file.write_bytes(b"test" * 1024)
        assert part_file.is_file()

        autopilot_manager.state = "rendering"
        autopilot_manager.current_step = "downloading"
        res = autopilot_manager.cancel_active_run()

        assert res.state == "idle"
        assert not part_file.exists()


def test_cleanup_file_tracks_disk_space(tmp_path):
    mgr = AutopilotManager()
    dummy_file = tmp_path / "temp_source_video.mp4"
    dummy_file.write_bytes(b"0" * 1048576)  # 1 MB
    assert dummy_file.exists()

    freed = mgr.cleanup_file(str(dummy_file))
    assert round(freed, 1) == 1.0
    assert not dummy_file.exists()
    assert mgr.disk_space_cleaned_mb >= 1.0


@pytest.mark.anyio
@patch("app.autopilot.publish_short_video", new_callable=AsyncMock)
@patch("app.autopilot.refresh_access_token")
async def test_publish_clip_and_immediate_cleanup(mock_refresh, mock_publish, tmp_path):
    clip_file = tmp_path / "gta6_short_test_1.mp4"
    clip_file.write_bytes(b"x" * 524288)  # 0.5 MB

    mock_publish.return_value = {
        "video_id": "yt_short_123",
        "youtube_url": "https://youtube.com/shorts/yt_short_123",
        "title": "GTA 6 Insane Detail #Shorts",
        "privacy": "public",
        "status": "uploaded",
    }

    clip_item = AutopilotClipItem(
        id="batch1_1",
        source_video_id="src_1",
        source_title="GTA 6 Gameplay",
        clip_index=1,
        start_time=10.0,
        end_time=40.0,
        duration=30.0,
        hook_title="GTA 6 Insane Detail",
        filename=clip_file.name,
        scheduled_time=datetime.now(timezone.utc).isoformat(),
        status="queued",
    )

    with patch("app.autopilot.DOWNLOAD_DIR", tmp_path):
        success = await autopilot_manager.publish_clip(clip_item)
        assert success is True
        assert clip_item.status == "published"
        assert clip_item.youtube_video_id == "yt_short_123"
        # Assert clip was immediately deleted from disk!
        assert not clip_file.exists()
        assert autopilot_manager.disk_space_cleaned_mb > 0


@pytest.mark.anyio
async def test_tick_cooldown_triggers_when_limit_reached():
    autopilot_manager.is_running = True
    autopilot_manager.daily_uploads_count = 6
    autopilot_manager.daily_upload_limit = 6

    await autopilot_manager.tick()

    assert autopilot_manager.state == "cooldown"
    assert autopilot_manager.cooldown_until is not None


def test_audio_endpoint(client):
    resp = client.get("/api/autopilot/audio")
    assert resp.status_code == 200
    data = resp.json()
    assert "custom_tracks" in data
    assert isinstance(data["custom_tracks"], list)


def test_trigger_custom_url_with_video_metadata(client):
    from app.schemas import VideoMetadata
    mock_meta = VideoMetadata(
        id="8-DRGbQ1IXc",
        platform="youtube",
        title="Custom Test Video",
        creator="Test Creator",
        duration=120,
        thumbnail="https://example.com/thumb.jpg",
        formats=[],
    )
    with patch("app.main.extract_metadata", return_value=mock_meta), \
         patch("app.autopilot.autopilot_manager.create_and_render_batch", new_callable=AsyncMock) as mock_batch:
        resp = client.post("/api/autopilot/trigger", json={"url": "https://www.youtube.com/watch?v=8-DRGbQ1IXc"})
        assert resp.status_code == 200
        # Background task runs
        assert autopilot_manager.daily_uploads_count == 0
