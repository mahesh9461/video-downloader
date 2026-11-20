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
