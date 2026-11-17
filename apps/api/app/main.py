import asyncio
import os
import time
import ipaddress
import logging
import email
from collections import defaultdict
from typing import Dict, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse

from app.config import (
    DOWNLOAD_DIR,
    CLEANUP_TIMEOUT_SECONDS,
    RATE_LIMIT_PER_MINUTE,
    FFMPEG_PATH,
    PROXY_URL,
    COOKIE_FILE_PATH,
    COBALT_API_URL,
)
from app.schemas import MetadataRequest, DownloadRequest, VideoMetadata, ApiError
from app.schemas import WatermarkRemoveRequest, WatermarkPresetInfo, WatermarkResult, WatermarkRegion
from app.downloader import (
    extract_metadata,
    download_video_stream,
    DownloadException,
    is_youtube_cooldown_active,
)
from app.watermark import (
    process_watermark_removal,
    WatermarkException,
    PLATFORM_PRESETS,
    MAX_UPLOAD_BYTES,
    ALLOWED_EXTENSIONS,
)

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
        rate_limits[client_ip] = [ts for ts in timestamps if ts > window_start]
        if len(rate_limits[client_ip]) >= RATE_LIMIT_PER_MINUTE:
            return False
        rate_limits[client_ip].append(now)
        return True


def sweep_expired_files():
    now = time.time()
    try:
        for filename in os.listdir(DOWNLOAD_DIR):
            file_path = DOWNLOAD_DIR / filename
            if file_path.is_file():
                age = now - file_path.stat().st_mtime
                if age > CLEANUP_TIMEOUT_SECONDS:
                    try:
                        file_path.unlink(missing_ok=True)
                        logger.info("Cleaned up expired file (%.0fs old): %s", age, filename)
                    except Exception as e:
                        logger.warning("Error removing expired file %s: %s", filename, e)
    except Exception as e:
        logger.error("Error during sweep of expired files: %s", e)


async def cleanup_old_files():
    while True:
        try:
            sweep_expired_files()
        except Exception as e:
            logger.error("Error in cleanup background task: %s", e)
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_task = asyncio.create_task(cleanup_old_files())
    logger.info("Started video downloader service. FFmpeg: %s", FFMPEG_PATH or "Not Found")
    yield
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="SaveIt Video Downloader API",
    version="1.0.0",
    description="High-speed video downloading backend for YouTube, TikTok, and Instagram Reels with FFmpeg processing",
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


@app.exception_handler(WatermarkException)
async def watermark_exception_handler(request: Request, exc: WatermarkException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error_type": exc.error_type},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error_type": "http_error"},
    )


@app.get("/")
@app.head("/")
async def root():
    return {"status": "ok"}


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "SaveIt Downloader Backend",
        "ffmpeg_available": bool(FFMPEG_PATH),
        "youtube_cooldown_active": is_youtube_cooldown_active(),
        "proxy": bool(PROXY_URL),
        "cookies": bool(COOKIE_FILE_PATH),
        "cobalt": bool(COBALT_API_URL or os.getenv("COBALT_API_URL")),
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
        logger.error("Unexpected error extracting metadata for %s: %s", req.url, e)
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

    # Opportunistically sweep any expired files
    sweep_expired_files()

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
            logger.info("Removed downloaded file after completion: %s", file_path)
    except Exception as e:
        logger.warning("Failed to remove file %s: %s", file_path, e)


@app.get("/api/file/{filename}")
async def serve_downloaded_file(filename: str, background_tasks: BackgroundTasks):
    safe_filename = os.path.basename(filename)
    file_path = DOWNLOAD_DIR / safe_filename

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Requested file not found or expired.")

    background_tasks.add_task(remove_file_delayed, str(file_path))

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



# ---------------------------------------------------------------------------
# Watermark removal endpoints
# ---------------------------------------------------------------------------


@app.get("/api/watermark/presets")
async def list_watermark_presets():
    """List available platform-specific watermark removal presets."""
    presets = []
    for key, preset in PLATFORM_PRESETS.items():
        presets.append(
            WatermarkPresetInfo(
                platform=key,
                label=preset["label"],
                description=preset["description"],
                regions=[
                    WatermarkRegion(x=r["x"], y=r["y"], w=r["w"], h=r["h"])
                    for r in preset["regions"]
                ],
            )
        )
    return {"presets": presets}


