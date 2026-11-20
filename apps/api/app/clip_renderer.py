"""
Viral Shorts & Clip Renderer.

Transforms 16:9 landscape videos into 9:16 vertical Shorts/TikToks/Reels with:
1. Smart Layout Framing (Blurred Background, Center Crop, Letterbox).
2. Hook Title Banner Overlays (High-contrast, attention-grabbing titles).
3. Background Music Mixing & Audio Ducking.
"""

import asyncio
import logging
import os
import re
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import DOWNLOAD_DIR, FFMPEG_PATH
from app.schemas import PresetOption

logger = logging.getLogger(__name__)

# Available 9:16 vertical layouts
LAYOUT_PRESETS: List[PresetOption] = [
    PresetOption(
        id="center_crop",
        label="Full Screen 9:16 (Smart Speaker Focus)",
        description="Fills the entire 9:16 vertical screen with high-impact edge-to-edge action.",
    ),
    PresetOption(
        id="split_screen",
        label="Viral Split Screen (Ssemble Trend)",
        description="Top half main video + bottom half dynamic ambient mirror stack.",
    ),
    PresetOption(
        id="blurred_background",
        label="Blurred Backdrop (Opus / Ssemble Style)",
        description="Centered 16:9 video over a heavily blurred, zoomed vertical background.",
    ),
    PresetOption(
        id="fit_black",
        label="Classic Letterbox",
        description="Fits original video within a clean vertical black canvas.",
    ),
]

# Available background music synthesizers / presets
MUSIC_PRESETS: List[PresetOption] = [
    PresetOption(
        id="lofi_chill",
        label="Lo-Fi Chill",
        description="Warm, relaxing harmonic chord bed ducked softly behind speech.",
    ),
    PresetOption(
        id="energetic_beat",
        label="Energetic Pulse",
        description="Upbeat rhythmic pulse and sub-bass drive.",
    ),
    PresetOption(
        id="dramatic_suspense",
        label="Dramatic Suspense",
        description="Low tension drone and atmospheric fifths for mystery and reveals.",
    ),
    PresetOption(
        id="ambient_drone",
        label="Soft Ambient Pad",
        description="Subtle ethereal soundscape for calm storytelling.",
    ),
    PresetOption(
        id="none",
        label="No Background Music",
        description="Keeps only the original voice/audio without any music.",
    ),
]

# Headline banner visual styles
HOOK_STYLES: List[PresetOption] = [
    PresetOption(
        id="none",
        label="None (Clean Video)",
        description="Clean vertical video without text overlay (ideal for CapCut/TikTok captioning).",
    ),
    PresetOption(
        id="hormozi_bold",
        label="Hormozi Kinetic (Neon Yellow / Bold Stroke)",
        description="High-contrast vibrant yellow font with heavy black outline for maximum retention.",
    ),
    PresetOption(
        id="mrbeast_urgency",
        label="MrBeast Alert (White on Red Banner)",
        description="Urgent high-impact white headline inside a bold red contrast pill.",
    ),
    PresetOption(
        id="tiktok_trending",
        label="TikTok Trending (Frosted Dark Pill)",
        description="Clean white typography inside a modern translucent dark rounded pill.",
    ),
    PresetOption(
        id="cinematic_glow",
        label="Cinematic Glow (Pure Text with Deep Shadow)",
        description="Elegant bold white typography with deep drop shadow and no box.",
    ),
    PresetOption(
        id="yellow_box",
        label="Classic Yellow Box",
        description="Vibrant yellow text inside a semi-transparent black contrast box.",
    ),
]

# Kinetic progress bar color hexes
PROGRESS_BAR_COLORS: Dict[str, str] = {
    "yellow": "0xFFE600@0.95",
    "cyan": "0x00F0FF@0.95",
    "violet": "0xBD00FF@0.95",
    "red": "0xFF2A2A@0.95",
    "white": "0xFFFFFF@0.95",
}

