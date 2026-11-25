"""
Viral Shorts & Clip Renderer.

Transforms 16:9 landscape videos into 9:16 vertical Shorts/TikToks/Reels with:
1. Dynamic Active-Speaker Face-Tracking & 2-Speaker Split-Screen Framing.
2. Kinetic Hormozi/Opus-Style Word-by-Word Karaoke Subtitles with Accent Pop.
3. Broadcast Audio Mastering (EBU R128 loudnorm) & Seamless Loop Silence Trimming.
4. Refined Anti-Copyright Acoustic and Visual Cloaking.
5. Background Music Mixing & Dynamic Ducking.
"""

import asyncio
import logging
import os
import re
import shutil
import subprocess
import threading
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from app.config import DOWNLOAD_DIR, FFMPEG_PATH
from app.schemas import PresetOption
from app.cache import duration_cache

logger = logging.getLogger(__name__)

# Active subprocess registry for instant, clean cancellation
_ACTIVE_SUBPROCESSES: Set[subprocess.Popen] = set()
_ACTIVE_SUBPROCESSES_LOCK = threading.Lock()


def register_active_subprocess(proc: subprocess.Popen):
    """Registers a running subprocess so it can be killed on cancellation."""
    with _ACTIVE_SUBPROCESSES_LOCK:
        _ACTIVE_SUBPROCESSES.add(proc)


def unregister_active_subprocess(proc: subprocess.Popen):
    """Removes a finished or terminated subprocess from the registry."""
    with _ACTIVE_SUBPROCESSES_LOCK:
        _ACTIVE_SUBPROCESSES.discard(proc)


def terminate_all_active_subprocesses():
    """Immediately kills all tracked active subprocesses (ffmpeg, etc.)."""
    with _ACTIVE_SUBPROCESSES_LOCK:
        procs = list(_ACTIVE_SUBPROCESSES)
        _ACTIVE_SUBPROCESSES.clear()

    for p in procs:
        try:
            p.kill()
        except Exception:
            pass
        try:
            p.wait(timeout=1.0)
        except Exception:
            pass


