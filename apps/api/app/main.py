import asyncio
import json
import os
import time
import uuid
from datetime import datetime, timezone
import ipaddress
import logging
import email
from collections import defaultdict
from typing import Dict, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, Header, status
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
from app.schemas import (
    MetadataRequest,
    DownloadRequest,
    VideoMetadata,
    ApiError,
    WatermarkRemoveRequest,
    WatermarkPresetInfo,
    WatermarkResult,
    WatermarkRegion,
    ClipCandidate,
    ClipAnalyzeRequest,
    ClipAnalyzeResponse,
    ClipRenderRequest,
    ClipRenderResponse,
    ClipAiHookRequest,
    ClipAiHookResponse,
    ClipPresetInfo,
    YouTubePublishRequest,
    YouTubePublishResponse,
    YouTubeAuthStatus,
    AutopilotStatus,
    AutopilotTriggerRequest,
    UserProfile,
    AuthLoginRequest,
    AuthSignUpRequest,
    AuthResponse,
    YouTubeChannelItem,
    YouTubeChannelsResponse,
    SelectChannelRequest,
    HistoryItemSchema,
    HistoryListResponse,
    GlobalSettings,
)
from app.autopilot import autopilot_manager
from app.ai_hook import generate_ai_hook
from app.youtube_publisher import (
    get_youtube_status,
    get_youtube_auth_url,
    exchange_code_for_token,
    publish_short_video,
    save_google_credentials,
    save_stored_token,
    clear_stored_token,
    save_user_channel,
    get_user_channels,
    set_active_channel_id,
    delete_user_channel,
    get_channel_token,
)
from app.downloader import (
    extract_metadata,
    download_video_stream,
    DownloadException,
    is_youtube_cooldown_active,
    get_base_ydl_opts,
    sanitize_url,
    YOUTUBE_CLIENT_PROFILES,
    extract_youtube_id,
    download_youtube_innertube_stream,
)
from app.watermark import (
    process_watermark_removal,
    WatermarkException,
    PLATFORM_PRESETS,
    MAX_UPLOAD_BYTES,
    ALLOWED_EXTENSIONS,
)
from app.clip_scorer import analyze_and_score_clips, parse_vtt_or_srt
from app.clip_renderer import (
    process_clip_render,
    ClipRenderException,
    generate_ass_subtitles,
    probe_video_duration,
    LAYOUT_PRESETS,
    MUSIC_PRESETS,
    HOOK_STYLES,
)
from app.cache import (
    metadata_cache,
    subtitle_cache,
    duration_cache,
    clear_all_caches,
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


# NOTE: Automated background hourly timer disabled as requested.
# async def autopilot_background_worker():
#     while True:
#         try:
#             await autopilot_manager.tick()
#         except Exception as e:
#             logger.debug("Error in autopilot background task: %s", e)
#         await asyncio.sleep(20)


@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_task = asyncio.create_task(cleanup_old_files())
    # Automated background hourly timer disabled as requested. Uploads happen only when user adds a link.
    # autopilot_task = asyncio.create_task(autopilot_background_worker())
    logger.info("Started video downloader service. FFmpeg: %s", FFMPEG_PATH or "Not Found")
    # Pre-warm FFmpeg binary into OS memory
    if FFMPEG_PATH:
        try:
            prewarm_proc = await asyncio.create_subprocess_exec(
                FFMPEG_PATH, "-version",
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await prewarm_proc.wait()
            logger.info("FFmpeg pre-warm complete.")
        except Exception as e:
            logger.debug("FFmpeg pre-warm skipped: %s", e)
    yield
    cleanup_task.cancel()
    # autopilot_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    # try:
    #     await autopilot_task
    # except asyncio.CancelledError:
    #     pass


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


@app.exception_handler(ClipRenderException)
async def clip_render_exception_handler(request: Request, exc: ClipRenderException):
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
    cleaned_url = req.url.strip()
    cached = metadata_cache.get(cleaned_url)
    if cached is not None:
        return cached
    try:
        metadata = await asyncio.to_thread(extract_metadata, cleaned_url)
        metadata_cache.set(cleaned_url, metadata)
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

    # Do not delete autopilot clips and cover images so in-browser video & cover previews never break
    if not (safe_filename.startswith("gta6_short_") or safe_filename.startswith("gta6_cover_") or safe_filename.startswith("autopilot_")):
        background_tasks.add_task(remove_file_delayed, str(file_path))

    display_name = safe_filename
    if "_" in safe_filename:
        prefix, *rest = safe_filename.split("_", 1)
        if len(prefix) == 10 and rest:
            display_name = rest[0]

    # Ensure correct extension in display name so browser never defaults to .txt
    ext = os.path.splitext(safe_filename)[1].lower()
    if not display_name.lower().endswith(ext):
        display_name += ext

    media_type = "video/mp4"
    if ext == ".mp3":
        media_type = "audio/mpeg"
    elif ext == ".webm":
        media_type = "video/webm"
    elif ext == ".mov":
        media_type = "video/quicktime"
    elif ext == ".mkv":
        media_type = "video/x-matroska"
    elif ext == ".mp4":
        media_type = "video/mp4"

    return FileResponse(
        path=str(file_path),
        filename=display_name,
        media_type=media_type,
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



# ---------------------------------------------------------------------------
# Viral Clips endpoints (Opus Clip style)
# ---------------------------------------------------------------------------


@app.get("/api/clips/presets", response_model=ClipPresetInfo)
async def list_clip_presets():
    """List available vertical layouts, music synthesizers, and hook styles."""
    return ClipPresetInfo(
        layouts=LAYOUT_PRESETS,
        music_presets=MUSIC_PRESETS,
        hook_styles=HOOK_STYLES,
    )


@app.post("/api/clips/analyze", response_model=ClipAnalyzeResponse)
async def analyze_viral_clips(req: ClipAnalyzeRequest, request: Request):
    """
    Analyzes a video to find the most engaging, viral moments.
    Returns 3-5 ranked clip candidates with timestamps and virality scores.
    """
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

    if not req.url or not req.url.strip():
        raise DownloadException("URL cannot be empty.", "invalid_url", 400)

    # Check if req.url refers to an uploaded local file in DOWNLOAD_DIR
    local_path = DOWNLOAD_DIR / os.path.basename(req.url.strip())
    if local_path.is_file():
        dur = probe_video_duration(str(local_path))
        title = local_path.stem.replace("upload_", "")
        clips = analyze_and_score_clips(
            cues=None,
            total_duration=dur,
            video_title=title,
            min_duration=req.min_duration,
            max_duration=req.max_duration,
            max_clips=req.max_clips,
            video_id=local_path.name,
            duration_mode=req.duration_mode or "short",
        )
        return ClipAnalyzeResponse(
            video_id=local_path.name,
            title=title,
            total_duration=dur,
            clips=clips,
        )

    url = sanitize_url(req.url.strip())

    async def _get_meta_async():
        cached_meta = metadata_cache.get(url)
        if cached_meta is not None:
            return cached_meta
        m = await asyncio.to_thread(extract_metadata, url)
        metadata_cache.set(url, m)
        return m

    async def _get_subs_async():
        cached_subs = subtitle_cache.get(url)
        if cached_subs is not None:
            return cached_subs
        try:
            import yt_dlp
            ydl_opts = get_base_ydl_opts("youtube")
            ydl_opts.update({
                "skip_download": True,
                "writesubtitles": True,
                "writeautomaticsub": True,
                "subtitleslangs": ["en", "en-US", "en.*"],
            })

            async def _fetch():
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = await asyncio.to_thread(ydl.extract_info, url, download=False)
                    if info:
                        sub_dict = info.get("subtitles") or info.get("automatic_captions") or {}
                        en_subs = sub_dict.get("en") or sub_dict.get("en-US") or []
                        vtt_url = None
                        for fmt in en_subs:
                            if fmt.get("ext") in ("vtt", "srt"):
                                vtt_url = fmt.get("url")
                                break
                        if vtt_url:
                            async with httpx.AsyncClient(timeout=4.0) as client:
                                sub_resp = await client.get(vtt_url)
                                if sub_resp.status_code == 200:
                                    return parse_vtt_or_srt(sub_resp.text)
                return None

            cues_res = await asyncio.wait_for(_fetch(), timeout=5.0)
            if cues_res:
                subtitle_cache.set(url, cues_res)
            return cues_res
        except Exception as e:
            logger.debug("Subtitle extraction skipped or timed out for %s: %s", url, e)
            return None

    # Parallelize metadata and subtitle retrieval with asyncio.gather
    meta_task, subs_task = await asyncio.gather(_get_meta_async(), _get_subs_async(), return_exceptions=True)

    if isinstance(meta_task, Exception):
        if isinstance(meta_task, DownloadException):
            raise meta_task
        logger.error("Failed to extract metadata in analyze_viral_clips for %s: %s", url, meta_task)
        raise DownloadException(f"Could not retrieve video information: {meta_task}", "unknown", 400)

    meta = meta_task
    cues = subs_task if not isinstance(subs_task, Exception) else None

    clips = analyze_and_score_clips(
        cues=cues,
        total_duration=float(meta.duration or 300),
        video_title=meta.title,
        min_duration=req.min_duration,
        max_duration=req.max_duration,
        max_clips=req.max_clips,
        video_id=meta.id,
        thumbnail_url=meta.thumbnail,
        duration_mode=req.duration_mode or "short",
    )

    return ClipAnalyzeResponse(
        video_id=meta.id,
        title=meta.title,
        total_duration=float(meta.duration or 300),
        clips=clips,
    )


@app.post("/api/clips/upload")
async def upload_clip_video(request: Request):
    """
    Uploads a local video file (MP4, MOV, WebM) for AI clip discovery and vertical clipping.
    """
    content_type = request.headers.get("content-type", "")
    original_filename = "uploaded_video.mp4"
    video_bytes = None

    if "multipart/form-data" in content_type:
        form = await request.form()
        upload = form.get("video")
        if upload is not None and hasattr(upload, "filename"):
            original_filename = upload.filename
            video_bytes = await upload.read()
    else:
        original_filename = request.headers.get("x-filename", "uploaded_video.mp4")
        video_bytes = await request.body()

    if not video_bytes or len(video_bytes) == 0:
        raise HTTPException(status_code=400, detail="No video file provided.")

    if len(video_bytes) > MAX_UPLOAD_BYTES:
        max_mb = MAX_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {max_mb} MB.")

    import uuid as _uuid
    from pathlib import Path as _P
    ext = _P(original_filename).suffix.lower() or ".mp4"
    upload_id = _uuid.uuid4().hex[:10]
    upload_filename = f"upload_{upload_id}{ext}"
    upload_path = DOWNLOAD_DIR / upload_filename

    with open(upload_path, "wb") as f:
        f.write(video_bytes)

    duration = probe_video_duration(str(upload_path))
    return {
        "file_id": upload_filename,
        "filename": original_filename,
        "duration": duration,
        "download_url": f"/api/file/{upload_filename}",
    }


@app.post("/api/clips/render", response_model=ClipRenderResponse)
async def render_viral_clip_endpoint(
    req: ClipRenderRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Renders a selected clip into a vertical 9:16 Short/Reel/TikTok with:
    - Smart center crop, split screen, or blurred background layout.
    - Ssemble-style viral subtitle burn-in.
    - Top headline banner.
    - Subtle background music ducking.
    """
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

    if not req.url or not req.url.strip():
        raise ClipRenderException("A valid video URL or file path is required.", "missing_url")

    source_input = req.url.strip()
    temp_source_path: Optional[str] = None
    subtitles_temp_path: Optional[str] = None

    # Check if source_input is an existing local file in DOWNLOAD_DIR
    local_candidate = DOWNLOAD_DIR / os.path.basename(source_input)
    if local_candidate.is_file():
        actual_input_path = str(local_candidate)
        title_hint = local_candidate.stem
    else:
        # Download the video source with multi-client resilience and universal format fallback
        import yt_dlp
        from yt_dlp.utils import download_range_func
        import uuid as _uuid

        job_id = _uuid.uuid4().hex[:10]
        stem = f"source_{job_id}"
        outtmpl_pattern = str(DOWNLOAD_DIR / f"{stem}.%(ext)s")

        # Universal fallback format string prioritizing highest available resolution (4K, 1440p, 1080p, best)
        format_selector = (
            "bestvideo[ext=mp4]+bestaudio[ext=m4a]/"
            "bestvideo+bestaudio/"
            "best[ext=mp4]/"
            "best/"
            "bv*+ba/b"
        )

        is_yt = "youtube" in source_input.lower() or "youtu.be" in source_input.lower()
        client_candidates = YOUTUBE_CLIENT_PROFILES if is_yt else [None]
        download_success = False
        last_error = None
        title_hint = "clip"

        # Step A: Attempt fast range download of only the needed section (avoids downloading hundreds of megabytes)
        safe_range_start = max(0.0, req.start_time - 2.0)
        safe_range_end = req.end_time + 2.0

        for client_profile in client_candidates:
            ydl_opts = get_base_ydl_opts("youtube" if is_yt else "general", client_override=client_profile)
            ydl_opts.update({
                "outtmpl": outtmpl_pattern,
                "format": format_selector,
                "merge_output_format": "mp4",
                "noplaylist": True,
                "download_ranges": download_range_func(None, [(safe_range_start, safe_range_end)]),
                "force_keyframes_at_cuts": True,
            })
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = await asyncio.to_thread(ydl.extract_info, source_input, download=True)
                    if info:
                        title_hint = info.get("title", title_hint)

                # Look for downloaded file matching stem with any extension
                candidates = [
                    p for p in DOWNLOAD_DIR.glob(f"{stem}.*")
                    if not p.name.endswith(".part") and p.stat().st_size > 0
                ]
                if candidates:
                    actual_input_path = str(candidates[0])
                    temp_source_path = actual_input_path
                    download_success = True
                    break
            except Exception as e:
                last_error = e
                logger.warning("yt-dlp profile %s failed to fetch range clip segment: %s", client_profile, e)
                continue

        # Step B: Fallback to full download without download_ranges if range request failed
        if not download_success:
            for client_profile in client_candidates:
                ydl_opts = get_base_ydl_opts("youtube" if is_yt else "general", client_override=client_profile)
                ydl_opts.update({
                    "outtmpl": outtmpl_pattern,
                    "format": format_selector,
                    "merge_output_format": "mp4",
                    "noplaylist": True,
                })
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info = await asyncio.to_thread(ydl.extract_info, source_input, download=True)
                        if info:
                            title_hint = info.get("title", title_hint)
                    candidates = [
                        p for p in DOWNLOAD_DIR.glob(f"{stem}.*")
                        if not p.name.endswith(".part") and p.stat().st_size > 0
                    ]
                    if candidates:
                        actual_input_path = str(candidates[0])
                        temp_source_path = actual_input_path
                        download_success = True
                        break
                except Exception as e:
                    last_error = e
                    logger.warning("yt-dlp profile %s full download fallback failed: %s", client_profile, e)
                    continue

        # Step C: If yt-dlp failed completely, try our built-in InnerTube CDN streamer
        if not download_success and is_yt:
            vid_id = extract_youtube_id(source_input)
            if vid_id:
                try:
                    logger.info("Attempting built-in InnerTube fallback download for %s", vid_id)
                    dummy_queue = asyncio.Queue()
                    stream_res = await asyncio.to_thread(
                        download_youtube_innertube_stream,
                        vid_id,
                        "yt-720p",
                        job_id,
                        asyncio.get_running_loop(),
                        dummy_queue,
                    )
                    if stream_res and stream_res.get("filename"):
                        it_path = str(DOWNLOAD_DIR / stream_res["filename"])
                        if os.path.exists(it_path) and os.path.getsize(it_path) > 0:
                            temp_source_path = it_path
                            actual_input_path = it_path
                            download_success = True
                except Exception as it_err:
                    logger.warning("Built-in InnerTube fallback failed for %s: %s", vid_id, it_err)

        if not download_success:
            if temp_source_path and os.path.exists(temp_source_path):
                try:
                    os.remove(temp_source_path)
                except Exception:
                    pass
            raise ClipRenderException(f"Failed to fetch video source: {last_error}", "source_download_error", 500)

    # Calculate smart render timestamps based on actual source video duration
    probe_dur = probe_video_duration(actual_input_path)
    requested_duration = req.end_time - req.start_time
    if probe_dur > 0 and probe_dur <= requested_duration + 6.0:
        # File is already a trimmed segment from range download
        render_start = 0.0
        render_end = min(probe_dur, requested_duration)
    else:
        # File is full long video
        render_start = req.start_time
        render_end = req.end_time

    # Optional Ssemble-style Subtitles Burn-in
    if req.burn_captions:
        try:
            import uuid as _uuid
            sub_job_id = _uuid.uuid4().hex[:8]
            sub_path = str(DOWNLOAD_DIR / f"sub_{sub_job_id}.ass")
            # First check subtitle cache to avoid redundant network download
            cues_to_burn = subtitle_cache.get(source_input) or []
            if not cues_to_burn:
                is_yt = "youtube" in source_input.lower() or "youtu.be" in source_input.lower()
                if is_yt:
                    import yt_dlp
                    ydl_sub_opts = get_base_ydl_opts("youtube")
                    ydl_sub_opts.update({
                        "skip_download": True,
                        "writesubtitles": True,
                        "writeautomaticsub": True,
                        "subtitleslangs": ["en", "en-US", "en.*"],
                    })
                    with yt_dlp.YoutubeDL(ydl_sub_opts) as ydl:
                        info_sub = await asyncio.to_thread(ydl.extract_info, source_input, download=False)
                        if info_sub:
                            sub_dict = info_sub.get("subtitles") or info_sub.get("automatic_captions") or {}
                            en_subs = sub_dict.get("en") or sub_dict.get("en-US") or []
                            for fmt in en_subs:
                                if fmt.get("ext") in ("vtt", "srt") and fmt.get("url"):
                                    import httpx
                                    with httpx.Client(timeout=8.0) as client:
                                        sub_resp = client.get(fmt["url"])
                                        if sub_resp.status_code == 200:
                                            cues_to_burn = parse_vtt_or_srt(sub_resp.text)
                                            subtitle_cache.set(source_input, cues_to_burn)
                                            break
            if cues_to_burn:
                ok = generate_ass_subtitles(
                    cues=cues_to_burn,
                    start_time=req.start_time,
                    end_time=req.end_time,
                    output_path=sub_path,
                    style=req.caption_style or "viral_yellow",
                )
                if ok and os.path.exists(sub_path):
                    subtitles_temp_path = sub_path
        except Exception as sub_err:
            logger.debug("Failed to burn in captions: %s", sub_err)

    try:
        result = await process_clip_render(
            input_path=actual_input_path,
            original_title=title_hint,
            start_time=render_start,
            end_time=render_end,
            layout=req.layout,
            hook_title=req.hook_title,
            hook_style=req.hook_style,
            background_music=req.background_music,
            music_volume=req.music_volume,
            progress_bar=req.progress_bar,
            progress_bar_color=req.progress_bar_color,
            subtitles_path=subtitles_temp_path,
        )
    finally:
        # If we downloaded a temporary source video or created a temporary sub file, clean it up
        if temp_source_path and os.path.exists(temp_source_path):
            try:
                os.remove(temp_source_path)
            except Exception:
                pass
        if subtitles_temp_path and os.path.exists(subtitles_temp_path):
            try:
                os.remove(subtitles_temp_path)
            except Exception:
                pass

    # Schedule cleanup of the rendered clip
    output_file_path = str(DOWNLOAD_DIR / result["filename"])
    background_tasks.add_task(remove_file_delayed, output_file_path)

    return ClipRenderResponse(
        filename=result["filename"],
        filesize=result["filesize"],
        duration=result["duration"],
        download_url=result["download_url"],
        layout=result["layout"],
        hook_title=result["hook_title"],
    )


@app.post("/api/clips/ai-hook", response_model=ClipAiHookResponse)
async def generate_ai_hook_endpoint(req: ClipAiHookRequest, request: Request):
    """
    Transcribes clip audio using OpenAI Whisper, and passes the transcript to
    an OpenAI LLM (gpt-4o-mini) to craft the ultimate viral hook headline for video overlays.
    Gracefully falls back to local heuristic if OpenAI API key is unavailable.
    """
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

    if not req.url or not req.url.strip():
        raise HTTPException(status_code=400, detail="A video URL or identifier is required.")

    source_input = req.url.strip()
    temp_source_path: Optional[str] = None
    actual_input_path: Optional[str] = None

    local_candidate = DOWNLOAD_DIR / os.path.basename(source_input)
    if local_candidate.is_file():
        actual_input_path = str(local_candidate)
    else:
        import yt_dlp
        import uuid as _uuid
        job_id = _uuid.uuid4().hex[:10]
        temp_source_path = str(DOWNLOAD_DIR / f"ai_source_{job_id}.mp4")

        is_yt = "youtube" in source_input.lower() or "youtu.be" in source_input.lower()
        client_candidates = YOUTUBE_CLIENT_PROFILES if is_yt else [None]

        for client_profile in client_candidates:
            ydl_opts = get_base_ydl_opts("youtube" if is_yt else "general", client_override=client_profile)
            ydl_opts.update({
                "outtmpl": temp_source_path,
                "format": "bestaudio/bestvideo[height<=360]+bestaudio/best[height<=360]/best/bv*+ba/b",
                "noplaylist": True,
            })
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    await asyncio.to_thread(ydl.extract_info, source_input, download=True)
                if os.path.exists(temp_source_path) and os.path.getsize(temp_source_path) > 0:
                    actual_input_path = temp_source_path
                    break
            except Exception:
                continue

    if not actual_input_path:
        fallback = generate_ai_hook(
            video_path="",
            start_time=req.start_time,
            end_time=req.end_time,
            video_title=req.video_title or "Video Highlight",
            source_url=source_input,
            clip_dialogue=getattr(req, "clip_dialogue", None),
            provider=getattr(req, "provider", "free_open_llm"),
        )
        return ClipAiHookResponse(**fallback)

    try:
        hook_res = await asyncio.to_thread(
            generate_ai_hook,
            video_path=actual_input_path,
            start_time=req.start_time,
            end_time=req.end_time,
            video_title=req.video_title or "Video Highlight",
            source_url=source_input,
            clip_dialogue=getattr(req, "clip_dialogue", None),
            provider=getattr(req, "provider", "free_open_llm"),
        )
        return ClipAiHookResponse(**hook_res)
    finally:
        if temp_source_path and os.path.exists(temp_source_path):
            try:
                os.remove(temp_source_path)
            except Exception:
                pass


# ---------------------------------------------------------------------------
# YouTube Shorts Publishing Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/youtube/status", response_model=YouTubeAuthStatus)
async def youtube_status_endpoint(authorization: Optional[str] = Header(None)):
    """Check YouTube OAuth configuration and channel connection status."""
    user_id = None
    if authorization:
        try:
            from app.auth import get_user_by_token
            u = await get_user_by_token(authorization.replace("Bearer ", "").strip())
            if u:
                user_id = u.id
        except Exception:
            pass
    status_data = await get_youtube_status(user_id=user_id)
    return YouTubeAuthStatus(**status_data)


@app.post("/api/youtube/configure")
async def youtube_configure_endpoint(payload: dict):
    """Dynamically set Google OAuth Client ID and Secret."""
    client_id = payload.get("client_id")
    client_secret = payload.get("client_secret")
    if not client_id or not client_secret:
        raise HTTPException(status_code=400, detail="Both client_id and client_secret are required.")
    save_google_credentials(client_id, client_secret)
    status_data = await get_youtube_status()
    return {"status": "configured", "youtube_status": status_data}


@app.post("/api/youtube/disconnect")
async def youtube_disconnect_endpoint():
    """Disconnect currently linked YouTube account."""
    clear_stored_token()
    return {"status": "disconnected"}


@app.post("/api/youtube/set-token")
async def youtube_set_token_endpoint(payload: dict, authorization: Optional[str] = Header(None)):
    """Directly save an access token manually as a connected channel."""
    tok_raw = str(payload.get("token") or payload.get("access_token") or "").strip()
    refresh_tok = payload.get("refresh_token")
    if tok_raw.startswith("{") and "access_token" in tok_raw:
        try:
            import json as _json
            parsed = _json.loads(tok_raw)
            if parsed.get("access_token"):
                tok_raw = parsed["access_token"]
                refresh_tok = refresh_tok or parsed.get("refresh_token")
        except Exception:
            pass

    if not tok_raw:
        raise HTTPException(status_code=400, detail="Token is required.")
    token = tok_raw
    user_id = None
    if authorization:
        try:
            from app.auth import get_user_by_token
            u = await get_user_by_token(authorization.replace("Bearer ", "").strip())
            if u:
                user_id = u.id
        except Exception:
            pass
    from app.youtube_publisher import get_channel_info
    tok_str = str(token).strip()
    explicit_id = payload.get("channel_id")
    explicit_title = payload.get("channel_title")
    chan_info = {}
    if not explicit_id or not explicit_title:
        try:
            chan_info = await get_channel_info(tok_str)
        except Exception:
            pass
    token_suffix = tok_str[-8:] if len(tok_str) >= 8 else "custom"
    chan_id = explicit_id or chan_info.get("channel_id") or f"chan_{token_suffix}"
    chan_title = explicit_title or chan_info.get("channel_title") or f"YouTube Channel ({token_suffix})"

    save_user_channel({
        "channel_id": chan_id,
        "channel_title": chan_title,
        "thumbnail_url": payload.get("thumbnail_url") or chan_info.get("thumbnail_url"),
        "access_token": tok_str,
        "refresh_token": refresh_tok or payload.get("refresh_token"),
        "is_default": payload.get("is_default", True),
    }, user_id=user_id)

    status_data = await get_youtube_status(user_id=user_id)
    return {"status": "connected", "youtube_status": status_data}


@app.get("/api/youtube/auth-url")
async def youtube_auth_url_endpoint():
    """Retrieve Google OAuth authorization URL for YouTube upload."""
    url = get_youtube_auth_url()
    if not url:
        raise HTTPException(
            status_code=400,
            detail="Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.",
        )
    return {"auth_url": url}


@app.post("/api/youtube/token")
async def youtube_exchange_token_endpoint(payload: dict, authorization: Optional[str] = Header(None)):
    """Exchange authorization code for YouTube access/refresh token."""
    code = payload.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code is required.")
    user_id = None
    if authorization and authorization.startswith("Bearer "):
        try:
            from app.auth import get_user_from_token
            u = get_user_from_token(authorization.split("Bearer ")[1].strip())
            if u:
                user_id = u.id
        except Exception:
            pass
    try:
        token_data = await exchange_code_for_token(code, user_id=user_id)
        return {"status": "ok", "token": token_data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/youtube/publish", response_model=YouTubePublishResponse)
async def youtube_publish_endpoint(req: YouTubePublishRequest):
    """Publish a rendered vertical short directly to YouTube Shorts."""
    try:
        result = await publish_short_video(
            filename=req.filename,
            title=req.title,
            description=req.description or "",
            tags=req.tags,
            privacy=req.privacy,
            access_token=req.access_token,
        )
        return YouTubePublishResponse(**result)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Failed to publish video to YouTube: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to publish to YouTube: {str(e)}")


# ---------------------------------------------------------------------------
# User Authentication & Profiles Endpoints
# ---------------------------------------------------------------------------


@app.post("/api/auth/signup", response_model=AuthResponse)
async def auth_signup_endpoint(payload: AuthSignUpRequest):
    """Creates a new user profile via Supabase Auth or local store."""
    try:
        from app.auth import register_user
        res = await register_user(payload.email, payload.password, payload.name, payload.surname)
        return AuthResponse(**res)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {e}")


@app.post("/api/auth/login", response_model=AuthResponse)
async def auth_login_endpoint(payload: AuthLoginRequest):
    """Authenticates user via email and password."""
    try:
        from app.auth import login_user
        res = await login_user(payload.email, payload.password)
        return AuthResponse(**res)
    except ValueError as ve:
        raise HTTPException(status_code=401, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {e}")


@app.get("/api/auth/me", response_model=UserProfile)
async def auth_me_endpoint(authorization: Optional[str] = Header(None)):
    """Returns the authenticated user's profile."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication token required.")
    token = authorization.replace("Bearer ", "").strip()
    from app.auth import get_user_by_token
    user = await get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    return user


@app.post("/api/auth/logout")
async def auth_logout_endpoint(authorization: Optional[str] = Header(None)):
    """Logs out and invalidates the session token."""
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        from app.auth import logout_token
        logout_token(token)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Multiple YouTube Channels Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/youtube/channels", response_model=YouTubeChannelsResponse)
async def youtube_channels_endpoint(authorization: Optional[str] = Header(None)):
    """Returns all connected YouTube channels for the authenticated user."""
    user_id = None
    if authorization:
        try:
            from app.auth import get_user_by_token
            u = await get_user_by_token(authorization.replace("Bearer ", "").strip())
            if u:
                user_id = u.id
        except Exception:
            pass
    from app.youtube_publisher import get_user_channels, _channels_store
    channels_raw = get_user_channels(user_id=user_id)
    items = [YouTubeChannelItem(**c) for c in channels_raw]
    active_id = _channels_store.get("active_channel_id")
    if not active_id and items:
        active_id = items[0].channel_id
    return YouTubeChannelsResponse(channels=items, active_channel_id=active_id)


@app.post("/api/youtube/channels/select", response_model=YouTubeChannelsResponse)
async def youtube_select_channel_endpoint(payload: SelectChannelRequest, authorization: Optional[str] = Header(None)):
    """Sets a YouTube channel as the active upload target."""
    user_id = None
    if authorization:
        try:
            from app.auth import get_user_by_token
            u = await get_user_by_token(authorization.replace("Bearer ", "").strip())
            if u:
                user_id = u.id
        except Exception:
            pass
    from app.youtube_publisher import set_active_channel_id, get_user_channels
    ok = set_active_channel_id(payload.channel_id, user_id=user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Channel not found in your connected accounts.")
    channels_raw = get_user_channels(user_id=user_id)
    return YouTubeChannelsResponse(channels=[YouTubeChannelItem(**c) for c in channels_raw], active_channel_id=payload.channel_id)


@app.delete("/api/youtube/channels/{channel_id}")
async def youtube_delete_channel_endpoint(channel_id: str, authorization: Optional[str] = Header(None)):
    """Disconnects a specific YouTube channel."""
    user_id = None
    if authorization:
        try:
            from app.auth import get_user_by_token
            u = await get_user_by_token(authorization.replace("Bearer ", "").strip())
            if u:
                user_id = u.id
        except Exception:
            pass
    from app.youtube_publisher import delete_user_channel
    delete_user_channel(channel_id, user_id=user_id)
    return {"ok": True, "deleted_channel_id": channel_id}


# ---------------------------------------------------------------------------
# User Download History Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/history", response_model=HistoryListResponse)
async def get_history_endpoint(authorization: Optional[str] = Header(None)):
    """Retrieves download history specific to the authenticated user."""
    user_id = None
    if authorization:
        try:
            from app.auth import get_user_by_token
            u = await get_user_by_token(authorization.replace("Bearer ", "").strip())
            if u:
                user_id = u.id
        except Exception:
            pass
    from app.supabase_client import get_download_history_supabase
    history = await get_download_history_supabase(user_id=user_id)
    return HistoryListResponse(history=[HistoryItemSchema(**h) for h in history])


@app.post("/api/history")
async def save_history_endpoint(item: HistoryItemSchema, authorization: Optional[str] = Header(None)):
    """Saves a download history item for the authenticated user."""
    user_id = item.user_id
    if authorization and not user_id:
        try:
            from app.auth import get_user_by_token
            u = await get_user_by_token(authorization.replace("Bearer ", "").strip())
            if u:
                user_id = u.id
        except Exception:
            pass
    from app.supabase_client import save_download_history_supabase
    await save_download_history_supabase(item.model_dump(), user_id=user_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# GTA 6 Autopilot & Scheduled Publishing Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/autopilot/status", response_model=AutopilotStatus)
async def autopilot_status_endpoint(authorization: Optional[str] = Header(None)):
    """Retrieve runtime status, queue, cooldown, and disk space cleaned."""
    user_id = None
    user = None
    if authorization:
        try:
            from app.auth import get_user_by_token
            user = await get_user_by_token(authorization.replace("Bearer ", "").strip())
            if user:
                user_id = user.id
        except Exception:
            pass
    status_obj = autopilot_manager.get_status(user_id=user_id)
    if user:
        status_obj.user = user
    return status_obj


@app.post("/api/autopilot/start", response_model=AutopilotStatus)
async def autopilot_start_endpoint():
    """Starts or resumes the GTA 6 viral autopilot worker."""
    autopilot_manager.start()
    return autopilot_manager.get_status()


@app.post("/api/autopilot/pause", response_model=AutopilotStatus)
async def autopilot_pause_endpoint():
    """Pauses the autopilot scheduler."""
    autopilot_manager.pause()
    return autopilot_manager.get_status()


@app.post("/api/autopilot/stop", response_model=AutopilotStatus)
@app.post("/api/autopilot/cancel", response_model=AutopilotStatus)
async def autopilot_cancel_endpoint():
    """Immediately terminates any active download or rendering job and purges partial files."""
    return autopilot_manager.cancel_active_run()


@app.post("/api/autopilot/trigger", response_model=AutopilotStatus)
async def autopilot_trigger_endpoint(
    background_tasks: BackgroundTasks,
    request: Optional[AutopilotTriggerRequest] = None,
    authorization: Optional[str] = Header(None),
):
    """Immediately triggers viral discovery or custom video URL ingestion and 6-clip batch creation."""
    url = request.url.strip() if request and request.url else None
    target_channel_id = request.channel_id.strip() if request and request.channel_id else None
    user_id = None
    if authorization:
        try:
            from app.auth import get_user_by_token
            u = await get_user_by_token(authorization.replace("Bearer ", "").strip())
            if u:
                user_id = u.id
        except Exception:
            pass

    # Reset any stale error or cooldown state so manual run starts immediately
    autopilot_manager.state = "idle"
    autopilot_manager.cooldown_until = None
    if url:
        # Reset count for custom single-run so all 6 clips can upload
        autopilot_manager.daily_uploads_count = 0

    async def _run_batch():
        if url:
            try:
                autopilot_manager.state = "rendering"
                autopilot_manager.current_step = "downloading"
                autopilot_manager.current_step_label = f"Extracting metadata for URL: {url}"
                autopilot_manager._save_state()
                meta = await asyncio.to_thread(extract_metadata, url)
                # Extract YouTube video id from url or fallback to uuid
                vid_id = str(uuid.uuid4().hex[:8])
                if "v=" in url:
                    vid_id = url.split("v=")[1].split("&")[0]
                elif "youtu.be/" in url:
                    vid_id = url.split("youtu.be/")[1].split("?")[0]
                elif hasattr(meta, "id") and getattr(meta, "id"):
                    vid_id = getattr(meta, "id")

                vid_title = getattr(meta, "title", "Custom Viral Moment") or "Custom Viral Moment"
                vid_duration = getattr(meta, "duration", 300) or 300
                vid_thumbnail = getattr(meta, "thumbnail", None)

                vid_info = {
                    "id": vid_id,
                    "title": vid_title,
                    "url": url,
                    "duration": vid_duration,
                    "thumbnail": vid_thumbnail,
                }
                should_auto_upload = bool(user_id)
                await autopilot_manager.create_and_render_batch(
                    vid_info,
                    sequential_upload=should_auto_upload,
                    target_channel_id=target_channel_id,
                    user_id=user_id,
                )
            except Exception as e:
                autopilot_manager._log(f"❌ Failed to process URL '{url}': {e}")
                autopilot_manager.state = "error"
                autopilot_manager.current_step = "failed"
                autopilot_manager.current_step_label = f"Failed URL: {e}"
                autopilot_manager.recent_errors.insert(0, {
                    "title": url,
                    "stage": "download",
                    "error": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                autopilot_manager._save_state()
        else:
            video = await autopilot_manager.search_viral_gta_video()
            if video:
                should_auto_upload = bool(user_id)
                await autopilot_manager.create_and_render_batch(
                    video,
                    sequential_upload=should_auto_upload,
                    target_channel_id=target_channel_id,
                    user_id=user_id,
                )

    background_tasks.add_task(_run_batch)
    return autopilot_manager.get_status(user_id=user_id)


@app.post("/api/autopilot/reset", response_model=AutopilotStatus)
async def autopilot_reset_endpoint(clear_history: bool = False):
    """Resets daily upload limit, cooldown, and active batch state. Optionally clears published history."""
    autopilot_manager.reset_state(clear_history=clear_history)
    return autopilot_manager.get_status()


@app.post("/api/autopilot/clear-history", response_model=AutopilotStatus)
async def autopilot_clear_history_endpoint():
    """Clears all published shorts and resets to a clean slate."""
    autopilot_manager.reset_state(clear_history=True)
    return autopilot_manager.get_status()


@app.post("/api/autopilot/retry-upload/{clip_id}", response_model=AutopilotStatus)
async def autopilot_retry_upload_endpoint(clip_id: str, background_tasks: BackgroundTasks):
    """Retries uploading a failed clip in the current batch."""
    if autopilot_manager.current_batch:
        for clip in autopilot_manager.current_batch.clips:
            if clip.id == clip_id:
                async def _do_retry(c=clip):
                    await autopilot_manager.publish_clip(c, cleanup_after=False)
                background_tasks.add_task(_do_retry)
                break
    return autopilot_manager.get_status()


@app.post("/api/autopilot/cleanup")
async def autopilot_cleanup_endpoint():
    """Manually purges orphan temporary downloads from disk."""
    freed = autopilot_manager.purge_orphan_downloads()
    return {"freed_mb": round(freed, 2), "total_cleaned_mb": round(autopilot_manager.disk_space_cleaned_mb, 2)}


@app.get("/api/autopilot/audio")
async def autopilot_audio_endpoint():
    """List available custom audio tracks in assets/audio/."""
    files = autopilot_manager.get_custom_audio_files()
    return {"custom_tracks": files, "count": len(files)}


# ---------------------------------------------------------------------------
# Global Settings Endpoints
# ---------------------------------------------------------------------------

GLOBAL_SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "global_settings.json")


@app.get("/api/settings/global", response_model=GlobalSettings)
async def get_global_settings_endpoint(authorization: Optional[str] = Header(None)):
    """Retrieve global user customization settings (Supabase with local JSON fallback)."""
    user_id = "default"
    if authorization:
        try:
            from app.auth import get_user_by_token
            u = await get_user_by_token(authorization.replace("Bearer ", "").strip())
            if u:
                user_id = u.id
        except Exception:
            pass

    # Try Supabase if configured
    try:
        from app.supabase_client import get_global_settings_supabase, is_supabase_configured
        if is_supabase_configured():
            cloud_settings = await get_global_settings_supabase(user_id=user_id)
            if cloud_settings:
                return GlobalSettings(**cloud_settings)
    except Exception as e:
        logger.debug("Failed reading settings from Supabase: %s", e)

    # Local file fallback
    try:
        if os.path.exists(GLOBAL_SETTINGS_FILE):
            with open(GLOBAL_SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return GlobalSettings(**data)
    except Exception as e:
        logger.debug("Failed reading local settings file: %s", e)

    return GlobalSettings(user_id=user_id)


@app.post("/api/settings/global", response_model=GlobalSettings)
async def update_global_settings_endpoint(
    settings: GlobalSettings,
    authorization: Optional[str] = Header(None),
):
    """Save or update global customization settings (persists to Supabase and local JSON fallback)."""
    user_id = settings.user_id or "default"
    if authorization:
        try:
            from app.auth import get_user_by_token
            u = await get_user_by_token(authorization.replace("Bearer ", "").strip())
            if u:
                user_id = u.id
                settings.user_id = user_id
        except Exception:
            pass

    settings.updated_at = datetime.now(timezone.utc).isoformat()
    settings_dict = settings.model_dump()

    # Save to local fallback file
    try:
        os.makedirs(os.path.dirname(GLOBAL_SETTINGS_FILE), exist_ok=True)
        with open(GLOBAL_SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings_dict, f, indent=2)
    except Exception as e:
        logger.warning("Failed writing local settings file: %s", e)

    # Sync to Supabase in background / async if configured
    try:
        from app.supabase_client import save_global_settings_supabase, is_supabase_configured
        if is_supabase_configured():
            asyncio.create_task(save_global_settings_supabase(settings_dict, user_id=user_id))
    except Exception as e:
        logger.debug("Failed syncing settings to Supabase: %s", e)

    return settings



