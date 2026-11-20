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

export interface AutopilotClipItem {
  id: string;
  source_video_id: string;
  source_title: string;
  clip_index: number;
  start_time: number;
  end_time: number;
  duration: number;
  hook_title: string;
  hook_style: string;
  progress_bar_color: string;
  layout: string;
  background_music: string;
  filename?: string | null;
  scheduled_time?: string | null;
  status: "queued" | "rendering" | "uploading" | "published" | "cleaned" | "failed";
  youtube_video_id?: string | null;
  youtube_url?: string | null;
  error?: string | null;
}

export interface AutopilotBatch {
  batch_id: string;
  source_video_id: string;
  source_title: string;
  source_url: string;
  created_at: string;
  clips: AutopilotClipItem[];
  status: "processing" | "queued" | "completed" | "cooldown";
}

export interface AutopilotStatus {
  is_running: boolean;
  state: "idle" | "searching" | "rendering" | "queued" | "uploading" | "cooldown" | "paused";
  current_batch?: AutopilotBatch | null;
  next_upload_time?: string | null;
  seconds_until_next_upload?: number | null;
  daily_uploads_count: number;
  daily_upload_limit: number;
  cooldown_until?: string | null;
  disk_space_cleaned_mb: number;
  last_cleaned_at?: string | null;
  cpu_mode: string;
  recent_logs: string[];
}



