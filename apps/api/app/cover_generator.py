"""
Full HD Viral Cover & Thumbnail Generator for YouTube Shorts / Reels / TikTok.

Generates high-converting, high-energy 1080x1920 Full HD cover images from video clips using:
1. High-contrast color grading (contrast boost, saturation pop, crisp exposure).
2. Upper urgency virality badge (e.g. '🔥 VIRAL MOMENT', '⚡ MUST WATCH').
3. Bold viral headline typography (Hormozi / MrBeast style typography).
4. Lower high-retention call-to-action banner ('WATCH TILL THE END').
"""

import logging
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Optional

from app.config import FFMPEG_PATH

logger = logging.getLogger(__name__)


COVERS_DIR = Path(__file__).resolve().parent.parent / "assets" / "covers"


def get_available_cover_templates() -> list[Path]:
    """Returns list of stored GTA 6 cover templates in assets/covers."""
    if not COVERS_DIR.is_dir():
        return []
    return sorted(list(COVERS_DIR.glob("*.jpg")) + list(COVERS_DIR.glob("*.png")) + list(COVERS_DIR.glob("*.jpeg")))


def sanitize_cover_text(text: str) -> str:
    """Sanitizes text for FFmpeg drawtext to avoid quoting or rendering errors."""
    if not text:
        return ""
    # Strip emojis and non-ASCII to prevent missing-glyph tofu boxes
    text = re.sub(r"[^\x20-\x7E\n]", "", text)
    text = text.replace("\\", "\\\\").replace("'", "").replace(":", " - ").replace("%", "%%")
    words = text.split()
    if len(words) > 4 and "\n" not in text:
        half = len(words) // 2
        text = " ".join(words[:half]) + "\n" + " ".join(words[half:])
    return text.strip()


