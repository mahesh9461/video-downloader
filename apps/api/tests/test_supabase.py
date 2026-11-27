"""
Unit tests for Supabase Database Client & PostgREST Synchronization.
"""

from unittest.mock import patch, AsyncMock, MagicMock
import pytest

from app.supabase_client import (
    is_supabase_configured,
    save_youtube_tokens_supabase,
    get_youtube_tokens_supabase,
    record_processed_source_supabase,
    get_processed_source_ids_supabase,
    sync_autopilot_batch_supabase,
    update_clip_status_supabase,
)


def test_is_supabase_configured_false_by_default(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    assert is_supabase_configured() is False


@pytest.mark.anyio
async def test_save_tokens_unconfigured_returns_false():
    with patch("app.supabase_client.is_supabase_configured", return_value=False):
        res = await save_youtube_tokens_supabase({"access_token": "test_tok"})
        assert res is False


@pytest.mark.anyio
@patch("httpx.AsyncClient.post")
async def test_save_tokens_success(mock_post):
    mock_resp = MagicMock()
    mock_resp.status_code = 201
    mock_post.return_value = mock_resp

    with patch("app.supabase_client.is_supabase_configured", return_value=True):
        res = await save_youtube_tokens_supabase({
            "access_token": "tok_123",
            "refresh_token": "ref_456",
            "channel_id": "ch_789",
            "channel_title": "ViceVerse",
        })
        assert res is True
        mock_post.assert_called_once()


@pytest.mark.anyio
@patch("httpx.AsyncClient.get")
async def test_get_tokens_success(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [
        {
            "access_token": "tok_recovered",
            "refresh_token": "ref_recovered",
            "channel_id": "ch_rec",
            "channel_title": "ViceVerse Channel",
        }
    ]
    mock_get.return_value = mock_resp

    with patch("app.supabase_client.is_supabase_configured", return_value=True):
        tokens = await get_youtube_tokens_supabase()
        assert tokens is not None
        assert tokens["access_token"] == "tok_recovered"
        assert tokens["channel_title"] == "ViceVerse Channel"


@pytest.mark.anyio
@patch("httpx.AsyncClient.get")
async def test_get_processed_source_ids(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [{"video_id": "vid_1"}, {"video_id": "vid_2"}]
    mock_get.return_value = mock_resp

    with patch("app.supabase_client.is_supabase_configured", return_value=True):
        ids = await get_processed_source_ids_supabase()
        assert ids == ["vid_1", "vid_2"]


@pytest.mark.anyio
@patch("httpx.AsyncClient.patch")
async def test_update_clip_status(mock_patch):
    mock_resp = MagicMock()
    mock_resp.status_code = 204
    mock_patch.return_value = mock_resp

    with patch("app.supabase_client.is_supabase_configured", return_value=True):
        res = await update_clip_status_supabase("clip_01", {"status": "published"})
        assert res is True
        mock_patch.assert_called_once()


@pytest.mark.anyio
@patch("httpx.AsyncClient.post")
async def test_save_user_channel_supabase_includes_game_title(mock_post):
    from app.supabase_client import save_user_channel_supabase
    mock_resp = MagicMock()
    mock_resp.status_code = 201
    mock_post.return_value = mock_resp

    with patch("app.supabase_client.is_supabase_configured", return_value=True):
        res = await save_user_channel_supabase({
            "channel_id": "UC_GTA_TEST",
            "channel_title": "GTA Hub",
            "category_id": "20",
            "game_title": "Grand Theft Auto VI",
            "description": "GTA 6 daily shorts",
            "tags": ["GTA 6", "Rockstar Games"],
        })
        assert res is True
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args.kwargs
        assert call_kwargs["json"]["game_title"] == "Grand Theft Auto VI"
        assert call_kwargs["json"]["category_id"] == "20"


@pytest.mark.anyio
async def test_run_auto_schema_migration_no_db_url(monkeypatch):
    from app.supabase_client import run_auto_schema_migration
    monkeypatch.delenv("DATABASE_URL", raising=False)
    res = await run_auto_schema_migration()
    assert res is False


@pytest.mark.anyio
async def test_run_auto_schema_migration_with_db_url_success(monkeypatch):
    from app.supabase_client import run_auto_schema_migration
    monkeypatch.setenv("DATABASE_URL", "postgresql://postgres:pass@localhost:5432/postgres")
    
    mock_conn = AsyncMock()
    mock_conn.execute.return_value = "CREATE TABLE"
    mock_conn.close.return_value = None

    with patch("asyncpg.connect", new_callable=AsyncMock, return_value=mock_conn):
        res = await run_auto_schema_migration()
        assert res is True
        mock_conn.execute.assert_called_once()
        executed_sql = mock_conn.execute.call_args[0][0]
        # Verify schema contains key tables and columns
        assert "user_global_settings" in executed_sql
        assert "game_title" in executed_sql
        assert "user_youtube_channels" in executed_sql
