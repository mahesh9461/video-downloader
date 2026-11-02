import os
os.environ["FILE_CLEANUP_DELAY_SECONDS"] = "0"

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app, rate_limits
from app.config import DOWNLOAD_DIR
from app.schemas import VideoMetadata, VideoFormat

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "ffmpeg_available" in data


def test_get_metadata_invalid_url():
    response = client.post("/api/metadata", json={"url": "https://unknownsite.com/123"})
    assert response.status_code == 400
    data = response.json()
    assert data["error_type"] == "invalid_url"


def test_get_metadata_empty_url():
    response = client.post("/api/metadata", json={"url": "   "})
    assert response.status_code == 400
    data = response.json()
    assert data["error_type"] == "invalid_url"


@patch("app.downloader.yt_dlp.YoutubeDL")
def test_get_metadata_success(mock_ydl_class):
    mock_ydl = MagicMock()
    mock_ydl_class.return_value.__enter__.return_value = mock_ydl
    mock_ydl.extract_info.return_value = {
        "id": "dQw4w9WgXcQ",
        "title": "Rick Astley - Never Gonna Give You Up",
        "uploader": "RickAstleyVEVO",
        "duration": 213,
        "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        "formats": [
            {"height": 1080, "vcodec": "avc1", "ext": "mp4", "filesize": 50000000},
            {"height": 720, "vcodec": "avc1", "ext": "mp4", "filesize": 25000000},
            {"height": 360, "vcodec": "avc1", "ext": "mp4", "filesize": 10000000},
            {"vcodec": "none", "acodec": "mp4a", "ext": "m4a"},
        ],
    }

    response = client.post(
        "/api/metadata",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "dQw4w9WgXcQ"
    assert data["platform"] == "youtube"
    assert data["title"] == "Rick Astley - Never Gonna Give You Up"
    assert data["creator"] == "RickAstleyVEVO"
    assert data["duration"] == 213
    assert len(data["formats"]) > 0

    format_labels = [f["label"] for f in data["formats"]]
    assert any("1080p" in lbl for lbl in format_labels)
    assert any("720p" in lbl for lbl in format_labels)
    assert any("MP3" in lbl for lbl in format_labels)


@patch("app.main.download_video_stream")
def test_rate_limiting_middleware(mock_stream):
    async def dummy_gen():
        yield "data: {}\n\n"

    mock_stream.return_value = dummy_gen()
    rate_limits.clear()
    test_ip = "192.168.1.99"
    headers = {"X-Forwarded-For": test_ip}

    # First 5 should succeed
    for i in range(5):
        resp = client.post(
            "/api/download",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "format_id": "yt-720p"},
            headers=headers,
        )
        assert resp.status_code != 429

    # 6th should be rejected with 429
    resp_blocked = client.post(
        "/api/download",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "format_id": "yt-720p"},
        headers=headers,
    )
    assert resp_blocked.status_code == 429
    data = resp_blocked.json()
    assert data["error_type"] == "rate_limit"
    assert "Rate limit exceeded" in data["detail"]


@patch("app.main.download_video_stream")
def test_download_stream_sse_endpoint(mock_stream):
    async def sample_sse_stream():
        yield 'data: {"status": "downloading", "percent": 50.0}\n\n'
        yield 'data: {"status": "complete", "percent": 100.0, "filename": "sample.mp4"}\n\n'

    mock_stream.return_value = sample_sse_stream()

    response = client.post(
        "/api/download",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "format_id": "yt-720p"},
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert "downloading" in response.text
    assert "complete" in response.text


def test_serve_downloaded_file_not_found():
    response = client.get("/api/file/nonexistent_file_123.mp4")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_serve_downloaded_file_success(tmp_path):
    test_file_name = "testjob123_My_Test_Video.mp4"
    test_file_path = DOWNLOAD_DIR / test_file_name
    test_file_path.write_bytes(b"dummy mp4 file content for test")

    try:
        response = client.get(f"/api/file/{test_file_name}")
        assert response.status_code == 200
        assert response.content == b"dummy mp4 file content for test"
        assert 'attachment; filename="My_Test_Video.mp4"' in response.headers["content-disposition"]
    finally:
        if test_file_path.exists():
            test_file_path.unlink()
