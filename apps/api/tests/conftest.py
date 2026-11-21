import pytest
from pathlib import Path
from app.downloader import reset_youtube_cooldown
import app.youtube_publisher as yt
import app.autopilot as ap
import app.auth as au


@pytest.fixture(autouse=True)
def clean_cooldown_state():
    reset_youtube_cooldown()
    yield
    reset_youtube_cooldown()


@pytest.fixture(autouse=True, scope="session")
def isolate_test_data(tmp_path_factory):
    """Isolates all persistent JSON cache files so tests never touch production data in apps/api/data."""
    test_dir = tmp_path_factory.mktemp("test_data")

    orig_channels_file = yt.CHANNELS_CACHE_FILE
    orig_token_file = yt.TOKEN_CACHE_FILE
    orig_creds_file = yt.CREDENTIALS_CACHE_FILE
    orig_state_file = ap.STATE_FILE
    orig_users_file = au.USERS_FILE
    orig_sessions_file = au.SESSIONS_FILE

    # Backup current real file contents if present
    real_channels_content = orig_channels_file.read_text(encoding="utf-8") if orig_channels_file.exists() else None
    real_state_content = orig_state_file.read_text(encoding="utf-8") if orig_state_file.exists() else None

    # Backup in-memory data
    saved_channels_store = dict(yt._channels_store)
    saved_token_store = dict(yt._token_store)
    saved_creds_store = dict(yt._creds_store)
    saved_autopilot_videos = list(ap.autopilot_manager.all_published_videos)
    saved_autopilot_ids = list(ap.autopilot_manager.processed_video_ids)
    saved_autopilot_logs = list(ap.autopilot_manager.recent_logs)
    saved_autopilot_errors = list(ap.autopilot_manager.recent_errors)

    # Redirect paths to temporary test directory
    yt.CHANNELS_CACHE_FILE = test_dir / "youtube_channels.json"
    yt.TOKEN_CACHE_FILE = test_dir / "token_cache.json"
    yt.CREDENTIALS_CACHE_FILE = test_dir / "google_creds.json"
    ap.STATE_FILE = test_dir / "autopilot_state.json"
    au.USERS_FILE = test_dir / "users.json"
    au.SESSIONS_FILE = test_dir / "sessions.json"

    yield

    # Restore original paths
    yt.CHANNELS_CACHE_FILE = orig_channels_file
    yt.TOKEN_CACHE_FILE = orig_token_file
    yt.CREDENTIALS_CACHE_FILE = orig_creds_file
    ap.STATE_FILE = orig_state_file
    au.USERS_FILE = orig_users_file
    au.SESSIONS_FILE = orig_sessions_file

    # Ensure real files are intact
    if real_channels_content is not None:
        orig_channels_file.write_text(real_channels_content, encoding="utf-8")
    if real_state_content is not None:
        orig_state_file.write_text(real_state_content, encoding="utf-8")

    # Restore in-memory data
    yt._channels_store = saved_channels_store
    yt._token_store = saved_token_store
    yt._creds_store = saved_creds_store
    ap.autopilot_manager.all_published_videos = saved_autopilot_videos
    ap.autopilot_manager.processed_video_ids = saved_autopilot_ids
    ap.autopilot_manager.recent_logs = saved_autopilot_logs
    ap.autopilot_manager.recent_errors = saved_autopilot_errors
    yt._init_channels_store()
    ap.autopilot_manager._load_state()