def generate_viral_cover_image(
    video_path: str,
    output_path: str,
    hook_title: str,
    hook_style: str = "hormozi_bold",
    badge_text: str = "GTA 6 EXCLUSIVE",
    timestamp: float = 2.0,
    template_index: Optional[int] = None,
    use_gta_template: bool = True,
) -> bool:
    """
    Generates a 1080x1920 Full HD viral cover image with high-energy graphics and bold typography,
    prioritizing official GTA 6 cover artworks stored in assets/covers.
    """
    ffmpeg = FFMPEG_PATH or shutil.which("ffmpeg")
    if not ffmpeg:
        try:
            import static_ffmpeg
            static_ffmpeg.add_paths()
            ffmpeg = shutil.which("ffmpeg")
        except Exception:
            pass

    if not ffmpeg:
        logger.warning("Cannot generate cover image: FFmpeg executable not found.")
        return False

    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    clean_hook = sanitize_cover_text(hook_title or "VIRAL MOMENT")
    if not clean_hook:
        clean_hook = "VIRAL MOMENT"

    clean_badge = sanitize_cover_text(badge_text or "GTA 6 EXCLUSIVE")
    if not clean_badge:
        clean_badge = "GTA 6 EXCLUSIVE"

    # Style-specific color accents
    if hook_style in ("mrbeast_urgency", "red_accent"):
        title_box_color = "0xE50914@0.92"
        title_font_color = "white"
        title_border = ""
    elif hook_style in ("tiktok_trending", "cinematic_glow"):
        title_box_color = "0x111827@0.85"
        title_font_color = "white"
        title_border = ":borderw=3:bordercolor=black"
    else:
        # Default: hormozi_bold neon yellow
        title_box_color = "black@0.8"
        title_font_color = "0xFFE600"
        title_border = ":borderw=4:bordercolor=black:shadowcolor=black@0.9:shadowx=3:shadowy=3"

    # Build FFmpeg filtergraph for high-energy 1080x1920 cover
    filters = [
        "scale=1080:1920:force_original_aspect_ratio=increase",
        "crop=1080:1920",
        "eq=contrast=1.18:saturation=1.35:brightness=0.01",
        # Top Urgency Badge Pill
        "drawbox=y=90:w=520:h=64:x=(w-520)/2:color=0xE50914@0.95:t=fill",
        f"drawtext=text='{clean_badge}':fontsize=34:fontcolor=white:x=(w-text_w)/2:y=106",
        # Main Headline Box & Typography
        f"drawbox=y=190:h=260:color={title_box_color}:t=fill",
        f"drawtext=text='{clean_hook}':fontsize=54:fontcolor={title_font_color}{title_border}:x=(w-text_w)/2:y=245:line_spacing=12",
        # Bottom CTA Retention Pill
        "drawbox=y=1640:h=90:color=black@0.85:t=fill",
        "drawtext=text='WATCH TILL THE END':fontsize=40:fontcolor=0xFFE600:borderw=3:bordercolor=black:x=(w-text_w)/2:y=1665",
    ]
    filter_complex = f"[0:v]{','.join(filters)}[out]"

    # Check for stored GTA 6 cover templates in assets/covers/
    template_file: Optional[Path] = None
    if use_gta_template:
        templates = get_available_cover_templates()
        if templates:
            idx = template_index if template_index is not None else 0
            template_file = templates[idx % len(templates)]

    has_video = video_path and os.path.exists(video_path)

    if template_file and template_file.is_file():
        # Input 0 is the GTA 6 template artwork
        cmd = [
            ffmpeg, "-y",
            "-i", str(template_file),
            "-vframes", "1",
            "-filter_complex", filter_complex,
            "-map", "[out]",
            "-q:v", "2",
            str(out_file),
        ]
    elif has_video:
        cmd = [
            ffmpeg, "-y",
            "-ss", str(max(0.5, timestamp)),
            "-i", video_path,
            "-vframes", "1",
            "-filter_complex", filter_complex,
            "-map", "[out]",
            "-q:v", "2",
            str(out_file),
        ]
    else:
        cmd = [
            ffmpeg, "-y",
            "-f", "lavfi", "-i", "color=c=0x111827:s=1080x1920:d=1",
            "-vframes", "1",
            "-filter_complex", filter_complex,
            "-map", "[out]",
            "-q:v", "2",
            str(out_file),
        ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if proc.returncode == 0 and out_file.is_file() and out_file.stat().st_size > 0:
            logger.info("Generated Full HD viral cover image: %s (%d bytes)", out_file.name, out_file.stat().st_size)
            return True
        logger.warning("Cover generation failed (%d): %s", proc.returncode, proc.stderr[-200:] if proc.stderr else "")
    except Exception as err:
        logger.warning("Cover generation exception: %s", err)

    # Fallback: simple frame capture without filters if complex filter failed
    if has_video:
        try:
            fallback_cmd = [
                ffmpeg, "-y",
                "-ss", str(max(0.5, timestamp)),
                "-i", video_path,
                "-vframes", "1",
                "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
                "-q:v", "2",
                str(out_file),
            ]
            f_proc = subprocess.run(fallback_cmd, capture_output=True, text=True, timeout=10)
            return f_proc.returncode == 0 and out_file.is_file()
        except Exception:
            pass

    return False


def attach_cover_intro_to_video(
    video_path: str,
    cover_path: str,
    output_path: str,
    duration: float = 0.35,
) -> bool:
    """
    Slices / concats the Full HD cover image as the opening frame (default 0.35s) of the video.
    This guarantees that YouTube Shorts automatically selects this high-energy GTA 6 cover
    as the Short's thumbnail on mobile feeds, Shorts player, and video previews.
    """
    ffmpeg = FFMPEG_PATH or shutil.which("ffmpeg")
    if not ffmpeg:
        try:
            import static_ffmpeg
            static_ffmpeg.add_paths()
            ffmpeg = shutil.which("ffmpeg")
        except Exception:
            pass

    if not ffmpeg or not os.path.exists(video_path) or not os.path.exists(cover_path):
        return False

    ffprobe = shutil.which("ffprobe")
    has_audio = False
    if ffprobe:
        try:
            probe_cmd = [
                ffprobe, "-v", "error",
                "-select_streams", "a",
                "-show_entries", "stream=codec_name",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path,
            ]
            res = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=5)
            has_audio = bool(res.stdout.strip())
        except Exception:
            pass

    fps = 30
    loops = max(1, int(duration * fps))

    if has_audio:
        filtergraph = (
            f"[0:v]loop=loop={loops}:size=1:start=0,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps={fps}[vc];"
            f"[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps={fps}[vm];"
            f"[vc][vm]concat=n=2:v=1:a=0[outv];"
            f"aevalsrc=0:d={duration}:s=44100[silence];"
            f"[silence][1:a]concat=n=2:v=0:a=1[outa]"
        )
        cmd = [
            ffmpeg, "-y",
            "-i", str(cover_path),
            "-i", str(video_path),
            "-filter_complex", filtergraph,
            "-map", "[outv]",
            "-map", "[outa]",
            "-c:v", "libx264", "-preset", "ultrafast",
            "-c:a", "aac",
            "-movflags", "+faststart",
            str(output_path),
        ]
    else:
        filtergraph = (
            f"[0:v]loop=loop={loops}:size=1:start=0,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps={fps}[vc];"
            f"[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps={fps}[vm];"
            f"[vc][vm]concat=n=2:v=1:a=0[outv]"
        )
        cmd = [
            ffmpeg, "-y",
            "-i", str(cover_path),
            "-i", str(video_path),
            "-filter_complex", filtergraph,
            "-map", "[outv]",
            "-c:v", "libx264", "-preset", "ultrafast",
            "-movflags", "+faststart",
            str(output_path),
        ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if proc.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            logger.info("Successfully attached cover intro to video: %s", output_path)
            return True
        logger.warning("Failed to attach cover intro (%d): %s", proc.returncode, proc.stderr[-200:] if proc.stderr else "")
    except Exception as e:
        logger.warning("Error attaching cover intro to video: %s", e)

    return False

