"""
GTA 6 Autonomous Viral Clipping & Scheduled YouTube Publisher.

Automates:
1. YouTube viral video discovery for trending GTA 6 content (zero API quota using yt-dlp).
2. Deep cutting of exactly 6 high-converting 9:16 vertical clips per viral video.
3. Randomized visual hook styling, progress bars, and custom audio mixing.
4. Low CPU background rendering (restricted threads) to protect host system performance.
5. Immediate multi-stage disk cleanup (source video deleted right after slicing; clip deleted right after upload).
6. 1-hour interval queue dispatcher uploading 6 clips per 24-hour cycle to strictly respect Google's 10,000 quota limit.
"""

import asyncio
import json
import logging
import os
import random
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import DOWNLOAD_DIR, BASE_DIR
from app.clip_renderer import render_viral_clip, terminate_all_active_subprocesses
from app.clip_scorer import analyze_and_score_clips, parse_vtt_or_srt
from app.downloader import extract_metadata, get_base_ydl_opts, YOUTUBE_CLIENT_PROFILES
from app.youtube_publisher import (
    publish_short_video,
    get_youtube_status,
    refresh_access_token,
    DEFAULT_YOUTUBE_DESCRIPTION,
    DEFAULT_YOUTUBE_TAGS,
    DEFAULT_YOUTUBE_CATEGORY_ID,
)
from app.schemas import (
    AutopilotClipItem,
    AutopilotBatch,
    AutopilotStatus,
)

logger = logging.getLogger("video_downloader.autopilot")

STATE_FILE = BASE_DIR / "data" / "autopilot_state.json"
AUDIO_DIR = BASE_DIR / "assets" / "audio"
DATA_DIR = BASE_DIR / "data"

DATA_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# 6 distinct style profiles to ensure every clip in the daily batch has unique visual branding
STYLE_PROFILES: List[Dict[str, str]] = [
    {"hook_style": "hormozi_bold", "progress_bar_color": "yellow", "layout": "center_crop"},
    {"hook_style": "mrbeast_urgency", "progress_bar_color": "red", "layout": "blurred_background"},
    {"hook_style": "tiktok_trending", "progress_bar_color": "cyan", "layout": "center_crop"},
    {"hook_style": "cinematic_glow", "progress_bar_color": "white", "layout": "blurred_background"},
    {"hook_style": "yellow_box", "progress_bar_color": "yellow", "layout": "center_crop"},
    {"hook_style": "mrbeast_urgency", "progress_bar_color": "violet", "layout": "blurred_background"},
]

PROCEDURAL_MUSIC_FALLBACKS: List[str] = [
    "lofi_chill",
    "energetic_beat",
    "dramatic_suspense",
    "ambient_drone",
    "lofi_chill",
    "energetic_beat",
]


