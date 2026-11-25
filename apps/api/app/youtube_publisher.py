import json
import logging
import os
import secrets
import time
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
    "🎮 Game: Grand Theft Auto VI (Rockstar Games)\n\n"
    "#GTA6 #GTAVI #Shorts #GTA6Shorts #GTA6Live #GTA6LiveStream #ViceCity #Leonida #GTA6Gameplay #GTA6Launch #GamingShorts #LiveGaming"
)

DEFAULT_YOUTUBE_TAGS = [
    "GTA 6", "GTA VI", "Grand Theft Auto VI", "Grand Theft Auto 6", "Rockstar Games", "GTA 6 Shorts", "ViceVerse",
    "GTA World ViceVerse", "ViceVerse GTA 6", "Vice City", "GTA 6 secrets",
    "GTA 6 gameplay", "GTA 6 Easter eggs", "GTA 6 clips", "GTA 6 physics",
    "GTA 6 map", "gaming Shorts", "gta6 gameplay", "gta6 lucia", "lucia gta6",
    "gta6 pc", "gta6 car", "gta6 woke", "illojuan gta6", "gta6 first mission",
    "gta6 on pc", "gya6 live", "gta6livestram", "Jason and Lucia GTA 6",
    "Jason GTA 6", "Boobie Ike GTA 6", "Brian Heder GTA 6", "Roxy GTA 6",
    "GTA 6 characters", "GTA 6 cast", "Grand Theft Auto"
]

DEFAULT_YOUTUBE_CATEGORY_ID = "20"  # Gaming Category

# Default Pipsy Pop Kids & Nursery Rhymes Presets
PIPSY_POP_CHANNEL_ID = "UCgwgp-cWzUEi4Vw-7mRSfOw"
PIPSY_POP_DESCRIPTION = (
    "Join Mother Duck and her cute little ducklings on a fun swimming adventure! Sing and count along with this classic Five Little Ducks nursery rhyme, perfect for babies, toddlers, and preschoolers.\n\n"
    "🔔 Subscribe to Pipsy Pop for more fun nursery rhymes, counting songs, and kid-friendly cartoons!\n\n"
    "#FiveLittleDucks #NurseryRhymes #KidsSongs #PipsyPop #ToddlerSongs #CartoonsForKids #CountingSongs"
)

PIPSY_POP_TAGS = [
    "Five Little Ducks", "Five Little Ducks Went Swimming One Day", "nursery rhymes",
    "kids songs", "Pipsy Pop", "PipsyPop", "toddler songs", "cartoons for kids",
    "counting songs", "baby songs", "children songs", "preschool songs",
    "rhymes for children", "kindergarten songs", "duck song", "sing along",
    "kids animation", "educational songs", "fun kids videos", "Mother Duck",
    "ducklings", "Mother Duck and her cute little ducklings", "classic Five Little Ducks",
    "songs for babies", "learning songs"
]

PIPSY_POP_CATEGORY_ID = "1"  # Film & Animation Category

# Multi-channel persistent cache file and store
CHANNELS_CACHE_FILE = Path(__file__).resolve().parent.parent / "data" / "youtube_channels.json"
_channels_store: Dict[str, Any] = {"channels": {}, "active_channel_id": None}

# Legacy in-memory store maintained strictly for backward compatibility
_token_store: Dict[str, Any] = {}
_creds_store: Dict[str, str] = {}


