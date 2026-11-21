"""
Unit tests for multiple YouTube channels support and user history.
"""

from fastapi.testclient import TestClient
from app.main import app
from app.youtube_publisher import (
    save_user_channel,
    get_user_channels,
    set_active_channel_id,
    delete_user_channel,
    get_channel_token,
)

client = TestClient(app)


def test_multiple_channels_lifecycle():
    user_id = "user_multichannel_test"

    # Add Channel 1
    ch1 = save_user_channel({
        "channel_id": "UC_gaming_clips",
        "channel_title": "GTA 6 Gaming Clips",
        "thumbnail_url": "https://example.com/ch1.jpg",
        "access_token": "token_channel_1",
        "refresh_token": "refresh_channel_1",
    }, user_id=user_id)

    assert ch1["channel_id"] == "UC_gaming_clips"
    assert ch1["is_default"] is True

    # Add Channel 2
    ch2 = save_user_channel({
        "channel_id": "UC_funny_moments",
        "channel_title": "GTA 6 Funny Moments",
        "thumbnail_url": "https://example.com/ch2.jpg",
        "access_token": "token_channel_2",
        "refresh_token": "refresh_channel_2",
        "is_default": False,
    }, user_id=user_id)

    assert ch2["channel_id"] == "UC_funny_moments"

    # Verify both channels are listed
    channels = get_user_channels(user_id=user_id)
    assert len(channels) >= 2
    cids = [c["channel_id"] for c in channels]
    assert "UC_gaming_clips" in cids
    assert "UC_funny_moments" in cids

    # Verify active channel tokens
    assert get_channel_token("UC_gaming_clips", user_id=user_id) == "token_channel_1"
    assert get_channel_token("UC_funny_moments", user_id=user_id) == "token_channel_2"

    # Switch active channel
    assert set_active_channel_id("UC_funny_moments", user_id=user_id) is True
    assert get_channel_token(user_id=user_id) == "token_channel_2"

    # Delete channel
    assert delete_user_channel("UC_gaming_clips", user_id=user_id) is True
    channels_after = get_user_channels(user_id=user_id)
    assert "UC_gaming_clips" not in [c["channel_id"] for c in channels_after]


def test_auth_and_channels_endpoints():
    # 1. Sign up user
    signup_resp = client.post("/api/auth/signup", json={
        "email": "channelowner@test.com",
        "password": "mypassword123",
        "name": "Channel Owner",
    })
    assert signup_resp.status_code == 200
    token = signup_resp.json()["access_token"]
    assert token is not None

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get me
    me_resp = client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "channelowner@test.com"

    # 3. Connect a channel via manual token
    token_resp = client.post("/api/youtube/set-token", json={
        "access_token": "ya29.test_channel_token",
        "channel_id": "UC_user_chan_99",
        "channel_title": "Owner GTA 6 Channel",
    }, headers=headers)
    assert token_resp.status_code == 200

    # 4. List channels
    channels_resp = client.get("/api/youtube/channels", headers=headers)
    assert channels_resp.status_code == 200
    data = channels_resp.json()
    assert "channels" in data
    assert any(c["channel_id"] == "UC_user_chan_99" for c in data["channels"])

    # 5. Select channel
    sel_resp = client.post("/api/youtube/channels/select", json={
        "channel_id": "UC_user_chan_99",
    }, headers=headers)
    assert sel_resp.status_code == 200
    assert sel_resp.json()["active_channel_id"] == "UC_user_chan_99"

    # 6. User History
    hist_post = client.post("/api/history", json={
        "id": "hist_123",
        "platform": "youtube",
        "title": "GTA 6 Trailer Reaction",
    }, headers=headers)
    assert hist_post.status_code == 200

    hist_get = client.get("/api/history", headers=headers)
    assert hist_get.status_code == 200
    assert "history" in hist_get.json()