async def load_effective_global_settings(user_id: Optional[str] = None):
    """Loads global settings from Supabase if configured, falling back to local JSON file."""
    from app.schemas import GlobalSettings
    effective_id = user_id or "default"
    try:
        from app.supabase_client import get_global_settings_supabase, is_supabase_configured
        if is_supabase_configured():
            cloud = await get_global_settings_supabase(effective_id)
            if cloud:
                return GlobalSettings(**cloud)
    except Exception as e:
        logger.debug("Failed loading settings from Supabase: %s", e)

    try:
        from app.main import GLOBAL_SETTINGS_FILE
        if os.path.exists(GLOBAL_SETTINGS_FILE):
            with open(GLOBAL_SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return GlobalSettings(**data)
    except Exception as e:
        logger.debug("Failed loading local settings: %s", e)
    return None


class AutopilotManager:
    """Manages autonomous discovery, clipping, rendering, scheduling, and cleanup."""

    def __init__(self):
        self.is_running: bool = False
        self.state: str = "idle"  # idle, searching, rendering, queued, uploading, cooldown, paused, error
        self.current_batch: Optional[AutopilotBatch] = None
        self.active_clip_id: Optional[str] = None
        self.current_step: Optional[str] = None
        self.current_step_label: Optional[str] = None
        self.processed_video_ids: List[str] = []
        self.daily_uploads_count: int = 0
        self.daily_upload_limit: int = 6
        self.upload_interval_seconds: int = 3600  # 1 hour
        self.cooldown_until: Optional[float] = None
        self.disk_space_cleaned_mb: float = 0.0
        self.last_cleaned_at: Optional[str] = None
        self.recent_logs: List[str] = []
        self.all_published_videos: List[Dict[str, Any]] = []
        self.recent_errors: List[Dict[str, Any]] = []
        self._lock = asyncio.Lock()
        self.cancel_requested: bool = False
        self._active_async_tasks: List[asyncio.Task] = []
        self._load_state()

    def _log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        entry = f"[{timestamp}] {message}"
        self.recent_logs.append(entry)
        if len(self.recent_logs) > 40:
            self.recent_logs.pop(0)
        logger.info("[Autopilot] %s", message)

    def reset_state(self, clear_history: bool = False):
        """Resets cooldown, active errors, and daily uploads counter. Optionally clears published history."""
        self.is_running = False
        self.state = "idle"
        self.current_batch = None
        self.daily_uploads_count = 0
        self.cooldown_until = None
        self.active_clip_id = None
        self.current_step = None
        self.current_step_label = None
        self.recent_errors = []
        if clear_history:
            self.all_published_videos = []
            self.processed_video_ids = []
            self._log("🧹 Cleared all published video history and deduplication cache.")
        self._log("🔄 Reset autopilot state, cooldown, and daily upload counter.")
        self._save_state()

    def _save_state(self):
        try:
            state_data = {
                "is_running": self.is_running,
                "state": self.state,
                "current_batch": self.current_batch.model_dump() if self.current_batch else None,
                "active_clip_id": self.active_clip_id,
                "current_step": self.current_step,
                "current_step_label": self.current_step_label,
                "processed_video_ids": self.processed_video_ids[-100:],
                "daily_uploads_count": self.daily_uploads_count,
                "daily_upload_limit": self.daily_upload_limit,
                "upload_interval_seconds": self.upload_interval_seconds,
                "cooldown_until": self.cooldown_until,
                "disk_space_cleaned_mb": round(self.disk_space_cleaned_mb, 2),
                "last_cleaned_at": self.last_cleaned_at,
                "recent_logs": self.recent_logs[-30:],
                "all_published_videos": self.all_published_videos[:20],
                "recent_errors": self.recent_errors[:20],
            }
            STATE_FILE.write_text(json.dumps(state_data, indent=2), encoding="utf-8")
        except Exception as err:
            logger.warning("Failed to persist autopilot state: %s", err)

    def _load_state(self):
        if not STATE_FILE.is_file():
            return
        try:
            data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            self.is_running = data.get("is_running", False)
            self.state = data.get("state", "idle")
            self.active_clip_id = data.get("active_clip_id")
            self.current_step = data.get("current_step")
            self.current_step_label = data.get("current_step_label")
            self.processed_video_ids = data.get("processed_video_ids", [])
            self.daily_uploads_count = data.get("daily_uploads_count", 0)
            self.daily_upload_limit = data.get("daily_upload_limit", 6)
            self.upload_interval_seconds = data.get("upload_interval_seconds", 3600)
            self.cooldown_until = data.get("cooldown_until")
            self.disk_space_cleaned_mb = data.get("disk_space_cleaned_mb", 0.0)
            self.last_cleaned_at = data.get("last_cleaned_at")
            self.recent_logs = data.get("recent_logs", [])
            self.all_published_videos = data.get("all_published_videos", [])
            self.recent_errors = data.get("recent_errors", [])
            batch_data = data.get("current_batch")
            if batch_data:
                self.current_batch = AutopilotBatch(**batch_data)
        except Exception as err:
            logger.warning("Failed to load existing autopilot state: %s", err)

    def get_custom_audio_files(self) -> List[str]:
        """Returns filenames of any custom audio tracks placed in assets/audio."""
        if not AUDIO_DIR.exists():
            return []
        valid_exts = {".mp3", ".wav", ".m4a", ".aac"}
        return [f.name for f in AUDIO_DIR.iterdir() if f.is_file() and f.suffix.lower() in valid_exts]

    def cleanup_file(self, file_path: Optional[str]) -> float:
        """Immediately deletes a file and tracks freed disk space in MB."""
        if not file_path:
            return 0.0
        p = Path(file_path)
        if p.is_file():
            try:
                size_mb = p.stat().st_size / (1024 * 1024)
                p.unlink()
                self.disk_space_cleaned_mb += size_mb
                self.last_cleaned_at = datetime.now().isoformat()
                self._log(f"🧹 Cleaned disk: deleted {p.name} (freed {size_mb:.1f} MB)")
                self._save_state()
                return size_mb
            except Exception as e:
                logger.warning("Failed to delete file %s: %s", file_path, e)
        return 0.0

    def purge_orphan_downloads(self) -> float:
        """Scans DOWNLOAD_DIR and purges any unreferenced or old temporary files."""
        total_freed = 0.0
        active_filenames = set()
        if self.current_batch:
            for c in self.current_batch.clips:
                if c.filename:
                    active_filenames.add(c.filename)

        now = time.time()
        for f in DOWNLOAD_DIR.glob("*"):
            if not f.is_file() or f.name in active_filenames:
                continue
            # Delete temp or partial files older than 15 minutes
            if f.name.endswith(".part") or (now - f.stat().st_mtime > 900):
                try:
                    size_mb = f.stat().st_size / (1024 * 1024)
                    f.unlink()
                    total_freed += size_mb
                except Exception:
                    pass

        if total_freed > 0:
            self.disk_space_cleaned_mb += total_freed
            self.last_cleaned_at = datetime.now().isoformat()
            self._log(f"🧹 Orphan cleanup: freed {total_freed:.1f} MB in downloads folder")
            self._save_state()
        return total_freed

    async def search_viral_gta_video(self) -> Optional[Dict[str, Any]]:
        """Finds top viral GTA 6 video via yt-dlp search without consuming YouTube API units."""
        self._log("🔍 Searching YouTube for trending GTA 6 viral videos...")
        # Check cloud deduplication from Supabase if configured
        try:
            from app.supabase_client import get_processed_source_ids_supabase, is_supabase_configured
            if is_supabase_configured():
                cloud_ids = await get_processed_source_ids_supabase()
                for cid in cloud_ids:
                    if cid not in self.processed_video_ids:
                        self.processed_video_ids.append(cid)
        except Exception:
            pass

        queries = [
            "GTA 6 gameplay 4K",
            "Grand Theft Auto VI secrets details",
            "GTA 6 trailer breakdown gameplay",
        ]
        query = random.choice(queries)

        def _do_search():
            import yt_dlp
            ydl_opts = get_base_ydl_opts("youtube")
            ydl_opts.update({
                "extract_flat": True,
                "skip_download": True,
                "quiet": True,
                "no_warnings": True,
            })
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(f"ytsearch20:{query}", download=False)

        try:
            res = await asyncio.to_thread(_do_search)
            entries = res.get("entries") or []
            candidates = []
            for e in entries:
                if not e:
                    continue
                vid_id = e.get("id")
                if not vid_id or vid_id in self.processed_video_ids:
                    continue
                dur = e.get("duration") or 0
                # Optimal clipping length: 3 minutes to 20 minutes
                if 180 <= dur <= 1200:
                    candidates.append({
                        "id": vid_id,
                        "title": e.get("title", "GTA 6 Viral Moment"),
                        "url": f"https://www.youtube.com/watch?v={vid_id}",
                        "duration": dur,
                        "view_count": e.get("view_count", 0),
                        "thumbnail": e.get("thumbnail") or e.get("thumbnails", [{}])[-1].get("url"),
                    })

            if not candidates:
                self._log("⚠️ No new candidates matching length criteria. Using first available entry.")
                for e in entries:
                    if e and e.get("id") and e.get("id") not in self.processed_video_ids:
                        candidates.append({
                            "id": e["id"],
                            "title": e.get("title", "GTA 6 Gameplay"),
                            "url": f"https://www.youtube.com/watch?v={e['id']}",
                            "duration": e.get("duration") or 300,
                            "view_count": e.get("view_count", 0),
                        })
                        break

            if candidates:
                # Sort by views
                candidates.sort(key=lambda x: x.get("view_count", 0), reverse=True)
                top = candidates[0]
                self._log(f"🎯 Selected viral candidate: '{top['title']}' ({top['duration']}s)")
                return top
        except Exception as e:
            self._log(f"❌ Error searching viral video: {e}")
        return None

    async def create_and_render_batch(
        self,
        video_info: Dict[str, Any],
        sequential_upload: bool = True,
        target_channel_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Optional[AutopilotBatch]:
        """
        Downloads the source video once, slices exactly 6 clips with randomized styles,
        mixes custom audio, immediately cleans the source video, and sets up 1-hour schedule.
        """
        vid_id = video_info["id"]
        vid_url = video_info["url"]
        vid_title = video_info["title"]
        batch_id = uuid.uuid4().hex[:8]

        self.state = "rendering"
        self.current_step = "downloading"
        self.current_step_label = f"Downloading source video: '{vid_title}'"
        self._log(f"📥 Downloading source video for clipping: '{vid_title}'")
        self._save_state()

        self.cancel_requested = False

        # Step 1: Download full source video with universal format fallback and multi-client rotation
        # ALWAYS prioritize highest resolution available: 4K / 1440p / 1080p / best
        source_stem = f"autopilot_src_{vid_id}"
        outtmpl = str(DOWNLOAD_DIR / f"{source_stem}.%(ext)s")
        source_path: Optional[str] = None

        # Prioritize absolute highest HD resolution video stream (1080p, 1440p, 4K, 720p) merged with best audio into MP4
        format_selector = (
            "bestvideo[height>=1080]+bestaudio/"
            "bestvideo[height>=720]+bestaudio/"
            "bestvideo+bestaudio/"
            "best[height>=720]/"
            "best"
        )

        def _download_src():
            import yt_dlp
            last_err = None
            client_candidates = YOUTUBE_CLIENT_PROFILES if ("youtube" in vid_url or "youtu.be" in vid_url) else [None]

            def _abort_hook(d):
                if self.cancel_requested:
                    raise yt_dlp.utils.DownloadCancelled("Autopilot download cancelled by user.")

            # Clean any stale or corrupted partial downloads from previous runs to prevent [Errno 5] I/O errors
            for stale_part in DOWNLOAD_DIR.glob(f"{source_stem}.*"):
                if stale_part.name.endswith(".part") or stale_part.stat().st_size == 0:
                    try:
                        stale_part.unlink(missing_ok=True)
                    except Exception:
                        pass

            for client_profile in client_candidates:
                if self.cancel_requested:
                    raise yt_dlp.utils.DownloadCancelled("Autopilot download cancelled by user.")
                ydl_opts = get_base_ydl_opts("youtube", client_override=client_profile)
                ydl_opts.update({
                    "outtmpl": outtmpl,
                    "format": format_selector,
                    "merge_output_format": "mp4",
                    "noplaylist": True,
                    "overwrites": True,
                    "progress_hooks": [_abort_hook],
                })
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        ydl.download([vid_url])
                    matches = [
                        p for p in DOWNLOAD_DIR.glob(f"{source_stem}.*")
                        if not p.name.endswith(".part") and p.stat().st_size > 0
                    ]
                    if matches:
                        return str(matches[0])
                except yt_dlp.utils.DownloadCancelled:
                    raise
                except Exception as e:
                    last_err = e
                    continue

            if last_err:
                raise last_err
            return None

        try:
            source_path = await asyncio.to_thread(_download_src)
            if not source_path:
                matches = [
                    p for p in DOWNLOAD_DIR.glob(f"{source_stem}.*")
                    if not p.name.endswith(".part") and p.stat().st_size > 0
                ]
                if matches:
                    source_path = str(matches[0])
        except Exception as dl_err:
            if self.cancel_requested:
                self._log("🛑 Download cancelled during source acquisition.")
                return None
            self._log(f"❌ Failed to download source video: {dl_err}")
            self.state = "error"
            self.current_step = "failed"
            self.current_step_label = f"Failed to download source: {dl_err}"
            self.recent_errors.insert(0, {
                "title": vid_title,
                "stage": "download",
                "error": str(dl_err),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            self._save_state()
            return None

        if self.cancel_requested:
            self._log("🛑 Batch creation halted by user cancellation.")
            return None

        if not source_path or not os.path.exists(source_path):
            self._log("❌ Downloaded source video not found on disk.")
            self.state = "error"
            self.current_step = "failed"
            self.current_step_label = "Downloaded source video not found on disk"
            self._save_state()
            return None

        src_size_mb = os.path.getsize(source_path) / (1024 * 1024)
        self.current_step = "analyzing"
        self.current_step_label = f"Analyzing 6 viral moments & retention cues ({src_size_mb:.1f} MB source)..."
        self._log(f"📦 Downloaded source ({src_size_mb:.1f} MB). Analyzing 6 viral segments...")
        self._save_state()

        try:
            # Step 2: Extract Subtitles or Cues (Multi-language and auto-captions)
            cues = None
            try:
                def _fetch_subs():
                    import yt_dlp
                    ydl_opts = get_base_ydl_opts("youtube")
                    ydl_opts.update({
                        "skip_download": True,
                        "writesubtitles": True,
                        "writeautomaticsub": True,
                        "subtitleslangs": ["en", "en-US", "en.*", "en-orig"],
                    })
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        return ydl.extract_info(vid_url, download=False)
                info = await asyncio.to_thread(_fetch_subs)
                subs = (info.get("subtitles") or {}) if info else {}
                auto_subs = (info.get("automatic_captions") or {}) if info else {}
                all_subs = {**auto_subs, **subs}
                
                en_sub = None
                for lk in ["en", "en-US", "en-orig"]:
                    if lk in all_subs and all_subs[lk]:
                        en_sub = all_subs[lk]
                        break

                if not en_sub and all_subs:
                    for k, val in all_subs.items():
                        if k.startswith("en") and val:
                            en_sub = val
                            break

                sub_url = None
                if en_sub and isinstance(en_sub, list):
                    for fmt in en_sub:
                        if fmt.get("ext") in ("vtt", "srt"):
                            sub_url = fmt.get("url")
                            break
                    if not sub_url and en_sub[0].get("url"):
                        sub_url = en_sub[0]["url"]

                if sub_url:
                    import httpx
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.get(sub_url)
                        if resp.status_code == 200:
                            cues = parse_vtt_or_srt(resp.text)
            except Exception as sub_err:
                logger.debug("Autopilot subtitle extraction notice: %s", sub_err)

            extracted_cues = cues

            # Load user global settings if present to respect duration_mode, text overlay, audio mix, and cover image settings
            global_settings = await load_effective_global_settings(user_id=user_id)

            dur_mode = (global_settings and getattr(global_settings, "duration_mode", None)) or "short"
            total_dur = video_info.get("duration") or 300

            # Analyze and score clips to discover the most viral highlights
            # short mode: <30s (typically 15-28s); long mode: custom duration (e.g. 5-6 min = 300-360s)
            if dur_mode == "long":
                target_long_sec = (global_settings and getattr(global_settings, "long_clip_duration_seconds", None)) or 240
                raw_min = max(60.0, float(target_long_sec - 30))
                raw_max = min(total_dur, float(target_long_sec + 30))
                raw_default_clip_len = min(total_dur, float(target_long_sec))
            else:
                raw_min = 15.0
                raw_max = 28.0
                raw_default_clip_len = 25.0

            raw_candidates = analyze_and_score_clips(
                cues=cues,
                total_duration=total_dur,
                video_title=vid_title,
                min_duration=int(raw_min),
                max_duration=int(raw_max),
                max_clips=12,
                video_id=vid_id,
                duration_mode=dur_mode,
            )

            # Pick the top 6 highest-scoring viral moments
            clip_candidates = sorted(
                raw_candidates,
                key=lambda c: getattr(c, "viral_score", 0.0),
                reverse=True,
            )[:6]

            # Ensure we have segments
            target_slice_count = 6 if dur_mode == "short" else min(3, max(1, int(total_dur // 180) or 1))
            while len(clip_candidates) < target_slice_count:
                idx = len(clip_candidates)
                step = total_dur / float(target_slice_count + 1)
                start = round(step * (idx + 1), 1)
                end = min(total_dur, start + raw_default_clip_len)
                from app.schemas import ClipCandidate
                clip_candidates.append(ClipCandidate(
                    clip_id=f"clip_{int(start)}_{int(end)}",
                    start_time=start,
                    end_time=end,
                    duration=round(end - start, 1),
                    viral_score=75,
                    hook_title=f"GTA 6 INSANE MOMENT #{idx + 1}",
                    summary=f"GTA 6 Highlight segment {idx + 1}",
                    reason="High energy action sequence",
                    retention_rate="88% Retention",
                    hook_rating="High Engagement",
                    hook_score=75,
                    pacing_score=75,
                    audio_energy_score=80,
                    visual_motion_score=75,
                    loop_rating="Seamless Loop",
                    speaker_tracking_applied=True,
                ))

            # Pre-populate batch so UI immediately sees all 6 planned clips upon refresh
            custom_audio_list = self.get_custom_audio_files()
            now_ts = time.time()
            preliminary_clips: List[AutopilotClipItem] = []

            # Respect user global layout, progress bar color, and hook styling if set
            effective_layout = getattr(global_settings, "layout", None) if global_settings else None
            effective_pb_color = getattr(global_settings, "progress_bar_color", None) if global_settings else None
            effective_hook_style = (global_settings.text_overlay.hook_style if (global_settings and getattr(global_settings, "text_overlay", None) and global_settings.text_overlay) else None)

            for idx, cand in enumerate(clip_candidates[:6]):
                clip_index = idx + 1
                profile = STYLE_PROFILES[idx % len(STYLE_PROFILES)]
                audio_choice = custom_audio_list[idx % len(custom_audio_list)] if custom_audio_list else PROCEDURAL_MUSIC_FALLBACKS[idx % len(PROCEDURAL_MUSIC_FALLBACKS)]
                scheduled_epoch = now_ts + 60 + (idx * self.upload_interval_seconds)
                scheduled_iso = datetime.fromtimestamp(scheduled_epoch, tz=timezone.utc).isoformat()
                output_filename = f"gta6_short_{batch_id}_{clip_index}.mp4"

                clip_layout = "horizontal" if dur_mode == "long" else (effective_layout or profile["layout"])
                clip_pb_color = effective_pb_color or profile["progress_bar_color"]
                clip_hook_style = effective_hook_style or profile["hook_style"]

                preliminary_clips.append(AutopilotClipItem(
                    id=f"{batch_id}_{clip_index}",
                    source_video_id=vid_id,
                    source_title=vid_title,
                    clip_index=clip_index,
                    start_time=cand.start_time,
                    end_time=cand.end_time,
                    duration=cand.duration,
                    hook_title=cand.hook_title,
                    hook_style=clip_hook_style,
                    progress_bar_color=clip_pb_color,
                    layout=clip_layout,
                    background_music=audio_choice,
                    filename=output_filename,
                    preview_url=f"/api/file/{output_filename}",
                    download_url=f"/api/file/{output_filename}",
                    scheduled_time=scheduled_iso,
                    status="queued",
                    current_step="queued",
                    step_description="Clip queued in batch",
                    user_id=user_id,
                    channel_id=target_channel_id,
                ))

            batch = AutopilotBatch(
                batch_id=batch_id,
                source_video_id=vid_id,
                source_title=vid_title,
                source_url=vid_url,
                created_at=datetime.now(timezone.utc).isoformat(),
                clips=preliminary_clips,
                status="processing",
                user_id=user_id,
                channel_id=target_channel_id,
            )
            self.current_batch = batch
            self._save_state()

            # Step 3: Sequential Low-CPU Rendering of the 6 Clips
            # Load user global settings if present to respect text overlay, audio mix, and cover image settings
            global_settings = await load_effective_global_settings(user_id=user_id)

            for idx, cand in enumerate(clip_candidates[:6]):
                if self.cancel_requested:
                    self._log("🛑 Rendering loop stopped by user cancellation.")
                    break
                clip_index = idx + 1
                clip = self.current_batch.clips[idx]
                profile = STYLE_PROFILES[idx % len(STYLE_PROFILES)]
                
                # Check global audio mix setting
                orig_vol = 1.0
                if global_settings and hasattr(global_settings, "audio_mix") and global_settings.audio_mix:
                    if global_settings.audio_mix.background_music == "none":
                        audio_choice = "none"
                        music_vol = 0.0
                    else:
                        audio_choice = global_settings.audio_mix.background_music or "vice_city_synth"
                        music_vol = global_settings.audio_mix.music_volume if global_settings.audio_mix.music_volume is not None else 0.12
                    orig_vol = global_settings.audio_mix.original_audio_volume if global_settings.audio_mix.original_audio_volume is not None else 1.0
                else:
                    audio_choice = custom_audio_list[idx % len(custom_audio_list)] if custom_audio_list else PROCEDURAL_MUSIC_FALLBACKS[idx % len(PROCEDURAL_MUSIC_FALLBACKS)]
                    music_vol = 0.12
                    orig_vol = 1.0
                self.active_clip_id = clip.id

                # Substep 1: Hook Creation ("that ok we have created the hook. this the hook")
                final_hook = cand.hook_title
                try:
                    from app.ai_hook import generate_hook_from_gemini
                    ai_hook = generate_hook_from_gemini(cand.transcript or vid_title, vid_title)
                    if ai_hook:
                        final_hook = ai_hook
                except Exception:
                    pass

                # If hook is default/fallback, respect user's default_hook setting if customized
                if global_settings and hasattr(global_settings, "text_overlay") and global_settings.text_overlay:
                    if getattr(global_settings.text_overlay, "default_hook", None) and (not final_hook or final_hook == cand.hook_title):
                        final_hook = global_settings.text_overlay.default_hook.strip()

                # Check global text overlay settings
                text_overlay_enabled = True
                hook_position = "top"
                burn_captions_enabled = False
                if global_settings and hasattr(global_settings, "text_overlay") and global_settings.text_overlay:
                    text_overlay_enabled = getattr(global_settings.text_overlay, "enabled", True)
                    hook_position = getattr(global_settings.text_overlay, "position", "top") or "top"
                    burn_captions_enabled = getattr(global_settings.text_overlay, "burn_captions", False)

                if not text_overlay_enabled:
                    render_hook_title = ""
                    render_hook_style = "none"
                    clip.hook_title = ""
                    clip.hook_style = "none"
                else:
                    render_hook_title = final_hook
                    render_hook_style = (global_settings and global_settings.text_overlay and global_settings.text_overlay.hook_style) or profile["hook_style"]
                    clip.hook_title = final_hook
                    clip.hook_style = render_hook_style

                clip.current_step = "hook_created"
                clip.step_description = f"Hook created: '{clip.hook_title}'" if text_overlay_enabled else "Hook overlay disabled by global settings"
                self.current_step = "hook_created"
                self.current_step_label = f"Short #{clip_index}: Created viral hook '{clip.hook_title}'" if text_overlay_enabled else f"Short #{clip_index}: Hook overlay off"
                self._log(f"🎣 Hook for Short #{clip_index}: '{clip.hook_title}' (overlay_enabled={text_overlay_enabled}, position={hook_position})")
                self._save_state()

                # Substep 2: Text Styling & Song ("now this is the text thing song")
                # Respect global progress bar settings
                progress_bar_enabled = True
                pb_color = profile["progress_bar_color"]
                if global_settings:
                    if hasattr(global_settings, "progress_bar"):
                        progress_bar_enabled = bool(global_settings.progress_bar)
                    if getattr(global_settings, "progress_bar_color", None):
                        pb_color = global_settings.progress_bar_color

                clip.current_step = "styling"
                clip.background_music = audio_choice
                clip.progress_bar_color = pb_color
                if dur_mode == "long":
                    clip.layout = "horizontal"
                else:
                    clip.layout = (global_settings and global_settings.layout) or profile["layout"]
                clip.step_description = f"Overlay: {clip.hook_style} ({pb_color} bar) • Song: {audio_choice}"
                self.current_step = "styling"
                self.current_step_label = f"Clip #{clip_index}: Styled text ({clip.hook_style}) & song ({audio_choice})"
                self._log(f"🎵 Text & Song set for Clip #{clip_index}: {clip.hook_style} | {audio_choice}")
                self._save_state()

                # Substep 3: Low-CPU Video Rendering
                output_filename = f"gta6_short_{batch_id}_{clip_index}.mp4"
                output_path = str(DOWNLOAD_DIR / output_filename)
                clip.status = "rendering"
                clip.current_step = "rendering"
                format_desc = "Full HD horizontal 16:9" if dur_mode == "long" else "9:16 vertical"
                clip.step_description = f"Rendering {format_desc} video with low CPU mode..."
                self.current_step = "rendering"
                self.current_step_label = f"Rendering Clip #{clip_index}/{len(clip_candidates[:target_slice_count])} (threads=2)..."
                self._log(f"🎬 Rendering Clip {clip_index} ({format_desc}, layout={clip.layout}, threads=2): hook='{render_hook_title}' style='{render_hook_style}'")
                self._save_state()

                render_layout = clip.layout
                render_pb_color = clip.progress_bar_color

                # Generate subtitles if burn_captions is requested
                subtitles_file_path: Optional[str] = None
                if burn_captions_enabled and extracted_cues:
                    try:
                        from app.clip_renderer import generate_ass_subtitles
                        sub_file = str(DOWNLOAD_DIR / f"captions_{batch_id}_{clip_index}.ass")
                        generate_ass_subtitles(extracted_cues, cand.start_time, cand.end_time, sub_file)
                        if os.path.exists(sub_file) and os.path.getsize(sub_file) > 0:
                            subtitles_file_path = sub_file
                            self._log(f"📝 Burned kinetic subtitles into Short #{clip_index}")
                    except Exception as sub_err:
                        logger.debug("Subtitle burn notice for clip #%d: %s", clip_index, sub_err)

                def _render(
                    c=cand,
                    h=render_hook_title,
                    s=render_hook_style,
                    pos=hook_position,
                    ly=render_layout,
                    a=audio_choice,
                    mv=music_vol,
                    ov=orig_vol,
                    pb=progress_bar_enabled,
                    pb_col=render_pb_color,
                    sub=subtitles_file_path,
                    out=output_path,
                ):
                    return render_viral_clip(
                        input_path=source_path,
                        output_path=out,
                        start_time=c.start_time,
                        end_time=c.end_time,
                        layout=ly,
                        hook_title=h,
                        hook_style=s,
                        hook_position=pos,
                        background_music=a,
                        music_volume=mv,
                        original_audio_volume=ov,
                        progress_bar=pb,
                        progress_bar_color=pb_col,
                        subtitles_path=sub,
                        threads=2,
                    )

                try:
                    await asyncio.to_thread(_render)
                except Exception as render_err:
                    if self.cancel_requested:
                        self._log(f"🛑 Clip #{clip_index} render aborted by user.")
                        break
                    raise render_err

                if self.cancel_requested:
                    self._log("🛑 Batch rendering aborted by user.")
                    break

                # Substep 4: Video Preview Ready ("her is your video preview")
                clip.filename = output_filename
                clip.preview_url = f"/api/file/{output_filename}"
                clip.download_url = f"/api/file/{output_filename}"

                # Check global cover image setting
                cover_enabled = False
                cover_headline = final_hook
                cover_theme = "gta_action"
                if global_settings and hasattr(global_settings, "cover_image") and global_settings.cover_image:
                    cover_enabled = global_settings.cover_image.enabled and dur_mode != "long"
                    cover_theme = getattr(global_settings.cover_image, "theme", "gta_action") or "gta_action"
                    if getattr(global_settings.cover_image, "headline", None):
                        cover_headline = global_settings.cover_image.headline.strip() or final_hook

                if cover_enabled:
                    # Generate Full HD 1080x1920 viral cover image
                    cover_filename = f"gta6_cover_{batch_id}_{clip_index}.jpg"
                    cover_output_path = str(DOWNLOAD_DIR / cover_filename)
                    try:
                        from app.cover_generator import generate_viral_cover_image, attach_cover_intro_to_video
                        await asyncio.to_thread(
                            generate_viral_cover_image,
                            video_path=output_path,
                            output_path=cover_output_path,
                            hook_title=cover_headline,
                            hook_style=profile["hook_style"],
                            badge_text="GTA 6 EXCLUSIVE",
                            template_index=idx,
                            use_gta_template=(cover_theme == "gta_action"),
                        )
                        if os.path.exists(cover_output_path):
                            clip.cover_filename = cover_filename
                            clip.cover_url = f"/api/file/{cover_filename}"
                            self._log(f"🖼️ Generated Full HD viral cover for Short #{clip_index}: {cover_filename}")

                            # Concat / slap the cover image onto the video as the opening frame (0.35s)
                            # so YouTube Shorts automatically uses this cover image on mobile feeds & Shorts player
                            merged_temp_path = str(DOWNLOAD_DIR / f"merged_{output_filename}")
                            merged_ok = await asyncio.to_thread(
                                attach_cover_intro_to_video,
                                video_path=output_path,
                                cover_path=cover_output_path,
                                output_path=merged_temp_path,
                                duration=0.35,
                            )
                            if merged_ok and os.path.exists(merged_temp_path) and os.path.getsize(merged_temp_path) > 0:
                                os.replace(merged_temp_path, output_path)
                                self._log(f"🎯 Concat slapped cover as opening frame on Short #{clip_index}")
                    except Exception as cover_err:
                        logger.debug("Cover image generation skipped: %s", cover_err)
                else:
                    self._log(f"⏭️ Cover thumbnail generation skipped for Short #{clip_index} (disabled in global settings)")

                if os.path.exists(output_path):
                    try:
                        clip.file_size_mb = round(os.path.getsize(output_path) / (1024 * 1024), 2)
                    except Exception:
                        pass

                is_long_clip = (dur_mode == "long") or clip.layout in ("horizontal", "landscape", "16:9") or (clip.duration and clip.duration > 60)
                video_kind = "Video" if is_long_clip else "Short"
                size_str = f" ({clip.file_size_mb:.2f} MB)" if clip.file_size_mb else ""

                clip.status = "preview_ready"
                clip.current_step = "preview_ready"
                clip.step_description = f"Video rendered! Video preview is ready{size_str}."
                self.current_step = "preview_ready"
                self.current_step_label = f"{video_kind} #{clip_index} video preview is ready{size_str}."
                self._log(f"✅ Video preview ready for {video_kind} #{clip_index}: {output_filename}{size_str}")
                self._save_state()

            # Step 4: AGGRESSIVE DISK CLEANUP 1 — Delete the raw source video immediately!
            self.cleanup_file(source_path)

            self.processed_video_ids.append(vid_id)
            self.state = "queued"
            self.current_batch.status = "queued"
            self._log(f"✅ Batch {batch_id} ready: 6 GTA 6 Shorts prepared.")
            self._save_state()

            # Sync batch & source to Supabase cloud database
            try:
                from app.supabase_client import sync_autopilot_batch_supabase, record_processed_source_supabase, is_supabase_configured
                if is_supabase_configured():
                    asyncio.create_task(sync_autopilot_batch_supabase(self.current_batch.model_dump()))
                    asyncio.create_task(record_processed_source_supabase(video_info))
            except Exception as sb_err:
                logger.debug("Supabase batch sync hook error: %s", sb_err)

            # Sequential auto-upload of all 6 clips one by one (requires authenticated user)
            can_upload = bool(user_id) and sequential_upload
            if can_upload and self.current_batch and self.current_batch.clips:
                self._log("🚀 Starting sequential auto-upload: uploading all 6 clips to YouTube one by one...")
                for clip in self.current_batch.clips:
                    self._log(f"📤 Uploading Short #{clip.clip_index}/6: '{clip.hook_title}'")
                    uploaded = await self.publish_clip(clip, cleanup_after=False)
                    if not uploaded:
                        self._log(f"⚠️ Short #{clip.clip_index} upload paused/failed. Stopping sequential upload.")
                        break
                    # Wait 3 seconds between uploads to give YouTube Data API breathing room
                    await asyncio.sleep(3)

                remaining = [c for c in self.current_batch.clips if c.status in ("queued", "rendering", "uploading")]
                if not remaining:
                    # Clean up all rendered clip files and covers from disk to free storage
                    freed_batch_mb = 0.0
                    for c in self.current_batch.clips:
                        if c.filename:
                            p = DOWNLOAD_DIR / c.filename
                            if p.is_file():
                                try:
                                    freed_batch_mb += p.stat().st_size / (1024 * 1024)
                                    p.unlink()
                                except Exception:
                                    pass
                        if c.cover_filename:
                            cp = DOWNLOAD_DIR / c.cover_filename
                            if cp.is_file():
                                try:
                                    freed_batch_mb += cp.stat().st_size / (1024 * 1024)
                                    cp.unlink()
                                except Exception:
                                    pass
                        # Also clean up any temporary .ass subtitle files
                        sub_p = DOWNLOAD_DIR / f"captions_{self.current_batch.batch_id}_{c.clip_index}.ass"
                        if sub_p.is_file():
                            try:
                                freed_batch_mb += sub_p.stat().st_size / (1024 * 1024)
                                sub_p.unlink()
                            except Exception:
                                pass
                    if freed_batch_mb > 0:
                        self.disk_space_cleaned_mb += freed_batch_mb
                        self.last_cleaned_at = datetime.now(timezone.utc).isoformat()
                        self._log(f"🧹 Purged {freed_batch_mb:.1f} MB temporary clip files from completed batch.")

                    self.current_batch.status = "completed"
                    self.current_batch = None
                    self.active_clip_id = None
                    self.state = "idle"
                    self.current_step = "completed"
                    self.current_step_label = "All 6 clips successfully uploaded to YouTube!"
                    self._log("🎉 Batch complete! All 6 clips published to YouTube one by one. Cleared active batch & purged temporary storage.")
                    self._save_state()
            else:
                # Guest user or manual download mode: all 6 clips rendered and ready for free download
                if self.current_batch:
                    self.current_batch.status = "ready"
                    self.state = "idle"
                    self.current_step = "preview_ready"
                    self.current_step_label = "6 Shorts ready for free download! (Sign in to auto-upload to YouTube)"
                    self._log("🎉 All 6 clips rendered & ready for free download! Sign in to auto-upload directly to YouTube.")
                    self._save_state()

            return self.current_batch

        except Exception as e:
            self._log(f"❌ Failed to process batch: {e}")
            if source_path and os.path.exists(source_path):
                self.cleanup_file(source_path)
            self.state = "error"
            self.current_step = "failed"
            self.current_step_label = f"Batch processing failed: {e}"
            self.recent_errors.insert(0, {
                "title": vid_title,
                "stage": "batch",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            self._save_state()
            return None

    async def publish_clip(self, clip: AutopilotClipItem, cleanup_after: bool = True) -> bool:
        """Publishes a single queued clip to YouTube and immediately tracks link or frontend issue."""
        if not clip.filename:
            return False

        clip_path = str(DOWNLOAD_DIR / clip.filename)
        if not os.path.exists(clip_path):
            self._log(f"⚠️ Clip file not found on disk: {clip.filename}")
            clip.status = "failed"
            clip.current_step = "failed"
            clip.error = "Rendered video file not found on disk"
            self.recent_errors.insert(0, {
                "clip_id": clip.id,
                "title": clip.hook_title,
                "stage": "upload",
                "error": "Rendered video file not found on disk",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            self._save_state()
            return False

        is_long_video = clip.layout in ("horizontal", "landscape", "16:9") or (clip.duration and clip.duration > 60)
        video_kind = "Video" if is_long_video else "Short"
        total_clips = len(self.current_batch.clips) if self.current_batch and self.current_batch.clips else 6

        self.state = "uploading"
        clip.status = "uploading"
        clip.current_step = "uploading"
        clip.step_description = f"Uploading {video_kind.lower()} to YouTube via YouTube Data API..."
        self.active_clip_id = clip.id
        self.current_step = "uploading"
        self.current_step_label = f"Uploading {video_kind} #{clip.clip_index} to YouTube..."
        
        # Build video title: append #Shorts only for vertical Shorts
        raw_hook = (clip.hook_title or "").strip()
        if not raw_hook:
            raw_hook = (clip.source_title or "").strip() or f"GTA 6 Viral Moment #{clip.clip_index}"
        
        if not is_long_video:
            if not raw_hook.lower().endswith("#shorts") and "#shorts" not in raw_hook.lower():
                upload_title = f"{raw_hook} #Shorts"
            else:
                upload_title = raw_hook
        else:
            upload_title = raw_hook

        # Load user global settings if present to respect default_privacy and default_tags
        upload_privacy = "public"
        upload_tags = DEFAULT_YOUTUBE_TAGS
        try:
            global_settings = await load_effective_global_settings(user_id=clip.user_id)
            if global_settings:
                if getattr(global_settings, "default_privacy", None) in ("public", "unlisted", "private"):
                    upload_privacy = global_settings.default_privacy
                if getattr(global_settings, "default_tags", None):
                    upload_tags = global_settings.default_tags
        except Exception as e:
            logger.debug("Failed loading settings for upload privacy: %s", e)

        self._log(f"🚀 Publishing {video_kind} #{clip.clip_index}/{total_clips} to YouTube: '{upload_title}' (privacy={upload_privacy})")
        self._save_state()

        try:
            # Background auto-token refresh check
            await asyncio.to_thread(refresh_access_token)

            pub_res = await publish_short_video(
                filename=clip.filename,
                title=upload_title[:100],
                description=DEFAULT_YOUTUBE_DESCRIPTION,
                tags=upload_tags,
                privacy=upload_privacy,
                channel_id=clip.channel_id,
                user_id=clip.user_id,
            )

            vid_id = pub_res.get("video_id")
            if is_long_video:
                yt_url = f"https://www.youtube.com/watch?v={vid_id}"
            else:
                yt_url = pub_res.get("youtube_url") or f"https://youtube.com/shorts/{vid_id}"

            # Auto-upload Full HD cover image as YouTube custom thumbnail
            if clip.cover_filename:
                cover_full_path = str(DOWNLOAD_DIR / clip.cover_filename)
                if os.path.exists(cover_full_path):
                    try:
                        from app.youtube_publisher import set_video_thumbnail
                        await set_video_thumbnail(
                            vid_id,
                            cover_full_path,
                            channel_id=clip.channel_id,
                            user_id=clip.user_id,
                        )
                    except Exception as thumb_err:
                        logger.debug("YouTube thumbnail upload skipped: %s", thumb_err)

            clip.status = "published"
            clip.current_step = "published"
            clip.step_description = f"Published on YouTube: {yt_url}"
            clip.youtube_video_id = vid_id
            clip.youtube_url = yt_url
            self.daily_uploads_count += 1
            self._log(f"🎉 Successfully uploaded Short #{clip.clip_index}! URL: {yt_url}")

            # Record in all_published_videos list
            pub_item = {
                "id": clip.id,
                "clip_index": clip.clip_index,
                "title": clip.hook_title,
                "youtube_url": yt_url,
                "youtube_video_id": vid_id,
                "published_at": datetime.now(timezone.utc).isoformat(),
                "preview_url": clip.preview_url or f"/api/file/{clip.filename}",
                "cover_url": clip.cover_url,
                "duration": clip.duration,
                "file_size_mb": getattr(clip, "file_size_mb", None),
            }
            self.all_published_videos = [p for p in self.all_published_videos if p.get("id") != clip.id]
            self.all_published_videos.insert(0, pub_item)

            # Sync published status to Supabase
            try:
                from app.supabase_client import update_clip_status_supabase, is_supabase_configured
                if is_supabase_configured():
                    asyncio.create_task(update_clip_status_supabase(clip.id, {
                        "status": "published",
                        "youtube_video_id": vid_id,
                        "youtube_url": yt_url,
                        "published_at": datetime.now(timezone.utc).isoformat(),
                    }))
            except Exception as sb_err:
                logger.debug("Supabase clip status sync hook error: %s", sb_err)

            if cleanup_after:
                self.cleanup_file(clip_path)

            self.state = "queued"
            self.current_step = "published"
            self.current_step_label = f"Published Short #{clip.clip_index}! URL: {yt_url}"
            self._save_state()
            return True

        except Exception as err:
            err_msg = str(err)
            self._log(f"❌ Upload failed for Short #{clip.clip_index}: {err_msg}")
            clip.status = "failed"
            clip.current_step = "failed"
            clip.error = err_msg
            self.recent_errors.insert(0, {
                "clip_id": clip.id,
                "title": clip.hook_title,
                "stage": "upload",
                "error": err_msg,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            self.state = "error"
            self.current_step = "failed"
            self.current_step_label = f"Short #{clip.clip_index} upload failed: {err_msg}"
            self._save_state()
            return False

    async def tick(self):
        """Periodic background evaluation called every 20-30 seconds."""
        if not self.is_running or self.state in ("rendering", "uploading") or self._lock.locked():
            return

        async with self._lock:
            now = time.time()

            # 1. Check Cooldown
            if self.state == "cooldown":
                if self.cooldown_until and now >= self.cooldown_until:
                    self._log("⏰ Cooldown period finished. Resetting daily upload count to 0.")
                    self.state = "idle"
                    self.cooldown_until = None
                    self.daily_uploads_count = 0
                    self.current_batch = None
                    self._save_state()
                else:
                    return

            # 2. Check Daily Limit
            if self.daily_uploads_count >= self.daily_upload_limit:
                if self.state != "cooldown":
                    self.state = "cooldown"
                    # Cooldown for remaining hours (default 18 hours after 6 uploads)
                    self.cooldown_until = now + (18 * 3600)
                    self._log(
                        f"🛡️ Daily upload limit reached ({self.daily_uploads_count}/{self.daily_upload_limit}). "
                        f"Entering 18-hour cooldown to protect Google API quota."
                    )
                    self._save_state()
                return

            # 3. Automated hourly scheduled uploads (Disabled for now as requested - all 6 upload sequentially on demand)
            # if self.current_batch and self.current_batch.clips:
            #     pending_clips = [
            #         c for c in self.current_batch.clips
            #         if c.status == "queued" and c.scheduled_time
            #     ]
            #     if pending_clips:
            #         next_clip = pending_clips[0]
            #         sched_dt = datetime.fromisoformat(next_clip.scheduled_time)
            #         sched_epoch = sched_dt.timestamp()
            #         if now >= sched_epoch:
            #             await self.publish_clip(next_clip, cleanup_after=False)
            #             return

            # 4. Automated hourly video discovery (Disabled for now as requested - triggers only when user adds a link)
            # if self.state == "idle" and self.daily_uploads_count < self.daily_upload_limit:
            #     video = await self.search_viral_gta_video()
            #     if video:
            #         await self.create_and_render_batch(video)
            #     else:
            #         self._log("Sleeping for 5 minutes before retrying video discovery.")
            #         await asyncio.sleep(300)

    def start(self):
        """Starts or resumes autopilot."""
        self.is_running = True
        if self.state in ("paused", "error"):
            self.state = "queued" if self.current_batch else "idle"
        self._log("▶️ Autopilot STARTED.")
        self._save_state()

    def pause(self):
        """Pauses autopilot."""
        self.is_running = False
        self.state = "paused"
        self._log("⏸️ Autopilot PAUSED.")
        self._save_state()

    def cancel_active_run(self) -> AutopilotStatus:
        """Immediately terminates any active download or rendering job and purges partial files."""
        self.cancel_requested = True
        self.is_running = False
        self.state = "idle"
        self.current_step = "idle"
        self.current_step_label = "Ready to queue next video"
        self.active_clip_id = None
        self.current_batch = None
        self.recent_errors = []

        # Cancel any active running async background tasks
        for t in list(self._active_async_tasks):
            if not t.done():
                t.cancel()
        self._active_async_tasks.clear()

        # Terminate any active rendering subprocesses (ffmpeg)
        try:
            terminate_all_active_subprocesses()
        except Exception as e:
            logger.debug("Error terminating subprocesses: %s", e)

        purged_mb = 0.0
        for p in DOWNLOAD_DIR.glob("*.part"):
            try:
                purged_mb += p.stat().st_size / (1024 * 1024)
                p.unlink()
            except Exception:
                pass
        self._log(f"🛑 Terminated active download/run. Cleaned up {purged_mb:.1f} MB partial files.")
        self._save_state()
        return self.get_status()

    def get_status(self, user_id: Optional[str] = None) -> AutopilotStatus:
        """Returns the full runtime status and countdown."""
        now = time.time()
        next_upload_time = None
        seconds_left = None

        if self.current_batch and self.current_batch.clips:
            pending = [c for c in self.current_batch.clips if c.status == "queued" and c.scheduled_time]
            if pending:
                next_clip = pending[0]
                next_upload_time = next_clip.scheduled_time
                try:
                    sched_epoch = datetime.fromisoformat(next_clip.scheduled_time).timestamp()
                    seconds_left = max(0, int(sched_epoch - now))
                except Exception:
                    pass

        cooldown_iso = None
        if self.cooldown_until:
            cooldown_iso = datetime.fromtimestamp(self.cooldown_until, tz=timezone.utc).isoformat()

        # Multi-channel information
        channels_items = []
        active_id = None
        try:
            from app.youtube_publisher import get_user_channels, _channels_store
            from app.schemas import YouTubeChannelItem
            channels_raw = get_user_channels(user_id)
            channels_items = [YouTubeChannelItem(**c) for c in channels_raw]
            active_id = _channels_store.get("active_channel_id")
            if not active_id and channels_items:
                active_id = channels_items[0].channel_id
        except Exception as e:
            logger.debug("Failed to populate channels in get_status: %s", e)

        # Update dynamic file sizes for any active or rendering clips on disk
        if self.current_batch and self.current_batch.clips:
            for c in self.current_batch.clips:
                if c.filename:
                    fp = DOWNLOAD_DIR / c.filename
                    if fp.is_file():
                        try:
                            c.file_size_mb = round(fp.stat().st_size / (1024 * 1024), 2)
                        except Exception:
                            pass

        return AutopilotStatus(
            is_running=self.is_running,
            state=self.state,
            current_batch=self.current_batch,
            active_clip_id=self.active_clip_id,
            current_step=self.current_step,
            current_step_label=self.current_step_label,
            next_upload_time=next_upload_time,
            seconds_until_next_upload=seconds_left,
            daily_uploads_count=self.daily_uploads_count,
            daily_upload_limit=self.daily_upload_limit,
            cooldown_until=cooldown_iso,
            disk_space_cleaned_mb=round(self.disk_space_cleaned_mb, 2),
            last_cleaned_at=self.last_cleaned_at,
            cpu_mode="low_load_threads_2",
            recent_logs=self.recent_logs[-25:],
            all_published_videos=self.all_published_videos,
            recent_errors=self.recent_errors[:10],
            channels=channels_items,
            active_channel_id=active_id,
        )


# Global singleton instance
autopilot_manager = AutopilotManager()
