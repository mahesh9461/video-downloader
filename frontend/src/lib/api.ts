import { VideoMetadata, DownloadProgress, ApiError } from "./types";

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
