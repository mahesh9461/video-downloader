"""
Acceptance tests for multi-channel YouTube OAuth bug fixes in youtube_publisher.py.

Verifies:
1. Connect channel A, then channel B (different ids) -> get_user_channels() returns both, each with its own refresh_token.
2. Connect channel A twice -> only one record, tokens updated, already_connected is true.
3. If the channels API call fails during connect -> an error is raised and NO channel record is created (no "chan_xxxx" ids).
4. Publishing to channel B with an expired access token refreshes using B's refresh_token only; channel A's tokens are unchanged.
5. set_active_channel_id(B) does not change A's stored tokens.
6. Deleting channel A leaves B connected and active.
"""

import time
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.youtube_publisher import (
    clear_stored_token,
    exchange_code_for_token,
    get_user_channels,
    save_user_channel,
    set_active_channel_id,
    delete_user_channel,
    update_channel_settings,
    get_channel_preset,
    publish_short_video,
    _channels_store,
)
from app.config import DOWNLOAD_DIR


@pytest.fixture(autouse=True)
def clean_channel_state():
    clear_stored_token()
    yield
    clear_stored_token()


def _make_oauth_token_response(access_token: str, refresh_token: str = None, expires_in: int = 3600):
    mock = MagicMock()
    mock.status_code = 200
    data = {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": expires_in,
    }
    if refresh_token:
        data["refresh_token"] = refresh_token
    mock.json.return_value = data
    mock.text = str(data)
    return mock


def _make_channel_info_response(channel_id: str, title: str, thumb: str = "https://example.com/thumb.jpg"):
    mock = MagicMock()
    mock.status_code = 200
    mock.json.return_value = {
        "items": [
            {
                "id": channel_id,
                "snippet": {
                    "title": title,
                    "thumbnails": {"default": {"url": thumb}},
                },
            }
        ]
    }
    mock.text = str(mock.json.return_value)
    return mock


