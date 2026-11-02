import asyncio
import os
import re
import time
import uuid
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import AsyncGenerator, Dict, Any, List, Optional
import httpx
import yt_dlp

from app.config import (
    DOWNLOAD_DIR,
    FFMPEG_PATH,
    COOKIE_FILE_PATH,
    PROXY_URL,
    COBALT_API_URL,
    COBALT_API_KEY,
)
from app.schemas import VideoFormat, VideoMetadata, DownloadProgress

logger = logging.getLogger(__name__)

MAX_CONCURRENT_DOWNLOADS = int(os.getenv("MAX_CONCURRENT_DOWNLOADS", "5"))
DOWNLOAD_EXECUTOR = ThreadPoolExecutor(
    max_workers=MAX_CONCURRENT_DOWNLOADS,
    thread_name_prefix="downloader_worker",
)

YOUTUBE_REGEX = re.compile(
    r"^(https?://)?(www\.|m\.)?(youtube\.com/(watch\?v=|shorts/|embed/)|youtu\.be/)[\w-]{11}"
)
TIKTOK_REGEX = re.compile(
    r"^(https?://)?(www\.)?(tiktok\.com/@[\w.-]+/video/\d+|(vm|vt)\.tiktok\.com/[\w]+|tiktok\.com/t/[\w]+)"
)

# Shared client profiles: minimal hammering
YOUTUBE_CLIENT_PROFILES: List[List[str]] = [["web", "mweb"], ["tv"]]

BOT_BLOCK_COOLDOWN_SECONDS = int(os.getenv("BOT_BLOCK_COOLDOWN_SECONDS", "60"))
_youtube_bot_block_until: float = 0.0


def is_youtube_cooldown_active() -> bool:
    global _youtube_bot_block_until
    return time.time() < _youtube_bot_block_until


def trigger_youtube_cooldown() -> None:
    global _youtube_bot_block_until
    _youtube_bot_block_until = time.time() + BOT_BLOCK_COOLDOWN_SECONDS
    logger.warning(
        "YouTube bot block detected. Activated in-memory cooldown for %ds.",
        BOT_BLOCK_COOLDOWN_SECONDS,
    )


def reset_youtube_cooldown() -> None:
    """Helper for testing or manually clearing the cooldown."""
    global _youtube_bot_block_until
    _youtube_bot_block_until = 0.0


def safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    """Safely parses integer values from headers, JSON, or external strings."""
    if value is None:
        return default
    try:
        return int(float(str(value).strip()))
    except (ValueError, TypeError):
        return default


class DownloadException(Exception):
    def __init__(self, detail: str, error_type: str = "unknown", status_code: int = 400):
        super().__init__(detail)
        self.detail = detail
        self.error_type = error_type
        self.status_code = status_code


def detect_platform(url: str) -> str:
    url = url.strip()
    if YOUTUBE_REGEX.search(url):
        return "youtube"
    if TIKTOK_REGEX.search(url):
        return "tiktok"
    raise DownloadException(
        "Invalid or unsupported URL. Please paste a valid YouTube or TikTok link.",
        error_type="invalid_url",
        status_code=400,
    )


def is_bot_check_error(error_msg: str) -> bool:
    msg = error_msg.lower()
    return (
        "sign in to confirm you're not a bot" in msg
        or "sign in to confirm you’re not a bot" in msg
        or "confirm you're not a bot" in msg
        or "confirm you’re not a bot" in msg
        or "botguard" in msg
    )


def map_ytdlp_error(error_msg: str) -> DownloadException:
    msg = error_msg.lower()
    # 1. Detect bot-check challenges FIRST before generic private/login checks
    if is_bot_check_error(msg):
        return DownloadException(
            "YouTube is blocking this server right now. Please try again later.",
            error_type="bot_check",
            status_code=503,
        )
    if "private video" in msg or "sign in if you've been granted access" in msg or "login required" in msg:
        return DownloadException("This video is private or requires sign-in.", "private", 403)
    if "not available in your country" in msg or "geo-restricted" in msg or "blocked in your country" in msg:
        return DownloadException("This video is not available in your region.", "geo_restricted", 403)
    if "video unavailable" in msg or "removed by the user" in msg or "has been deleted" in msg or "http error 404" in msg:
        return DownloadException("The requested video was deleted or cannot be found.", "deleted", 404)
    if "too many requests" in msg or "rate-limit" in msg or "http error 429" in msg:
        return DownloadException("Rate limit or verification challenge triggered. Please try again later.", "rate_limit", 429)
    if "unsupported url" in msg or "is not a valid url" in msg:
        return DownloadException("Invalid video URL provided.", "invalid_url", 400)
    return DownloadException(f"Failed to process video: {error_msg}", "unknown", 400)


