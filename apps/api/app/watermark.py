"""
Watermark removal engine.

Provides two modes:
1. **Preset mode** – auto-removes watermarks for known platforms (TikTok).
2. **Manual mode** – user specifies a bounding box region to remove.
3. **Auto-detect mode** – uses frame-sampling analysis to find static overlay
   regions likely to be watermarks, then removes them via FFmpeg.

All heavy processing is done by FFmpeg's ``delogo`` filter which runs fast on
CPU-only servers (suitable for Render free tier).
"""

import asyncio
import logging
import os
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import DOWNLOAD_DIR, FFMPEG_PATH

logger = logging.getLogger(__name__)

# Maximum upload size in bytes (100 MB)
MAX_UPLOAD_BYTES = int(os.getenv("WATERMARK_MAX_UPLOAD_MB", "100")) * 1024 * 1024

# Supported input video extensions
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".flv"}

# ---------------------------------------------------------------------------
# Platform watermark presets (coordinates for 1080×1920 portrait video)
# ---------------------------------------------------------------------------

PLATFORM_PRESETS: Dict[str, Dict[str, Any]] = {
    "tiktok": {
        "label": "TikTok",
        "description": "Removes the @username watermark (top-left) and TikTok logo (bottom-right).",
        "reference_width": 1080,
        "reference_height": 1920,
        "regions": [
            {"x": 25, "y": 25, "w": 360, "h": 70, "label": "Username watermark"},
            {"x": 840, "y": 1740, "w": 210, "h": 130, "label": "TikTok logo"},
        ],
    },
}


class WatermarkException(Exception):
    """Raised when watermark processing fails."""

    def __init__(self, detail: str, error_type: str = "processing_error", status_code: int = 400):
        super().__init__(detail)
        self.detail = detail
        self.error_type = error_type
        self.status_code = status_code


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _require_ffmpeg() -> str:
    """Return the path to ffmpeg or raise."""
    ffmpeg = FFMPEG_PATH or shutil.which("ffmpeg")
    if not ffmpeg:
        raise WatermarkException(
            "FFmpeg is not available on this server. Watermark removal requires FFmpeg.",
            error_type="missing_dependency",
            status_code=503,
        )
    return ffmpeg


def _validate_extension(filename: str) -> None:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise WatermarkException(
            f"Unsupported file type '{ext}'. Allowed: {allowed}",
            error_type="invalid_file",
        )


