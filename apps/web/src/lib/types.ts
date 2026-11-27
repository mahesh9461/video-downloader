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
  view_count?: number | null;
}

export interface DownloadProgress {
  status: "downloading" | "merging" | "converting" | "complete" | "error";
  percent: number;
  speed: string | null;
  eta: string | null;
  filename: string | null;
  filesize: number | null;
  error_message: string | null;
  error?: string | null;
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
  id?: string;
  start_time: number;
  end_time: number;
  duration: number;
  viral_score: number;
  hook_title: string;
  summary: string;
  reason: string;
  transcript_snippet?: string | null;
  reasoning?: string | null;
  thumbnail_url?: string | null;
  retention_rate?: string | null;
  hook_rating?: string | null;
  hook_score?: number | null;
  pacing_score?: number | null;
  audio_energy_score?: number | null;
  visual_motion_score?: number | null;
  loop_rating?: string | null;
  speaker_tracking_applied?: boolean;
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
  anti_copyright_shield?: boolean;
  mute_original_audio?: boolean;
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
  channel_id?: string;
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

export interface AutopilotPublishedVideo {
  id: string;
  clip_index?: number;
  title: string;
  youtube_url: string;
  youtube_video_id: string;
  published_at: string;
  preview_url?: string | null;
  cover_url?: string | null;
  duration?: number;
  file_size_mb?: number | null;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  surname?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
}

export interface AuthResponse {
  user: UserProfile;
  access_token: string;
}

export interface YouTubeChannelItem {
  id: string;
  channel_id: string;
  channel_title: string;
  thumbnail_url?: string | null;
  is_default: boolean;
  user_id?: string;
  connected_at?: string | null;
  description?: string | null;
  tags?: string[] | null;
  category_id?: string | null;
  category_name?: string | null;
  game_title?: string | null;
  made_for_kids?: boolean | null;
  ai_generated?: boolean | null;
  paid_promotion?: boolean | null;
  email?: string | null;
  subscriber_count?: string | null;
}

export interface UpdateChannelSettingsRequest {
  description?: string;
  tags?: string[];
  category_id?: string;
  category_name?: string;
  game_title?: string;
  made_for_kids?: boolean;
  ai_generated?: boolean;
  paid_promotion?: boolean;
}

export interface YouTubeChannelsResponse {
  channels: YouTubeChannelItem[];
  active_channel_id?: string | null;
}

export interface AutopilotIssue {
  clip_id?: string;
  title?: string;
  stage?: string;
  error: string;
  timestamp: string;
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
  preview_url?: string | null;
  download_url?: string | null;
  cover_filename?: string | null;
  cover_url?: string | null;
  file_size_mb?: number | null;
  scheduled_time?: string | null;
  status: "queued" | "rendering" | "preview_ready" | "uploading" | "published" | "cleaned" | "failed";
  current_step?: "queued" | "discovering" | "hook_created" | "styling" | "rendering" | "preview_ready" | "uploading" | "published" | "failed";
  step_description?: string | null;
  youtube_video_id?: string | null;
  youtube_url?: string | null;
  error?: string | null;
  user_id?: string | null;
  channel_id?: string | null;
}

export interface AutopilotBatch {
  batch_id: string;
  source_video_id: string;
  source_title: string;
  source_url: string;
  created_at: string;
  clips: AutopilotClipItem[];
  status: "processing" | "queued" | "completed" | "cooldown";
  user_id?: string | null;
  target_channel_id?: string | null;
}

export interface AutopilotStatus {
  is_running: boolean;
  state: "idle" | "searching" | "rendering" | "queued" | "uploading" | "cooldown" | "paused" | "error";
  current_batch?: AutopilotBatch | null;
  active_clip_id?: string | null;
  current_step?: string | null;
  current_step_label?: string | null;
  next_upload_time?: string | null;
  seconds_until_next_upload?: number | null;
  daily_uploads_count: number;
  daily_upload_limit: number;
  cooldown_until?: string | null;
  disk_space_cleaned_mb: number;
  last_cleaned_at?: string | null;
  cpu_mode: string;
  recent_logs: string[];
  all_published_videos?: AutopilotPublishedVideo[];
  recent_errors?: AutopilotIssue[];
  channels?: YouTubeChannelItem[];
  active_channel_id?: string | null;
  user?: UserProfile | null;
}

export interface TextOverlaySettings {
  enabled: boolean;
  hook_style: string;
  default_hook: string;
  burn_captions: boolean;
  caption_style: string;
  position: string;
}

export interface AudioMixSettings {
  background_music: string;
  music_volume: number;
  original_audio_volume: number;
  ducking_enabled: boolean;
}

export interface CoverImageSettings {
  enabled: boolean;
  theme: string;
  headline: string;
}

export interface GlobalSettings {
  user_id?: string;
  duration_mode?: "short" | "long";
  long_clip_duration_seconds?: number;
  layout: string;
  progress_bar: boolean;
  progress_bar_color: string;
  text_overlay: TextOverlaySettings;
  audio_mix: AudioMixSettings;
  cover_image: CoverImageSettings;
  default_privacy: "public" | "unlisted" | "private";
  default_tags: string[];
  active_channel_id?: string | null;
  updated_at?: string;
}




