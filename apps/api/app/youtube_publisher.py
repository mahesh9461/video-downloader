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
    if "access_token" in _token_store:
        return _token_store["access_token"]
    if TOKEN_CACHE_FILE.exists():
        try:
            data = json.loads(TOKEN_CACHE_FILE.read_text(encoding="utf-8"))
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


def clear_stored_token() -> None:
    _token_store.clear()
    if TOKEN_CACHE_FILE.exists():
        try:
            TOKEN_CACHE_FILE.unlink()
        except Exception:
            pass


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
    """Fetches the connected YouTube channel's title and ID."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(
            "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if res.status_code == 200:
            items = res.json().get("items", [])
            if items:
                snippet = items[0].get("snippet", {})
                return {
                    "channel_title": snippet.get("title"),
                    "channel_id": items[0].get("id"),
                    "thumbnail_url": snippet.get("thumbnails", {}).get("default", {}).get("url"),
                }
    return {}


async def get_youtube_status() -> Dict[str, Any]:
    """Returns whether YouTube publishing is configured and connected."""
    client_id, client_secret = get_google_credentials()
    configured = bool(client_id and client_secret)
    token = get_stored_token()
    connected = False
    channel_info = {}

    if token:
        try:
            channel_info = await get_channel_info(token)
            connected = bool(channel_info.get("channel_title") or channel_info.get("channel_id"))
        except Exception:
            connected = False

    auth_url = get_youtube_auth_url() if configured else None

    return {
        "configured": configured,
        "connected": connected,
        "channel_title": channel_info.get("channel_title"),
        "channel_id": channel_info.get("channel_id"),
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
        raise ValueError("No YouTube access token available. Please connect your YouTube channel or provide an access token.")

    video_path = DOWNLOAD_DIR / filename
    if not video_path.is_file():
        raise FileNotFoundError(f"Video file not found: {filename}")

    # Ensure #Shorts tag in title and description for YouTube algorithm discovery
    if "#shorts" not in title.lower():
        title = f"{title.strip()} #Shorts"

    if tags is None:
        tags = []
    if "Shorts" not in tags:
        tags.append("Shorts")
    if "viral" not in [t.lower() for t in tags]:
        tags.append("viral")

    file_size = video_path.stat().st_size

    # Step 1: Initiate resumable upload session
    init_url = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status"
    metadata = {
        "snippet": {
            "title": title[:100],  # YouTube title limit 100 chars
            "description": description or f"{title}\n\nCreated with Viral Clips Creator #Shorts",
            "tags": tags[:30],
            "categoryId": "22",  # People & Blogs
        },
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
