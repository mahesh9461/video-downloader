import uuid
from typing import Any, List, Optional
from pydantic import BaseModel, Field, model_validator


class MetadataRequest(BaseModel):
    url: str = Field(..., description="Target video URL from YouTube, TikTok, or Instagram")


class VideoFormat(BaseModel):
    format_id: str
    label: str
    resolution: Optional[str] = None
    ext: str = "mp4"
    filesize: Optional[int] = None
    is_audio_only: bool = False


class VideoMetadata(BaseModel):
    id: str
    platform: str
    title: str
    creator: str
    creator_avatar: Optional[str] = None
    duration: int = 0
    thumbnail: str
    formats: List[VideoFormat]
    downloads_available: bool = True
    notice: Optional[str] = None


class DownloadRequest(BaseModel):
    url: str = Field(..., description="Target video URL")
    format_id: str = Field(..., description="Format ID or selection token")
    anti_copyright_shield: bool = Field(False, description="Apply anti-copyright audio and video cloaking to prevent Content ID claims")
    mute_audio: bool = Field(False, description="Mute or strip audio on downloaded video")


class DownloadProgress(BaseModel):
    status: str  # downloading, merging, converting, complete, error
    percent: float = 0.0
    speed: Optional[str] = None
    eta: Optional[str] = None
    filename: Optional[str] = None
    filesize: Optional[int] = None
    error_message: Optional[str] = None


class ApiError(BaseModel):
    detail: str
    error_type: str  # private, geo_restricted, deleted, rate_limit, invalid_url, network, unknown


# ---------------------------------------------------------------------------
# Watermark removal schemas
# ---------------------------------------------------------------------------


class WatermarkRegion(BaseModel):
    x: int = Field(..., ge=0, description="Left edge of the watermark area in pixels")
    y: int = Field(..., ge=0, description="Top edge of the watermark area in pixels")
    w: int = Field(..., ge=10, description="Width of the watermark area in pixels")
    h: int = Field(..., ge=10, description="Height of the watermark area in pixels")


class WatermarkRemoveRequest(BaseModel):
    mode: str = Field(
        "auto",
        description="Removal mode: 'preset' (platform-specific), 'manual' (user coordinates), or 'auto' (detect automatically)",
    )
    platform: Optional[str] = Field(
        None,
        description="Platform preset name (e.g. 'tiktok'). Required when mode='preset'.",
    )
    regions: Optional[List[WatermarkRegion]] = Field(
        None,
        description="Watermark regions to remove. Required when mode='manual'.",
    )
    band: int = Field(
        4,
        ge=0,
        le=50,
        description="Edge transition smoothness (0–50). Higher = smoother edges around removed area.",
    )


class WatermarkPresetInfo(BaseModel):
    platform: str
    label: str
    description: str
    regions: List[WatermarkRegion]


class WatermarkResult(BaseModel):
    filename: str
    filesize: int
    download_url: str
    detected_regions: Optional[List[WatermarkRegion]] = None


# ---------------------------------------------------------------------------
# Viral Clips schemas
# ---------------------------------------------------------------------------


class ClipCandidate(BaseModel):
    clip_id: str = Field(default_factory=lambda: f"clip_{uuid.uuid4().hex[:8]}", description="Unique ID for this clip segment")
    start_time: float = Field(..., ge=0, description="Start timestamp in seconds")
    end_time: float = Field(..., ge=0, description="End timestamp in seconds")
    duration: float = Field(0.0, ge=0, description="Clip duration in seconds")
    viral_score: int = Field(75, ge=0, le=100, description="Engagement virality score (0-100)")
    hook_title: str = Field("MUST WATCH MOMENT", description="Generated hook headline for the top banner")
    summary: str = Field("", description="Brief summary of what happens in this clip")
    reason: str = Field("High energy action sequence", description="Why this clip is predicted to perform well")
    thumbnail_url: Optional[str] = Field(None, description="Visual thumbnail of the video clip")
    retention_rate: Optional[str] = Field(None, description="Predicted viewer retention percentage")
    hook_rating: Optional[str] = Field(None, description="Virality percentile badge")
    hook_score: Optional[int] = Field(None, ge=0, le=100, description="First-3s Hook strength score (0-100)")
    pacing_score: Optional[int] = Field(None, ge=0, le=100, description="Speech cadence & pacing score (0-100)")
    audio_energy_score: Optional[int] = Field(None, ge=0, le=100, description="Audio dynamic energy & variance score (0-100)")
    visual_motion_score: Optional[int] = Field(None, ge=0, le=100, description="Visual scene-cut & novelty score (0-100)")
    loop_rating: Optional[str] = Field(None, description="Loopability rating (e.g. 'Seamless Loop', 'High Loopability', 'Standard')")
    speaker_tracking_applied: Optional[bool] = Field(False, description="Whether active speaker tracking was applied")

    @model_validator(mode="before")
    @classmethod
    def _normalize_candidate_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Alias clip_id <- id
            if not data.get("clip_id"):
                data["clip_id"] = data.get("id") or f"clip_{uuid.uuid4().hex[:8]}"
            # Alias summary <- transcript, transcript_snippet
            if not data.get("summary"):
                data["summary"] = data.get("transcript") or data.get("transcript_snippet") or "Highlight segment"
            # Alias reason <- reasoning
            if not data.get("reason"):
                data["reason"] = data.get("reasoning") or "High energy action sequence"
            # Compute duration if missing
            if ("duration" not in data or data["duration"] is None) and "start_time" in data and "end_time" in data:
                data["duration"] = round(float(data["end_time"]) - float(data["start_time"]), 1)
            # Ensure viral_score is int
            if "viral_score" in data and isinstance(data["viral_score"], (float, str)):
                try:
                    data["viral_score"] = int(round(float(data["viral_score"])))
                except (ValueError, TypeError):
                    data["viral_score"] = 75
        return data