def format_bytes(num_bytes: Optional[float]) -> Optional[str]:
    if not num_bytes:
        return None
    for unit in ["B", "KB", "MB", "GB"]:
        if num_bytes < 1024.0:
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f} TB"


def format_seconds(seconds: Optional[int]) -> Optional[str]:
    if seconds is None:
        return None
    mins, secs = divmod(int(seconds), 60)
    hours, mins = divmod(mins, 60)
    if hours > 0:
        return f"{hours:02d}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"


def sanitize_url(url: str) -> str:
    """Strips playlist and mix parameters so yt-dlp only loads the single target video."""
    url = url.strip()
    if ("youtube.com" in url or "youtu.be" in url) and ("&list=" in url or "?list=" in url):
        v_match = re.search(r"[?&]v=([a-zA-Z0-9_-]{11})", url)
        if v_match:
            return f"https://www.youtube.com/watch?v={v_match.group(1)}"
    return url


def extract_youtube_id(url: str) -> Optional[str]:
    match = re.search(r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([\w-]{11})", url)
    return match.group(1) if match else None


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r'[\\/*?:"<>|]', "", name).strip()
    return cleaned[:80] if cleaned else "video"


def fetch_youtube_oembed(video_id: str) -> Optional[VideoMetadata]:
    """
    Fetches YouTube metadata via Google's official public oEmbed CDN API.
    Guaranteed 100% uptime, zero authentication, never blocked on datacenter IPs.
    Returns empty formats and downloads_available=False to remain honest when
    full video stream extraction is unavailable.
    """
    oembed_url = "https://www.youtube.com/oembed"
    params = {
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "format": "json",
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json",
    }
    try:
        with httpx.Client(timeout=6.0, follow_redirects=True, headers=headers) as client:
            resp = client.get(oembed_url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                title = data.get("title", "YouTube Video")
                author = data.get("author_name", "YouTube Creator")
                thumbnail = data.get("thumbnail_url") or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

                logger.info("Retrieved YouTube video metadata via Google oEmbed for %s: %s", video_id, title)
                return VideoMetadata(
                    id=video_id,
                    platform="youtube",
                    title=title,
                    creator=author,
                    creator_avatar=None,
                    duration=0,
                    thumbnail=thumbnail,
                    formats=[],
                    downloads_available=False,
                    notice="Preview only: downloads are temporarily unavailable for this video.",
                )
            logger.warning("Google oEmbed returned status %d for %s: %s", resp.status_code, video_id, resp.text[:150])
    except Exception as e:
        logger.warning("Google oEmbed failed for %s: %s", video_id, e)
    return None


def download_via_cobalt(
    url: str,
    format_id: str,
    job_id: str,
    title: str,
    loop: asyncio.AbstractEventLoop,
    queue: asyncio.Queue,
) -> Optional[Dict[str, Any]]:
    """
    Downloads media streams via Cobalt ONLY if COBALT_API_URL is configured.
    Uses v10 payload parameters (videoQuality, downloadMode, audioFormat).
    """
    configured_url = os.getenv("COBALT_API_URL") or COBALT_API_URL
    if not configured_url:
        return None

    is_audio = "audio" in format_id
    quality_match = re.search(r"(\d+)p", format_id)
    quality = quality_match.group(1) if quality_match else "1080"

    payload: Dict[str, Any] = {
        "url": url,
        "videoQuality": quality,
    }
    if is_audio:
        payload["downloadMode"] = "audio"
        payload["audioFormat"] = "mp3"
        ext = "mp3"
    else:
        payload["downloadMode"] = "auto"
        ext = "mp4"

    client_headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "SaveItApp/1.0",
    }
    configured_key = os.getenv("COBALT_API_KEY") or COBALT_API_KEY
    if configured_key:
        client_headers["Authorization"] = f"Api-Key {configured_key}"

    loop.call_soon_threadsafe(
        queue.put_nowait,
        DownloadProgress(status="downloading", percent=15.0, speed="Connecting to download engine...", eta="Starting..."),
    )

    endpoint = configured_url.rstrip("/") + "/"
    try:
        with httpx.Client(timeout=45.0, follow_redirects=True, headers=client_headers) as client:
            resp = client.post(endpoint, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                status_field = data.get("status")
                stream_url = data.get("url")

                # Handle tunnel, redirect, success or direct url presence
                if stream_url and (status_field in ("tunnel", "redirect", "success") or not status_field):
                    clean_title = sanitize_filename(title)
                    out_filename = f"{job_id}_{clean_title}.{ext}"
                    out_path = DOWNLOAD_DIR / out_filename

                    loop.call_soon_threadsafe(
                        queue.put_nowait,
                        DownloadProgress(status="downloading", percent=40.0, speed="Streaming...", eta="A few seconds"),
                    )

                    with client.stream("GET", stream_url) as stream_resp:
                        if stream_resp.status_code in (200, 206):
                            total_bytes = safe_int(stream_resp.headers.get("content-length")) or 0
                            downloaded = 0
                            with open(out_path, "wb") as f:
                                for chunk in stream_resp.iter_bytes(chunk_size=131072):
                                    f.write(chunk)
                                    downloaded += len(chunk)
                                    if total_bytes > 0:
                                        pct = min(98.0, 40.0 + (downloaded / total_bytes * 58.0))
                                        loop.call_soon_threadsafe(
                                            queue.put_nowait,
                                            DownloadProgress(status="downloading", percent=round(pct, 1), filesize=total_bytes),
                                        )

                            if out_path.exists() and out_path.stat().st_size > 0:
                                logger.info("Cobalt download succeeded: %s", out_filename)
                                return {"filename": out_filename, "filesize": out_path.stat().st_size}
                else:
                    logger.warning("Cobalt %s returned status '%s': %s", configured_url, status_field, resp.text[:200])
            else:
                logger.warning("Cobalt %s returned HTTP %d: %s", configured_url, resp.status_code, resp.text[:200])
    except Exception as e:
        logger.warning("Cobalt request failed on %s: %s", configured_url, e)
    return None


def get_base_ydl_opts(platform: str, client_override: Optional[List[str]] = None) -> Dict[str, Any]:
    opts: Dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "playlist_items": "1",
        "extract_flat": False,
    }
    if FFMPEG_PATH:
        opts["ffmpeg_location"] = FFMPEG_PATH

    if COOKIE_FILE_PATH and os.path.exists(COOKIE_FILE_PATH):
        opts["cookiefile"] = COOKIE_FILE_PATH

    if PROXY_URL:
        opts["proxy"] = PROXY_URL

    if platform == "youtube":
        # When cookies are set or by default, use configured profile without ios/android
        clients = client_override if client_override is not None else YOUTUBE_CLIENT_PROFILES[0]
        opts["extractor_args"] = {
            "youtube": {
                "player_client": clients,
            }
        }
    return opts


