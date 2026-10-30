import os
import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app, rate_limits
from app.config import DOWNLOAD_DIR

client = TestClient(app)


def test_e2e_full_stack_lifecycle():
    # 1. Health check
    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"

    # 2. Extract metadata with yt-dlp mock
    with patch("app.downloader.yt_dlp.YoutubeDL") as mock_ydl_class:
        mock_ydl = MagicMock()
        mock_ydl_class.return_value.__enter__.return_value = mock_ydl
        mock_ydl.extract_info.return_value = {
            "id": "e2e_vid_123",
            "title": "E2E Test Video",
            "uploader": "E2E Channel",
            "duration": 180,
            "thumbnail": "https://example.com/thumb.jpg",
            "formats": [
                {"height": 1080, "vcodec": "avc1", "ext": "mp4", "filesize": 40000000},
                {"height": 720, "vcodec": "avc1", "ext": "mp4", "filesize": 20000000},
                {"vcodec": "none", "acodec": "mp4a", "ext": "m4a"},
            ],
        }

        res_meta = client.post(
            "/api/metadata",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
        )
        assert res_meta.status_code == 200
        meta = res_meta.json()
        assert meta["title"] == "E2E Test Video"
        assert len(meta["formats"]) >= 3
        chosen_format = meta["formats"][0]["format_id"]

    # 3. Trigger Download and stream progress via SSE
    with patch("app.main.download_video_stream") as mock_stream:
        async def dummy_sse():
            yield 'data: {"status": "downloading", "percent": 45.0, "speed": "5.0 MB/s", "eta": "00:10"}\n\n'
            yield 'data: {"status": "merging", "percent": 99.0}\n\n'
            yield 'data: {"status": "complete", "percent": 100.0, "filename": "e2e_job123_video.mp4"}\n\n'

        mock_stream.return_value = dummy_sse()

        res_down = client.post(
            "/api/download",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "format_id": chosen_format},
        )
        assert res_down.status_code == 200
        assert "text/event-stream" in res_down.headers["content-type"]
        events = [line for line in res_down.text.split("\n\n") if line.startswith("data: ")]
        assert len(events) == 3
        assert "complete" in events[-1]

    # 4. Fetch the completed file
    test_file_path = DOWNLOAD_DIR / "e2e_job123_video.mp4"
    test_file_path.write_bytes(b"E2E binary content")

    try:
        res_file = client.get("/api/file/e2e_job123_video.mp4")
        assert res_file.status_code == 200
        assert res_file.content == b"E2E binary content"
        assert "video.mp4" in res_file.headers["content-disposition"]
    finally:
        if test_file_path.exists():
            test_file_path.unlink()

