"""
Supabase REST & Realtime Database Adapter (PostgREST via HTTPX).

100% Free Tier, zero extra heavy dependencies.
Provides:
1. Persistent YouTube OAuth token storage across restarts and deployments.
2. Global viral video source deduplication.
3. 6-Short scheduled batch and clip queue synchronization.
4. Graceful local fallback if Supabase is not configured.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger("video_downloader.supabase")

def get_supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "").rstrip("/")


def get_supabase_key() -> str:
    return (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("SUPABASE_KEY", "")
    )


def is_supabase_configured() -> bool:
    """Returns True if valid Supabase URL and key are provided."""
    url = get_supabase_url()
    key = get_supabase_key()
    return bool(url and key and url.startswith("http"))


def _get_headers() -> Dict[str, str]:
    key = get_supabase_key()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


# ---------------------------------------------------------------------------
# 1. YouTube OAuth Token Persistence
# ---------------------------------------------------------------------------


async def save_youtube_tokens_supabase(tokens: Dict[str, Any]) -> bool:
    """Saves or updates YouTube OAuth tokens in Supabase."""
    if not is_supabase_configured():
        return False

    endpoint = f"{get_supabase_url()}/rest/v1/user_youtube_tokens"
    headers = _get_headers()
    headers["Prefer"] = "resolution=merge-duplicates"

    payload = {
        "id": "primary",
        "access_token": tokens.get("access_token") or tokens.get("token", ""),
        "refresh_token": tokens.get("refresh_token"),
        "channel_id": tokens.get("channel_id"),
        "channel_title": tokens.get("channel_title"),
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            if resp.status_code in (200, 201):
                logger.info("Successfully synced YouTube tokens to Supabase.")
                return True
            logger.warning("Supabase token sync returned status %d: %s", resp.status_code, resp.text)
    except Exception as e:
        logger.debug("Supabase token sync skipped: %s", e)
    return False


async def get_youtube_tokens_supabase() -> Optional[Dict[str, Any]]:
    """Retrieves stored YouTube OAuth tokens from Supabase."""
    if not is_supabase_configured():
        return None

    endpoint = f"{get_supabase_url()}/rest/v1/user_youtube_tokens?id=eq.primary&select=*"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(endpoint, headers=_get_headers())
            if resp.status_code == 200:
                rows = resp.json()
                if rows and len(rows) > 0:
                    row = rows[0]
                    return {
                        "access_token": row.get("access_token"),
                        "token": row.get("access_token"),
                        "refresh_token": row.get("refresh_token"),
                        "channel_id": row.get("channel_id"),
                        "channel_title": row.get("channel_title"),
                    }
    except Exception as e:
        logger.debug("Supabase token fetch skipped: %s", e)
    return None


# ---------------------------------------------------------------------------
# 2. Viral Video Source Deduplication
# ---------------------------------------------------------------------------


async def record_processed_source_supabase(video_info: Dict[str, Any]) -> bool:
    """Records a processed video to prevent duplicate clipping."""
    if not is_supabase_configured():
        return False

    endpoint = f"{get_supabase_url()}/rest/v1/autopilot_sources"
    headers = _get_headers()
    headers["Prefer"] = "resolution=merge-duplicates"

    payload = {
        "video_id": video_info["id"],
        "title": video_info.get("title", ""),
        "duration": int(video_info.get("duration", 0)),
        "view_count": int(video_info.get("view_count", 0)),
        "thumbnail_url": video_info.get("thumbnail"),
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            return resp.status_code in (200, 201)
    except Exception as e:
        logger.debug("Supabase source record skipped: %s", e)
    return False


async def get_processed_source_ids_supabase() -> List[str]:
    """Retrieves list of all previously processed video IDs."""
    if not is_supabase_configured():
        return []

    endpoint = f"{get_supabase_url()}/rest/v1/autopilot_sources?select=video_id"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(endpoint, headers=_get_headers())
            if resp.status_code == 200:
                return [row["video_id"] for row in resp.json() if "video_id" in row]
    except Exception as e:
        logger.debug("Supabase sources fetch skipped: %s", e)
    return []


# ---------------------------------------------------------------------------
# 3. Scheduled Batches & Clip Queue Sync
# ---------------------------------------------------------------------------


async def sync_autopilot_batch_supabase(batch_dict: Dict[str, Any]) -> bool:
    """Syncs a 6-clip daily batch to Supabase."""
    if not is_supabase_configured():
        return False

    batch_endpoint = f"{get_supabase_url()}/rest/v1/autopilot_batches"
    clips_endpoint = f"{get_supabase_url()}/rest/v1/autopilot_clips"
    headers = _get_headers()
    headers["Prefer"] = "resolution=merge-duplicates"

    batch_payload = {
        "id": batch_dict["batch_id"],
        "source_video_id": batch_dict["source_video_id"],
        "source_title": batch_dict["source_title"],
        "source_url": batch_dict["source_url"],
        "status": batch_dict.get("status", "queued"),
    }

    clips_payload = []
    for c in batch_dict.get("clips", []):
        clips_payload.append({
            "id": c["id"],
            "batch_id": batch_dict["batch_id"],
            "source_video_id": c.get("source_video_id"),
            "source_title": c.get("source_title"),
            "clip_index": c["clip_index"],
            "start_time": c["start_time"],
            "end_time": c["end_time"],
            "duration": c["duration"],
            "hook_title": c["hook_title"],
            "hook_style": c.get("hook_style", "hormozi_bold"),
            "progress_bar_color": c.get("progress_bar_color", "yellow"),
            "layout": c.get("layout", "center_crop"),
            "background_music": c.get("background_music", "none"),
            "filename": c.get("filename"),
            "scheduled_time": c.get("scheduled_time"),
            "status": c.get("status", "queued"),
            "youtube_video_id": c.get("youtube_video_id"),
            "youtube_url": c.get("youtube_url"),
        })

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(batch_endpoint, headers=headers, json=batch_payload)
            if clips_payload:
                await client.post(clips_endpoint, headers=headers, json=clips_payload)
            logger.info("Successfully synced 6-Short batch %s to Supabase.", batch_dict["batch_id"])
            return True
    except Exception as e:
        logger.debug("Supabase batch sync skipped: %s", e)
    return False


async def update_clip_status_supabase(clip_id: str, updates: Dict[str, Any]) -> bool:
    """Updates status, YouTube URL, and published timestamp of a Short in Supabase."""
    if not is_supabase_configured():
        return False

    endpoint = f"{get_supabase_url()}/rest/v1/autopilot_clips?id=eq.{clip_id}"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.patch(endpoint, headers=_get_headers(), json=updates)
            return resp.status_code in (200, 204)
    except Exception as e:
        logger.debug("Supabase clip update skipped: %s", e)
    return False


# ---------------------------------------------------------------------------
# 4. Multi-Channel YouTube Support in Supabase
# ---------------------------------------------------------------------------


async def save_user_channel_supabase(channel_data: Dict[str, Any], user_id: str = "primary") -> bool:
    """Saves or updates a YouTube channel for a user in Supabase."""
    if not is_supabase_configured():
        return False

    endpoint = f"{get_supabase_url()}/rest/v1/user_youtube_channels"
    headers = _get_headers()
    headers["Prefer"] = "resolution=merge-duplicates"

    chan_id = channel_data.get("channel_id") or "primary"
    record_id = f"{user_id}_{chan_id}"

    payload = {
        "id": record_id,
        "user_id": user_id,
        "channel_id": chan_id,
        "channel_title": channel_data.get("channel_title", "YouTube Channel"),
        "thumbnail_url": channel_data.get("thumbnail_url"),
        "access_token": channel_data.get("access_token", ""),
        "refresh_token": channel_data.get("refresh_token"),
        "expires_at": channel_data.get("expires_at"),
        "is_default": bool(channel_data.get("is_default", False)),
    }
    for field in ("description", "tags", "category_id", "category_name", "made_for_kids", "ai_generated", "paid_promotion", "game_title"):
        if field in channel_data and channel_data[field] is not None:
            payload[field] = channel_data[field]

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            return resp.status_code in (200, 201)
    except Exception as e:
        logger.debug("Supabase user channel save skipped: %s", e)
    return False


async def get_user_channels_supabase(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves all connected YouTube channels for a user from Supabase."""
    if not is_supabase_configured():
        return []

    url = f"{get_supabase_url()}/rest/v1/user_youtube_channels?select=*"
    if user_id:
        url += f"&user_id=eq.{user_id}"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers=_get_headers())
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.debug("Supabase user channels fetch skipped: %s", e)
    return []


