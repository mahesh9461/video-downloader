import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import httpx

from app.config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    YOUTUBE_REDIRECT_URI,
    DOWNLOAD_DIR,
)

logger = logging.getLogger("video_downloader.youtube_publisher")

TOKEN_CACHE_FILE = Path("/tmp/youtube_auth_token.json")
CREDENTIALS_CACHE_FILE = Path("/tmp/youtube_oauth_credentials.json")

# Default ViceVerse GTA 6 YouTube Gaming Presets
DEFAULT_YOUTUBE_DESCRIPTION = (
    "Welcome to GTA World: ViceVerse — your daily hub for GTA 6 Shorts, live gameplay streams, "
    "hidden Leonida secrets, Vice City map discoveries, crazy physics tests, and launch-week moments with Jason and Lucia.\n\n"
    "Subscribe and turn on notifications so you never miss a daily Short or live stream!\n\n"
    "#GTA6 #GTAVI #Shorts #GTA6Shorts #GTA6Live #GTA6LiveStream #ViceCity #Leonida #GTA6Gameplay #GTA6Launch #GamingShorts #LiveGaming"
)

DEFAULT_YOUTUBE_TAGS = [
    "GTA 6", "GTA VI", "Grand Theft Auto 6", "GTA 6 Shorts", "ViceVerse",
    "GTA World ViceVerse", "ViceVerse GTA 6", "Vice City", "GTA 6 secrets",
    "GTA 6 gameplay", "GTA 6 Easter eggs", "GTA 6 clips", "GTA 6 physics",
    "GTA 6 map", "gaming Shorts", "gta6 gameplay", "gta6 lucia", "lucia gta6",
    "gta6 pc", "gta6 car", "gta6 woke", "illojuan gta6", "gta6 first mission",
    "gta6 on pc", "gya6 live", "gta6livestram", "Jason and Lucia GTA 6",
    "Jason GTA 6", "Boobie Ike GTA 6", "Brian Heder GTA 6", "Roxy GTA 6",
    "GTA 6 characters", "GTA 6 cast"
]

DEFAULT_YOUTUBE_CATEGORY_ID = "20"  # Gaming Category

# In-memory store fallback
_token_store: Dict[str, Any] = {}
_creds_store: Dict[str, str] = {}


def get_google_credentials() -> tuple[Optional[str], Optional[str]]:
    cid = _creds_store.get("client_id") or GOOGLE_CLIENT_ID or os.getenv("GOOGLE_CLIENT_ID")
    sec = _creds_store.get("client_secret") or GOOGLE_CLIENT_SECRET or os.getenv("GOOGLE_CLIENT_SECRET")
    if cid or sec:
        return cid, sec
    if CREDENTIALS_CACHE_FILE.exists():
        try:
            data = json.loads(CREDENTIALS_CACHE_FILE.read_text(encoding="utf-8"))
            return data.get("client_id"), data.get("client_secret")
        except Exception:
            pass
    return None, None


def save_google_credentials(client_id: str, client_secret: str) -> None:
    _creds_store["client_id"] = client_id.strip()
    _creds_store["client_secret"] = client_secret.strip()
    try:
        CREDENTIALS_CACHE_FILE.write_text(
            json.dumps({"client_id": client_id.strip(), "client_secret": client_secret.strip()}),
            encoding="utf-8",
        )
    except Exception as e:
        logger.warning("Failed to save credentials cache: %s", e)


def get_stored_token() -> Optional[str]:
    if "access_token" in _token_store and _token_store["access_token"]:
        return _token_store["access_token"]
    if TOKEN_CACHE_FILE.exists():
        try:
            data = json.loads(TOKEN_CACHE_FILE.read_text(encoding="utf-8"))
            _token_store.update(data)
            return data.get("access_token")
        except Exception as e:
            logger.warning("Failed to read token cache: %s", e)
    return None


def save_stored_token(token_data: Dict[str, Any]) -> None:
    _token_store.update(token_data)
    try:
        TOKEN_CACHE_FILE.write_text(json.dumps(_token_store), encoding="utf-8")
    except Exception as e:
        logger.warning("Failed to write token cache: %s", e)
    # Sync to Supabase in background if configured
    try:
        from app.supabase_client import save_youtube_tokens_supabase, is_supabase_configured
        if is_supabase_configured():
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(save_youtube_tokens_supabase(dict(_token_store)))
            except RuntimeError:
                pass
    except Exception:
        pass


