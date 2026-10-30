import { VideoMetadata, DownloadProgress, ApiError } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async fetchMetadata(url: string): Promise<VideoMetadata> {
    const response = await fetch(`${this.baseUrl}/api/metadata`, {
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
        const response = await fetch(`${this.baseUrl}/api/download`, {
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
                  `${this.baseUrl}/api/file/${encodeURIComponent(data.filename)}`
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