async def delete_user_channel_supabase(channel_id: str, user_id: Optional[str] = None) -> bool:
    """Deletes a YouTube channel connection from Supabase."""
    if not is_supabase_configured():
        return False

    url = f"{get_supabase_url()}/rest/v1/user_youtube_channels?channel_id=eq.{channel_id}"
    if user_id:
        url += f"&user_id=eq.{user_id}"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.delete(url, headers=_get_headers())
            return resp.status_code in (200, 204)
    except Exception as e:
        logger.debug("Supabase user channel delete skipped: %s", e)
    return False


# ---------------------------------------------------------------------------
# 5. User-Specific Download History in Supabase
# ---------------------------------------------------------------------------


async def save_download_history_supabase(item: Dict[str, Any], user_id: Optional[str] = None) -> bool:
    """Records a completed download in Supabase specific to the user."""
    if not is_supabase_configured():
        return False

    endpoint = f"{get_supabase_url()}/rest/v1/download_history"
    headers = _get_headers()

    payload = {
        "platform": item.get("platform", "unknown"),
        "title": item.get("title", "Video"),
        "thumbnail": item.get("thumbnail"),
        "creator": item.get("creator"),
        "format": item.get("format"),
        "filesize": item.get("filesize"),
    }
    if user_id:
        payload["user_id"] = user_id

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            return resp.status_code in (200, 201)
    except Exception as e:
        logger.debug("Supabase download history save skipped: %s", e)
    return False


