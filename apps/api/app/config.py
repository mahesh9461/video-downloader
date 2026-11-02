import os
import shutil
import base64
import logging
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit, urlunsplit

logger = logging.getLogger("video_downloader.config")

# Add static_ffmpeg paths if available
try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
except Exception:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent
DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", BASE_DIR / "downloads"))
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 30-minute cleanup timeout
CLEANUP_TIMEOUT_SECONDS = int(os.getenv("CLEANUP_TIMEOUT_SECONDS", 1800))
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", 5))

# Check ffmpeg availability
FFMPEG_PATH = shutil.which("ffmpeg")
FFPROBE_PATH = shutil.which("ffprobe")

# YouTube cookies and proxy support for cloud environments
COOKIE_FILE_PATH: Optional[str] = None
raw_cookies = os.getenv("YOUTUBE_COOKIES")
cookies_file = os.getenv("YOUTUBE_COOKIES_FILE")

candidate_cookie_path: Optional[Path] = None

if cookies_file and Path(cookies_file).is_file():
    candidate_cookie_path = Path(cookies_file).resolve()
elif raw_cookies:
    try:
        if raw_cookies.startswith("base64:"):
            cookie_text = base64.b64decode(raw_cookies[7:]).decode("utf-8")
        else:
            cookie_text = raw_cookies
        temp_raw_path = Path("/tmp/youtube_cookies_raw.txt")
        temp_raw_path.write_text(cookie_text, encoding="utf-8")
        candidate_cookie_path = temp_raw_path
    except Exception as e:
        logger.warning("Failed to parse YOUTUBE_COOKIES env variable: %s", e)

if candidate_cookie_path and candidate_cookie_path.is_file():
    target_cookie_path = candidate_cookie_path
    try:
        # If file is read-only (e.g. Render secret files) or outside /tmp, copy to writable temp file
        writable_path = Path("/tmp/cookies.txt")
        if candidate_cookie_path != writable_path:
            shutil.copyfile(candidate_cookie_path, writable_path)
            target_cookie_path = writable_path
        COOKIE_FILE_PATH = str(target_cookie_path.resolve())
        logger.info("YouTube cookies loaded successfully from %s (contents not logged)", COOKIE_FILE_PATH)
    except Exception as e:
        COOKIE_FILE_PATH = str(candidate_cookie_path.resolve())
        logger.info("YouTube cookies loaded from %s (copy failed: %s)", COOKIE_FILE_PATH, e)
else:
    logger.info("No YouTube cookies configured")

PROXY_URL: Optional[str] = os.getenv("PROXY_URL") or os.getenv("HTTP_PROXY") or os.getenv("HTTPS_PROXY")


def mask_proxy_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        parts = urlsplit(url)
        if parts.username and parts.password:
            netloc = f"{parts.username}:***@{parts.hostname}"
            if parts.port:
                netloc += f":{parts.port}"
            return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
        elif parts.password:
            netloc = f":***@{parts.hostname}"
            if parts.port:
                netloc += f":{parts.port}"
            return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
        return url
    except Exception:
        return "configured (masked)"


if PROXY_URL:
    logger.info("Outbound proxy configured: %s", mask_proxy_url(PROXY_URL))
else:
    logger.info("No outbound proxy configured")

# Optional Cobalt configuration
COBALT_API_URL: Optional[str] = os.getenv("COBALT_API_URL")
COBALT_API_KEY: Optional[str] = os.getenv("COBALT_API_KEY")
