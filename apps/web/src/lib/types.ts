export type Platform = "youtube" | "tiktok";

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