# ==============================================================================
# Acceptance Test 1: Connect channel A, then channel B -> both return with separate refresh_tokens
# ==============================================================================
@pytest.mark.anyio
async def test_connect_two_different_channels():
    with patch("app.youtube_publisher.GOOGLE_CLIENT_ID", "mock-client-id"), \
         patch("app.youtube_publisher.GOOGLE_CLIENT_SECRET", "mock-client-secret"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        # Step 1: Connect Channel A
        mock_post.return_value = _make_oauth_token_response("tok_a_123", "refresh_a_abc")
        mock_get.return_value = _make_channel_info_response("UC_channel_A", "Channel Alpha")

        res_a = await exchange_code_for_token("code_a")
        assert res_a["channel_id"] == "UC_channel_A"
        assert res_a["already_connected"] is False

        # Step 2: Connect Channel B
        mock_post.return_value = _make_oauth_token_response("tok_b_456", "refresh_b_xyz")
        mock_get.return_value = _make_channel_info_response("UC_channel_B", "Channel Beta")

        res_b = await exchange_code_for_token("code_b")
        assert res_b["channel_id"] == "UC_channel_B"
        assert res_b["already_connected"] is False

        # Verify get_user_channels() returns both channels, each retaining its own refresh_token
        channels = get_user_channels()
        assert len(channels) == 2

        by_id = {c["channel_id"]: c for c in channels}
        assert "UC_channel_A" in by_id
        assert "UC_channel_B" in by_id

        assert by_id["UC_channel_A"]["channel_title"] == "Channel Alpha"
        assert by_id["UC_channel_A"]["refresh_token"] == "refresh_a_abc"

        assert by_id["UC_channel_B"]["channel_title"] == "Channel Beta"
        assert by_id["UC_channel_B"]["refresh_token"] == "refresh_b_xyz"


# ==============================================================================
# Acceptance Test 2: Connect channel A twice -> only one record, updated tokens, already_connected=True
# ==============================================================================
@pytest.mark.anyio
async def test_connect_channel_twice_updates_tokens():
    with patch("app.youtube_publisher.GOOGLE_CLIENT_ID", "mock-client-id"), \
         patch("app.youtube_publisher.GOOGLE_CLIENT_SECRET", "mock-client-secret"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        # First connection
        mock_post.return_value = _make_oauth_token_response("tok_a_initial", "refresh_a_original")
        mock_get.return_value = _make_channel_info_response("UC_channel_A", "Channel Alpha")
        res1 = await exchange_code_for_token("code_a_1")
        assert res1["already_connected"] is False

        # Second connection for same channel (e.g. refreshed or re-authorized)
        mock_post.return_value = _make_oauth_token_response("tok_a_updated", None)  # Google might not return new refresh_token
        mock_get.return_value = _make_channel_info_response("UC_channel_A", "Channel Alpha Renamed")
        res2 = await exchange_code_for_token("code_a_2")
        assert res2["already_connected"] is True
        assert res2["channel_title"] == "Channel Alpha Renamed"

        # Verify only one channel record exists in store
        channels = get_user_channels()
        assert len(channels) == 1
        rec = channels[0]
        assert rec["channel_id"] == "UC_channel_A"
        assert rec["channel_title"] == "Channel Alpha Renamed"
        assert rec["refresh_token"] == "refresh_a_original"  # Preserved original refresh token!
        assert _channels_store["channels"]["UC_channel_A"]["access_token"] == "tok_a_updated"


# ==============================================================================
# Acceptance Test 3: Channels API failure during connect raises error and creates NO record
# ==============================================================================
@pytest.mark.anyio
async def test_channels_api_failure_raises_and_creates_no_record():
    mock_err_response = MagicMock()
    mock_err_response.status_code = 403
    mock_err_response.json.return_value = {"error": {"message": "Access Not Configured / Quota Exceeded"}}
    mock_err_response.text = "Access Not Configured"

    with patch("app.youtube_publisher.GOOGLE_CLIENT_ID", "mock-client-id"), \
         patch("app.youtube_publisher.GOOGLE_CLIENT_SECRET", "mock-client-secret"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        mock_post.return_value = _make_oauth_token_response("tok_fail_123", "refresh_fail")
        mock_get.return_value = mock_err_response

        with pytest.raises(RuntimeError) as exc_info:
            await exchange_code_for_token("code_failing")

        assert "YouTube channel lookup failed" in str(exc_info.value)

        # Confirm NO record was created (no fake "chan_xxxx" ids)
        channels = get_user_channels()
        assert len(channels) == 0
        assert len(_channels_store.get("channels", {})) == 0


# ==============================================================================
# Acceptance Test 4: Publishing to B with expired token refreshes using B's refresh_token only; A unchanged
# ==============================================================================
@pytest.mark.anyio
async def test_publish_to_b_with_expired_token_refreshes_b_only():
    from app.youtube_publisher import save_user_channel

    # Set up Channel A (valid token)
    save_user_channel({
        "channel_id": "UC_A",
        "channel_title": "Channel A",
        "access_token": "token_A_active",
        "refresh_token": "refresh_token_A",
        "expires_at": time.time() + 3600,
        "is_default": True,
    })

    # Set up Channel B (expired token: expires_at in the past)
    save_user_channel({
        "channel_id": "UC_B",
        "channel_title": "Channel B",
        "access_token": "token_B_expired",
        "refresh_token": "refresh_token_B",
        "expires_at": time.time() - 300,  # Expired 5 minutes ago
        "is_default": False,
    })

    # Create dummy video file
    dummy_video = DOWNLOAD_DIR / "test_publish_b.mp4"
    dummy_video.write_bytes(b"dummy mp4 contents")

    try:
        # Mock Google Token Refresh endpoint and YouTube Upload endpoints
        async def mock_post_handler(url, *args, **kwargs):
            url_str = str(url)
            if "oauth2.googleapis.com/token" in url_str:
                # Ensure refresh endpoint was called with B's refresh token
                payload = kwargs.get("data", {})
                assert payload.get("refresh_token") == "refresh_token_B"
                resp = MagicMock()
                resp.status_code = 200
                resp.json.return_value = {
                    "access_token": "token_B_refreshed_new",
                    "expires_in": 3600,
                }
                return resp
            elif "upload/youtube/v3/videos" in url_str:
                headers = kwargs.get("headers", {})
                # Resumable upload initiation must use B's NEW refreshed token!
                assert headers.get("Authorization") == "Bearer token_B_refreshed_new"
                resp = MagicMock()
                resp.status_code = 200
                resp.headers = {"Location": "https://upload.youtube.com/resumable/test_session_b"}
                return resp
            raise ValueError(f"Unexpected POST url: {url_str}")

        mock_put = MagicMock()
        mock_put.status_code = 200
        mock_put.json.return_value = {"id": "short_b_123"}

        with patch("app.youtube_publisher.GOOGLE_CLIENT_ID", "mock-client-id"), \
             patch("app.youtube_publisher.GOOGLE_CLIENT_SECRET", "mock-client-secret"), \
             patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=mock_post_handler), \
             patch("httpx.AsyncClient.put", new_callable=AsyncMock, return_value=mock_put):

            res = await publish_short_video(
                filename="test_publish_b.mp4",
                title="Amazing Short on B",
                channel_id="UC_B",
            )
            assert res["video_id"] == "short_b_123"

        # Verify Channel B's access_token was updated
        assert _channels_store["channels"]["UC_B"]["access_token"] == "token_B_refreshed_new"

        # Verify Channel A's access_token was completely untouched!
        assert _channels_store["channels"]["UC_A"]["access_token"] == "token_A_active"
        assert _channels_store["channels"]["UC_A"]["refresh_token"] == "refresh_token_A"
    finally:
        if dummy_video.exists():
            dummy_video.unlink()


# ==============================================================================
# Acceptance Test 5: set_active_channel_id(B) does not change A's stored tokens
# ==============================================================================
def test_set_active_channel_id_does_not_change_other_tokens():
    from app.youtube_publisher import save_user_channel

    save_user_channel({
        "channel_id": "UC_A",
        "channel_title": "Channel A",
        "access_token": "token_A_preserved",
        "refresh_token": "refresh_A_preserved",
        "is_default": True,
    })

    save_user_channel({
        "channel_id": "UC_B",
        "channel_title": "Channel B",
        "access_token": "token_B_preserved",
        "refresh_token": "refresh_B_preserved",
        "is_default": False,
    })

    assert _channels_store["active_channel_id"] == "UC_A"

    # Switch active channel to B
    ok = set_active_channel_id("UC_B")
    assert ok is True
    assert _channels_store["active_channel_id"] == "UC_B"
    assert _channels_store["channels"]["UC_B"]["is_default"] is True
    assert _channels_store["channels"]["UC_A"]["is_default"] is False

    # Confirm Channel A's tokens were NOT changed or overwritten
    assert _channels_store["channels"]["UC_A"]["access_token"] == "token_A_preserved"
    assert _channels_store["channels"]["UC_A"]["refresh_token"] == "refresh_A_preserved"

    # Confirm Channel B's tokens remain intact
    assert _channels_store["channels"]["UC_B"]["access_token"] == "token_B_preserved"
    assert _channels_store["channels"]["UC_B"]["refresh_token"] == "refresh_B_preserved"


# ==============================================================================
# Acceptance Test 6: Deleting channel A leaves B connected and active
# ==============================================================================
def test_deleting_channel_a_leaves_b_connected_and_active():
    from app.youtube_publisher import save_user_channel

    save_user_channel({
        "channel_id": "UC_A",
        "channel_title": "Channel A",
        "access_token": "token_A",
        "refresh_token": "refresh_A",
        "is_default": True,
    })

    save_user_channel({
        "channel_id": "UC_B",
        "channel_title": "Channel B",
        "access_token": "token_B",
        "refresh_token": "refresh_B",
        "is_default": False,
    })

    assert len(get_user_channels()) == 2
    assert _channels_store["active_channel_id"] == "UC_A"

    # Delete Channel A (the currently active channel)
    ok = delete_user_channel("UC_A")
    assert ok is True

    # Channel B should remain and automatically become active
    channels_remaining = get_user_channels()
    assert len(channels_remaining) == 1
    assert channels_remaining[0]["channel_id"] == "UC_B"
    assert channels_remaining[0]["is_default"] is True
    assert _channels_store["active_channel_id"] == "UC_B"


def test_update_channel_settings_custom_description_tags_category():
    """Verify user can add/modify description, tags, category, and made_for_kids for a channel."""
    save_user_channel({
        "channel_id": "UC_CUSTOM_1",
        "channel_title": "Custom Vlogger",
        "access_token": "tok_1",
        "refresh_token": "ref_1",
        "is_default": True,
    })

    # Update settings with specific tags, category, and description
    updated = update_channel_settings("UC_CUSTOM_1", {
        "description": "My custom vlogging channel description with links!",
        "tags": ["vlog", "#dailyvlog", "tech", "vlog"],  # test deduplication & # stripping
        "category_id": "22",
        "made_for_kids": False,
        "ai_generated": False,
        "paid_promotion": True,
    })

    assert updated is not None
    assert updated["description"] == "My custom vlogging channel description with links!"
    assert updated["tags"] == ["vlog", "dailyvlog", "tech"]
    assert updated["category_id"] == "22"
    assert updated["category_name"] == "People & Blogs"
    assert updated["made_for_kids"] is False
    assert updated["paid_promotion"] is True

    # Check preset retrieval returns these custom stored settings
    preset = get_channel_preset("UC_CUSTOM_1")
    assert preset["description"] == "My custom vlogging channel description with links!"
    assert preset["tags"] == ["vlog", "dailyvlog", "tech"]
    assert preset["categoryId"] == "22"
    assert preset["category_name"] == "People & Blogs"
    assert preset["selfDeclaredMadeForKids"] is False
    assert preset["paidProductPlacement"] is True

    # User can modify again
    modified = update_channel_settings("UC_CUSTOM_1", {
        "description": "Updated new description",
        "tags": ["travel", "food"],
        "category_id": "19",
    })
    assert modified["description"] == "Updated new description"
    assert modified["tags"] == ["travel", "food"]
    assert modified["category_id"] == "19"
    assert modified["category_name"] == "Travel & Events"


def test_update_channel_settings_api_endpoint():
    """Verify PUT /api/youtube/channels/{channel_id}/settings endpoint."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    save_user_channel({
        "channel_id": "UC_API_TEST",
        "channel_title": "API Test Channel",
        "access_token": "tok_api",
        "refresh_token": "ref_api",
        "is_default": True,
    })

    res = client.put(
        "/api/youtube/channels/UC_API_TEST/settings",
        json={
            "description": "Endpoint configured description",
            "tags": ["test1", "test2", "#hashtag"],
            "category_id": "1",
            "made_for_kids": True,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["channel_id"] == "UC_API_TEST"
    assert data["description"] == "Endpoint configured description"
    assert data["tags"] == ["test1", "test2", "hashtag"]
    assert data["category_id"] == "1"
    assert data["category_name"] == "Film & Animation"
    assert data["made_for_kids"] is True