def extract_metadata(url: str) -> VideoMetadata:
    url = sanitize_url(url)
    platform = detect_platform(url)

    # If YouTube cooldown is active, skip hammering yt-dlp immediately
    if platform == "youtube" and is_youtube_cooldown_active():
        logger.info("YouTube cooldown active; skipping yt-dlp and checking oEmbed.")
        vid_id = extract_youtube_id(url)
        if vid_id:
            oembed_meta = fetch_youtube_oembed(vid_id)
            if oembed_meta:
                return oembed_meta
        raise DownloadException(
            "YouTube is blocking this server right now. Please try again later.",
            error_type="bot_check",
            status_code=503,
        )

    info = None
    last_err: Optional[Exception] = None

    client_candidates: List[Optional[List[str]]] = (
        YOUTUBE_CLIENT_PROFILES if platform == "youtube" else [None]
    )

    for client_profile in client_candidates:
        ydl_opts = get_base_ydl_opts(platform, client_override=client_profile)
        ydl_opts["skip_download"] = True
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if info and (info.get("_type") == "playlist" or "entries" in info):
                    entries = [e for e in info.get("entries", []) if e]
                    if entries:
                        info = entries[0]
                    else:
                        raise DownloadException("Playlist contains no playable videos.", "deleted", 404)
                if info:
                    break
        except yt_dlp.utils.DownloadError as e:
            last_err = e
            if is_bot_check_error(str(e)):
                trigger_youtube_cooldown()
                break  # Stop retrying; subsequent profiles will also fail
            continue
        except Exception as e:
            if isinstance(e, DownloadException):
                raise
            last_err = e
            if is_bot_check_error(str(e)):
                trigger_youtube_cooldown()
                break
            continue

    if not info:
        # If yt-dlp failed on cloud datacenter IP, try honest oEmbed fallback
        if platform == "youtube":
            vid_id = extract_youtube_id(url)
            if vid_id:
                oembed_meta = fetch_youtube_oembed(vid_id)
                if oembed_meta:
                    return oembed_meta
        if last_err:
            raise map_ytdlp_error(str(last_err))
        raise DownloadException("Could not retrieve video information.", "unknown", 404)

    video_id = info.get("id", str(uuid.uuid4())[:8])
    title = info.get("title", "Untitled Video")
    creator = info.get("uploader") or info.get("channel") or info.get("creator") or "Unknown Creator"
    creator_avatar = None
    duration = safe_int(info.get("duration"), 0)
    thumbnail = info.get("thumbnail") or ""

    formats: List[VideoFormat] = []
    raw_formats = info.get("formats", [])

    if platform == "youtube":
        available_heights = set()
        for f in raw_formats:
            h = f.get("height")
            if h and f.get("vcodec") != "none":
                available_heights.add(h)

        target_resolutions = [
            (2160, "4K (2160p)", "2160p"),
            (1440, "2K (1440p)", "1440p"),
            (1080, "1080p Full HD", "1080p"),
            (720, "720p HD", "720p"),
            (480, "480p", "480p"),
            (360, "360p", "360p"),
        ]

        for h, label, res_str in target_resolutions:
            if any(avail >= h - 20 for avail in available_heights) or h in [720, 360]:
                formats.append(
                    VideoFormat(
                        format_id=f"yt-{res_str}",
                        label=label,
                        resolution=res_str,
                        ext="mp4",
                        filesize=None,
                        is_audio_only=False,
                    )
                )

        formats.append(
            VideoFormat(
                format_id="yt-audio-mp3",
                label="MP3 Audio",
                resolution="Audio",
                ext="mp3",
                filesize=None,
                is_audio_only=True,
            )
        )

    elif platform == "tiktok":
        formats.append(
            VideoFormat(
                format_id="tiktok-no-watermark",
                label="No Watermark (Original)",
                resolution="HD",
                ext="mp4",
                filesize=None,
                is_audio_only=False,
            )
        )
        formats.append(
            VideoFormat(
                format_id="tiktok-watermark",
                label="With Watermark",
                resolution="HD",
                ext="mp4",
                filesize=None,
                is_audio_only=False,
            )
        )
        formats.append(
            VideoFormat(
                format_id="tiktok-audio",
                label="MP3 Audio",
                resolution="Audio",
                ext="mp3",
                filesize=None,
                is_audio_only=True,
            )
        )

    return VideoMetadata(
        id=video_id,
        platform=platform,
        title=title,
        creator=creator,
        creator_avatar=creator_avatar,
        duration=duration,
        thumbnail=thumbnail,
        formats=formats,
        downloads_available=True,
        notice=None,
    )


