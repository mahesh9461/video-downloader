import {
  VideoMetadata,
  DownloadProgress,
  ApiError,
  WatermarkResult,
  WatermarkPresetInfo,
  ClipCandidate,
  ClipAnalyzeResponse,
  ClipRenderRequest,
  ClipRenderResponse,
  ClipAiHookRequest,
  ClipAiHookResponse,
  ClipPresetInfo,
} from "./types";

const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL !== undefined && process.env.NEXT_PUBLIC_API_URL !== "") {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
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

  private resolveUrl(path: string): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    if (this.baseUrl.endsWith("/api/proxy")) {
      const endpoint = cleanPath.startsWith("/api/") ? cleanPath.slice(5) : cleanPath.slice(1);
      return `${this.baseUrl}/${endpoint}`;
    }
    return `${this.baseUrl}${cleanPath}`;
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
    minDuration = 30,
    maxDuration = 60,
    maxClips = 5
  ): Promise<ClipAnalyzeResponse> {
    const response = await fetch(this.resolveUrl("/api/clips/analyze"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        min_duration: minDuration,
        max_duration: maxDuration,
        max_clips: maxClips,
      }),
    });

    if (!response.ok) {
      let detail = "Failed to analyze video clips";
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

    return response.json();
  }

  async renderClip(request: ClipRenderRequest): Promise<ClipRenderResponse> {
    const response = await fetch(this.resolveUrl("/api/clips/render"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let detail = "Failed to render clip";
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
      let detail = "Failed to generate AI hook headline";
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

  async fetchClipPresets(): Promise<ClipPresetInfo> {
    const response = await fetch(this.resolveUrl("/api/clips/presets"));
    if (!response.ok) {
      throw new DownloadError("Failed to fetch clip presets", "unknown");
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