def clear_stored_token() -> None:
    _token_store.clear()
    if TOKEN_CACHE_FILE.exists():
        try:
            TOKEN_CACHE_FILE.unlink()
        except Exception:
            pass


async def refresh_access_token() -> Optional[str]:
    """Refreshes the access token using the stored refresh_token if available."""
    client_id, client_secret = get_google_credentials()
    if not client_id or not client_secret:
        return None

    stored = {}
    if TOKEN_CACHE_FILE.exists():
        try:
            stored = json.loads(TOKEN_CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    refresh_tok = _token_store.get("refresh_token") or stored.get("refresh_token")
    if not refresh_tok:
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": refresh_tok,
                    "grant_type": "refresh_token",
                },
            )
            if res.status_code == 200:
                data = res.json()
                new_token = data.get("access_token")
                if new_token:
                    _token_store["access_token"] = new_token
                    if "refresh_token" not in data:
                        data["refresh_token"] = refresh_tok
                    save_stored_token(data)
                    logger.info("Successfully refreshed YouTube access token")
                    return new_token
    except Exception as e:
        logger.warning("Failed to refresh YouTube access token: %s", e)
    return None


def get_youtube_auth_url(state: Optional[str] = None) -> Optional[str]:
    """Generates the Google OAuth 2.0 authorization URL for YouTube upload."""
    client_id, _ = get_google_credentials()
    if not client_id:
        return None

    params = {
        "client_id": client_id,
        "redirect_uri": YOUTUBE_REDIRECT_URI,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
    }
    if state:
        params["state"] = state

    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


async def exchange_code_for_token(code: str) -> Dict[str, Any]:
    """Exchanges an authorization code for access and refresh tokens."""
    client_id, client_secret = get_google_credentials()
    if not client_id or not client_secret:
        raise ValueError("Google OAuth Client ID and Secret must be configured.")

    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": YOUTUBE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(token_url, data=payload)
        if res.status_code != 200:
            error_detail = res.text
            try:
                error_detail = res.json().get("error_description", res.text)
            except Exception:
                pass
            raise RuntimeError(f"Google OAuth token exchange failed: {error_detail}")

        data = res.json()
        save_stored_token(data)
        return data


