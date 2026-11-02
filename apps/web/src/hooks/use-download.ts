"use client";

import { useState, useCallback, useRef } from "react";
import { apiClient, DownloadError } from "@/lib/api";
import { VideoMetadata, DownloadProgress } from "@/lib/types";
import { trackDownloadComplete, trackDownloadError } from "@/lib/analytics";

interface UseDownloadReturn {
  metadata: VideoMetadata | null;
  progress: DownloadProgress | null;
  isLoadingMetadata: boolean;
  isDownloading: boolean;
  error: string | null;
  errorType: string | null;
  fetchMetadata: (url: string) => Promise<void>;
  startDownload: (url: string, formatId: string) => void;
  cancelDownload: () => void;
  clearError: () => void;
  reset: () => void;
}

export function useDownload(): UseDownloadReturn {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    setErrorType(null);
  }, []);

  const reset = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    setMetadata(null);
    setProgress(null);
    setIsLoadingMetadata(false);
    setIsDownloading(false);
    setError(null);
    setErrorType(null);
  }, []);

  const fetchMetadata = useCallback(async (url: string) => {
    setIsLoadingMetadata(true);
    setError(null);
    setErrorType(null);
    setMetadata(null);
    setProgress(null);

    try {
      const data = await apiClient.fetchMetadata(url);
      setMetadata(data);
    } catch (err) {
      if (err instanceof DownloadError || (err && typeof err === "object" && (err as any).name === "DownloadError")) {
        const errorMsg = (err as DownloadError).message;
        const type = (err as DownloadError).type;
        setError(errorMsg);
        setErrorType(type);
        trackDownloadError({ error_message: errorMsg, error_type: type });
      } else {
        const errorMsg = "Failed to fetch video info. Please check the URL and try again.";
        setError(errorMsg);
        setErrorType("network");
        trackDownloadError({ error_message: errorMsg, error_type: "network" });
      }
    } finally {
      setIsLoadingMetadata(false);
    }
  }, []);

  const startDownload = useCallback((url: string, formatId: string) => {
    setIsDownloading(true);
    setProgress({
      status: "downloading",
      percent: 0,
      speed: "Connecting...",
      eta: "Starting...",
      filename: null,
      filesize: null,
      error_message: null,
    });
    setError(null);

    const cancel = apiClient.downloadWithProgress(
      url,
      formatId,
      (prog) => setProgress(prog),
      (downloadUrl) => {
        setIsDownloading(false);
        setProgress({
          status: "complete",
          percent: 100,
          speed: null,
          eta: null,
          filename: null,
          filesize: null,
          error_message: null,
        });
        trackDownloadComplete({
          platform: metadata?.platform || "unknown",
          title: metadata?.title || "Unknown Video",
          format: formatId,
          duration_seconds: metadata?.duration || 0,
        });
        // Trigger browser download
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.setAttribute("download", "");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
      (errorMsg) => {
        setIsDownloading(false);
        setError(errorMsg);
        setErrorType("unknown");
        trackDownloadError({
          platform: metadata?.platform || "unknown",
          error_message: errorMsg,
          error_type: "download_failed",
        });
      }
    );

    cancelRef.current = cancel;
  }, []);

  const cancelDownload = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    setIsDownloading(false);
    setProgress(null);
  }, []);

  return {
    metadata,
    progress,
    isLoadingMetadata,
    isDownloading,
    error,
    errorType,
    fetchMetadata,
    startDownload,
    cancelDownload,
    clearError,
    reset,
  };
}

