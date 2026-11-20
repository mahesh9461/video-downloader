import os
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.youtube_publisher import (
    get_stored_token,
    save_stored_token,
    clear_stored_token,
    get_youtube_auth_url,
    get_youtube_status,
    publish_short_video,
    CREDENTIALS_CACHE_FILE,
    _creds_store,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_tokens(monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)
    clear_stored_token()
    _creds_store.clear()
    if CREDENTIALS_CACHE_FILE.exists():
        try:
            CREDENTIALS_CACHE_FILE.unlink()
        except Exception:
            pass
    yield
    clear_stored_token()
    _creds_store.clear()
    if CREDENTIALS_CACHE_FILE.exists():
        try:
            CREDENTIALS_CACHE_FILE.unlink()
        except Exception:
            pass


def test_youtube_status_unconfigured():
    with patch("app.youtube_publisher.GOOGLE_CLIENT_ID", None), patch("app.youtube_publisher.GOOGLE_CLIENT_SECRET", None):
        res = client.get("/api/youtube/status")
        assert res.status_code == 200
        data = res.json()
        assert data["configured"] is False
        assert data["connected"] is False
        assert data["auth_url"] is None


def test_youtube_status_configured_not_connected():
    with patch("app.youtube_publisher.GOOGLE_CLIENT_ID", "test-client-id"), \
         patch("app.youtube_publisher.GOOGLE_CLIENT_SECRET", "test-secret"):
        res = client.get("/api/youtube/status")
        assert res.status_code == 200
        data = res.json()
        assert data["configured"] is True
        assert data["connected"] is False
        assert "accounts.google.com" in data["auth_url"]


def test_youtube_auth_url_endpoint():
    with patch("app.youtube_publisher.GOOGLE_CLIENT_ID", "test-client-id"):
        res = client.get("/api/youtube/auth-url")
        assert res.status_code == 200
        data = res.json()
        assert "client_id=test-client-id" in data["auth_url"]
        assert "youtube.upload" in data["auth_url"]


def test_youtube_auth_url_not_configured():
    with patch("app.youtube_publisher.GOOGLE_CLIENT_ID", None):
        res = client.get("/api/youtube/auth-url")
        assert res.status_code == 400
        assert "not configured" in res.json()["detail"].lower()


def test_youtube_configure_and_disconnect():
    res = client.post("/api/youtube/configure", json={
        "client_id": "dynamic-id.apps.googleusercontent.com",
        "client_secret": "dynamic-secret",
    })
    assert res.status_code == 200
    assert res.json()["status"] == "configured"
    assert res.json()["youtube_status"]["configured"] is True

    # Test disconnect
    disc = client.post("/api/youtube/disconnect")
    assert disc.status_code == 200
    assert disc.json()["status"] == "disconnected"



@pytest.mark.anyio
async def test_youtube_token_exchange():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "access_token": "ya29.test-access-token",
        "expires_in": 3600,
        "token_type": "Bearer",
    }

    with patch("app.youtube_publisher.GOOGLE_CLIENT_ID", "test-id"), \
         patch("app.youtube_publisher.GOOGLE_CLIENT_SECRET", "test-sec"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        res = client.post("/api/youtube/token", json={"code": "4/0A..."})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["token"]["access_token"] == "ya29.test-access-token"
        assert get_stored_token() == "ya29.test-access-token"


def test_youtube_publish_no_token():
    res = client.post("/api/youtube/publish", json={
        "filename": "non_existent.mp4",
        "title": "Viral Moment",
    })
    assert res.status_code == 400
    assert "no youtube access token" in res.json()["detail"].lower()


def test_youtube_publish_file_not_found():
    res = client.post("/api/youtube/publish", json={
        "filename": "missing_video_12345.mp4",
        "title": "Viral Moment",
        "access_token": "test-token",
    })
    assert res.status_code == 404
    assert "video file not found" in res.json()["detail"].lower()


@pytest.mark.anyio
async def test_youtube_publish_success(tmp_path):
    from app.config import DOWNLOAD_DIR

    test_video = DOWNLOAD_DIR / "test_publish_short.mp4"
    test_video.write_bytes(b"dummy mp4 video bytes")

    try:
        init_mock_resp = MagicMock()
        init_mock_resp.status_code = 200
        init_mock_resp.headers = {"Location": "https://upload.youtube.com/resumable/12345"}

        put_mock_resp = MagicMock()
        put_mock_resp.status_code = 200
        put_mock_resp.json.return_value = {"id": "yt_short_abc123"}

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
             patch("httpx.AsyncClient.put", new_callable=AsyncMock) as mock_put:
            mock_post.return_value = init_mock_resp
            mock_put.return_value = put_mock_resp

            res = client.post("/api/youtube/publish", json={
                "filename": "test_publish_short.mp4",
                "title": "Insane Gaming Play",
                "description": "Watch this clip!",
                "privacy": "public",
                "access_token": "test-token",
            })

            assert res.status_code == 200
            data = res.json()
            assert data["video_id"] == "yt_short_abc123"
            assert data["youtube_url"] == "https://www.youtube.com/shorts/yt_short_abc123"
            assert "#Shorts" in data["title"]
            assert data["status"] == "uploaded"
    finally:
        if test_video.exists():
            test_video.unlink()


@pytest.mark.anyio
async def test_set_video_thumbnail_success(tmp_path):
    from app.youtube_publisher import set_video_thumbnail
    test_thumb = tmp_path / "thumb.jpg"
    test_thumb.write_bytes(b"dummy image bytes")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"items": []}

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        success = await set_video_thumbnail("yt_short_123", str(test_thumb), access_token="mock_token")
        assert success is True


@pytest.mark.anyio
async def test_set_video_thumbnail_no_token():
    from app.youtube_publisher import set_video_thumbnail
    with patch("app.youtube_publisher.get_stored_token", return_value=None), \
         patch("app.youtube_publisher.refresh_access_token", new_callable=AsyncMock, return_value=None):
        success = await set_video_thumbnail("yt_short_123", "/nonexistent/thumb.jpg")
        assert success is False
