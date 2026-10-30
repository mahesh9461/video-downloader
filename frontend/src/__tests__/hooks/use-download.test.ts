import "@testing-library/jest-dom";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDownload } from "@/hooks/use-download";

// Mock the API client before importing the hook
const mockFetchMetadata = jest.fn();
const mockDownloadWithProgress = jest.fn();

jest.mock("@/lib/api", () => ({
  apiClient: {
    fetchMetadata: (...args: unknown[]) => mockFetchMetadata(...args),
    downloadWithProgress: (...args: unknown[]) => mockDownloadWithProgress(...args),
  },
  DownloadError: class DownloadError extends Error {
    type: string;
    constructor(message: string, type: string) {
      super(message);
      this.type = type;
      this.name = "DownloadError";
    }
  },
}));

const mockMetadata = {
  id: "test-id",
  platform: "youtube" as const,
  title: "Test Video",
  creator: "Test Creator",
  creator_avatar: null,
  duration: 120,
  thumbnail: "https://example.com/thumb.jpg",
  formats: [
    { format_id: "720p", label: "720p", resolution: "720p", ext: "mp4", filesize: 1024, is_audio_only: false },
  ],
};

describe("useDownload hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("render (initial state)", () => {
    it("should initialize with default values", () => {
      // Arrange & Act
      const { result } = renderHook(() => useDownload());

      // Assert
      expect(result.current.metadata).toBeNull();
      expect(result.current.progress).toBeNull();
      expect(result.current.isLoadingMetadata).toBe(false);
      expect(result.current.isDownloading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.errorType).toBeNull();
    });
  });

  describe("user interaction - fetchMetadata", () => {
    it("should fetch metadata successfully", async () => {
      // Arrange
      mockFetchMetadata.mockResolvedValueOnce(mockMetadata);
      const { result } = renderHook(() => useDownload());

      // Act
      await act(async () => {
        await result.current.fetchMetadata("https://www.youtube.com/watch?v=test123test");
      });

      // Assert
      expect(result.current.metadata).toEqual(mockMetadata);
      expect(result.current.isLoadingMetadata).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should set loading state while fetching", async () => {
      // Arrange
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetchMetadata.mockReturnValueOnce(promise);
      const { result } = renderHook(() => useDownload());

      // Act
      act(() => {
        result.current.fetchMetadata("https://www.youtube.com/watch?v=test123test");
      });

      // Assert - loading state
      expect(result.current.isLoadingMetadata).toBe(true);

      // Cleanup
      await act(async () => {
        resolvePromise!(mockMetadata);
      });
    });

    it("should handle DownloadError", async () => {
      // Arrange
      const { DownloadError } = require("@/lib/api");
      mockFetchMetadata.mockRejectedValueOnce(new DownloadError("Video is private", "private"));
      const { result } = renderHook(() => useDownload());

      // Act
      await act(async () => {
        await result.current.fetchMetadata("https://www.youtube.com/watch?v=private1234");
      });

      // Assert
      expect(result.current.error).toBe("Video is private");
      expect(result.current.errorType).toBe("private");
      expect(result.current.metadata).toBeNull();
    });

    it("should handle generic errors", async () => {
      // Arrange
      mockFetchMetadata.mockRejectedValueOnce(new Error("Network error"));
      const { result } = renderHook(() => useDownload());

      // Act
      await act(async () => {
        await result.current.fetchMetadata("https://www.youtube.com/watch?v=test123test");
      });

      // Assert
      expect(result.current.error).toBe("Failed to fetch video info. Please check the URL and try again.");
      expect(result.current.errorType).toBe("network");
    });
  });

  describe("user interaction - startDownload", () => {
    it("should initiate a download and set isDownloading", () => {
      // Arrange
      const mockCancel = jest.fn();
      mockDownloadWithProgress.mockReturnValueOnce(mockCancel);
      const { result } = renderHook(() => useDownload());

      // Act
      act(() => {
        result.current.startDownload("https://www.youtube.com/watch?v=test123test", "720p");
      });

      // Assert
      expect(result.current.isDownloading).toBe(true);
      expect(mockDownloadWithProgress).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=test123test",
        "720p",
        expect.any(Function), // onProgress
        expect.any(Function), // onComplete
        expect.any(Function)  // onError
      );
    });

    it("should update progress when SSE sends data", () => {
      // Arrange
      let onProgress: (p: unknown) => void;
      mockDownloadWithProgress.mockImplementationOnce(
        (_url: string, _fmt: string, progressCb: (p: unknown) => void) => {
          onProgress = progressCb;
          return jest.fn();
        }
      );
      const { result } = renderHook(() => useDownload());

      // Act
      act(() => {
        result.current.startDownload("https://www.youtube.com/watch?v=test123test", "720p");
      });
      act(() => {
        onProgress!({
          status: "downloading",
          percent: 42.5,
          speed: "2.1 MB/s",
          eta: "00:15",
          filename: null,
          filesize: null,
          error_message: null,
        });
      });

      // Assert
      expect(result.current.progress).toBeTruthy();
      expect(result.current.progress!.percent).toBe(42.5);
      expect(result.current.progress!.speed).toBe("2.1 MB/s");
    });
  });

  describe("state verification - cancelDownload", () => {
    it("should cancel an active download", () => {
      // Arrange
      const mockCancel = jest.fn();
      mockDownloadWithProgress.mockReturnValueOnce(mockCancel);
      const { result } = renderHook(() => useDownload());
      act(() => {
        result.current.startDownload("https://www.youtube.com/watch?v=test123test", "720p");
      });

      // Act
      act(() => {
        result.current.cancelDownload();
      });

      // Assert
      expect(mockCancel).toHaveBeenCalled();
      expect(result.current.isDownloading).toBe(false);
      expect(result.current.progress).toBeNull();
    });
  });

  describe("state verification - reset", () => {
    it("should reset all state", async () => {
      // Arrange
      mockFetchMetadata.mockResolvedValueOnce(mockMetadata);
      const { result } = renderHook(() => useDownload());
      await act(async () => {
        await result.current.fetchMetadata("https://www.youtube.com/watch?v=test123test");
      });

      // Act
      act(() => {
        result.current.reset();
      });

      // Assert
      expect(result.current.metadata).toBeNull();
      expect(result.current.progress).toBeNull();
      expect(result.current.isLoadingMetadata).toBe(false);
      expect(result.current.isDownloading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe("state verification - clearError", () => {
    it("should clear error and errorType", async () => {
      // Arrange
      mockFetchMetadata.mockRejectedValueOnce(new Error("fail"));
      const { result } = renderHook(() => useDownload());
      await act(async () => {
        await result.current.fetchMetadata("https://www.youtube.com/watch?v=test123test");
      });
      expect(result.current.error).toBeTruthy();

      // Act
      act(() => {
        result.current.clearError();
      });

      // Assert
      expect(result.current.error).toBeNull();
      expect(result.current.errorType).toBeNull();
    });
  });
});

