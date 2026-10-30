import os
import shutil
from pathlib import Path

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

