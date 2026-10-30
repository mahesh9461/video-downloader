import asyncio
import os
import re
import uuid
import logging
from typing import AsyncGenerator, Dict, Any, List, Optional
import yt_dlp

from app.config import DOWNLOAD_DIR, FFMPEG_PATH
from app.schemas import VideoFormat, VideoMetadata, DownloadProgress

logger = logging.getLogger(__name__)

YOUTUBE_REGEX = re.compile(
    r"^(https?://)?(www\.|m\.)?(youtube\.com/(watch\?v=|shorts/|embed/)|youtu\.be/)[\w-]{11}"
)
TIKTOK_REGEX = re.compile(
    r"^(https?://)?(www\.)?(tiktok\.com/@[\w.-]+/video/\d+|(vm|vt)\.tiktok\.com/[\w]+|tiktok\.com/t/[\w]+)"
)


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


def map_ytdlp_error(error_msg: str) -> DownloadException:
    msg = error_msg.lower()
    if "private video" in msg or "sign in if you've been granted access" in msg or "login required" in msg:
        return DownloadException("This video is private or requires sign-in.", "private", 403)
    if "not available in your country" in msg or "geo-restricted" in msg or "blocked in your country" in msg:
        return DownloadException("This video is not available in your region.", "geo_restricted", 403)
    if "video unavailable" in msg or "removed by the user" in msg or "has been deleted" in msg or "404" in msg:
        return DownloadException("The requested video was deleted or cannot be found.", "deleted", 404)
    if "too many requests" in msg or "rate-limit" in msg or "429" in msg or "bot" in msg:
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


def get_base_ydl_opts(platform: str, client_override: Optional[List[str]] = None) -> Dict[str, Any]:
    opts: Dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
    }
    if FFMPEG_PATH:
        opts["ffmpeg_location"] = FFMPEG_PATH

    if platform == "youtube":
        # android_vr and android bypass YouTube's "The page needs to be reloaded" bot challenge
        clients = client_override or ["android_vr", "android", "web"]
        opts["extractor_args"] = {
            "youtube": {
                "player_client": clients,
            }
        }
    return opts


def extract_metadata(url: str) -> VideoMetadata:
    platform = detect_platform(url)

    ydl_opts = get_base_ydl_opts(platform)
    ydl_opts["skip_download"] = True

    info = None
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        err_str = str(e)
        # If web/default triggered the reload or playability block, fallback specifically to mobile clients
        if platform == "youtube" and ("page needs to be reloaded" in err_str or "playability" in err_str.lower()):
            try:
                fallback_opts = get_base_ydl_opts(platform, client_override=["android_vr", "android"])
                fallback_opts["skip_download"] = True
                with yt_dlp.YoutubeDL(fallback_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
            except Exception as fb_err:
                raise map_ytdlp_error(str(fb_err))
        else:
            raise map_ytdlp_error(err_str)
    except Exception as e:
        if isinstance(e, DownloadException):
            raise
        raise DownloadException(str(e), "unknown", 400)

    if not info:
        raise DownloadException("Could not retrieve video information.", "unknown", 404)

    video_id = info.get("id", str(uuid.uuid4())[:8])
    title = info.get("title", "Untitled Video")
    creator = info.get("uploader") or info.get("channel") or info.get("creator") or "Unknown Creator"
    creator_avatar = None
    duration = int(info.get("duration") or 0)
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
                approx_size = None
                for f in raw_formats:
                    if f.get("height") == h and (f.get("filesize") or f.get("filesize_approx")):
                        approx_size = f.get("filesize") or f.get("filesize_approx")
                        break

                formats.append(
                    VideoFormat(
                        format_id=f"yt-{res_str}",
                        label=label,
                        resolution=res_str,
                        ext="mp4",
                        filesize=approx_size,
                        is_audio_only=False,
                    )
                )

        formats.append(
            VideoFormat(
                format_id="yt-audio-mp3",
                label="MP3 Audio",
                resolution=None,
                ext="mp3",
                filesize=None,
                is_audio_only=True,
            )
        )
        formats.append(
            VideoFormat(
                format_id="yt-audio-m4a",
                label="M4A Audio",
                resolution=None,
                ext="m4a",
                filesize=None,
                is_audio_only=True,
            )
        )

    elif platform == "tiktok":
        formats.append(
            VideoFormat(
                format_id="tiktok-nowm",
                label="No Watermark",
                resolution="HD",
                ext="mp4",
                filesize=info.get("filesize") or info.get("filesize_approx"),
                is_audio_only=False,
            )
        )
        formats.append(
            VideoFormat(
                format_id="tiktok-hd",
                label="HD Video",
                resolution="Original",
                ext="mp4",
                filesize=info.get("filesize") or info.get("filesize_approx"),
                is_audio_only=False,
            )
        )
        formats.append(
            VideoFormat(
                format_id="tiktok-audio",
                label="Extract Audio (MP3)",
                resolution=None,
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
    )


async def download_video_stream(url: str, format_id: str) -> AsyncGenerator[str, None]:
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    platform = detect_platform(url)

    job_id = uuid.uuid4().hex[:10]
    out_template = str(DOWNLOAD_DIR / f"{job_id}_%(title).100B.%(ext)s")

    is_audio = "audio" in format_id or format_id == "tiktok-audio"

    ydl_opts = get_base_ydl_opts(platform, client_override=["android_vr", "android"] if platform == "youtube" else None)
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
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
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
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                if info:
                    target_filename = ydl.prepare_filename(info)
                    if is_audio:
                        ext = ydl_opts["postprocessors"][0]["preferredcodec"]
                        target_filename = os.path.splitext(target_filename)[0] + f".{ext}"
                    elif "merge_output_format" in ydl_opts:
                        target_filename = os.path.splitext(target_filename)[0] + f".{ydl_opts['merge_output_format']}"

                    if not os.path.exists(target_filename):
                        # Find matching file with job_id prefix in DOWNLOAD_DIR
                        for f in os.listdir(DOWNLOAD_DIR):
                            if f.startswith(job_id):
                                target_filename = str(DOWNLOAD_DIR / f)
                                break

                    final_filename = os.path.basename(target_filename)
                    if os.path.exists(target_filename):
                        final_filesize = os.path.getsize(target_filename)

                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    DownloadProgress(
                        status="complete",
                        percent=100.0,
                        filename=final_filename,
                        filesize=final_filesize,
                    ),
                )
        except Exception as e:
            err = map_ytdlp_error(str(e))
            loop.call_soon_threadsafe(
                queue.put_nowait,
                DownloadProgress(
                    status="error",
                    percent=0.0,
                    error_message=err.detail,
                ),
            )
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)

    # Run in background executor
    asyncio.get_event_loop().run_in_executor(None, run_download)

    while True:
        prog = await queue.get()
        if prog is None:
            break
        yield f"data: {prog.model_dump_json()}\n\n"