class ClipAnalyzeRequest(BaseModel):
    url: Optional[str] = Field(None, description="YouTube or video URL to analyze")
    min_duration: int = Field(15, ge=5, le=300, description="Minimum clip duration in seconds")
    max_duration: int = Field(60, ge=10, le=300, description="Maximum clip duration in seconds")
    max_clips: int = Field(5, ge=1, le=10, description="Maximum number of clips to return")
    duration_mode: Optional[str] = Field("short", description="'short' (<30s vertical 9:16) or 'long' (3-4min horizontal 16:9)")


class ClipAnalyzeResponse(BaseModel):
    video_id: Optional[str] = None
    title: str
    total_duration: float
    clips: List[ClipCandidate]


class ClipRenderRequest(BaseModel):
    url: Optional[str] = Field(None, description="Source video URL or existing file identifier")
    start_time: float = Field(..., ge=0, description="Start timestamp in seconds")
    end_time: float = Field(..., ge=0, description="End timestamp in seconds")
    layout: str = Field("center_crop", description="Layout: 'center_crop', 'split_screen', 'blurred_background', or 'fit_black'")
    hook_title: Optional[str] = Field(None, description="Custom top headline banner (empty = no overlay)")
    hook_style: str = Field("none", description="Headline style: 'none', 'hormozi_bold', 'mrbeast_urgency', 'tiktok_trending', 'cinematic_glow', or 'yellow_box'")
    background_music: Optional[str] = Field("none", description="Preset music: 'none', 'lofi_chill', 'energetic_beat', 'dramatic_suspense', or 'ambient_drone'")
    music_volume: float = Field(0.12, ge=0.0, le=1.0, description="Background music volume relative to voice (default 0.12 = -18dB)")
    progress_bar: bool = Field(True, description="Enable kinetic bottom progress bar for higher retention")
    progress_bar_color: str = Field("yellow", description="Progress bar color: 'yellow', 'cyan', 'violet', or 'red'")
    burn_captions: bool = Field(False, description="Burn in Ssemble-style viral subtitle captions")
    caption_style: str = Field("viral_yellow", description="Caption style: 'viral_yellow' or 'clean_white'")
    anti_copyright_shield: bool = Field(False, description="Apply anti-copyright audio and video cloaking (pitch shift, tempo adjustment, and EQ) to prevent Content ID claims")
    mute_original_audio: bool = Field(False, description="Mute or strip the original audio completely")


class ClipRenderResponse(BaseModel):
    filename: str
    filesize: int
    duration: float
    download_url: str
    layout: str
    hook_title: Optional[str] = None


class ClipAiHookRequest(BaseModel):
    url: Optional[str] = Field(None, description="Video source URL or cached video file")
    start_time: float = Field(..., ge=0, description="Start timestamp of the clip in seconds")
    end_time: float = Field(..., ge=0, description="End timestamp of the clip in seconds")
    video_title: Optional[str] = Field("Video Highlight", description="Original video title for context")
    clip_dialogue: Optional[str] = Field(None, description="Existing dialogue transcript if available")
    provider: Optional[str] = Field("deepseek", description="Free model engine: 'deepseek', 'free_open_llm', or 'ollama'")


class ClipAiHookResponse(BaseModel):
    transcript: str
    hook_title: str
    source: str = Field("free_open_llm", description="Generation source: 'free_open_llm', 'ollama', or 'local_nlp'")


class PresetOption(BaseModel):
    id: str
    label: str
    description: str


class ClipPresetInfo(BaseModel):
    layouts: List[PresetOption]
    music_presets: List[PresetOption]
    hook_styles: List[PresetOption]


