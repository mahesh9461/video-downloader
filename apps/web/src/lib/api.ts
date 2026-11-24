import {
  VideoMetadata,
  DownloadProgress,
  ApiError,
  WatermarkResult,
  WatermarkPresetInfo,
  ClipAnalyzeResponse,
  ClipRenderRequest,
  ClipRenderResponse,
  ClipAiHookRequest,
  ClipAiHookResponse,
  ClipPresetInfo,
  YouTubePublishRequest,
  YouTubePublishResponse,
  YouTubeAuthStatus,
  AutopilotStatus,
  UserProfile,
  AuthResponse,
  YouTubeChannelItem,
  YouTubeChannelsResponse,
  HistoryItem,
  GlobalSettings,
} from "./types";

const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL !== undefined && process.env.NEXT_PUBLIC_API_URL !== "") {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    // Direct connection to local FastAPI backend when running locally to avoid
    // Next.js dev server proxy rewrite socket hang ups on long video/clip requests
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }
    return "/api/proxy";
  }
  return "http://localhost:8000";
};

const API_BASE = getApiBase();

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  public resolveUrl(path: string): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    if (this.baseUrl.endsWith("/api/proxy")) {
      const endpoint = cleanPath.startsWith("/api/") ? cleanPath.slice(5) : cleanPath.slice(1);
      return `${this.baseUrl}/${endpoint}`;
    }
    return `${this.baseUrl}${cleanPath}`;
  }

  public getAuthHeaders(): Record<string, string> {
    if (typeof window !== "undefined") {
      try {
        const token = localStorage.getItem("saveit_auth_token");
        if (token) {
          return { Authorization: `Bearer ${token}` };
        }
      } catch {}
    }
    return {};
  }

  async fetchMetadata(url: string): Promise<VideoMetadata> {
    const response = await fetch(this.resolveUrl("/api/metadata"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new DownloadError(error.detail, error.error_type);
    }

    return response.json();
  }

  downloadWithProgress(
    url: string,
    formatId: string,
    onProgress: (progress: DownloadProgress) => void,
    onComplete: (downloadUrl: string) => void,
    onError: (error: string) => void
  ): () => void {
    const abortController = new AbortController();

    const run = async () => {
      try {
        const response = await fetch(this.resolveUrl("/api/download"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, format_id: formatId }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const error: ApiError = await response.json();
          throw new DownloadError(error.detail, error.error_type);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = JSON.parse(line.slice(6));

              if (data.status === "complete" && data.filename) {
                onComplete(
                  this.resolveUrl(`/api/file/${encodeURIComponent(data.filename)}`)
                );
              } else if (data.status === "error") {
                onError(data.error_message || "Download failed");
              } else {
                onProgress(data as DownloadProgress);
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof DownloadError) {
          onError(err.message);
        } else {
          onError("An unexpected error occurred");
        }
      }
    };

    run();

    return () => abortController.abort();
  }

  async removeWatermark(formData: FormData): Promise<WatermarkResult> {
    const response = await fetch(this.resolveUrl("/api/watermark/remove"), {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let detail = "Failed to process watermark removal";
      let errorType = "unknown";
      try {
        const err = await response.json();
        detail = err.detail || detail;
        errorType = err.error_type || errorType;
      } catch {
        // fallback
      }
      throw new DownloadError(detail, errorType);
    }

    const data: WatermarkResult = await response.json();
    return {
      ...data,
      download_url: this.resolveUrl(data.download_url),
    };
  }

  async fetchWatermarkPresets(): Promise<WatermarkPresetInfo[]> {
    const response = await fetch(this.resolveUrl("/api/watermark/presets"));
    if (!response.ok) {
      throw new DownloadError("Failed to fetch watermark presets", "unknown");
    }
    return response.json();
  }

  async analyzeClips(
    url: string,
    minDuration = 15,
    maxDuration = 30,
    maxClips = 5,
    durationMode = "short"
  ): Promise<ClipAnalyzeResponse> {
    const response = await fetch(this.resolveUrl("/api/clips/analyze"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        min_duration: minDuration,
        max_duration: maxDuration,
        max_clips: maxClips,
        duration_mode: durationMode,
      }),
    });

    if (!response.ok) {
      let detail = `Failed to analyze video clips (${response.status})`;
      let errorType = "unknown";
      try {
        const err = await response.json();
        if (typeof err.detail === "string") {
          detail = err.detail;
        } else if (Array.isArray(err.detail)) {
          detail = err.detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
        }
        errorType = err.error_type || errorType;
      } catch {
        // fallback
      }
      throw new DownloadError(detail, errorType);
    }

    return response.json();
  }

  async renderClip(request: ClipRenderRequest): Promise<ClipRenderResponse> {
    const response = await fetch(this.resolveUrl("/api/clips/render"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let detail = `Failed to render clip (${response.status})`;
      let errorType = "unknown";
      try {
        const err = await response.json();
        if (typeof err.detail === "string") {
          detail = err.detail;
        } else if (Array.isArray(err.detail)) {
          detail = err.detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
        }
        errorType = err.error_type || errorType;
      } catch {
        // fallback
      }
      throw new DownloadError(detail, errorType);
    }

    const data: ClipRenderResponse = await response.json();
    return {
      ...data,
      download_url: this.resolveUrl(data.download_url),
    };
  }

  async generateClipAiHook(request: ClipAiHookRequest): Promise<ClipAiHookResponse> {
    const response = await fetch(this.resolveUrl("/api/clips/ai-hook"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let detail = `Failed to generate AI hook headline (${response.status})`;
      let errorType = "unknown";
      try {
        const err = await response.json();
        if (typeof err.detail === "string") {
          detail = err.detail;
        } else if (Array.isArray(err.detail)) {
          detail = err.detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
        }
        errorType = err.error_type || errorType;
      } catch {}
      throw new DownloadError(detail, errorType);
    }

    return response.json();
  }

  async fetchClipPresets(): Promise<ClipPresetInfo> {
    const response = await fetch(this.resolveUrl("/api/clips/presets"));
    if (!response.ok) {
      throw new DownloadError("Failed to fetch clip presets", "unknown");
    }
    return response.json();
  }

  async uploadClipVideo(formData: FormData): Promise<{ file_id: string; filename: string; duration: number; download_url: string }> {
    const response = await fetch(this.resolveUrl("/api/clips/upload"), {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let detail = "Failed to upload video";
      let errorType = "unknown";
      try {
        const err = await response.json();
        detail = err.detail || detail;
        errorType = err.error_type || errorType;
      } catch {}
      throw new DownloadError(detail, errorType);
    }

    return response.json();
  }

  async getYouTubeStatus(): Promise<YouTubeAuthStatus> {
    const response = await fetch(this.resolveUrl("/api/youtube/status"), {
      headers: { ...this.getAuthHeaders() },
    });
    if (!response.ok) {
      throw new DownloadError("Failed to fetch YouTube auth status", "unknown");
    }
    return response.json();
  }

  async getYouTubeAuthUrl(): Promise<string> {
    const response = await fetch(this.resolveUrl("/api/youtube/auth-url"));
    if (!response.ok) {
      let detail = "Failed to get YouTube authorization URL";
      try {
        const err = await response.json();
        detail = err.detail || detail;
      } catch {}
      throw new DownloadError(detail, "oauth_error");
    }
    const data = await response.json();
    return data.auth_url;
  }

  async configureYouTubeOAuth(clientId: string, clientSecret: string): Promise<any> {
    const response = await fetch(this.resolveUrl("/api/youtube/configure"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    });
    if (!response.ok) {
      throw new DownloadError("Failed to save YouTube OAuth credentials", "oauth_error");
    }
    return response.json();
  }

  async disconnectYouTube(): Promise<any> {
    const response = await fetch(this.resolveUrl("/api/youtube/disconnect"), {
      method: "POST",
    });
    if (!response.ok) {
      throw new DownloadError("Failed to disconnect YouTube channel", "unknown");
    }
    return response.json();
  }

  async setYouTubeToken(token: string, channelId?: string, channelTitle?: string, refreshToken?: string): Promise<any> {
    const response = await fetch(this.resolveUrl("/api/youtube/set-token"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({
        token,
        channel_id: channelId,
        channel_title: channelTitle,
        refresh_token: refreshToken,
      }),
    });
    if (!response.ok) {
      throw new DownloadError("Failed to save YouTube access token", "unknown");
    }
    return response.json();
  }

  async publishToYouTube(req: YouTubePublishRequest): Promise<YouTubePublishResponse> {
    const response = await fetch(this.resolveUrl("/api/youtube/publish"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      let detail = "Failed to publish video to YouTube";
      let errorType = "youtube_error";
      try {
        const err = await response.json();
        detail = err.detail || detail;
        errorType = err.error_type || errorType;
      } catch {}
      throw new DownloadError(detail, errorType);
    }

    return response.json();
  }

  async getAutopilotStatus(): Promise<AutopilotStatus> {
    const response = await fetch(this.resolveUrl("/api/autopilot/status"), {
      headers: { ...this.getAuthHeaders() },
    });
    if (!response.ok) {
      throw new DownloadError("Failed to fetch autopilot status", "unknown");
    }
    return response.json();
  }

  async startAutopilot(): Promise<AutopilotStatus> {
    const response = await fetch(this.resolveUrl("/api/autopilot/start"), {
      method: "POST",
      headers: { ...this.getAuthHeaders() },
    });
    if (!response.ok) {
      throw new DownloadError("Failed to start autopilot", "unknown");
    }
    return response.json();
  }

  async pauseAutopilot(): Promise<AutopilotStatus> {
    const response = await fetch(this.resolveUrl("/api/autopilot/pause"), {
      method: "POST",
      headers: { ...this.getAuthHeaders() },
    });
    if (!response.ok) {
      throw new DownloadError("Failed to pause autopilot", "unknown");
    }
    return response.json();
  }

  async stopAutopilot(): Promise<AutopilotStatus> {
    const response = await fetch(this.resolveUrl("/api/autopilot/stop"), {
      method: "POST",
      headers: { ...this.getAuthHeaders() },
    });
    if (!response.ok) {
      throw new DownloadError("Failed to stop autopilot", "unknown");
    }
    return response.json();
  }

  async triggerAutopilot(url?: string, channelId?: string): Promise<AutopilotStatus> {
    const response = await fetch(this.resolveUrl("/api/autopilot/trigger"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({ url: url || null, channel_id: channelId || null }),
    });
    if (!response.ok) {
      throw new DownloadError("Failed to trigger autopilot", "unknown");
    }
    return response.json();
  }

  // User Authentication
  async signup(email: string, password: string, name?: string, surname?: string): Promise<AuthResponse> {
    const response = await fetch(this.resolveUrl("/api/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, surname }),
    });
    if (!response.ok) {
      let detail = "Signup failed";
      try {
        const err = await response.json();
        detail = err.detail || detail;
      } catch {}
      throw new DownloadError(detail, "auth_error");
    }
    const data: AuthResponse = await response.json();
    if (typeof window !== "undefined" && data.access_token) {
      localStorage.setItem("saveit_auth_token", data.access_token);
    }
    return data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(this.resolveUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      let detail = "Invalid email or password";
      try {
        const err = await response.json();
        detail = err.detail || detail;
      } catch {}
      throw new DownloadError(detail, "auth_error");
    }
    const data: AuthResponse = await response.json();
    if (typeof window !== "undefined" && data.access_token) {
      localStorage.setItem("saveit_auth_token", data.access_token);
    }
    return data;
  }

  async getMe(): Promise<UserProfile> {
    const response = await fetch(this.resolveUrl("/api/auth/me"), {
      headers: { ...this.getAuthHeaders() },
    });
    if (!response.ok) {
      throw new DownloadError("Not authenticated", "auth_error");
    }
    return response.json();
  }

  async logout(): Promise<void> {
    try {
      await fetch(this.resolveUrl("/api/auth/logout"), {
        method: "POST",
        headers: { ...this.getAuthHeaders() },
      });
    } catch {}
    if (typeof window !== "undefined") {
      localStorage.removeItem("saveit_auth_token");
    }
  }

  // Multiple YouTube Channels
  async getYouTubeChannels(): Promise<YouTubeChannelsResponse> {
    const response = await fetch(this.resolveUrl("/api/youtube/channels"), {
      headers: { ...this.getAuthHeaders() },
    });
    if (!response.ok) {
      throw new DownloadError("Failed to fetch YouTube channels", "youtube_error");
    }
    return response.json();
  }

  async selectYouTubeChannel(channelId: string): Promise<YouTubeChannelsResponse> {
    const response = await fetch(this.resolveUrl("/api/youtube/channels/select"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({ channel_id: channelId }),
    });
    if (!response.ok) {
      throw new DownloadError("Failed to select channel", "youtube_error");
    }
    return response.json();
  }

  async deleteYouTubeChannel(channelId: string): Promise<{ ok: boolean; deleted_channel_id: string }> {
    const response = await fetch(this.resolveUrl(`/api/youtube/channels/${encodeURIComponent(channelId)}`), {
      method: "DELETE",
      headers: { ...this.getAuthHeaders() },
    });
    if (!response.ok) {
      throw new DownloadError("Failed to delete channel", "youtube_error");
    }
    return response.json();
  }

  // Remote History
  async getRemoteHistory(): Promise<HistoryItem[]> {
    const response = await fetch(this.resolveUrl("/api/history"), {
      headers: { ...this.getAuthHeaders() },
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.history || [];
  }

  async saveRemoteHistory(item: HistoryItem): Promise<HistoryItem> {
    const response = await fetch(this.resolveUrl("/api/history"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify(item),
    });
    if (!response.ok) {
      return item;
    }
    return response.json();
  }

  async resetAutopilot(clearHistory: boolean = false): Promise<AutopilotStatus> {
    const url = clearHistory ? "/api/autopilot/reset?clear_history=true" : "/api/autopilot/reset";
    const response = await fetch(this.resolveUrl(url), {
      method: "POST",
    });
    if (!response.ok) {
      throw new DownloadError("Failed to reset autopilot", "unknown");
    }
    return response.json();
  }

  async clearAutopilotHistory(): Promise<AutopilotStatus> {
    const response = await fetch(this.resolveUrl("/api/autopilot/clear-history"), {
      method: "POST",
    });
    if (!response.ok) {
      throw new DownloadError("Failed to clear autopilot history", "unknown");
    }
    return response.json();
  }

  async retryAutopilotClip(clipId: string): Promise<AutopilotStatus> {
    const response = await fetch(this.resolveUrl(`/api/autopilot/retry-upload/${encodeURIComponent(clipId)}`), {
      method: "POST",
    });
    if (!response.ok) {
      throw new DownloadError("Failed to retry upload", "unknown");
    }
    return response.json();
  }

  async cleanupAutopilotDisk(): Promise<{ freed_mb: number; total_cleaned_mb: number }> {
    const response = await fetch(this.resolveUrl("/api/autopilot/cleanup"), {
      method: "POST",
    });
    if (!response.ok) {
      throw new DownloadError("Failed to cleanup disk", "unknown");
    }
    return response.json();
  }

  async getAutopilotAudio(): Promise<{ custom_tracks: string[]; count: number }> {
    const response = await fetch(this.resolveUrl("/api/autopilot/audio"));
    if (!response.ok) {
      throw new DownloadError("Failed to fetch audio tracks", "unknown");
    }
    return response.json();
  }

  async getGlobalSettings(): Promise<GlobalSettings> {
    const response = await fetch(this.resolveUrl("/api/settings/global"), {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new DownloadError("Failed to fetch global settings", "unknown");
    }
    return response.json();
  }

  async saveGlobalSettings(settings: GlobalSettings): Promise<GlobalSettings> {
    const response = await fetch(this.resolveUrl("/api/settings/global"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      throw new DownloadError("Failed to save global settings", "unknown");
    }
    return response.json();
  }
}

export class DownloadError extends Error {
  type: string;
  constructor(message: string, type: string) {
    super(message);
    this.type = type;
    this.name = "DownloadError";
  }
}

export const apiClient = new ApiClient(API_BASE);