# Procedural synth audio expressions for CC0 background audio beds
SYNTH_EXPRESSIONS: Dict[str, str] = {
    "lofi_chill": "0.025*sin(2*PI*220*t)+0.02*sin(2*PI*277.18*t)+0.015*sin(2*PI*329.63*t)",
    "energetic_beat": "0.03*sin(2*PI*110*t)*(1+0.5*sin(2*PI*4*t))+0.015*sin(2*PI*440*t)",
    "dramatic_suspense": "0.04*sin(2*PI*55*t)+0.025*sin(2*PI*82.41*t)+0.015*sin(2*PI*110*t)",
    "ambient_drone": "0.02*sin(2*PI*164.81*t)+0.02*sin(2*PI*220*t)+0.015*sin(2*PI*246.94*t)",
}


class ClipRenderException(Exception):
    """Raised when rendering a viral clip fails."""

    def __init__(self, detail: str, error_type: str = "render_error", status_code: int = 400):
        super().__init__(detail)
        self.detail = detail
        self.error_type = error_type
        self.status_code = status_code


def _require_ffmpeg() -> str:
    ffmpeg = FFMPEG_PATH or shutil.which("ffmpeg")
    if not ffmpeg:
        raise ClipRenderException(
            "FFmpeg is not available on this server. Clip rendering requires FFmpeg.",
            error_type="missing_dependency",
            status_code=503,
        )
    return ffmpeg


def probe_video_duration(video_path: str) -> float:
    """Probes the total duration in seconds of a video file using FFmpeg."""
    ffmpeg = FFMPEG_PATH or shutil.which("ffmpeg")
    if not ffmpeg or not os.path.exists(video_path):
        return 60.0

    try:
        cmd = [ffmpeg, "-i", video_path]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        dur_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", res.stderr)
        if dur_match:
            h, m, s = dur_match.groups()
            return round(int(h) * 3600 + int(m) * 60 + float(s), 2)
    except Exception as e:
        logger.debug("Failed to probe video duration: %s", e)
    return 60.0


def sanitize_drawtext_string(text: str) -> str:
    """Escapes characters and strips unsupported non-ASCII / emojis to avoid broken tofu boxes."""
    # Remove emojis and non-ASCII glyphs that default FFmpeg fonts cannot render (avoid ⮽ tofu boxes)
    text = re.sub(r"[^\x20-\x7E\n]", "", text)
    text = text.replace("\\", "\\\\").replace("'", "").replace(":", " - ").replace("%", "%%")
    # Wrap long headlines into 2 lines if needed
    words = text.split()
    if len(words) > 5 and "\n" not in text:
        half = len(words) // 2
        text = " ".join(words[:half]) + "\n" + " ".join(words[half:])
    return text.strip()