@app.post("/api/watermark/remove", response_model=WatermarkResult)
async def remove_watermark_endpoint(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Upload a video and remove watermarks.

    Supports standard multipart/form-data upload.
    **Modes:**
    - `preset` — auto-removes for known platforms (TikTok). Set `platform` field.
    - `manual` — provide exact coordinates via `regions_json`.
    - `auto` — auto-detect watermark regions from the video content.
    """
    # Rate limit
    client_ip = get_client_ip(request)
    allowed = await check_rate_limit(client_ip)
    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "detail": f"Rate limit exceeded. Maximum {RATE_LIMIT_PER_MINUTE} requests per minute.",
                "error_type": "rate_limit",
            },
        )

    content_type = request.headers.get("content-type", "")
    video_bytes: Optional[bytes] = None
    original_filename: Optional[str] = None
    mode: str = "auto"
    platform: Optional[str] = None
    regions_json: Optional[str] = None
    band: int = 4

    # 1. Parse multipart/form-data (tries Starlette form, falls back to stdlib email parser)
    if "multipart/form-data" in content_type:
        parsed_via_form = False
        try:
            form = await request.form()
            mode = str(form.get("mode") or "auto")
            platform = form.get("platform")
            if platform:
                platform = str(platform)
            regions_json = form.get("regions_json")
            if regions_json:
                regions_json = str(regions_json)
            if "band" in form:
                try:
                    band = int(form.get("band"))
                except (ValueError, TypeError):
                    band = 4
            upload = form.get("video")
            if upload is not None and hasattr(upload, "filename"):
                original_filename = upload.filename
                video_bytes = await upload.read()
                parsed_via_form = True
        except Exception:
            parsed_via_form = False

        if not parsed_via_form:
            body = await request.body()
            if len(body) > MAX_UPLOAD_BYTES:
                max_mb = MAX_UPLOAD_BYTES // (1024 * 1024)
                raise WatermarkException(
                    f"File too large. Maximum upload size is {max_mb} MB.",
                    error_type="file_too_large",
                    status_code=413,
                )
            header_bytes = f"Content-Type: {content_type}\r\n\r\n".encode("latin-1")
            msg = email.message_from_bytes(header_bytes + body)
            for part in msg.get_payload():
                name = part.get_param("name", header="content-disposition")
                part_fn = part.get_filename()
                payload = part.get_payload(decode=True)
                if part_fn or name == "video":
                    original_filename = part_fn or "uploaded_video.mp4"
                    video_bytes = payload
                elif name == "mode" and payload:
                    mode = payload.decode("utf-8", errors="ignore").strip()
                elif name == "platform" and payload:
                    platform = payload.decode("utf-8", errors="ignore").strip() or None
                elif name == "regions_json" and payload:
                    regions_json = payload.decode("utf-8", errors="ignore").strip() or None
                elif name == "band" and payload:
                    try:
                        band = int(payload.decode("utf-8", errors="ignore").strip())
                    except Exception:
                        band = 4
    elif "application/json" in content_type:
        body_json = await request.json()
        mode = body_json.get("mode", "auto")
        platform = body_json.get("platform")
        regions_json = json.dumps(body_json.get("regions")) if body_json.get("regions") else None
        band = int(body_json.get("band", 4))
    else:
        # Raw binary body
        qp = request.query_params
        mode = qp.get("mode", "auto")
        platform = qp.get("platform")
        regions_json = qp.get("regions_json")
        band = int(qp.get("band", 4))
        original_filename = request.headers.get("x-filename", "uploaded_video.mp4")
        video_bytes = await request.body()

    # Validate file presence
    if not original_filename or video_bytes is None:
        raise WatermarkException("No video file provided.", "invalid_file")

    from pathlib import Path as _P
    ext = _P(original_filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed_exts = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise WatermarkException(
            f"Unsupported file type '{ext}'. Allowed: {allowed_exts}",
            error_type="invalid_file",
        )

    if len(video_bytes) == 0:
        raise WatermarkException("Uploaded file is empty.", "invalid_file")

    if len(video_bytes) > MAX_UPLOAD_BYTES:
        max_mb = MAX_UPLOAD_BYTES // (1024 * 1024)
        raise WatermarkException(
            f"File too large. Maximum upload size is {max_mb} MB.",
            error_type="file_too_large",
            status_code=413,
        )

    # Save uploaded file
    import uuid as _uuid
    upload_id = _uuid.uuid4().hex[:10]
    upload_filename = f"upload_{upload_id}{ext}"
    upload_path = DOWNLOAD_DIR / upload_filename

    try:
        with open(upload_path, "wb") as f:
            f.write(video_bytes)
    except Exception as e:
        upload_path.unlink(missing_ok=True)
        logger.error("Failed to save uploaded file: %s", e)
        raise WatermarkException("Failed to save uploaded file.", "upload_error", 500)

    # Parse manual regions if provided
    parsed_regions = None
    if mode == "manual" and regions_json:
        import json
        try:
            raw = json.loads(regions_json)
            if not isinstance(raw, list) or not raw:
                raise ValueError("regions_json must be a non-empty JSON array")
            parsed_regions = [{"x": r["x"], "y": r["y"], "w": r["w"], "h": r["h"]} for r in raw]
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            upload_path.unlink(missing_ok=True)
            raise WatermarkException(
                f"Invalid regions_json: {e}. Expected JSON array of objects with x, y, w, h.",
                error_type="invalid_regions",
            )

    # Process
    try:
        result = await process_watermark_removal(
            input_path=str(upload_path),
            original_filename=original_filename,
            mode=mode,
            platform=platform,
            regions=parsed_regions,
            band=band,
        )
    except WatermarkException:
        raise
    except Exception as e:
        logger.error("Unexpected watermark processing error: %s", e)
        raise WatermarkException("An unexpected error occurred during processing.", "unknown", 500)
    finally:
        upload_path.unlink(missing_ok=True)

    # Schedule cleanup of the output file
    output_file_path = str(DOWNLOAD_DIR / result["filename"])
    background_tasks.add_task(remove_file_delayed, output_file_path)

    download_url = f"/api/file/{result['filename']}"

    response = WatermarkResult(
        filename=result["filename"],
        filesize=result["filesize"],
        download_url=download_url,
    )
    if result.get("detected_regions"):
        response.detected_regions = [
            WatermarkRegion(x=r["x"], y=r["y"], w=r["w"], h=r["h"])
            for r in result["detected_regions"]
        ]

    return response
