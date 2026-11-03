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