# ---------------------------------------------------------------------------
# YouTube Shorts Publishing schemas
# ---------------------------------------------------------------------------


class YouTubePublishRequest(BaseModel):
    filename: str = Field(..., description="Rendered video filename in DOWNLOAD_DIR")
    title: str = Field(..., description="YouTube video title (will auto-append #Shorts if missing)")
    description: Optional[str] = Field("", description="YouTube video description")
    tags: Optional[List[str]] = Field(default_factory=list, description="List of video tags")
    privacy: str = Field("public", description="Privacy status: 'public', 'unlisted', or 'private'")
    access_token: Optional[str] = Field(None, description="Optional Google OAuth access token if not using session/stored credentials")
    channel_id: Optional[str] = Field(None, description="Target YouTube channel ID")


class YouTubePublishResponse(BaseModel):
    video_id: str
    youtube_url: str
    title: str
    privacy: str
    status: str = "uploaded"


class YouTubeAuthStatus(BaseModel):
    configured: bool
    connected: bool
    channel_title: Optional[str] = None
    channel_id: Optional[str] = None
    auth_url: Optional[str] = None


# ---------------------------------------------------------------------------
# GTA 6 Autopilot & Scheduled Publishing schemas
# ---------------------------------------------------------------------------


class AutopilotClipItem(BaseModel):
    id: str
    source_video_id: str
    source_title: str
    clip_index: int = Field(..., ge=1, le=6, description="Index of clip within the 6-clip daily batch")
    start_time: float
    end_time: float
    duration: float
    hook_title: str
    hook_style: str = "hormozi_bold"
    progress_bar_color: str = "yellow"
    layout: str = "center_crop"
    background_music: str = "none"
    filename: Optional[str] = None
    preview_url: Optional[str] = None
    download_url: Optional[str] = None
    cover_filename: Optional[str] = None
    cover_url: Optional[str] = None
    file_size_mb: Optional[float] = None
    scheduled_time: Optional[str] = None
    status: str = Field("queued", description="'queued', 'rendering', 'preview_ready', 'uploading', 'published', 'cleaned', 'failed'")
    current_step: Optional[str] = Field("queued", description="'discovering', 'hook_created', 'styling', 'rendering', 'preview_ready', 'uploading', 'published', 'failed'")
    step_description: Optional[str] = None
    youtube_video_id: Optional[str] = None
    youtube_url: Optional[str] = None
    user_id: Optional[str] = None
    channel_id: Optional[str] = None
    channel_title: Optional[str] = None
    error: Optional[str] = None


class AutopilotBatch(BaseModel):
    batch_id: str
    source_video_id: str
    source_title: str
    source_url: str
    created_at: str
    clips: List[AutopilotClipItem] = Field(default_factory=list)
    status: str = Field("processing", description="'processing', 'queued', 'completed', 'cooldown'")
    user_id: Optional[str] = None
    channel_id: Optional[str] = None


class AutopilotPublishedVideo(BaseModel):
    id: str
    clip_index: Optional[int] = 1
    title: str
    youtube_url: str
    youtube_video_id: str
    published_at: str
    preview_url: Optional[str] = None
    duration: Optional[float] = 0.0
    file_size_mb: Optional[float] = None
    channel_id: Optional[str] = None
    channel_title: Optional[str] = None
    user_id: Optional[str] = None


class AutopilotIssue(BaseModel):
    clip_id: Optional[str] = None
    title: Optional[str] = None
    stage: Optional[str] = "upload"
    error: str
    timestamp: str


class AutopilotTriggerRequest(BaseModel):
    url: Optional[str] = None
    channel_id: Optional[str] = None


# ---------------------------------------------------------------------------
# User Authentication & Profiles
# ---------------------------------------------------------------------------