def format_ass_time(seconds: float) -> str:
    """Formats seconds into ASS subtitle timestamp string: H:MM:SS.cs"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs >= 100:
        cs = 99
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def generate_ass_subtitles(
    cues: List[Dict[str, Any]],
    start_time: float,
    end_time: float,
    output_path: str,
    style: str = "viral_yellow",
) -> bool:
    """Generates an ASS subtitle file for burning in Ssemble-style viral captions."""
    if not cues:
        return False

    relevant_cues = []
    for c in cues:
        c_start = float(c.get("start", 0))
        c_end = float(c.get("end", 0))
        text = str(c.get("text", "")).strip()
        if not text:
            continue
        if c_end >= start_time and c_start <= end_time:
            # Shift relative to start_time
            rel_start = max(0.0, c_start - start_time)
            rel_end = min(end_time - start_time, c_end - start_time)
            if rel_end > rel_start:
                clean_text = sanitize_drawtext_string(text).replace("\n", "\\N")
                relevant_cues.append((rel_start, rel_end, clean_text))

    if not relevant_cues:
        return False

    # PrimaryColour in ASS is &HAABBGGRR (Hex BGR)
    primary_color = "&H0000FFFF" if style == "viral_yellow" else "&H00FFFFFF"

    ass_content = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1080",
        "PlayResY: 1920",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: ViralCaptions,Helvetica,52,{primary_color},&H00000000,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,40,40,280,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    for s, e, txt in relevant_cues:
        ass_content.append(
            f"Dialogue: 0,{format_ass_time(s)},{format_ass_time(e)},ViralCaptions,,0,0,0,,{txt}"
        )

    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(ass_content))
        return True
    except Exception as err:
        logger.warning("Failed to write ASS subtitle file: %s", err)
        return False


def build_video_filtergraph(
    layout: str,
    hook_title: Optional[str] = None,
    hook_style: str = "none",
    clip_duration: float = 30.0,
    progress_bar: bool = True,
    progress_bar_color: str = "yellow",
    subtitles_path: Optional[str] = None,
) -> str:
    """Builds the 1080x1920 vertical layout filtergraph with optional hook text overlay, subtitles, and kinetic progress bar."""
    if layout == "center_crop":
        base_v = "[0:v]crop=ih*9/16:ih:(iw-ow)/2:0,scale=1080:1920[framed]"
    elif layout == "split_screen":
        base_v = (
            "[0:v]split=2[top_raw][bot_raw];"
            "[top_raw]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960[top_v];"
            "[bot_raw]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960,boxblur=18:4[bot_v];"
            "[top_v][bot_v]vstack=inputs=2[framed]"
        )
    elif layout == "fit_black":
        base_v = "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[framed]"
    else:
        # Default: blurred_background
        base_v = (
            "[0:v]split=2[in_bg][in_fg];"
            "[in_bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=22:5[bg];"
            "[in_fg]scale=1080:-1[fg];"
            "[bg][fg]overlay=(W-w)/2:(H-h)/2[framed]"
        )

    filters: List[str] = []

    # 1. Viral Hook Headline Overlay
    if hook_title and hook_title.strip() and hook_style not in ("none", "clean"):
        clean_title = sanitize_drawtext_string(hook_title.strip())
        if clean_title:
            if hook_style == "hormozi_bold":
                filters.append(
                    f"drawtext=text='{clean_title}':fontsize=52:fontcolor=0xFFE600:"
                    "borderw=4:bordercolor=black:shadowcolor=black@0.9:shadowx=3:shadowy=3:"
                    "x=(w-text_w)/2:y=240:line_spacing=12"
                )
            elif hook_style in ("mrbeast_urgency", "red_accent"):
                filters.append(
                    f"drawtext=text='{clean_title}':fontsize=48:fontcolor=white:"
                    "box=1:boxcolor=0xE50914@0.92:boxborderw=16:"
                    "x=(w-text_w)/2:y=240:line_spacing=12"
                )
            elif hook_style == "tiktok_trending":
                filters.append(
                    f"drawtext=text='{clean_title}':fontsize=46:fontcolor=white:"
                    "box=1:boxcolor=0x111827@0.8:boxborderw=18:"
                    "x=(w-text_w)/2:y=240:line_spacing=12"
                )
            elif hook_style in ("cinematic_glow", "minimal"):
                filters.append(
                    f"drawtext=text='{clean_title}':fontsize=50:fontcolor=white:"
                    "borderw=3:bordercolor=black@0.8:shadowcolor=black@0.95:shadowx=4:shadowy=4:"
                    "x=(w-text_w)/2:y=240:line_spacing=12"
                )
            elif hook_style == "bold_white":
                filters.append(
                    f"drawtext=text='{clean_title}':fontsize=48:fontcolor=white:"
                    "box=1:boxcolor=black@0.75:boxborderw=14:"
                    "x=(w-text_w)/2:y=240:line_spacing=10"
                )
            else:
                # Default: yellow_box
                filters.append(
                    f"drawtext=text='{clean_title}':fontsize=48:fontcolor=yellow:"
                    "box=1:boxcolor=black@0.7:boxborderw=12:"
                    "x=(w-text_w)/2:y=240:line_spacing=10"
                )

    # 2. Ssemble-Style Viral Auto-Captions Burn-in
    if subtitles_path and os.path.exists(subtitles_path):
        filters.append(f"subtitles='{subtitles_path}'")

    # 3. Dynamic Kinetic Progress Bar (Left-to-Right Animated Fill at Bottom)
    if progress_bar:
        bar_color = PROGRESS_BAR_COLORS.get(progress_bar_color, "0xFFE600@0.95")
        safe_dur = max(0.1, round(clip_duration, 2))
        filters.append(
            f"drawbox=x=0:y=ih-14:w='iw*min(1.0,t/{safe_dur})':h=14:color={bar_color}:t=fill"
        )

    if not filters:
        return f"{base_v};[framed]null[v]"

    # Chain filters sequentially
    curr_label = "framed"
    chain_parts = []
    for idx, f in enumerate(filters):
        next_label = "v" if idx == len(filters) - 1 else f"f{idx}"
        chain_parts.append(f"[{curr_label}]{f}[{next_label}]")
        curr_label = next_label

    return f"{base_v};" + ";".join(chain_parts)


def render_viral_clip(
    input_path: str,
    output_path: str,
    start_time: float,
    end_time: float,
    layout: str = "center_crop",
    hook_title: Optional[str] = None,
    hook_style: str = "none",
    background_music: Optional[str] = "none",
    music_volume: float = 0.12,
    progress_bar: bool = True,
    progress_bar_color: str = "yellow",
    subtitles_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Renders a vertical 9:16 viral short using FFmpeg.
    """
    ffmpeg = _require_ffmpeg()

    if end_time <= start_time:
        raise ClipRenderException("End time must be strictly greater than start time.", "invalid_time_range")

    clip_duration = round(end_time - start_time, 2)
    if clip_duration > 180:
        raise ClipRenderException("Maximum clip duration is 3 minutes (180 seconds).", "duration_too_long")

    video_filter = build_video_filtergraph(
        layout=layout,
        hook_title=hook_title,
        hook_style=hook_style,
        clip_duration=clip_duration,
        progress_bar=progress_bar,
        progress_bar_color=progress_bar_color,
        subtitles_path=subtitles_path,
    )

    has_music = (
        background_music
        and background_music != "none"
        and background_music in SYNTH_EXPRESSIONS
    )

    cmd = [
        ffmpeg, "-y",
        "-ss", str(start_time),
        "-t", str(clip_duration),
        "-i", input_path,
    ]

    if has_music:
        # Generate procedural harmonic background music bed
        synth_expr = SYNTH_EXPRESSIONS[background_music]
        cmd.extend([
            "-f", "lavfi",
            "-i", f"aevalsrc=exprs='{synth_expr}':d={clip_duration}:s=44100",
            "-filter_complex",
            f"{video_filter};"
            f"[0:a]volume=1.0[voice];"
            f"[1:a]volume={music_volume}[music];"
            f"[voice][music]amix=inputs=2:duration=first:dropout_transition=2[a]",
            "-map", "[v]",
            "-map", "[a]",
        ])
    else:
        cmd.extend([
            "-filter_complex", video_filter,
            "-map", "[v]",
            "-map", "0:a?",  # Map audio if present
        ])

    cmd.extend([
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        output_path,
    ])

    logger.info("Executing viral clip render: %s", " ".join(cmd[:15]))

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if res.returncode != 0:
            err = res.stderr[-500:] if res.stderr else "Unknown error"
            logger.error("FFmpeg clip render failed: %s", err)
            raise ClipRenderException(f"FFmpeg processing failed: {err}", "ffmpeg_error", 500)
    except subprocess.TimeoutExpired:
        raise ClipRenderException("Clip rendering timed out.", "timeout", 408)

    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        raise ClipRenderException("Rendered clip file is empty or missing.", "empty_file", 500)

    filesize = os.path.getsize(output_path)
    return {
        "filename": os.path.basename(output_path),
        "filesize": filesize,
        "duration": clip_duration,
        "layout": layout,
        "hook_title": hook_title,
    }


async def process_clip_render(
    input_path: str,
    original_title: str,
    start_time: float,
    end_time: float,
    layout: str = "center_crop",
    hook_title: Optional[str] = None,
    hook_style: str = "none",
    background_music: Optional[str] = "none",
    music_volume: float = 0.12,
    progress_bar: bool = True,
    progress_bar_color: str = "yellow",
    subtitles_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Async wrapper that renders the viral short in a background thread."""
    job_id = uuid.uuid4().hex[:10]
    safe_title = re.sub(r"[^\w-]", "", original_title[:30]).strip() or "clip"
    out_filename = f"{job_id}_viral_{safe_title}.mp4"
    out_path = str(DOWNLOAD_DIR / out_filename)

    result = await asyncio.to_thread(
        render_viral_clip,
        input_path=input_path,
        output_path=out_path,
        start_time=start_time,
        end_time=end_time,
        layout=layout,
        hook_title=hook_title,
        hook_style=hook_style,
        background_music=background_music,
        music_volume=music_volume,
        progress_bar=progress_bar,
        progress_bar_color=progress_bar_color,
        subtitles_path=subtitles_path,
    )
    result["download_url"] = f"/api/file/{result['filename']}"
    return result
