import os
import shutil
import base64
from pathlib import Path
from typing import Optional

# Add static_ffmpeg paths if available
try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
except Exception:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent
DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", BASE_DIR / "downloads"))
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

CLEANUP_TIMEOUT_SECONDS = int(os.getenv("CLEANUP_TIMEOUT_SECONDS", 600))  # 10 minutes
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", 5))

# Check ffmpeg availability
FFMPEG_PATH = shutil.which("ffmpeg")
FFPROBE_PATH = shutil.which("ffprobe")

# YouTube cookies and proxy support for cloud datacenter environments (Render, Koyeb, AWS)
COOKIE_FILE_PATH: Optional[str] = None
raw_cookies = os.getenv("YOUTUBE_COOKIES")
cookies_file = os.getenv("YOUTUBE_COOKIES_FILE")

if cookies_file and Path(cookies_file).is_file():
    COOKIE_FILE_PATH = str(Path(cookies_file).resolve())
elif raw_cookies:
    try:
        if raw_cookies.startswith("base64:"):
            cookie_text = base64.b64decode(raw_cookies[7:]).decode("utf-8")
        else:
            cookie_text = raw_cookies
        cookie_path = BASE_DIR / "cookies.txt"
        cookie_path.write_text(cookie_text, encoding="utf-8")
        COOKIE_FILE_PATH = str(cookie_path)
    except Exception:
        pass

PROXY_URL: Optional[str] = os.getenv("PROXY_URL") or os.getenv("HTTP_PROXY") or os.getenv("HTTPS_PROXY")