class UserProfile(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    surname: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None


class AuthLoginRequest(BaseModel):
    email: str
    password: str


class AuthSignUpRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    surname: Optional[str] = None


class AuthResponse(BaseModel):
    user: UserProfile
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Multiple YouTube Channels Support
# ---------------------------------------------------------------------------


class YouTubeChannelItem(BaseModel):
    id: str
    channel_id: str
    channel_title: str
    thumbnail_url: Optional[str] = None
    is_default: bool = False
    user_id: Optional[str] = None
    connected_at: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    game_title: Optional[str] = None
    made_for_kids: Optional[bool] = None
    ai_generated: Optional[bool] = None
    paid_promotion: Optional[bool] = None


class UpdateChannelSettingsRequest(BaseModel):
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    game_title: Optional[str] = None
    made_for_kids: Optional[bool] = None
    ai_generated: Optional[bool] = None
    paid_promotion: Optional[bool] = None


class YouTubeChannelsResponse(BaseModel):
    channels: List[YouTubeChannelItem] = Field(default_factory=list)
    active_channel_id: Optional[str] = None


class SelectChannelRequest(BaseModel):
    channel_id: str


# ---------------------------------------------------------------------------
# User Download History
# ---------------------------------------------------------------------------


class HistoryItemSchema(BaseModel):
    id: str
    platform: str
    title: str
    thumbnail: Optional[str] = None
    creator: Optional[str] = None
    format: Optional[str] = None
    filesize: Optional[int] = None
    timestamp: Optional[str] = None
    user_id: Optional[str] = None


class HistoryListResponse(BaseModel):
    history: List[HistoryItemSchema] = Field(default_factory=list)


class AutopilotStatus(BaseModel):
    is_running: bool
    state: str = Field("idle", description="'idle', 'searching', 'rendering', 'queued', 'uploading', 'cooldown', 'paused', 'error'")
    current_batch: Optional[AutopilotBatch] = None
    active_clip_id: Optional[str] = None
    current_step: Optional[str] = None
    current_step_label: Optional[str] = None
    next_upload_time: Optional[str] = None
    seconds_until_next_upload: Optional[int] = None
    daily_uploads_count: int = 0
    daily_upload_limit: int = 6
    cooldown_until: Optional[str] = None
    disk_space_cleaned_mb: float = 0.0
    last_cleaned_at: Optional[str] = None
    cpu_mode: str = "low_load_threads_2"
    recent_logs: List[str] = Field(default_factory=list)
    all_published_videos: List[AutopilotPublishedVideo] = Field(default_factory=list)
    recent_errors: List[AutopilotIssue] = Field(default_factory=list)
    channels: List[YouTubeChannelItem] = Field(default_factory=list)
    active_channel_id: Optional[str] = None
    user: Optional[UserProfile] = None


# ---------------------------------------------------------------------------
# Global Customization & Settings Schemas
# ---------------------------------------------------------------------------

class TextOverlaySettings(BaseModel):
    enabled: bool = Field(True, description="Whether to display overlay text banner")
    hook_style: str = Field("viral_yellow", description="Style preset: viral_yellow, neon_cyan, red_bold, clean_white, none")
    default_hook: str = Field("WAIT FOR THE END!", description="Default hook headline text")
    burn_captions: bool = Field(False, description="Burn dynamic subtitle captions into video")
    caption_style: str = Field("viral_yellow", description="Caption font style preset")
    position: str = Field("top", description="Position of hook headline: top, center, bottom")


class AudioMixSettings(BaseModel):
    background_music: str = Field("none", description="Background music preset: none, vice_city_synth, trap_beat, suspense_lofi")
    music_volume: float = Field(0.15, ge=0.0, le=1.0, description="Music volume level relative to video speech (0.0 to 1.0)")
    original_audio_volume: float = Field(1.0, ge=0.0, le=2.0, description="Original speech audio volume multiplier")
    ducking_enabled: bool = Field(True, description="Lower background music when speech is detected")


class CoverImageSettings(BaseModel):
    enabled: bool = Field(False, description="Slap a viral cover thumbnail as opening frame (default false)")
    theme: str = Field("gta_action", description="Cover theme preset: gta_action, neon_glow, bold_text, clean_minimal")
    headline: str = Field("WAIT FOR WHAT HAPPENS NEXT...", description="Default cover text headline")


class GlobalSettings(BaseModel):
    user_id: Optional[str] = Field("default", description="Associated user ID or 'default'")
    duration_mode: str = Field("short", description="Clip duration mode: 'short' (<30s vertical 9:16) or 'long' (3-4 min horizontal 16:9)")
    long_clip_duration_seconds: Optional[int] = Field(240, ge=30, le=900, description="Target duration for long clips in seconds (e.g. 180-240 for 3-4m, 300-360 for 5-6m)")
    layout: str = Field("center_crop", description="Default layout: center_crop, blurred_background, horizontal, stacked")
    progress_bar: bool = Field(True, description="Include kinetic progress bar at bottom of Short")
    progress_bar_color: str = Field("yellow", description="Progress bar color: yellow, cyan, pink, red, green")
    text_overlay: TextOverlaySettings = Field(default_factory=TextOverlaySettings)
    audio_mix: AudioMixSettings = Field(default_factory=AudioMixSettings)
    cover_image: CoverImageSettings = Field(default_factory=CoverImageSettings)
    default_privacy: str = Field("public", description="Default YouTube upload privacy: public, unlisted, private")
    default_tags: List[str] = Field(default_factory=lambda: ["Shorts", "Viral", "Trending"])
    active_channel_id: Optional[str] = None
    updated_at: Optional[str] = None