async def get_channel_info(access_token: str) -> Dict[str, Any]:
    """Fetches the connected YouTube channel's title and ID with local caching and token auto-refresh."""
    cached_title = _token_store.get("channel_title")
    cached_id = _token_store.get("channel_id")
    if cached_title:
        return {
            "channel_title": cached_title,
            "channel_id": cached_id or "connected_account",
        }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(
                "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if res.status_code == 200:
                items = res.json().get("items", [])
                if items:
                    snippet = items[0].get("snippet", {})
                    info = {
                        "channel_title": snippet.get("title", "YouTube Channel"),
                        "channel_id": items[0].get("id", "channel_id"),
                        "thumbnail_url": snippet.get("thumbnails", {}).get("default", {}).get("url"),
                    }
                    _token_store["channel_title"] = info["channel_title"]
                    _token_store["channel_id"] = info["channel_id"]
                    save_stored_token(_token_store)
                    return info
            elif res.status_code == 401:
                # Access token expired; refresh using refresh_token
                new_tok = await refresh_access_token()
                if new_tok:
                    return await get_channel_info(new_tok)
    except Exception as e:
        logger.debug("Could not fetch channel info online: %s", e)

    # Return cached or default title so user stays persistently connected
    return {
        "channel_title": _token_store.get("channel_title") or "YouTube Channel",
        "channel_id": _token_store.get("channel_id") or "connected_account",
    }


async def get_youtube_status() -> Dict[str, Any]:
    """Returns whether YouTube publishing is configured and connected."""
    client_id, client_secret = get_google_credentials()
    configured = bool(client_id and client_secret)
    token = get_stored_token()

    # If not in local cache, attempt to restore from Supabase cloud database
    if not token:
        try:
            from app.supabase_client import get_youtube_tokens_supabase, is_supabase_configured
            if is_supabase_configured():
                cloud_tokens = await get_youtube_tokens_supabase()
                if cloud_tokens and cloud_tokens.get("access_token"):
                    save_stored_token(cloud_tokens)
                    token = cloud_tokens["access_token"]
        except Exception as e:
            logger.debug("Failed to restore token from Supabase: %s", e)

    connected = False
    channel_info = {}

    if token:
        try:
            channel_info = await get_channel_info(token)
            connected = True
        except Exception:
            connected = True
            channel_info = {"channel_title": "YouTube Channel"}

    auth_url = get_youtube_auth_url() if configured else None

    return {
        "configured": configured,
        "connected": connected,
        "channel_title": channel_info.get("channel_title") if connected else None,
        "channel_id": channel_info.get("channel_id") if connected else None,
        "auth_url": auth_url,
    }


async def publish_short_video(
    filename: str,
    title: str,
    description: str = "",
    tags: Optional[List[str]] = None,
    privacy: str = "public",
    access_token: Optional[str] = None,
) -> Dict[str, Any]:
    """Uploads a vertical short video to YouTube via Data API v3 Resumable Upload."""
    token = access_token or get_stored_token()
    if not token:
        token = await refresh_access_token()
    if not token:
        raise ValueError("No YouTube access token available. Please connect your YouTube channel or provide an access token.")

    video_path = DOWNLOAD_DIR / filename
    if not video_path.is_file():
        raise FileNotFoundError(f"Video file not found: {filename}")

    # Ensure #Shorts tag in title for YouTube algorithm discovery
    if "#shorts" not in title.lower():
        title = f"{title.strip()} #Shorts"

    file_size = video_path.stat().st_size

    # Step 1: Initiate resumable upload session
    init_url = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status"
    snippet: Dict[str, Any] = {
        "title": title[:100],  # YouTube title limit 100 chars
        "description": description.strip() if description and description.strip() else DEFAULT_YOUTUBE_DESCRIPTION,
        "tags": tags if tags else DEFAULT_YOUTUBE_TAGS,
        "categoryId": DEFAULT_YOUTUBE_CATEGORY_ID,  # 20 = Gaming
    }

    metadata = {
        "snippet": snippet,
        "status": {
            "privacyStatus": privacy if privacy in ["public", "unlisted", "private"] else "public",
            "selfDeclaredMadeForKids": False,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        init_res = await client.post(
            init_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": "video/mp4",
                "X-Upload-Content-Length": str(file_size),
            },
            json=metadata,
        )

        if init_res.status_code not in (200, 201):
            error_msg = init_res.text
            try:
                error_msg = init_res.json().get("error", {}).get("message", init_res.text)
            except Exception:
                pass
            raise RuntimeError(f"YouTube upload initiation failed ({init_res.status_code}): {error_msg}")

        upload_location = init_res.headers.get("Location")
        if not upload_location:
            raise RuntimeError("YouTube upload session missing Location header.")

        # Step 2: Upload video payload
        with open(video_path, "rb") as vf:
            video_content = vf.read()

        upload_res = await client.put(
            upload_location,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "video/mp4",
                "Content-Length": str(file_size),
            },
            content=video_content,
        )

        if upload_res.status_code not in (200, 201):
            raise RuntimeError(f"YouTube video upload failed ({upload_res.status_code}): {upload_res.text}")

        res_data = upload_res.json()
        video_id = res_data.get("id")
        if not video_id:
            raise RuntimeError(f"Invalid YouTube response missing video ID: {upload_res.text}")

        return {
            "video_id": video_id,
            "youtube_url": f"https://www.youtube.com/shorts/{video_id}",
            "title": title,
            "privacy": privacy,
            "status": "uploaded",
        }


async def set_video_thumbnail(
    video_id: str,
    thumbnail_path: str,
    access_token: Optional[str] = None,
) -> bool:
    """Sets/uploads a custom thumbnail for a YouTube video via Data API v3."""
    token = access_token or get_stored_token()
    if not token:
        token = await refresh_access_token()
    if not token:
        logger.info("Cannot set thumbnail: No YouTube access token available.")
        return False

    thumb_p = Path(thumbnail_path)
    if not thumb_p.is_file():
        logger.info("Cannot set thumbnail: file does not exist: %s", thumbnail_path)
        return False

    upload_url = f"https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId={video_id}"
    try:
        content = thumb_p.read_bytes()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                upload_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "image/jpeg",
                    "Content-Length": str(len(content)),
                },
                content=content,
            )
            if resp.status_code in (200, 201):
                logger.info("Successfully uploaded custom thumbnail for YouTube video %s", video_id)
                return True
            else:
                logger.info("YouTube thumbnail upload note (%d): %s", resp.status_code, resp.text)
                return False
    except Exception as err:
        logger.info("YouTube custom thumbnail upload skipped: %s", err)
        return False