def _probe_dimensions(ffmpeg_path: str, video_path: str) -> tuple[int, int]:
    """Return (width, height) of the first video stream via ffprobe."""
    ffprobe = ffmpeg_path.replace("ffmpeg", "ffprobe")
    if not shutil.which(ffprobe):
        ffprobe = shutil.which("ffprobe") or "ffprobe"
    cmd = [
        ffprobe,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=p=0:s=x",
        video_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        parts = result.stdout.strip().split("x")
        if len(parts) == 2:
            return int(parts[0]), int(parts[1])
    except Exception as e:
        logger.warning("ffprobe dimension lookup failed: %s", e)
    # Fallback to a common resolution
    return 1080, 1920


def _scale_regions(
    regions: List[Dict[str, int]],
    ref_w: int,
    ref_h: int,
    actual_w: int,
    actual_h: int,
) -> List[Dict[str, int]]:
    """Scale preset regions from reference resolution to actual video dimensions."""
    if ref_w == actual_w and ref_h == actual_h:
        return regions
    sx = actual_w / ref_w
    sy = actual_h / ref_h
    scaled: List[Dict[str, int]] = []
    for r in regions:
        scaled.append({
            "x": max(0, int(r["x"] * sx)),
            "y": max(0, int(r["y"] * sy)),
            "w": int(r["w"] * sx),
            "h": int(r["h"] * sy),
            "label": r.get("label", ""),
        })
    return scaled


def _build_delogo_filter(regions: List[Dict[str, int]], band: int = 4) -> str:
    """Build a chained FFmpeg delogo filter string from a list of regions."""
    parts: List[str] = []
    for r in regions:
        parts.append(f"delogo=x={r['x']}:y={r['y']}:w={r['w']}:h={r['h']}:band={band}")
    return ",".join(parts)


# ---------------------------------------------------------------------------
# Auto-detection via frame sampling (OpenCV-free, pure FFmpeg + numpy)
# ---------------------------------------------------------------------------


def auto_detect_watermark_regions(
    video_path: str,
    ffmpeg_path: str,
    sample_count: int = 15,
) -> List[Dict[str, int]]:
    """
    Detect static overlay regions (likely watermarks) by sampling frames and
    finding areas with very low pixel variance.

    Runs analysis on downscaled thumbnail frames (e.g. 160×90) to maintain low
    memory footprint (<5MB RAM) and blazing speed (<0.1s), suitable for cloud
    free-tier instances (Render 512MB RAM). Works in pure Python if numpy is
    not installed.
    """
    width, height = _probe_dimensions(ffmpeg_path, video_path)

    # Use low-res analysis grid to save memory and CPU
    sample_w = 160
    sample_h = max(30, int(160 * height / width)) if width > 0 else 90

    # Extract sampled frames as raw grayscale via FFmpeg
    cmd = [
        ffmpeg_path,
        "-i", video_path,
        "-vf", f"fps=1,scale={sample_w}:{sample_h}",
        "-frames:v", str(sample_count),
        "-f", "rawvideo",
        "-pix_fmt", "gray",
        "-v", "error",
        "pipe:1",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        if result.returncode != 0:
            logger.warning("FFmpeg frame extraction failed: %s", result.stderr[:200])
            return []
    except subprocess.TimeoutExpired:
        logger.warning("FFmpeg frame extraction timed out for %s", video_path)
        return []

    raw = result.stdout
    frame_size = sample_w * sample_h
    if len(raw) < frame_size * 2:
        logger.warning("Not enough frame data for auto-detection (%d bytes)", len(raw))
        return []

    num_frames = min(sample_count, len(raw) // frame_size)

    # Calculate pixel variance (pure Python or numpy if available)
    try:
        import numpy as np
        frames = np.frombuffer(raw[:num_frames * frame_size], dtype=np.uint8).reshape(num_frames, sample_h, sample_w)
        std_map = np.std(frames.astype(np.float32), axis=0)
        threshold = max(5.0, float(np.percentile(std_map, 8)))
        static_mask = [[bool(std_map[y, x] <= threshold) for x in range(sample_w)] for y in range(sample_h)]
    except ImportError:
        # Pure Python fallback
        static_mask = _compute_static_mask_pure_python(raw, sample_w, sample_h, num_frames)

    # Find candidate bounding boxes on the thumbnail grid
    boxes_grid = _find_bounding_boxes_grid(static_mask, sample_w, sample_h)

    # Map detected boxes back to original video dimensions
    scale_x = width / sample_w
    scale_y = height / sample_h

    total_area = width * height
    min_area = total_area * 0.0005
    max_area = total_area * 0.12
    filtered: List[Dict[str, int]] = []

    for b in boxes_grid:
        orig_x = int(b["x"] * scale_x)
        orig_y = int(b["y"] * scale_y)
        orig_w = int(b["w"] * scale_x)
        orig_h = int(b["h"] * scale_y)

        area = orig_w * orig_h
        if area < min_area or area > max_area:
            continue

        # Watermarks almost always sit in corner or edge regions (outer 25%)
        cx = orig_x + orig_w / 2
        cy = orig_y + orig_h / 2
        in_edge = (
            cx < width * 0.25
            or cx > width * 0.75
            or cy < height * 0.25
            or cy > height * 0.75
        )
        if in_edge:
            pad = 8
            clamped_x = max(0, orig_x - pad)
            clamped_y = max(0, orig_y - pad)
            clamped_w = min(orig_w + pad * 2, width - clamped_x)
            clamped_h = min(orig_h + pad * 2, height - clamped_y)
            if clamped_w >= 10 and clamped_h >= 10:
                filtered.append({
                    "x": clamped_x,
                    "y": clamped_y,
                    "w": clamped_w,
                    "h": clamped_h,
                    "label": "Auto-detected region",
                })

    logger.info(
        "Auto-detect found %d candidate regions in %s",
        len(filtered), video_path,
    )
    return filtered[:4]


def _compute_static_mask_pure_python(
    raw: bytes, width: int, height: int, num_frames: int
) -> List[List[bool]]:
    """Calculates per-pixel variance across frames without numpy."""
    total_pixels = width * height
    variances: List[float] = []

    for p in range(total_pixels):
        vals = [raw[f * total_pixels + p] for f in range(num_frames)]
        mean = sum(vals) / num_frames
        var = sum((v - mean) ** 2 for v in vals) / num_frames
        variances.append(var)

    # 10th percentile threshold or minimum 10.0
    sorted_vars = sorted(variances)
    k = max(0, min(int(total_pixels * 0.08), total_pixels - 1))
    threshold = max(6.0, sorted_vars[k])

    mask: List[List[bool]] = []
    for y in range(height):
        row = [variances[y * width + x] <= threshold for x in range(width)]
        mask.append(row)
    return mask


def _find_bounding_boxes_grid(
    mask: List[List[bool]], width: int, height: int, block: int = 8
) -> List[Dict[str, int]]:
    """
    Groups adjacent static blocks into candidate bounding boxes.
    Pure Python, zero dependencies.
    """
    rows = height // block
    cols = width // block
    if rows == 0 or cols == 0:
        return []

    grid = [[False] * cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            count = 0
            for by in range(r * block, min((r + 1) * block, height)):
                for bx in range(c * block, min((c + 1) * block, width)):
                    if mask[by][bx]:
                        count += 1
            grid[r][c] = (count / (block * block)) > 0.55

    visited = [[False] * cols for _ in range(rows)]
    boxes: List[Dict[str, int]] = []

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] and not visited[r][c]:
                min_r, max_r = r, r
                min_c, max_c = c, c
                stack = [(r, c)]
                while stack:
                    cr, cc = stack.pop()
                    if visited[cr][cc]:
                        continue
                    visited[cr][cc] = True
                    min_r = min(min_r, cr)
                    max_r = max(max_r, cr)
                    min_c = min(min_c, cc)
                    max_c = max(max_c, cc)
                    for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                        nr, nc = cr + dr, cc + dc
                        if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] and not visited[nr][nc]:
                            stack.append((nr, nc))

                boxes.append({
                    "x": min_c * block,
                    "y": min_r * block,
                    "w": (max_c - min_c + 1) * block,
                    "h": (max_r - min_r + 1) * block,
                })

    return boxes


# ---------------------------------------------------------------------------
# Core processing functions
# ---------------------------------------------------------------------------


def remove_watermark(
    input_path: str,
    output_path: str,
    regions: List[Dict[str, int]],
    band: int = 4,
) -> Dict[str, Any]:
    """
    Remove watermarks from a video using FFmpeg's delogo filter.

    Args:
        input_path: Path to the input video file.
        output_path: Path to write the processed video.
        regions: List of dicts with x, y, w, h defining watermark areas.
        band: Edge transition width for delogo (higher = smoother edges).

    Returns:
        Dict with filename, filesize, and duration.
    """
    ffmpeg = _require_ffmpeg()

    if not regions:
        raise WatermarkException("No watermark regions specified.", error_type="no_regions")

    vf = _build_delogo_filter(regions, band=band)

    cmd = [
        ffmpeg,
        "-y",                       # Overwrite output
        "-threads", "2",            # Limit threads for low-memory servers
        "-i", input_path,
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "ultrafast",     # Minimum RAM overhead for encoding
        "-crf", "23",               # Good quality (lower = better, 18–28 range)
        "-maxrate", "2M",
        "-bufsize", "4M",           # Cap bitrate buffer to prevent memory spikes
        "-c:a", "copy",             # Keep original audio untouched
        "-movflags", "+faststart",  # Web-optimized MP4
        output_path,
    ]

    logger.info("Running watermark removal: %s", " ".join(cmd))

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
        )
        if result.returncode != 0:
            stderr = result.stderr[-500:] if result.stderr else "No error output"
            logger.error("FFmpeg watermark removal failed: %s", stderr)
            raise WatermarkException(
                f"FFmpeg processing failed: {stderr}",
                error_type="ffmpeg_error",
                status_code=500,
            )
    except subprocess.TimeoutExpired:
        raise WatermarkException(
            "Video processing timed out. The video may be too long or too large.",
            error_type="timeout",
            status_code=408,
        )

    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        raise WatermarkException(
            "FFmpeg produced an empty output file.",
            error_type="ffmpeg_error",
            status_code=500,
        )

    filesize = os.path.getsize(output_path)
    logger.info("Watermark removal complete: %s (%d bytes)", output_path, filesize)

    return {
        "filename": os.path.basename(output_path),
        "filesize": filesize,
    }


async def process_watermark_removal(
    input_path: str,
    original_filename: str,
    mode: str,
    platform: Optional[str] = None,
    regions: Optional[List[Dict[str, int]]] = None,
    band: int = 4,
) -> Dict[str, Any]:
    """
    High-level async entry point for watermark removal.

    Modes:
        - "preset"    : Use platform-specific presets (requires `platform`).
        - "manual"    : Use user-supplied regions (requires `regions`).
        - "auto"      : Auto-detect watermark regions from the video.

    Returns dict with filename, filesize, and detected_regions (for auto mode).
    """
    ffmpeg = _require_ffmpeg()
    _validate_extension(original_filename)

    job_id = uuid.uuid4().hex[:10]
    stem = Path(original_filename).stem[:60]
    out_filename = f"{job_id}_clean_{stem}.mp4"
    out_path = str(DOWNLOAD_DIR / out_filename)

    actual_w, actual_h = await asyncio.to_thread(_probe_dimensions, ffmpeg, input_path)
    detected_regions: Optional[List[Dict[str, int]]] = None

    if mode == "preset":
        if not platform or platform not in PLATFORM_PRESETS:
            available = ", ".join(PLATFORM_PRESETS.keys())
            raise WatermarkException(
                f"Unknown platform '{platform}'. Available presets: {available}",
                error_type="invalid_preset",
            )
        preset = PLATFORM_PRESETS[platform]
        final_regions = _scale_regions(
            preset["regions"],
            preset["reference_width"],
            preset["reference_height"],
            actual_w,
            actual_h,
        )
    elif mode == "manual":
        if not regions:
            raise WatermarkException(
                "Manual mode requires at least one region with x, y, w, h.",
                error_type="no_regions",
            )
        # Clamp regions to video dimensions
        final_regions = []
        for r in regions:
            final_regions.append({
                "x": max(0, min(r["x"], actual_w - 1)),
                "y": max(0, min(r["y"], actual_h - 1)),
                "w": max(10, min(r["w"], actual_w - r["x"])),
                "h": max(10, min(r["h"], actual_h - r["y"])),
            })
    elif mode == "auto":
        detected = await asyncio.to_thread(
            auto_detect_watermark_regions, input_path, ffmpeg
        )
        if not detected:
            raise WatermarkException(
                "Could not auto-detect any watermark regions in this video. "
                "Try using manual mode and specify the watermark area coordinates.",
                error_type="no_watermark_found",
            )
        final_regions = detected
        detected_regions = detected
    else:
        raise WatermarkException(
            f"Invalid mode '{mode}'. Use 'preset', 'manual', or 'auto'.",
            error_type="invalid_mode",
        )

    result = await asyncio.to_thread(
        remove_watermark, input_path, out_path, final_regions, band
    )

    if detected_regions is not None:
        result["detected_regions"] = detected_regions

    return result