async def get_download_history_supabase(user_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves download history from Supabase, filtered by user if authenticated."""
    if not is_supabase_configured():
        return []

    url = f"{get_supabase_url()}/rest/v1/download_history?select=*&order=downloaded_at.desc&limit={limit}"
    if user_id:
        url += f"&user_id=eq.{user_id}"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers=_get_headers())
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.debug("Supabase download history fetch skipped: %s", e)
    return []


# ---------------------------------------------------------------------------
# 6. Global Customization Settings in Supabase
# ---------------------------------------------------------------------------

async def save_global_settings_supabase(settings_dict: Dict[str, Any], user_id: str = "default") -> bool:
    """Saves or updates global customization settings in Supabase."""
    if not is_supabase_configured():
        return False

    endpoint = f"{get_supabase_url()}/rest/v1/user_global_settings"
    headers = _get_headers()
    headers["Prefer"] = "resolution=merge-duplicates"

    payload = {
        "user_id": user_id,
        "settings": settings_dict,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            return resp.status_code in (200, 201)
    except Exception as e:
        logger.debug("Supabase global settings save skipped: %s", e)
    return False


async def get_global_settings_supabase(user_id: str = "default") -> Optional[Dict[str, Any]]:
    """Retrieves global customization settings from Supabase."""
    if not is_supabase_configured():
        return None

    url = f"{get_supabase_url()}/rest/v1/user_global_settings?user_id=eq.{user_id}&select=settings"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers=_get_headers())
            if resp.status_code == 200:
                rows = resp.json()
                if rows and len(rows) > 0 and "settings" in rows[0]:
                    return rows[0]["settings"]
    except Exception as e:
        logger.debug("Supabase global settings fetch skipped: %s", e)
    return None


# ---------------------------------------------------------------------------
# 7. Automated Schema Migration Execution
# ---------------------------------------------------------------------------

async def run_auto_schema_migration() -> bool:
    """Automatically synchronizes database schema with Supabase via DATABASE_URL.
    
    Executes idempotent DDL migrations (table creation and column additions)
    in the background on server boot, eliminating the need to manually run SQL scripts.
    """
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        return False

    try:
        from pathlib import Path
        import asyncpg

        # Find supabase_schema.sql
        repo_root = Path(__file__).resolve().parents[3]
        schema_file = repo_root / "supabase_schema.sql"
        if not schema_file.exists():
            schema_file = Path(__file__).resolve().parent.parent.parent / "supabase_schema.sql"

        if not schema_file.exists():
            logger.debug("supabase_schema.sql not found at %s", schema_file)
            return False

        sql = schema_file.read_text(encoding="utf-8")
        conn = await asyncpg.connect(db_url, statement_cache_size=0, ssl="require", timeout=12)
        try:
            await conn.execute(sql)
            logger.info("✅ Supabase schema automatically migrated & verified!")
            return True
        finally:
            await conn.close()
    except Exception as e:
        logger.warning("Supabase auto-migration notice: %s", e)
        return False


