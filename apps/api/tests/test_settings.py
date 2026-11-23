import os
import pytest
from fastapi.testclient import TestClient
from app.main import app, GLOBAL_SETTINGS_FILE

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_settings():
    backup = None
    if os.path.exists(GLOBAL_SETTINGS_FILE):
        with open(GLOBAL_SETTINGS_FILE, "r", encoding="utf-8") as f:
            backup = f.read()
        os.remove(GLOBAL_SETTINGS_FILE)
    yield
    if backup is not None:
        with open(GLOBAL_SETTINGS_FILE, "w", encoding="utf-8") as f:
            f.write(backup)


def test_get_default_global_settings():
    resp = client.get("/api/settings/global")
    assert resp.status_code == 200
    data = resp.json()
    assert "text_overlay" in data
    assert "audio_mix" in data
    assert "cover_image" in data
    assert "enabled" in data["text_overlay"]
    assert "background_music" in data["audio_mix"]
    assert "enabled" in data["cover_image"]


def test_update_global_settings():
    payload = {
        "layout": "blurred_background",
        "progress_bar": True,
        "progress_bar_color": "cyan",
        "text_overlay": {
            "enabled": True,
            "hook_style": "neon_cyan",
            "default_hook": "DON'T MISS THIS MOMENT!",
            "burn_captions": True,
            "caption_style": "neon_cyan",
            "position": "center",
        },
        "audio_mix": {
            "background_music": "vice_city_synth",
            "music_volume": 0.25,
            "original_audio_volume": 1.0,
            "ducking_enabled": True,
        },
        "cover_image": {
            "enabled": False,
            "theme": "neon_glow",
            "headline": "INSANE CLIP!",
        },
        "default_privacy": "unlisted",
        "default_tags": ["GTA6", "ViceCity", "Shorts"],
    }
    resp = client.post("/api/settings/global", json=payload)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["layout"] == "blurred_background"
    assert res_data["progress_bar_color"] == "cyan"
    assert res_data["text_overlay"]["hook_style"] == "neon_cyan"
    assert res_data["text_overlay"]["default_hook"] == "DON'T MISS THIS MOMENT!"
    assert res_data["audio_mix"]["background_music"] == "vice_city_synth"
    assert res_data["audio_mix"]["music_volume"] == 0.25
    assert res_data["cover_image"]["enabled"] is False
    assert res_data["default_privacy"] == "unlisted"

    # Verify subsequent GET returns the updated settings
    get_resp = client.get("/api/settings/global")
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["layout"] == "blurred_background"
    assert get_data["cover_image"]["enabled"] is False
    assert get_data["audio_mix"]["background_music"] == "vice_city_synth"


def test_invalid_music_volume_validation():
    invalid_payload = {
        "audio_mix": {
            "background_music": "trap_beat",
            "music_volume": 1.5,  # Max allowed is 1.0
        }
    }
    resp = client.post("/api/settings/global", json=invalid_payload)
    assert resp.status_code == 422