def _init_channels_store():
    global _channels_store
    CHANNELS_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    if CHANNELS_CACHE_FILE.exists():
        try:
            _channels_store = json.loads(CHANNELS_CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            _channels_store = {"channels": {}, "active_channel_id": None}


_init_channels_store()


def _save_channels_store():
    try:
        CHANNELS_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        CHANNELS_CACHE_FILE.write_text(json.dumps(_channels_store, indent=2), encoding="utf-8")
    except Exception as e:
        logger.warning("Failed to save channels cache: %s", e)


# Standard YouTube Categories
YOUTUBE_CATEGORIES: Dict[str, str] = {
    "1": "Film & Animation",
    "2": "Autos & Vehicles",
    "10": "Music",
    "15": "Pets & Animals",
    "17": "Sports",
    "19": "Travel & Events",
    "20": "Gaming",
    "22": "People & Blogs",
    "23": "Comedy",
    "24": "Entertainment",
    "25": "News & Politics",
    "26": "Howto & Style",
    "27": "Education",
    "28": "Science & Technology",
    "29": "Nonprofits & Activism",
}


def get_channel_preset(channel_id: Optional[str] = None, channel_title: Optional[str] = None) -> Dict[str, Any]:
    """Returns the channel-specific metadata preset (description, tags, category, audience)."""
    channels_map = _channels_store.get("channels", {})
    target_ch = None
    if channel_id and channel_id in channels_map:
        target_ch = channels_map[channel_id]
    elif not channel_id:
        active_id = _channels_store.get("active_channel_id")
        if active_id and active_id in channels_map:
            target_ch = channels_map[active_id]

    c_title = (channel_title or (target_ch.get("channel_title") if target_ch else "")).lower()
    cid = channel_id or (target_ch.get("channel_id") if target_ch else "")

    # If the channel specifically has saved custom settings, use them!
    if target_ch and any(target_ch.get(k) is not None for k in ("description", "tags", "category_id", "made_for_kids", "game_title")):
        cat_id = str(target_ch.get("category_id") or ("1" if cid == PIPSY_POP_CHANNEL_ID else "20"))
        cat_name = target_ch.get("category_name") or YOUTUBE_CATEGORIES.get(cat_id, "Entertainment")
        desc = target_ch.get("description")
        if desc is None:
            desc = PIPSY_POP_DESCRIPTION if (cid == PIPSY_POP_CHANNEL_ID or "pipsy" in c_title) else DEFAULT_YOUTUBE_DESCRIPTION
        tags = target_ch.get("tags")
        if tags is None:
            tags = PIPSY_POP_TAGS if (cid == PIPSY_POP_CHANNEL_ID or "pipsy" in c_title) else DEFAULT_YOUTUBE_TAGS
        mfk = target_ch.get("made_for_kids")
        if mfk is None:
            mfk = True if (cid == PIPSY_POP_CHANNEL_ID or "pipsy" in c_title) else False
        game_title = target_ch.get("game_title")
        if game_title is None and (cat_id == "20" or "gta" in c_title or "vice" in c_title):
            game_title = "Grand Theft Auto VI"

        return {
            "channel_id": cid,
            "channel_title": target_ch.get("channel_title") or ("Pipsy Pop" if cid == PIPSY_POP_CHANNEL_ID else "YouTube Channel"),
            "description": desc,
            "tags": tags,
            "categoryId": cat_id,
            "category_name": cat_name,
            "game_title": game_title,
            "selfDeclaredMadeForKids": bool(mfk),
            "containsSyntheticMedia": bool(target_ch.get("ai_generated", False)),
            "paidProductPlacement": bool(target_ch.get("paid_promotion", False)),
        }

    if cid == PIPSY_POP_CHANNEL_ID or "pipsy" in c_title or "pop" in c_title:
        return {
            "channel_id": PIPSY_POP_CHANNEL_ID,
            "channel_title": "Pipsy Pop",
            "description": PIPSY_POP_DESCRIPTION,
            "tags": PIPSY_POP_TAGS,
            "categoryId": PIPSY_POP_CATEGORY_ID,
            "category_name": "Film & Animation",
            "game_title": None,
            "selfDeclaredMadeForKids": True,
            "containsSyntheticMedia": False,
            "paidProductPlacement": False,
        }

    # Default: ViceVerse GTA 6 Gaming
    return {
        "channel_id": "UC8wRcCQSvwn7Qf6BMxiUl4Q",
        "channel_title": "GTA World: ViceVerse",
        "description": DEFAULT_YOUTUBE_DESCRIPTION,
        "tags": DEFAULT_YOUTUBE_TAGS,
        "categoryId": DEFAULT_YOUTUBE_CATEGORY_ID,
        "category_name": "Gaming",
        "game_title": "Grand Theft Auto VI",
        "selfDeclaredMadeForKids": False,
        "containsSyntheticMedia": False,
        "paidProductPlacement": False,
    }


def get_user_channels(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns list of connected YouTube channels for user, including token validity and channel presets."""
    channels_map = _channels_store.get("channels", {})
    active_id = _channels_store.get("active_channel_id")

    # If no channels in store, but legacy _token_store has a channel, bridge it
    if not channels_map and _token_store.get("channel_id"):
        cid = _token_store.get("channel_id")
        channels_map[cid] = {
            "id": cid,
            "channel_id": cid,
            "channel_title": _token_store.get("channel_title") or "YouTube Channel",
            "thumbnail_url": _token_store.get("thumbnail_url"),
            "access_token": _token_store.get("access_token"),
            "refresh_token": _token_store.get("refresh_token"),
            "expires_at": time.time() + 3600,
            "is_default": True,
            "user_id": user_id or "default",
        }
        _channels_store["active_channel_id"] = cid

    results = []
    for cid, ch in channels_map.items():
        if user_id and ch.get("user_id") and ch.get("user_id") not in (user_id, "default"):
            continue
        is_def = (cid == active_id) or ch.get("is_default", False)

        # Check token validity
        exp = ch.get("expires_at")
        has_ref = bool(ch.get("refresh_token"))
        has_tok = bool(ch.get("access_token"))
        token_valid = (exp is not None and time.time() < (float(exp) - 60)) or has_ref or has_tok

        preset = get_channel_preset(cid, ch.get("channel_title"))

        results.append({
            "id": cid,
            "channel_id": ch.get("channel_id", cid),
            "channel_title": ch.get("channel_title", "YouTube Channel"),
            "thumbnail_url": ch.get("thumbnail_url"),
            "is_default": is_def,
            "token_valid": token_valid,
            "refresh_token": ch.get("refresh_token"),
            "user_id": ch.get("user_id", user_id),
            "connected_at": ch.get("connected_at"),
            "description": ch.get("description") or preset["description"],
            "tags": ch.get("tags") or preset["tags"],
            "category_id": ch.get("category_id") or preset["categoryId"],
            "category_name": ch.get("category_name") or preset["category_name"],
            "game_title": ch.get("game_title") if "game_title" in ch else preset.get("game_title"),
            "made_for_kids": ch.get("made_for_kids") if "made_for_kids" in ch else preset["selfDeclaredMadeForKids"],
            "ai_generated": ch.get("ai_generated") if "ai_generated" in ch else preset["containsSyntheticMedia"],
            "paid_promotion": ch.get("paid_promotion") if "paid_promotion" in ch else preset["paidProductPlacement"],
        })
    return results


def save_user_channel(channel_data: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
    """Saves or updates a channel in multi-channel storage with its own tokens and expires_at.
    
    Never replaces an existing channel's refresh_token with None or empty.
    """
    cid = channel_data.get("channel_id") or channel_data.get("id")
    if not cid:
        raise ValueError("channel_id is required to save a YouTube channel")

    channels_map = _channels_store.setdefault("channels", {})
    existing = channels_map.get(cid)

    # Never replace existing refresh_token with None/empty
    refresh_tok = channel_data.get("refresh_token")
    if not refresh_tok and existing and existing.get("refresh_token"):
        refresh_tok = existing.get("refresh_token")

    expires_at = channel_data.get("expires_at")
    if not expires_at and existing and existing.get("expires_at"):
        expires_at = existing.get("expires_at")
    if not expires_at:
        expires_at = time.time() + 3600

    if user_id and user_id != "default":
        user_channels = [c for c in channels_map.values() if c.get("user_id") == user_id]
    else:
        user_channels = [c for c in channels_map.values() if not c.get("user_id") or c.get("user_id") == "default"]

    is_first = len(user_channels) == 0
    is_def = channel_data.get("is_default")
    if is_def is None:
        is_def = is_first or (existing.get("is_default", False) if existing else False)

    rec = {
        "id": cid,
        "channel_id": cid,
        "channel_title": channel_data.get("channel_title") or (existing.get("channel_title") if existing else "YouTube Channel"),
        "thumbnail_url": channel_data.get("thumbnail_url") or (existing.get("thumbnail_url") if existing else None),
        "access_token": channel_data.get("access_token", ""),
        "refresh_token": refresh_tok,
        "expires_at": float(expires_at),
        "is_default": bool(is_def),
        "user_id": user_id or channel_data.get("user_id") or "default",
        "connected_at": channel_data.get("connected_at") or (existing.get("connected_at") if existing else time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
    }

    # Preserve custom channel metadata presets if present
    for field in ("description", "tags", "category_id", "category_name", "made_for_kids", "ai_generated", "paid_promotion", "game_title"):
        if field in channel_data and channel_data[field] is not None:
            rec[field] = channel_data[field]
        elif existing and field in existing and existing[field] is not None:
            rec[field] = existing[field]

    channels_map[cid] = rec

    if is_def or not _channels_store.get("active_channel_id"):
        _channels_store["active_channel_id"] = cid

    _save_channels_store()

    # Only sync to legacy _token_store if this is the active channel
    if _channels_store.get("active_channel_id") == cid:
        _token_store["access_token"] = rec["access_token"]
        if rec.get("refresh_token"):
            _token_store["refresh_token"] = rec["refresh_token"]
        _token_store["channel_id"] = cid
        _token_store["channel_title"] = rec["channel_title"]
        _token_store["thumbnail_url"] = rec["thumbnail_url"]
        save_stored_token(_token_store)

    # Sync to Supabase table user_youtube_channels in background if configured
    try:
        from app.supabase_client import save_user_channel_supabase, is_supabase_configured
        if is_supabase_configured():
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(save_user_channel_supabase(rec, user_id=rec["user_id"]))
            except RuntimeError:
                pass
    except Exception:
        pass

    return rec


def set_active_channel_id(channel_id: str, user_id: Optional[str] = None) -> bool:
    """Sets a channel as active and default without modifying other channels' tokens."""
    channels_map = _channels_store.get("channels", {})
    if channel_id in channels_map:
        _channels_store["active_channel_id"] = channel_id
        for cid, ch in channels_map.items():
            ch["is_default"] = (cid == channel_id)
        _save_channels_store()

        target = channels_map[channel_id]
        _token_store["access_token"] = target.get("access_token")
        if target.get("refresh_token"):
            _token_store["refresh_token"] = target["refresh_token"]
        _token_store["channel_id"] = channel_id
        _token_store["channel_title"] = target.get("channel_title")
        _token_store["thumbnail_url"] = target.get("thumbnail_url")
        save_stored_token(_token_store)
        return True
    return False


def delete_user_channel(channel_id: str, user_id: Optional[str] = None) -> bool:
    """Deletes a channel connection. If active was deleted, promotes the next channel to active."""
    channels_map = _channels_store.get("channels", {})
    if channel_id in channels_map:
        del channels_map[channel_id]
        if _channels_store.get("active_channel_id") == channel_id:
            next_active = next(iter(channels_map.keys())) if channels_map else None
            _channels_store["active_channel_id"] = next_active
            if next_active and next_active in channels_map:
                channels_map[next_active]["is_default"] = True
                target = channels_map[next_active]
                _token_store["access_token"] = target.get("access_token")
                if target.get("refresh_token"):
                    _token_store["refresh_token"] = target["refresh_token"]
                _token_store["channel_id"] = next_active
                _token_store["channel_title"] = target.get("channel_title")
                _token_store["thumbnail_url"] = target.get("thumbnail_url")
                save_stored_token(_token_store)
            else:
                _token_store.clear()
        _save_channels_store()

        try:
            from app.supabase_client import delete_user_channel_supabase, is_supabase_configured
            if is_supabase_configured():
                import asyncio
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(delete_user_channel_supabase(channel_id, user_id=user_id or "default"))
                except RuntimeError:
                    pass
        except Exception:
            pass
        return True
    return False


def update_channel_settings(
    channel_id: str,
    settings: Dict[str, Any],
    user_id: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Updates custom default metadata (description, tags, category, audience) for a specific channel."""
    channels_map = _channels_store.setdefault("channels", {})
    if channel_id not in channels_map:
        return None
    ch = channels_map[channel_id]

    if "description" in settings and settings["description"] is not None:
        ch["description"] = str(settings["description"]).strip()

    if "tags" in settings and settings["tags"] is not None:
        raw_tags = settings["tags"]
        if isinstance(raw_tags, str):
            raw_tags = [t.strip() for t in raw_tags.split(",") if t.strip()]
        cleaned_tags = []
        seen = set()
        for t in raw_tags:
            tag_str = str(t).strip().lstrip("#").strip()
            if tag_str and tag_str.lower() not in seen:
                seen.add(tag_str.lower())
                cleaned_tags.append(tag_str)
        ch["tags"] = cleaned_tags

    if "category_id" in settings and settings["category_id"] is not None:
        cat_id = str(settings["category_id"]).strip()
        ch["category_id"] = cat_id
        ch["category_name"] = settings.get("category_name") or YOUTUBE_CATEGORIES.get(cat_id, "Entertainment")

    if "made_for_kids" in settings and settings["made_for_kids"] is not None:
        ch["made_for_kids"] = bool(settings["made_for_kids"])

    if "ai_generated" in settings and settings["ai_generated"] is not None:
        ch["ai_generated"] = bool(settings["ai_generated"])

    if "paid_promotion" in settings and settings["paid_promotion"] is not None:
        ch["paid_promotion"] = bool(settings["paid_promotion"])

    if "game_title" in settings:
        ch["game_title"] = str(settings["game_title"]).strip() if settings["game_title"] else None

    _save_channels_store()

    preset = get_channel_preset(channel_id, ch.get("channel_title"))
    return {
        "id": channel_id,
        "channel_id": channel_id,
        "channel_title": ch.get("channel_title", "YouTube Channel"),
        "thumbnail_url": ch.get("thumbnail_url"),
        "is_default": (channel_id == _channels_store.get("active_channel_id")),
        "user_id": ch.get("user_id", user_id or "default"),
        "connected_at": ch.get("connected_at"),
        "description": ch.get("description") or preset["description"],
        "tags": ch.get("tags") or preset["tags"],
        "category_id": ch.get("category_id") or preset["categoryId"],
        "category_name": ch.get("category_name") or preset["category_name"],
        "game_title": ch.get("game_title") if "game_title" in ch else preset.get("game_title"),
        "made_for_kids": ch.get("made_for_kids") if "made_for_kids" in ch else preset["selfDeclaredMadeForKids"],
        "ai_generated": ch.get("ai_generated") if "ai_generated" in ch else preset["containsSyntheticMedia"],
        "paid_promotion": ch.get("paid_promotion") if "paid_promotion" in ch else preset["paidProductPlacement"],
    }


def get_channel_token(channel_id: Optional[str] = None, user_id: Optional[str] = None) -> Optional[str]:
    """Retrieves access token for a specific channel or active channel."""
    channels_map = _channels_store.get("channels", {})
    target_id = channel_id or _channels_store.get("active_channel_id")
    if target_id and target_id in channels_map:
        tok = channels_map[target_id].get("access_token")
        if tok:
            return tok
    return get_stored_token()


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
    _channels_store.clear()
    _channels_store["channels"] = {}
    _channels_store["active_channel_id"] = None
    if TOKEN_CACHE_FILE.exists():
        try:
            TOKEN_CACHE_FILE.unlink()
        except Exception:
            pass
    if CHANNELS_CACHE_FILE.exists():
        try:
            CHANNELS_CACHE_FILE.unlink()
        except Exception:
            pass


async def refresh_access_token(channel_id: Optional[str] = None) -> Optional[str]:
    """Refreshes the access token using THAT channel's refresh_token.
    
    Falls back to active channel when channel_id is None.
    Updates only that channel's entry in _channels_store (access_token + expires_at).
    """
    client_id, client_secret = get_google_credentials()
    if not client_id or not client_secret:
        return None

    target_id = channel_id or _channels_store.get("active_channel_id")
    channels_map = _channels_store.get("channels", {})
    channel_rec = channels_map.get(target_id) if target_id else None

    refresh_tok = None
    if channel_rec and channel_rec.get("refresh_token"):
        refresh_tok = channel_rec.get("refresh_token")
    elif not channels_map:
        refresh_tok = _token_store.get("refresh_token")
        if not refresh_tok and TOKEN_CACHE_FILE.exists():
            try:
                stored = json.loads(TOKEN_CACHE_FILE.read_text(encoding="utf-8"))
                refresh_tok = stored.get("refresh_token")
            except Exception:
                pass

    if not refresh_tok:
        logger.warning("No refresh_token available to refresh channel: %s", target_id)
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
                    expires_in = data.get("expires_in", 3600)
                    try:
                        expires_at = time.time() + float(expires_in)
                    except Exception:
                        expires_at = time.time() + 3600

                    # Update only this channel's record in storage
                    if channel_rec and target_id in channels_map:
                        channel_rec["access_token"] = new_token
                        channel_rec["expires_at"] = expires_at
                        if data.get("refresh_token"):
                            channel_rec["refresh_token"] = data["refresh_token"]
                        _save_channels_store()

                    # Keep legacy _token_store in sync only if this is the active channel
                    if target_id == _channels_store.get("active_channel_id") or not channels_map:
                        _token_store["access_token"] = new_token
                        if data.get("refresh_token"):
                            _token_store["refresh_token"] = data["refresh_token"]
                        save_stored_token(_token_store)

                    logger.info("Successfully refreshed YouTube access token for channel %s", target_id)
                    return new_token
            else:
                logger.warning("Google refresh token response (%d): %s", res.status_code, res.text)
    except Exception as e:
        logger.warning("Failed to refresh YouTube access token: %s", e)
    return None


async def get_valid_channel_token(channel_id: Optional[str] = None) -> Optional[str]:
    """Returns the channel's access token, automatically refreshing it if it expires within 60s."""
    target_id = channel_id or _channels_store.get("active_channel_id")
    channels_map = _channels_store.get("channels", {})
    channel_rec = channels_map.get(target_id) if target_id else None

    if channel_rec:
        expires_at = channel_rec.get("expires_at")
        access_token = channel_rec.get("access_token")

        needs_refresh = (not access_token) or (expires_at is not None and time.time() >= (float(expires_at) - 60))
        if needs_refresh and channel_rec.get("refresh_token"):
            refreshed = await refresh_access_token(channel_id=target_id)
            if refreshed:
                return refreshed

        if access_token:
            return access_token

    return get_channel_token(channel_id)


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
        "prompt": "select_account consent",
        "include_granted_scopes": "false",
    }
    if state:
        params["state"] = state

    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


async def fetch_channel_info_live(access_token: str) -> Dict[str, Any]:
    """Calls YouTube Data API channels endpoint directly with NO cache lookup.
    
    Raises RuntimeError on failure or if no YouTube channel is found.
    Never invents fake IDs.
    """
    if not access_token:
        raise ValueError("access_token is required to fetch channel info live")

    url = "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true"
    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.get(url, headers=headers)
        except Exception as e:
            raise RuntimeError(f"Failed to connect to YouTube Data API: {e}")

        if res.status_code != 200:
            err_msg = res.text
            try:
                err_msg = res.json().get("error", {}).get("message", res.text)
            except Exception:
                pass
            raise RuntimeError(f"YouTube channel lookup failed ({res.status_code}): {err_msg}")

        items = res.json().get("items", [])
        if not items:
            raise RuntimeError(
                "No YouTube channel found for this Google account. "
                "Please ensure you selected a valid YouTube channel or created one on YouTube."
            )

        item = items[0]
        cid = item.get("id")
        if not cid:
            raise RuntimeError("YouTube API response did not contain a valid channel ID.")

        snippet = item.get("snippet", {})
        title = snippet.get("title") or "YouTube Channel"
        thumbnail_url = snippet.get("thumbnails", {}).get("default", {}).get("url")

        return {
            "channel_id": cid,
            "channel_title": title,
            "thumbnail_url": thumbnail_url,
        }


async def exchange_code_for_token(code: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Exchanges an authorization code for access and refresh tokens, registering the specific YouTube channel.
    
    Does NOT call save_stored_token first, preventing overwriting other channels' tokens.
    Resolves real channel ID live from YouTube before saving.
    """
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

    tok = data.get("access_token")
    if not tok:
        raise RuntimeError("Google OAuth response missing access_token.")

    # Live call to YouTube Data API - no fallback to fake IDs
    chan_info = await fetch_channel_info_live(tok)
    cid = chan_info["channel_id"]
    title = chan_info["channel_title"]
    thumb = chan_info.get("thumbnail_url")

    channels_map = _channels_store.get("channels", {})
    existing = channels_map.get(cid)
    already_connected = existing is not None

    new_refresh = data.get("refresh_token")
    refresh_token = new_refresh or (existing.get("refresh_token") if existing else None)

    expires_in = data.get("expires_in", 3600)
    try:
        expires_at = time.time() + float(expires_in)
    except Exception:
        expires_at = time.time() + 3600

    is_def = (len(channels_map) == 0) or (existing.get("is_default", False) if existing else False)

    save_user_channel({
        "channel_id": cid,
        "channel_title": title,
        "thumbnail_url": thumb,
        "access_token": tok,
        "refresh_token": refresh_token,
        "expires_at": expires_at,
        "is_default": is_def,
    }, user_id=user_id)

    return {
        **data,
        "channel_id": cid,
        "channel_title": title,
        "thumbnail_url": thumb,
        "already_connected": already_connected,
    }


async def get_channel_info(access_token: str) -> Dict[str, Any]:
    """Fetches YouTube channel info: checks local store first, then falls back to live API."""
    channels_map = _channels_store.get("channels", {})
    for cid, ch in channels_map.items():
        if ch.get("access_token") == access_token:
            return {
                "channel_title": ch.get("channel_title") or "YouTube Channel",
                "channel_id": cid,
                "thumbnail_url": ch.get("thumbnail_url"),
            }

    try:
        return await fetch_channel_info_live(access_token)
    except Exception as e:
        logger.debug("Live fetch in get_channel_info skipped: %s", e)

    cached_title = _token_store.get("channel_title")
    cached_id = _token_store.get("channel_id")
    cached_tok = _token_store.get("access_token")
    if cached_title and cached_tok == access_token:
        return {
            "channel_title": cached_title,
            "channel_id": cached_id or "connected_account",
            "thumbnail_url": _token_store.get("thumbnail_url"),
        }

    token_suffix = access_token[-8:] if len(access_token) >= 8 else secrets.token_hex(4)
    return {
        "channel_title": f"YouTube Channel ({token_suffix})",
        "channel_id": f"chan_{token_suffix}",
    }


async def get_youtube_status(user_id: Optional[str] = None) -> Dict[str, Any]:
    """Returns whether YouTube publishing is configured and connected, including all user channels."""
    client_id, client_secret = get_google_credentials()
    configured = bool(client_id and client_secret)

    if not _channels_store.get("channels"):
        try:
            from app.supabase_client import get_user_channels_supabase, is_supabase_configured
            if is_supabase_configured():
                supa_channels = await get_user_channels_supabase(user_id=user_id)
                if supa_channels:
                    for ch in supa_channels:
                        cid = ch.get("channel_id") or ch.get("id")
                        if cid:
                            _channels_store.setdefault("channels", {})[cid] = ch
                            if ch.get("is_default") or not _channels_store.get("active_channel_id"):
                                _channels_store["active_channel_id"] = cid
                    _save_channels_store()
        except Exception as e:
            logger.debug("Failed to restore channels from Supabase: %s", e)

    channels = get_user_channels(user_id=user_id)
    active_channel_id = _channels_store.get("active_channel_id")
    if not active_channel_id and channels:
        active_channel_id = channels[0].get("channel_id")
        _channels_store["active_channel_id"] = active_channel_id

    connected = len(channels) > 0 or bool(get_stored_token())

    active_channel = next((c for c in channels if c.get("channel_id") == active_channel_id), None)
    active_title = active_channel.get("channel_title") if active_channel else None

    auth_url = get_youtube_auth_url() if configured else None

    return {
        "configured": configured,
        "connected": connected,
        "channel_title": active_title if connected else None,
        "channel_id": active_channel_id if connected else None,
        "channels": channels,
        "active_channel_id": active_channel_id,
        "auth_url": auth_url,
    }


async def publish_short_video(
    filename: str,
    title: str,
    description: str = "",
    tags: Optional[List[str]] = None,
    privacy: str = "public",
    access_token: Optional[str] = None,
    channel_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Uploads a vertical short video to YouTube via Data API v3 Resumable Upload with automatic token refresh."""
    token = access_token or await get_valid_channel_token(channel_id)
    if not token:
        token = await refresh_access_token(channel_id)
    if not token:
        raise ValueError("No YouTube access token available. Please connect your YouTube channel or provide an access token.")

    video_path = DOWNLOAD_DIR / filename
    if not video_path.is_file():
        raise FileNotFoundError(f"Video file not found: {filename}")

    if "#shorts" not in title.lower():
        title = f"{title.strip()} #Shorts"

    file_size = video_path.stat().st_size
    init_url = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status"

    # Resolve channel-specific metadata preset (Pipsy Pop vs GTA ViceVerse)
    preset = get_channel_preset(channel_id=channel_id)

    # Use channel-specific description if caller left it empty or passed GTA default to Pipsy Pop
    if description and description.strip() and (description.strip() != DEFAULT_YOUTUBE_DESCRIPTION or preset["channel_id"] != PIPSY_POP_CHANNEL_ID):
        final_description = description.strip()
    else:
        final_description = preset["description"]

    # If channel preset or settings specify a game title (e.g. Grand Theft Auto VI) and it's not in the description, ensure attribution
    game_title = preset.get("game_title")
    if game_title and f"Game: {game_title}" not in final_description and game_title not in final_description:
        final_description = f"{final_description}\n\n🎮 Game: {game_title} (Rockstar Games)"

    # Use channel-specific tags if caller didn't pass custom tags or passed GTA default to Pipsy Pop
    if tags and (tags != DEFAULT_YOUTUBE_TAGS or preset["channel_id"] != PIPSY_POP_CHANNEL_ID):
        final_tags = list(tags)
    else:
        final_tags = list(preset["tags"])

    # If it's a gaming video with a game title, ensure key entity tags are present
    if game_title and preset.get("categoryId") == "20":
        for g_tag in [game_title, "GTA 6" if "theft auto" in game_title.lower() else game_title, "Rockstar Games"]:
            if not any(g_tag.lower() == t.lower() for t in final_tags):
                final_tags.append(g_tag)

    snippet: Dict[str, Any] = {
        "title": title[:100],
        "description": final_description,
        "tags": final_tags,
        "categoryId": preset["categoryId"],
    }

    metadata = {
        "snippet": snippet,
        "status": {
            "privacyStatus": privacy if privacy in ["public", "unlisted", "private"] else "public",
            "selfDeclaredMadeForKids": preset["selfDeclaredMadeForKids"],
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

        # Retry once with refreshed token on 401
        if init_res.status_code == 401:
            refreshed = await refresh_access_token(channel_id)
            if refreshed:
                token = refreshed
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
    channel_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> bool:
    """Sets/uploads a custom thumbnail for a YouTube video with automatic token refresh."""
    token = access_token or await get_valid_channel_token(channel_id)
    if not token:
        token = await refresh_access_token(channel_id)
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

            # Retry once with refreshed token on 401
            if resp.status_code == 401:
                refreshed = await refresh_access_token(channel_id)
                if refreshed:
                    token = refreshed
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
