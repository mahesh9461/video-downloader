"""
User Authentication & Session Management Module.

Supports:
1. Supabase Auth integration (via REST PostgREST API).
2. Robust local session fallback for offline/sandboxed development and testing.
3. User profile resolution and token validation dependency for FastAPI.
"""

import hashlib
import hmac
import json
import logging
import os
import secrets
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

from app.schemas import UserProfile

logger = logging.getLogger("video_downloader.auth")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
USERS_FILE = DATA_DIR / "users.json"
SESSIONS_FILE = DATA_DIR / "sessions.json"

# In-memory stores
_users_cache: Dict[str, Dict[str, Any]] = {}
_sessions_cache: Dict[str, Dict[str, Any]] = {}


def _init_stores():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if USERS_FILE.is_file():
        try:
            _users_cache.update(json.loads(USERS_FILE.read_text(encoding="utf-8")))
        except Exception:
            pass
    if SESSIONS_FILE.is_file():
        try:
            _sessions_cache.update(json.loads(SESSIONS_FILE.read_text(encoding="utf-8")))
        except Exception:
            pass


_init_stores()


def _save_users():
    try:
        USERS_FILE.write_text(json.dumps(_users_cache, indent=2), encoding="utf-8")
    except Exception as e:
        logger.warning("Failed to persist users: %s", e)


def _save_sessions():
    try:
        SESSIONS_FILE.write_text(json.dumps(_sessions_cache, indent=2), encoding="utf-8")
    except Exception as e:
        logger.warning("Failed to persist sessions: %s", e)


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256((password + salt).encode("utf-8")).hexdigest()
    return hashed, salt


def verify_password(password: str, hashed: str, salt: str) -> bool:
    expected, _ = hash_password(password, salt)
    return hmac.compare_digest(expected, hashed)


async def register_user(
    email: str, password: str, name: Optional[str] = None, surname: Optional[str] = None
) -> Dict[str, Any]:
    """Registers a new user via Supabase Auth with automatic local store synchronization."""
    clean_email = email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise ValueError("A valid email address is required.")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters long.")

    display_name = (name or clean_email.split("@")[0]).strip()
    clean_surname = (surname or "").strip() or None
    if clean_surname:
        if name and name.strip():
            display_name = f"{name.strip()} {clean_surname}"
        else:
            display_name = clean_surname

    # Attempt Supabase Auth registration if configured
    supabase_user = None
    access_token = None
    from app.supabase_client import get_supabase_url, get_supabase_key, is_supabase_configured

    if is_supabase_configured():
        try:
            endpoint = f"{get_supabase_url()}/auth/v1/signup"
            headers = {
                "apikey": get_supabase_key(),
                "Content-Type": "application/json",
            }
            payload = {
                "email": clean_email,
                "password": password,
                "data": {"name": display_name},
            }
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.post(endpoint, headers=headers, json=payload)
                if res.status_code in (200, 201):
                    data = res.json()
                    sb_u = data.get("user") or data
                    supabase_user = {
                        "id": sb_u.get("id"),
                        "email": sb_u.get("email", clean_email),
                        "name": display_name,
                        "created_at": sb_u.get("created_at"),
                    }
                    access_token = data.get("access_token")
        except Exception as e:
            logger.debug("Supabase online signup skipped: %s", e)

    # Local fallback/record
    hashed, salt = hash_password(password)
    user_id = (supabase_user and supabase_user.get("id")) or f"usr_{uuid.uuid4().hex[:12]}"

    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    user_record = {
        "id": user_id,
        "email": clean_email,
        "name": display_name,
        "surname": clean_surname,
        "avatar_url": f"https://api.dicebear.com/7.x/bottts/svg?seed={user_id}",
        "hashed_password": hashed,
        "salt": salt,
        "created_at": now_iso,
    }
    _users_cache[clean_email] = user_record
    _save_users()

    if not access_token:
        access_token = f"tok_{secrets.token_urlsafe(32)}"

    _sessions_cache[access_token] = {
        "user_id": user_id,
        "email": clean_email,
        "created_at": time.time(),
    }
    _save_sessions()

    return {
        "user": UserProfile(
            id=user_id,
            email=clean_email,
            name=display_name,
            surname=clean_surname,
            avatar_url=user_record["avatar_url"],
            created_at=now_iso,
        ),
        "access_token": access_token,
    }


