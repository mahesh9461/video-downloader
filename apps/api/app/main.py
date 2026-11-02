import asyncio
import os
import time
import ipaddress
import logging
from collections import defaultdict
from typing import Dict, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse

from app.config import DOWNLOAD_DIR, CLEANUP_TIMEOUT_SECONDS, RATE_LIMIT_PER_MINUTE, FFMPEG_PATH
from app.schemas import MetadataRequest, DownloadRequest, VideoMetadata, ApiError
from app.downloader import extract_metadata, download_video_stream, DownloadException

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("video_downloader")

# In-memory sliding window rate limiter: IP -> list of timestamps
rate_limits: Dict[str, List[float]] = defaultdict(list)
rate_limit_lock = asyncio.Lock()


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        candidate = forwarded.split(",")[0].strip()
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            pass
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        candidate = real_ip.strip()
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            pass
    return request.client.host if request.client else "127.0.0.1"


async def check_rate_limit(client_ip: str) -> bool:
    now = time.time()
    window_start = now - 60.0
    async with rate_limit_lock:
        timestamps = rate_limits[client_ip]
        # Keep only timestamps in current 60s window
        rate_limits[client_ip] = [ts for ts in timestamps if ts > window_start]
        if len(rate_limits[client_ip]) >= RATE_LIMIT_PER_MINUTE:
            return False
        rate_limits[client_ip].append(now)
        return True


async def cleanup_old_files():
    while True:
        try:
            now = time.time()
            for filename in os.listdir(DOWNLOAD_DIR):
                file_path = DOWNLOAD_DIR / filename
                if file_path.is_file():
                    age = now - file_path.stat().st_mtime
                    if age > CLEANUP_TIMEOUT_SECONDS:
                        try:
                            file_path.unlink(missing_ok=True)
                            logger.info(f"Cleaned up expired file ({age:.0f}s old): {filename}")
                        except Exception as e:
                            logger.warning(f"Error removing expired file {filename}: {e}")
        except Exception as e:
            logger.error(f"Error in cleanup background task: {e}")
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_task = asyncio.create_task(cleanup_old_files())
    logger.info(f"Started video downloader service. FFmpeg: {FFMPEG_PATH or 'Not Found'}")
    yield
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="SaveIt Video Downloader API",
    version="1.0.0",
    description="High-speed video downloading backend for YouTube and TikTok with FFmpeg processing",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DownloadException)
async def download_exception_handler(request: Request, exc: DownloadException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error_type": exc.error_type},
    )


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "SaveIt Downloader Backend",
        "ffmpeg_available": bool(FFMPEG_PATH),
    }


@app.post("/api/metadata", response_model=VideoMetadata)
async def get_metadata(req: MetadataRequest):
    if not req.url or not req.url.strip():
        raise DownloadException("URL cannot be empty.", "invalid_url", 400)
    try:
        metadata = await asyncio.to_thread(extract_metadata, req.url.strip())
        return metadata
    except DownloadException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error extracting metadata for {req.url}: {e}")
        raise DownloadException("An unexpected error occurred while processing the video.", "unknown", 500)


@app.post("/api/download")
async def download_video(req: DownloadRequest, request: Request):
    client_ip = get_client_ip(request)
    allowed = await check_rate_limit(client_ip)
    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "detail": f"Rate limit exceeded. Maximum {RATE_LIMIT_PER_MINUTE} downloads per minute allowed per IP.",
                "error_type": "rate_limit",
            },
        )

    if not req.url or not req.url.strip():
        raise DownloadException("URL cannot be empty.", "invalid_url", 400)

    stream_generator = download_video_stream(req.url.strip(), req.format_id.strip())
    return StreamingResponse(
        stream_generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def remove_file_delayed(file_path: str, delay: int = None):
    if delay is None:
        delay = int(os.getenv("FILE_CLEANUP_DELAY_SECONDS", "300"))
    if delay > 0:
        await asyncio.sleep(delay)
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Removed downloaded file after completion: {file_path}")
    except Exception as e:
        logger.warning(f"Failed to remove file {file_path}: {e}")


@app.get("/api/file/{filename}")
async def serve_downloaded_file(filename: str, background_tasks: BackgroundTasks):
    # Prevent directory traversal attacks
    safe_filename = os.path.basename(filename)
    file_path = DOWNLOAD_DIR / safe_filename

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Requested file not found or expired.")

    # Schedule cleanup shortly after download starts
    background_tasks.add_task(remove_file_delayed, str(file_path))

    # Clean display filename (strip internal prefix if present)
    display_name = safe_filename
    if "_" in safe_filename:
        prefix, *rest = safe_filename.split("_", 1)
        if len(prefix) == 10 and rest:
            display_name = rest[0]

    return FileResponse(
        path=str(file_path),
        filename=display_name,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{display_name}"',
        },
    )
