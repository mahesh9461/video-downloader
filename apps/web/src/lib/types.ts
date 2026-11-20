export type Platform = "youtube" | "tiktok" | "instagram";

export interface VideoFormat {
  format_id: string;
  label: string;
  resolution: string | null;
  ext: string;
  filesize: number | null;
  is_audio_only: boolean;
}

export interface VideoMetadata {
  id: string;
  platform: Platform;
  title: string;
  creator: string;
  creator_avatar: string | null;
  duration: number;
  thumbnail: string;
  formats: VideoFormat[];
  downloads_available?: boolean;
  notice?: string | null;
}

export interface DownloadProgress {
  status: "downloading" | "merging" | "converting" | "complete" | "error";
  percent: number;
  speed: string | null;
  eta: string | null;
  filename: string | null;
  filesize: number | null;
  error_message: string | null;
}

export interface HistoryItem {
  id: string;
  platform: Platform;
  title: string;
  thumbnail: string;
  creator: string;
  format: string;
  filesize: number | null;
  timestamp: string;
}

export interface ApiError {
  detail: string;
  error_type: "private" | "geo_restricted" | "deleted" | "rate_limit" | "invalid_url" | "network" | "unknown";
}

export interface WatermarkRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WatermarkPresetInfo {
  platform: string;
  label: string;
  description: string;
  regions: WatermarkRegion[];
}

export interface WatermarkResult {
  filename: string;
  filesize: number;
  download_url: string;
  detected_regions?: WatermarkRegion[] | null;
}

export interface ClipCandidate {
  clip_id: string;
  start_time: number;
  end_time: number;
  duration: number;
  viral_score: number;
  hook_title: string;
  summary: string;
  reason: string;
  thumbnail_url?: string | null;
  retention_rate?: string | null;
  hook_rating?: string | null;
}

export interface ClipAnalyzeResponse {
  video_id?: string | null;
  title: string;
  total_duration: number;
  clips: ClipCandidate[];
}

export interface ClipRenderRequest {
  url?: string;
  start_time: number;
  end_time: number;
  layout?: string;
  hook_title?: string;
  hook_style?: string;
  background_music?: string;
  music_volume?: number;
  progress_bar?: boolean;
  progress_bar_color?: string;
  burn_captions?: boolean;
  caption_style?: string;
}

export interface ClipRenderResponse {
  filename: string;
  filesize: number;
  duration: number;
  download_url: string;
  layout: string;
  hook_title?: string | null;
}

export interface ClipAiHookRequest {
  url?: string;
  start_time: number;
  end_time: number;
  video_title?: string;
  clip_dialogue?: string;
  provider?: "deepseek" | "free_open_llm" | "ollama";
}

export interface ClipAiHookResponse {
  transcript: string;
  hook_title: string;
  source: string;
}

export interface PresetOption {
  id: string;
  label: string;
  description: string;
}

export interface ClipPresetInfo {
  layouts: PresetOption[];
  music_presets: PresetOption[];
  hook_styles: PresetOption[];
}

export interface YouTubePublishRequest {
  filename: string;
  title: string;
  description?: string;
  tags?: string[];
  privacy: "public" | "unlisted" | "private";
  access_token?: string;
}

export interface YouTubePublishResponse {
  video_id: string;
  youtube_url: string;
  title: string;
  privacy: string;
  status: string;
}

export interface YouTubeAuthStatus {
  configured: boolean;
  connected: boolean;
  channel_title?: string;
  channel_id?: string;
  auth_url?: string;
}


