from typing import List, Optional
from pydantic import BaseModel, Field


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
    clip_id: str = Field(..., description="Unique ID for this clip segment")
    start_time: float = Field(..., ge=0, description="Start timestamp in seconds")
    end_time: float = Field(..., ge=0, description="End timestamp in seconds")
    duration: float = Field(..., ge=0, description="Clip duration in seconds")
    viral_score: int = Field(..., ge=0, le=100, description="Engagement virality score (0-100)")
    hook_title: str = Field(..., description="Generated hook headline for the top banner")
    summary: str = Field(..., description="Brief summary of what happens in this clip")
    reason: str = Field(..., description="Why this clip is predicted to perform well")
    thumbnail_url: Optional[str] = Field(None, description="Visual thumbnail of the video clip")
    retention_rate: Optional[str] = Field(None, description="Predicted viewer retention percentage")
    hook_rating: Optional[str] = Field(None, description="Virality percentile badge")


class ClipAnalyzeRequest(BaseModel):
    url: Optional[str] = Field(None, description="YouTube or video URL to analyze")
    min_duration: int = Field(30, ge=15, le=120, description="Minimum clip duration in seconds")
    max_duration: int = Field(60, ge=20, le=180, description="Maximum clip duration in seconds")
    max_clips: int = Field(5, ge=1, le=10, description="Maximum number of clips to return")


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