async def login_user(email: str, password: str) -> Dict[str, Any]:
    """Authenticates a user via Supabase Auth or local store."""
    clean_email = email.strip().lower()
    from app.supabase_client import get_supabase_url, get_supabase_key, is_supabase_configured

    # Check Supabase Auth first
    if is_supabase_configured():
        try:
            endpoint = f"{get_supabase_url()}/auth/v1/token?grant_type=password"
            headers = {
                "apikey": get_supabase_key(),
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.post(endpoint, headers=headers, json={"email": clean_email, "password": password})
                if res.status_code == 200:
                    data = res.json()
                    sb_u = data.get("user", {})
                    token = data.get("access_token")
                    user_profile = UserProfile(
                        id=sb_u.get("id", f"usr_{uuid.uuid4().hex[:8]}"),
                        email=sb_u.get("email", clean_email),
                        name=sb_u.get("user_metadata", {}).get("name") or clean_email.split("@")[0],
                        created_at=sb_u.get("created_at"),
                    )
                    _sessions_cache[token] = {"user_id": user_profile.id, "email": clean_email, "created_at": time.time()}
                    _save_sessions()
                    return {"user": user_profile, "access_token": token}
        except Exception as e:
            logger.debug("Supabase online login skipped: %s", e)

    # Local authentication fallback
    user_record = _users_cache.get(clean_email)
    if not user_record:
        raise ValueError("Invalid email or password.")

    if not verify_password(password, user_record["hashed_password"], user_record["salt"]):
        raise ValueError("Invalid email or password.")

    token = f"tok_{secrets.token_urlsafe(32)}"
    _sessions_cache[token] = {
        "user_id": user_record["id"],
        "email": clean_email,
        "created_at": time.time(),
    }
    _save_sessions()

    return {
        "user": UserProfile(
            id=user_record["id"],
            email=user_record["email"],
            name=user_record.get("name"),
            surname=user_record.get("surname"),
            avatar_url=user_record.get("avatar_url"),
            created_at=user_record.get("created_at"),
        ),
        "access_token": token,
    }


async def get_user_by_token(token: str) -> Optional[UserProfile]:
    """Resolves a UserProfile from an access token."""
    if not token:
        return None

    # Check local session
    session = _sessions_cache.get(token)
    if session:
        user_record = _users_cache.get(session.get("email", ""))
        if user_record:
            return UserProfile(
                id=user_record["id"],
                email=user_record["email"],
                name=user_record.get("name"),
                surname=user_record.get("surname"),
                avatar_url=user_record.get("avatar_url"),
                created_at=user_record.get("created_at"),
            )

    # Check Supabase Auth
    from app.supabase_client import get_supabase_url, get_supabase_key, is_supabase_configured
    if is_supabase_configured():
        try:
            endpoint = f"{get_supabase_url()}/auth/v1/user"
            headers = {
                "apikey": get_supabase_key(),
                "Authorization": f"Bearer {token}",
            }
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(endpoint, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    return UserProfile(
                        id=data.get("id"),
                        email=data.get("email"),
                        name=data.get("user_metadata", {}).get("name") or data.get("email", "").split("@")[0],
                        created_at=data.get("created_at"),
                    )
        except Exception:
            pass

    return None


def logout_token(token: str) -> bool:
    """Invalidates the session token."""
    if token in _sessions_cache:
        del _sessions_cache[token]
        _save_sessions()
        return True
    return False