async def download_video_stream(url: str, format_id: str) -> AsyncGenerator[str, None]:
    url = sanitize_url(url)
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    platform = detect_platform(url)

    job_id = uuid.uuid4().hex[:10]
    out_template = str(DOWNLOAD_DIR / f"{job_id}_%(title).100B.%(ext)s")

    is_audio = "audio" in format_id or format_id == "tiktok-audio"

    ydl_opts = get_base_ydl_opts(platform)
    ydl_opts.update(
        {
            "outtmpl": out_template,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
        }
    )

    if is_audio:
        preferred_codec = "mp3" if "mp3" in format_id or format_id == "tiktok-audio" else "m4a"
        ydl_opts.update(
            {
                "format": "bestaudio/best",
                "postprocessors": [
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": preferred_codec,
                        "preferredquality": "192",
                    }
                ],
            }
        )
    else:
        if platform == "youtube":
            height_match = re.search(r"(\d+)p", format_id)
            if height_match:
                max_h = height_match.group(1)
                ydl_opts["format"] = f"bestvideo[height<={max_h}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<={max_h}]+bestaudio/best[height<={max_h}]/best"
            else:
                ydl_opts["format"] = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best"
            ydl_opts["merge_output_format"] = "mp4"
        elif platform == "tiktok":
            ydl_opts["format"] = "best[ext=mp4]/best"
            ydl_opts["merge_output_format"] = "mp4"

    def progress_hook(d: Dict[str, Any]):
        status = d.get("status")
        if status == "downloading":
            total = safe_int(d.get("total_bytes") or d.get("total_bytes_estimate"), 0)
            downloaded = safe_int(d.get("downloaded_bytes"), 0)
            percent = (downloaded / total * 100.0) if total > 0 else 0.0

            speed_str = format_bytes(d.get("speed"))
            speed_val = f"{speed_str}/s" if speed_str else None
            eta_val = format_seconds(d.get("eta"))

            prog = DownloadProgress(
                status="downloading",
                percent=min(round(percent, 1), 99.0),
                speed=speed_val,
                eta=eta_val,
                filesize=total if total > 0 else None,
            )
            loop.call_soon_threadsafe(queue.put_nowait, prog)

        elif status == "finished":
            prog = DownloadProgress(
                status="merging" if not is_audio else "converting",
                percent=99.0,
                speed=None,
                eta=None,
            )
            loop.call_soon_threadsafe(queue.put_nowait, prog)

    def postprocessor_hook(d: Dict[str, Any]):
        status = d.get("status")
        if status == "started":
            prog = DownloadProgress(
                status="merging" if not is_audio else "converting",
                percent=99.5,
                speed=None,
                eta=None,
            )
            loop.call_soon_threadsafe(queue.put_nowait, prog)

    ydl_opts["progress_hooks"] = [progress_hook]
    ydl_opts["postprocessor_hooks"] = [postprocessor_hook]

    final_filename: Optional[str] = None
    final_filesize: Optional[int] = None

    def run_download():
        nonlocal final_filename, final_filesize
        success = False
        last_error: Optional[Exception] = None

        # Check cooldown
        if platform == "youtube" and is_youtube_cooldown_active():
            logger.info("YouTube cooldown active; skipping yt-dlp download attempt.")
            last_error = DownloadException(
                "YouTube is blocking this server right now. Please try again later.",
                error_type="bot_check",
                status_code=503,
            )
        else:
            client_candidates: List[Optional[List[str]]] = (
                YOUTUBE_CLIENT_PROFILES if platform == "youtube" else [None]
            )

            for client_profile in client_candidates:
                curr_opts = dict(ydl_opts)
                if platform == "youtube":
                    curr_opts["extractor_args"] = {"youtube": {"player_client": client_profile}}
                try:
                    with yt_dlp.YoutubeDL(curr_opts) as ydl:
                        info = ydl.extract_info(url, download=True)
                        if not info:
                            continue

                        target_filename = ydl.prepare_filename(info)
                        if is_audio:
                            ext = curr_opts["postprocessors"][0]["preferredcodec"]
                            target_filename = os.path.splitext(target_filename)[0] + f".{ext}"
                        elif "merge_output_format" in curr_opts:
                            target_filename = os.path.splitext(target_filename)[0] + f".{curr_opts['merge_output_format']}"

                        if not os.path.exists(target_filename):
                            for f in os.listdir(DOWNLOAD_DIR):
                                if f.startswith(job_id):
                                    target_filename = str(DOWNLOAD_DIR / f)
                                    break

                        # Crucial fix: Only declare success if a file actually exists and has size
                        if os.path.exists(target_filename) and os.path.getsize(target_filename) > 0:
                            final_filename = os.path.basename(target_filename)
                            final_filesize = os.path.getsize(target_filename)
                            success = True
                            break
                except yt_dlp.utils.DownloadError as e:
                    last_error = e
                    if is_bot_check_error(str(e)):
                        trigger_youtube_cooldown()
                        break
                    continue
                except Exception as e:
                    last_error = e
                    if is_bot_check_error(str(e)):
                        trigger_youtube_cooldown()
                        break
                    continue

        # Optional Cobalt download fallback if configured
        if not success and platform == "youtube" and (os.getenv("COBALT_API_URL") or COBALT_API_URL):
            logger.info("yt-dlp blocked or failed. Attempting configured Cobalt fallback for %s", url)
            title_hint = "video"
            vid_id = extract_youtube_id(url)
            if vid_id:
                oembed = fetch_youtube_oembed(vid_id)
                if oembed:
                    title_hint = oembed.title

            cobalt_res = download_via_cobalt(url, format_id, job_id, title_hint, loop, queue)
            if cobalt_res:
                final_filename = cobalt_res["filename"]
                final_filesize = cobalt_res["filesize"]
                success = True

        if success:
            loop.call_soon_threadsafe(
                queue.put_nowait,
                DownloadProgress(
                    status="complete",
                    percent=100.0,
                    filename=final_filename,
                    filesize=final_filesize,
                ),
            )
        else:
            if isinstance(last_error, DownloadException):
                err = last_error
            else:
                err = map_ytdlp_error(str(last_error or "Download failed"))

            loop.call_soon_threadsafe(
                queue.put_nowait,
                DownloadProgress(
                    status="error",
                    percent=0.0,
                    error_message=err.detail,
                ),
            )
        loop.call_soon_threadsafe(queue.put_nowait, None)

    # Send initial progress state immediately
    loop.call_soon_threadsafe(
        queue.put_nowait,
        DownloadProgress(status="downloading", percent=1.0, speed="Starting...", eta="Calculating..."),
    )

    # Run in bounded background executor using running loop
    loop.run_in_executor(DOWNLOAD_EXECUTOR, run_download)

    while True:
        prog = await queue.get()
        if prog is None:
            break
        yield f"data: {prog.model_dump_json()}\n\n"