# Available layouts
LAYOUT_PRESETS: List[PresetOption] = [
    PresetOption(
        id="center_crop",
        label="Full Screen 9:16 (Active Speaker Face Tracking)",
        description="Dynamic face tracking glides smoothly to keep speakers centered, with automatic 2-speaker split-screen.",
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
    PresetOption(
        id="horizontal",
        label="Full HD 16:9 Landscape (Original Horizontal)",
        description="Keeps widescreen 1920x1080 landscape format in highest HD quality for 3-4 min highlight videos.",
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
    """Probes the total duration in seconds of a video file using FFmpeg, with in-memory caching."""
    cached = duration_cache.get(video_path)
    if cached is not None:
        return cached

    ffmpeg = FFMPEG_PATH or shutil.which("ffmpeg")
    if not ffmpeg or not os.path.exists(video_path):
        return 60.0

    try:
        cmd = [ffmpeg, "-i", video_path]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        dur_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", res.stderr)
        if dur_match:
            h, m, s = dur_match.groups()
            dur = round(int(h) * 3600 + int(m) * 60 + float(s), 2)
            duration_cache.set(video_path, dur)
            return dur
    except Exception as e:
        logger.debug("Failed to probe video duration: %s", e)
    return 60.0


def probe_video_dimensions(video_path: str) -> Tuple[int, int]:
    """Returns (width, height) of input video file."""
    ffmpeg = FFMPEG_PATH or shutil.which("ffmpeg")
    if not ffmpeg or not os.path.exists(video_path):
        return 1920, 1080

    try:
        cmd = [ffmpeg, "-i", video_path]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        m = re.search(r"Stream.*Video:.*,\s*(\d{3,5})x(\d{3,5})", res.stderr)
        if m:
            return int(m.group(1)), int(m.group(2))
    except Exception:
        pass
    return 1920, 1080


def sanitize_drawtext_string(text: str) -> str:
    """Escapes characters and strips unsupported non-ASCII / emojis to avoid broken tofu boxes."""
    text = re.sub(r"[^\x20-\x7E\n]", "", text)
    text = text.replace("\\", "\\\\").replace("'", "").replace(":", " - ").replace("%", "%%")
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


# ---------------------------------------------------------------------------
# Upgrade 2: Active-Speaker Face-Tracking Dynamic 9:16 Crop
# ---------------------------------------------------------------------------


def track_faces_in_clip(
    video_path: str, start_time: float, end_time: float
) -> Dict[str, Any]:
    """
    Samples frames at 2-3 FPS using OpenCV + MediaPipe face detection (or YuNet/Cascade fallback).
    Computes an Exponential Moving Average (EMA) smoothed horizontal trajectory x(t) and detects
    2-speaker conversation layouts.

    Returns:
    {
        "mode": "single_speaker" | "two_speaker_split" | "center",
        "center_x_expr": str, # FFmpeg crop x expression
        "left_x_expr": Optional[str],
        "right_x_expr": Optional[str],
        "speaker_tracking_applied": bool,
    }
    """
    default_res = {
        "mode": "center",
        "center_x_expr": "(iw-ow)/2",
        "left_x_expr": None,
        "right_x_expr": None,
        "speaker_tracking_applied": False,
    }

    if not os.path.exists(video_path):
        return default_res

    try:
        import cv2
    except ImportError:
        logger.debug("OpenCV (cv2) not installed; using standard center crop.")
        return default_res

    mp_face_detector = None
    try:
        import mediapipe as mp
        if hasattr(mp, "solutions") and hasattr(mp.solutions, "face_detection"):
            mp_face_detector = mp.solutions.face_detection.FaceDetection(
                model_selection=1, min_detection_confidence=0.45
            )
    except Exception as e:
        logger.debug("MediaPipe Face Detection init note: %s", e)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return default_res

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    v_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
    v_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080

    clip_dur = max(1.0, end_time - start_time)
    sample_step_sec = 0.4  # ~2.5 FPS
    sample_timestamps = [
        round(start_time + i * sample_step_sec, 2)
        for i in range(int(clip_dur / sample_step_sec))
    ]

    detections_by_time: List[Tuple[float, List[float]]] = []
    crop_w = int(v_height * 9 / 16)
    max_x = max(0, v_width - crop_w)

    for ts in sample_timestamps[:30]:  # Limit to 30 frame samples for sub-second analysis
        cap.set(cv2.CAP_PROP_POS_MSEC, ts * 1000.0)
        ret, frame = cap.read()
        if not ret or frame is None:
            continue

        face_centers_x: List[float] = []

        if mp_face_detector:
            try:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = mp_face_detector.process(rgb_frame)
                if results and results.detections:
                    for det in results.detections:
                        box = det.location_data.relative_bounding_box
                        cx_norm = box.xmin + (box.width / 2.0)
                        cx_px = cx_norm * v_width
                        face_centers_x.append(cx_px)
            except Exception:
                pass

        if not face_centers_x:
            # Fallback: OpenCV Haar Cascade detector
            try:
                cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
                face_cascade = cv2.CascadeClassifier(cascade_path)
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = face_cascade.detectMultiScale(gray, 1.2, 4, minSize=(60, 60))
                for (x, y, w, h) in faces:
                    face_centers_x.append(x + w / 2.0)
            except Exception:
                pass

        if face_centers_x:
            detections_by_time.append((ts, face_centers_x))

    cap.release()
    if mp_face_detector:
        try:
            mp_face_detector.close()
        except Exception:
            pass

    if not detections_by_time:
        return default_res

    # Check for consistent 2-speaker layout (faces on left and right thirds)
    two_speaker_frames = 0
    left_speaker_xs: List[float] = []
    right_speaker_xs: List[float] = []

    for _, xs in detections_by_time:
        lefts = [x for x in xs if x < v_width * 0.45]
        rights = [x for x in xs if x > v_width * 0.55]
        if lefts and rights:
            two_speaker_frames += 1
            left_speaker_xs.append(min(lefts))
            right_speaker_xs.append(max(rights))

    # If >= 30% of sampled frames have 2 distinct speakers far apart horizontally:
    if two_speaker_frames >= max(2, int(len(detections_by_time) * 0.30)):
        avg_left = sum(left_speaker_xs) / len(left_speaker_xs)
        avg_right = sum(right_speaker_xs) / len(right_speaker_xs)

        left_crop_x = int(min(max(0, avg_left - crop_w / 2), max_x))
        right_crop_x = int(min(max(0, avg_right - crop_w / 2), max_x))

        logger.info(
            "Active-Speaker: 2-Speaker Split-Screen detected (left_x=%d, right_x=%d).",
            left_crop_x,
            right_crop_x,
        )
        return {
            "mode": "two_speaker_split",
            "center_x_expr": "(iw-ow)/2",
            "left_x_expr": str(left_crop_x),
            "right_x_expr": str(right_crop_x),
            "speaker_tracking_applied": True,
        }

    # Single active speaker trajectory: Apply Exponential Moving Average (EMA, alpha=0.2)
    single_centers = [xs[0] for _, xs in detections_by_time]
    smoothed_xs: List[float] = []
    alpha = 0.2
    cur = single_centers[0]
    for x in single_centers:
        cur = alpha * x + (1.0 - alpha) * cur
        smoothed_xs.append(cur)

    # Compute horizontal crop offsets
    x0 = int(min(max(0, smoothed_xs[0] - crop_w / 2), max_x))
    x1 = int(min(max(0, smoothed_xs[-1] - crop_w / 2), max_x))
    x_avg = int(min(max(0, (sum(smoothed_xs) / len(smoothed_xs)) - crop_w / 2), max_x))

    # If speaker drifts significantly across clip, create smooth linear camera pan
    if abs(x1 - x0) > 50:
        center_x_expr = f"min(max(0,{x0}+({x1}-{x0})*(t/{clip_dur})),iw-ow)"
    else:
        center_x_expr = f"min(max(0,{x_avg}),iw-ow)"

    logger.info(
        "Active-Speaker: Smooth camera tracking trajectory generated (crop_x: %s)",
        center_x_expr,
    )

    return {
        "mode": "single_speaker",
        "center_x_expr": center_x_expr,
        "left_x_expr": None,
        "right_x_expr": None,
        "speaker_tracking_applied": True,
    }


# ---------------------------------------------------------------------------
# Upgrade 3: Word-Level Karaoke Highlighting Captions
# ---------------------------------------------------------------------------


def generate_ass_subtitles(
    cues: List[Dict[str, Any]],
    start_time: float,
    end_time: float,
    output_path: str,
    style: str = "viral_yellow",
) -> bool:
    """
    Generates Hormozi/Opus-style kinetic word-by-word karaoke subtitles.
    - Groups words into short, readable 3-4 word phrases in lower-middle safe zone (MarginV=320).
    - Emits ASS karaoke override tags so the active spoken word lights up in bright yellow
      (&H0000E6FF&) and scales up to 112% (\\fscx112\\fscy112) with a 4px black outline,
      while non-active words remain crisp white.
    """
    if not cues:
        return False

    # 1. Flatten all words that fall inside [start_time, end_time]
    active_words: List[Dict[str, Any]] = []

    for c in cues:
        c_start = float(c.get("start", 0))
        c_end = float(c.get("end", 0))

        if c_end < start_time or c_start > end_time:
            continue

        c_words = c.get("words")
        if c_words:
            for w in c_words:
                w_start = float(w.get("start", c_start))
                w_end = float(w.get("end", c_end))
                w_text = sanitize_drawtext_string(str(w.get("word", "")).strip())
                if w_text and w_end > start_time and w_start < end_time:
                    rel_s = max(0.0, w_start - start_time)
                    rel_e = min(end_time - start_time, w_end - start_time)
                    if rel_e > rel_s:
                        active_words.append({"word": w_text, "start": rel_s, "end": rel_e})
        else:
            tokens = sanitize_drawtext_string(str(c.get("text", "")).strip()).split()
            if tokens:
                c_dur = max(0.2, c_end - c_start)
                per_w = c_dur / len(tokens)
                for i, tok in enumerate(tokens):
                    ws = c_start + i * per_w
                    we = c_start + (i + 1) * per_w
                    if we > start_time and ws < end_time:
                        rel_s = max(0.0, ws - start_time)
                        rel_e = min(end_time - start_time, we - start_time)
                        if rel_e > rel_s:
                            active_words.append({"word": tok, "start": rel_s, "end": rel_e})

    if not active_words:
        return False

    # 2. Group into short 3-4 word readable phrases
    phrases: List[List[Dict[str, Any]]] = []
    current_phrase: List[Dict[str, Any]] = []

    for i, w in enumerate(active_words):
        current_phrase.append(w)
        is_punc = bool(re.search(r"[.!?]$", w["word"]))
        is_full = len(current_phrase) >= 4
        is_last = (i == len(active_words) - 1)

        if is_punc or is_full or is_last:
            phrases.append(current_phrase)
            current_phrase = []

    highlight_hex = "&H0000E6FF&" if style == "viral_yellow" else "&H0000FFFF&"

    ass_lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1080",
        "PlayResY: 1920",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: ViralKaraoke,Helvetica,54,&H00FFFFFF&,&H0000E6FF&,&H00000000&,&H80000000&,-1,0,0,0,100,100,0,0,1,4,2,2,40,40,320,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    # 3. Emit kinetic word pop for each word in the active phrase
    for phrase in phrases:
        for active_idx, target_word in enumerate(phrase):
            w_start_str = format_ass_time(target_word["start"])
            w_end_str = format_ass_time(target_word["end"])

            # Build phrase display where target_word scales up and highlights in yellow
            phrase_parts: List[str] = []
            for idx, w in enumerate(phrase):
                dur_cs = int(round((w["end"] - w["start"]) * 100))
                if idx == active_idx:
                    phrase_parts.append(
                        f"{{\\kf{dur_cs}\\c{highlight_hex}\\fscx112\\fscy112\\bord4}}{w['word']}{{\\r\\fnHelvetica\\b1\\fs54\\c&H00FFFFFF&\\3c&H00000000&\\bord4}}"
                    )
                else:
                    phrase_parts.append(f"{{\\kf{dur_cs}\\c&H00FFFFFF&\\bord4}}{w['word']}")

            line_text = " ".join(phrase_parts)
            ass_lines.append(
                f"Dialogue: 0,{w_start_str},{w_end_str},ViralKaraoke,,0,0,0,,{line_text}"
            )

    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(ass_lines))
        return True
    except Exception as err:
        logger.warning("Failed to write ASS kinetic subtitle file: %s", err)
        return False


# ---------------------------------------------------------------------------
# Upgrade 4: Seamless Loop Closure & Broadcast Loudness
# ---------------------------------------------------------------------------


def detect_and_trim_loop_silence(video_path: str, start_time: float, end_time: float) -> float:
    """
    Detects trailing dead silence (<120ms or silence before end_time) using FFmpeg silencedetect.
    Trims trailing silence so the final word flows seamlessly back into the opening hook.
    Returns refined end_time.
    """
    ffmpeg = FFMPEG_PATH or shutil.which("ffmpeg")
    if not ffmpeg or not os.path.exists(video_path) or (end_time - start_time) < 6.0:
        return end_time

    check_window = min(4.0, (end_time - start_time) / 2.0)
    probe_start = end_time - check_window

    cmd = [
        ffmpeg, "-y",
        "-ss", str(probe_start),
        "-t", str(check_window),
        "-i", video_path,
        "-af", "silencedetect=noise=-35dB:d=0.12",
        "-f", "null", "-",
    ]

    proc = None
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        register_active_subprocess(proc)
        _, stderr = proc.communicate(timeout=6.0)

        silence_starts = list(re.finditer(r"silence_start:\s*([\d\.]+)", stderr))
        if silence_starts:
            last_start_rel = float(silence_starts[-1].group(1))
            abs_silence_time = probe_start + last_start_rel
            # Ensure at least 120ms trimmed and clip remains at least 5s long
            if (end_time - abs_silence_time) >= 0.12 and abs_silence_time >= start_time + 5.0:
                logger.info(
                    "Seamless Loop: Trimmed %.2fs of trailing dead silence (new end: %.2fs)",
                    end_time - abs_silence_time,
                    abs_silence_time,
                )
                return round(abs_silence_time, 2)
    except Exception as e:
        logger.debug("Loop silence trimming note: %s", e)
    finally:
        if proc:
            unregister_active_subprocess(proc)

    return end_time


# ---------------------------------------------------------------------------
# Video Filtergraph Generator
# ---------------------------------------------------------------------------


def build_video_filtergraph(
    layout: str,
    hook_title: Optional[str] = None,
    hook_style: str = "none",
    clip_duration: float = 30.0,
    progress_bar: bool = True,
    progress_bar_color: str = "yellow",
    subtitles_path: Optional[str] = None,
    anti_copyright_shield: bool = False,
    face_tracking_data: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Builds video filtergraph (1080x1920 vertical or 1920x1080 horizontal HD) with:
    - Active speaker tracking and automatic 2-speaker split-screen composition.
    - Hook headline banner.
    - Word-level kinetic karaoke subtitles.
    - Kinetic bottom progress bar.
    - Softened anti-copyright visual cloaking.
    """
    is_horizontal = layout in ("horizontal", "landscape", "16:9")

    if is_horizontal:
        base_v = "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black[framed]"
    elif layout == "center_crop":
        ft_mode = face_tracking_data.get("mode") if face_tracking_data else None
        if ft_mode == "two_speaker_split":
            # Compose clean 2-speaker top/bottom split-screen
            left_x = face_tracking_data.get("left_x_expr", "0")
            right_x = face_tracking_data.get("right_x_expr", "iw/2")
            base_v = (
                f"[0:v]split=2[spk1_in][spk2_in];"
                f"[spk1_in]crop=w=ih*9/16:h=ih/2:x='{left_x}':y=0,scale=1080:960[top_v];"
                f"[spk2_in]crop=w=ih*9/16:h=ih/2:x='{right_x}':y=0,scale=1080:960[bot_v];"
                f"[top_v][bot_v]vstack=inputs=2[framed]"
            )
        elif ft_mode == "single_speaker" and face_tracking_data.get("center_x_expr"):
            cx_expr = face_tracking_data["center_x_expr"]
            base_v = f"[0:v]crop=w=ih*9/16:h=ih:x='{cx_expr}':y=0,scale=1080:1920[framed]"
        else:
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
        # Default: blurred_background (Opus Clip style)
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
            y_pos = "120" if is_horizontal else "240"
            font_sz = "44" if is_horizontal else "52"
            if hook_style == "hormozi_bold":
                filters.append(
                    f"drawtext=text='{clean_title}':fontsize={font_sz}:fontcolor=0xFFE600:"
                    "borderw=4:bordercolor=black:shadowcolor=black@0.9:shadowx=3:shadowy=3:"
                    f"x=(w-text_w)/2:y={y_pos}:line_spacing=12"
                )
            elif hook_style in ("mrbeast_urgency", "red_accent"):
                filters.append(
                    f"drawtext=text='{clean_title}':fontsize={font_sz}:fontcolor=white:"
                    "box=1:boxcolor=0xE50914@0.92:boxborderw=16:"
                    f"x=(w-text_w)/2:y={y_pos}:line_spacing=12"
                )
            elif hook_style == "tiktok_trending":
                filters.append(
                    f"drawtext=text='{clean_title}':fontsize={font_sz}:fontcolor=white:"
                    "box=1:boxcolor=0x111827@0.8:boxborderw=18:"
                    f"x=(w-text_w)/2:y={y_pos}:line_spacing=12"
                )
            elif hook_style in ("cinematic_glow", "minimal"):
                filters.append(
                    f"drawtext=text='{clean_title}':fontsize={font_sz}:fontcolor=white:"
                    "borderw=3:bordercolor=black@0.8:shadowcolor=black@0.95:shadowx=4:shadowy=4:"
                    f"x=(w-text_w)/2:y={y_pos}:line_spacing=12"
                )
            elif hook_style == "bold_white":
                filters.append(
                    f"drawtext=text='{clean_title}':fontsize={font_sz}:fontcolor=white:"
                    "box=1:boxcolor=black@0.75:boxborderw=14:"
                    f"x=(w-text_w)/2:y={y_pos}:line_spacing=10"
                )
            else:
                filters.append(
                    f"drawtext=text='{clean_title}':fontsize={font_sz}:fontcolor=yellow:"
                    "box=1:boxcolor=black@0.7:boxborderw=12:"
                    f"x=(w-text_w)/2:y={y_pos}:line_spacing=10"
                )

    # 2. Kinetic Word-by-Word Subtitles Burn-in
    if subtitles_path and os.path.exists(subtitles_path):
        filters.append(f"subtitles='{subtitles_path}'")

    # 3. Dynamic Kinetic Progress Bar
    if progress_bar:
        bar_color = PROGRESS_BAR_COLORS.get(progress_bar_color, "0xFFE600@0.95")
        safe_dur = max(0.1, round(clip_duration, 2))
        bar_h = 10 if is_horizontal else 14
        filters.append(
            f"drawbox=x=0:y=ih-{bar_h}:w='iw*min(1.0,t/{safe_dur})':h={bar_h}:color={bar_color}:t=fill"
        )

    # 4. Anti-Copyright Visual Cloaking (Softened 1.015 contrast to avoid artifacting)
    if anti_copyright_shield:
        filters.append("eq=contrast=1.015:brightness=0.005:saturation=1.02")

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


# ---------------------------------------------------------------------------
# Viral Clip Rendering Pipeline
# ---------------------------------------------------------------------------


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
    threads: int = 0,
    anti_copyright_shield: bool = False,
    mute_original_audio: bool = False,
) -> Dict[str, Any]:
    """
    Renders a vertical 9:16 viral short using FFmpeg with:
    - Active speaker tracking dynamic 9:16 crop & 2-speaker split-screen.
    - Seamless loop silence trimming.
    - Broadcast loudness mastering (loudnorm=I=-14:TP=-1.5:LRA=11).
    - Softened anti-copyright acoustic and visual cloaking.
    """
    ffmpeg = _require_ffmpeg()

    if end_time <= start_time:
        raise ClipRenderException("End time must be strictly greater than start time.", "invalid_time_range")

    # Upgrade 4: Seamless loop closure - detect and trim trailing dead silence (<120ms)
    refined_end_time = detect_and_trim_loop_silence(input_path, start_time, end_time)
    clip_duration = round(refined_end_time - start_time, 2)
    if clip_duration > 300:
        raise ClipRenderException("Maximum clip duration is 5 minutes (300 seconds).", "duration_too_long")

    # Upgrade 2: Active-Speaker Face-Tracking
    face_tracking_data: Dict[str, Any] = {
        "mode": "center",
        "center_x_expr": "(iw-ow)/2",
        "speaker_tracking_applied": False,
    }
    if layout == "center_crop" and os.path.exists(input_path):
        face_tracking_data = track_faces_in_clip(input_path, start_time, refined_end_time)

    video_filter = build_video_filtergraph(
        layout=layout,
        hook_title=hook_title,
        hook_style=hook_style,
        clip_duration=clip_duration,
        progress_bar=progress_bar,
        progress_bar_color=progress_bar_color,
        subtitles_path=subtitles_path,
        anti_copyright_shield=anti_copyright_shield,
        face_tracking_data=face_tracking_data,
    )

    # Check for custom audio file or procedural preset
    custom_audio_path: Optional[str] = None
    if background_music and background_music != "none":
        p = Path(background_music)
        if p.is_file():
            custom_audio_path = str(p.resolve())
        else:
            asset_candidate = Path(__file__).resolve().parent.parent / "assets" / "audio" / background_music
            if asset_candidate.is_file():
                custom_audio_path = str(asset_candidate.resolve())

    has_custom_audio = custom_audio_path is not None
    has_synth_music = (
        not has_custom_audio
        and background_music
        and background_music != "none"
        and background_music in SYNTH_EXPRESSIONS
    )

    cmd = [
        ffmpeg, "-y",
        "-ss", str(start_time),
        "-t", str(clip_duration),
        "-i", input_path,
    ]

    # Add second audio input if background music is specified
    if has_custom_audio:
        cmd.extend(["-stream_loop", "-1", "-i", custom_audio_path])
    elif has_synth_music:
        synth_expr = SYNTH_EXPRESSIONS[background_music]
        cmd.extend([
            "-f", "lavfi",
            "-i", f"aevalsrc=exprs='{synth_expr}':d={clip_duration}:s=44100",
        ])

    # Upgrade 4: Softened anti-copyright pitch perturbation (1.015) + broadcast mastering (loudnorm)
    if anti_copyright_shield:
        voice_af = "asetrate=44100*1.015,aresample=44100,atempo=1/1.015,equalizer=f=1000:t=q:w=1:g=-1,highpass=f=60"
    else:
        voice_af = "volume=1.0"

    loudnorm_af = "loudnorm=I=-14:TP=-1.5:LRA=11"

    if mute_original_audio:
        if has_custom_audio or has_synth_music:
            cmd.extend([
                "-filter_complex",
                f"{video_filter};[1:a]volume=1.0,{loudnorm_af}[a]",
                "-map", "[v]",
                "-map", "[a]",
            ])
        else:
            cmd.extend([
                "-filter_complex", video_filter,
                "-map", "[v]",
            ])
    elif has_custom_audio or has_synth_music:
        cmd.extend([
            "-filter_complex",
            f"{video_filter};"
            f"[0:a]{voice_af}[voice];"
            f"[1:a]volume={music_volume}[music];"
            f"[voice][music]amix=inputs=2:duration=first:dropout_transition=2,{loudnorm_af}[a]",
            "-map", "[v]",
            "-map", "[a]",
        ])
    else:
        cmd.extend([
            "-filter_complex",
            f"{video_filter};[0:a]{voice_af},{loudnorm_af}[a]",
            "-map", "[v]",
            "-map", "[a]",
        ])

    thread_str = str(threads) if threads > 0 else "0"
    cmd.extend([
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-threads", thread_str,
        "-tune", "film",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        output_path,
    ])

    logger.info("Executing viral clip render: %s", " ".join(cmd[:15]))

    proc = None
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        register_active_subprocess(proc)
        stdout, stderr = proc.communicate(timeout=300)
        if proc.returncode != 0:
            err = stderr[-500:] if stderr else "Unknown error"
            logger.error("FFmpeg clip render failed: %s", err)
            raise ClipRenderException(f"FFmpeg processing failed: {err}", "ffmpeg_error", 500)
    except subprocess.TimeoutExpired:
        if proc:
            proc.kill()
        raise ClipRenderException("Clip rendering timed out.", "timeout", 408)
    finally:
        if proc:
            unregister_active_subprocess(proc)

    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        raise ClipRenderException("Rendered clip file is empty or missing.", "empty_file", 500)

    filesize = os.path.getsize(output_path)
    return {
        "filename": os.path.basename(output_path),
        "filesize": filesize,
        "duration": clip_duration,
        "layout": layout,
        "hook_title": hook_title,
        "speaker_tracking_applied": face_tracking_data.get("speaker_tracking_applied", False),
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
    anti_copyright_shield: bool = False,
    mute_original_audio: bool = False,
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
        anti_copyright_shield=anti_copyright_shield,
        mute_original_audio=mute_original_audio,
    )
    result["download_url"] = f"/api/file/{result['filename']}"
    return result
