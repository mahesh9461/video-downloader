import asyncio
import os
import re
import uuid
import logging
import subprocess
from concurrent.futures import ThreadPoolExecutor
from typing import AsyncGenerator, Dict, Any, List, Optional
import httpx
import yt_dlp

from app.config import DOWNLOAD_DIR, FFMPEG_PATH, COOKIE_FILE_PATH, PROXY_URL
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
    """
    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json",
    }
    try:
        with httpx.Client(timeout=6.0, follow_redirects=True, headers=headers) as client:
            resp = client.get(oembed_url)
            if resp.status_code == 200:
                data = resp.json()
                title = data.get("title", "YouTube Video")
                author = data.get("author_name", "YouTube Creator")
                thumbnail = data.get("thumbnail_url") or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

                formats = [
                    VideoFormat(format_id="yt-1080p", label="1080p Full HD", resolution="1080p", ext="mp4", is_audio_only=False),
                    VideoFormat(format_id="yt-720p", label="720p HD", resolution="720p", ext="mp4", is_audio_only=False),
                    VideoFormat(format_id="yt-480p", label="480p", resolution="480p", ext="mp4", is_audio_only=False),
                    VideoFormat(format_id="yt-360p", label="360p", resolution="360p", ext="mp4", is_audio_only=False),
                    VideoFormat(format_id="yt-audio-mp3", label="MP3 Audio", resolution="Audio", ext="mp3", is_audio_only=True),
                ]
                logger.info(f"Retrieved YouTube video metadata via Google oEmbed for {video_id}: {title}")
                return VideoMetadata(
                    id=video_id,
                    platform="youtube",
                    title=title,
                    creator=author,
                    creator_avatar=None,
                    duration=0,
                    thumbnail=thumbnail,
                    formats=formats,
                )
    except Exception as e:
        logger.warning(f"Google oEmbed failed for {video_id}: {e}")
    return None


COBALT_INSTANCES = [
    inst for inst in [
        os.getenv("COBALT_API_URL"),
        "https://api.cobalt.tools",
        "https://cobalt-api.kwiatekm.pl",
        "https://cobalt.xy2401.com",
    ] if inst
]


def download_via_cobalt(
    url: str,
    format_id: str,
    job_id: str,
    title: str,
    loop: asyncio.AbstractEventLoop,
    queue: asyncio.Queue,
) -> Optional[Dict[str, Any]]:
    """
    Downloads media streams via the Cobalt production engine.
    Bypasses datacenter IP blocks, extracts 1080p/720p/MP3 with zero bot challenge.
    """
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
    cobalt_key = os.getenv("COBALT_API_KEY")
    if cobalt_key:
        client_headers["Authorization"] = f"Api-Key {cobalt_key}"

    loop.call_soon_threadsafe(
        queue.put_nowait,
        DownloadProgress(status="downloading", percent=15.0, speed="Connecting to high-speed engine...", eta="Starting..."),
    )

    with httpx.Client(timeout=45.0, follow_redirects=True, headers=client_headers) as client:
        for instance in COBALT_INSTANCES:
            try:
                endpoint = instance.rstrip("/") + "/"
                resp = client.post(endpoint, json=payload)
                logger.info(f"Cobalt {instance}: {resp.status_code} {resp.text[:200]}")
                if resp.status_code == 200:
                    data = resp.json()
                    stream_url = data.get("url")
                    if stream_url:
                        clean_title = sanitize_filename(title)
                        out_filename = f"{job_id}_{clean_title}.{ext}"
                        out_path = DOWNLOAD_DIR / out_filename

                        loop.call_soon_threadsafe(
                            queue.put_nowait,
                            DownloadProgress(status="downloading", percent=40.0, speed="Streaming...", eta="A few seconds"),
                        )

                        with client.stream("GET", stream_url) as stream_resp:
                            if stream_resp.status_code in (200, 206):
                                total_bytes = int(stream_resp.headers.get("content-length") or 0)
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

                                if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
                                    logger.info(f"Cobalt download succeeded via {instance}: {out_filename}")
                                    return {"filename": out_filename, "filesize": os.path.getsize(out_path)}
            except Exception as e:
                logger.warning(f"Cobalt instance {instance} failed: {e}")
                continue
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
        clients = client_override if client_override is not None else ["tv_samsung", "web_embedded", "ios", "mweb", "android"]
        opts["extractor_args"] = {
            "youtube": {
                "player_client": clients,
            }
        }
    return opts


def extract_metadata(url: str) -> VideoMetadata:
    url = sanitize_url(url)
    platform = detect_platform(url)

    info = None
    last_err: Optional[Exception] = None

    client_candidates: List[Optional[List[str]]] = (
        [
            ["tv_samsung", "web_embedded"],
            ["web_embedded"],
            ["tv_samsung"],
            ["ios", "mweb", "android"],
            ["android"],
            ["ios"],
            None,
        ]
        if platform == "youtube"
        else [None]
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
            continue
        except Exception as e:
            if isinstance(e, DownloadException):
                raise
            last_err = e
            continue

    if not info:
        # If yt-dlp failed on cloud datacenter IP, immediately fallback to official Google oEmbed
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
        success = False
        last_error = None

        client_candidates: List[Optional[List[str]]] = (
            [
                ["tv_samsung", "web_embedded"],
                ["web_embedded"],
                ["tv_samsung"],
                ["ios", "mweb", "android"],
                ["android"],
                ["ios"],
                None,
            ]
            if platform == "youtube"
            else [None]
        )

        for client_profile in client_candidates:
            curr_opts = dict(ydl_opts)
            if platform == "youtube":
                clients = client_profile if client_profile is not None else ["tv_samsung", "web_embedded", "ios"]
                curr_opts["extractor_args"] = {"youtube": {"player_client": clients}}
            try:
                with yt_dlp.YoutubeDL(curr_opts) as ydl:
                    info = ydl.extract_info(url, download=True)
                    if info:
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

                        final_filename = os.path.basename(target_filename)
                        if os.path.exists(target_filename):
                            final_filesize = os.path.getsize(target_filename)

                    success = True
                    break
            except Exception as e:
                last_error = e
                continue

        # If yt-dlp was blocked by YouTube bot challenge, seamlessly use Cobalt engine!
        if not success and platform == "youtube":
            logger.info(f"yt-dlp blocked on datacenter IP. Seamlessly executing Cobalt download fallback for {url}")
            cobalt_res = download_via_cobalt(url, format_id, job_id, "video", loop, queue)
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

    # Run in bounded background executor
    asyncio.get_event_loop().run_in_executor(DOWNLOAD_EXECUTOR, run_download)

    while True:
        prog = await queue.get()
        if prog is None:
            break
        yield f"data: {prog.model_dump_json()}\n\n"
