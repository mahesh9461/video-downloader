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

