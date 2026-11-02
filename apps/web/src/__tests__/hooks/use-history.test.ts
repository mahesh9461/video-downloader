import "@testing-library/jest-dom";
import { renderHook, act } from "@testing-library/react";
import { useHistory } from "@/hooks/use-history";
import { HistoryItem, Platform } from "@/lib/types";

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get _store() {
      return store;
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: mockLocalStorage });

// Mock crypto.randomUUID
Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: jest.fn(() => "test-uuid-" + Math.random().toString(36).slice(2, 9)),
  },
});

describe("useHistory hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
  });

  describe("render", () => {
    it("should initialize with empty history when localStorage is empty", () => {
      // Arrange & Act
      const { result } = renderHook(() => useHistory());

      // Assert
      expect(result.current.history).toEqual([]);
    });

    it("should load existing history from localStorage", () => {
      // Arrange
      const existingHistory: HistoryItem[] = [
        {
          id: "existing-1",
          platform: "youtube" as Platform,
          title: "Test Video",
          thumbnail: "https://example.com/thumb.jpg",
          creator: "Creator",
          format: "720p",
          filesize: 1024,
          timestamp: "2026-10-29T12:00:00Z",
        },
      ];
      mockLocalStorage.setItem("vd-download-history", JSON.stringify(existingHistory));

      // Act
      const { result } = renderHook(() => useHistory());

      // Assert
      expect(result.current.history).toEqual(existingHistory);
    });

    it("should handle corrupted localStorage gracefully", () => {
      // Arrange
      mockLocalStorage.setItem("vd-download-history", "invalid json{{{");

      // Act
      const { result } = renderHook(() => useHistory());

      // Assert
      expect(result.current.history).toEqual([]);
    });
  });

  describe("user interaction - addToHistory", () => {
    it("should add an item to history", () => {
      // Arrange
      const { result } = renderHook(() => useHistory());
      const newItem = {
        platform: "youtube" as Platform,
        title: "New Video",
        thumbnail: "https://example.com/thumb.jpg",
        creator: "Creator",
        format: "1080p",
        filesize: 2048,
      };

      // Act
      act(() => {
        result.current.addToHistory(newItem);
      });

      // Assert
      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].title).toBe("New Video");
      expect(result.current.history[0].platform).toBe("youtube");
      expect(result.current.history[0].id).toBeTruthy();
      expect(result.current.history[0].timestamp).toBeTruthy();
    });

    it("should prepend new items (most recent first)", () => {
      // Arrange
      const { result } = renderHook(() => useHistory());

      // Act
      act(() => {
        result.current.addToHistory({
          platform: "youtube" as Platform,
          title: "First Video",
          thumbnail: "thumb1.jpg",
          creator: "Creator1",
          format: "720p",
          filesize: null,
        });
      });
      act(() => {
        result.current.addToHistory({
          platform: "tiktok" as Platform,
          title: "Second Video",
          thumbnail: "thumb2.jpg",
          creator: "Creator2",
          format: "No Watermark",
          filesize: null,
        });
      });

      // Assert
      expect(result.current.history).toHaveLength(2);
      expect(result.current.history[0].title).toBe("Second Video");
      expect(result.current.history[1].title).toBe("First Video");
    });

    it("should persist to localStorage when adding items", () => {
      // Arrange
      const { result } = renderHook(() => useHistory());

      // Act
      act(() => {
        result.current.addToHistory({
          platform: "youtube" as Platform,
          title: "Persisted Video",
          thumbnail: "thumb.jpg",
          creator: "Creator",
          format: "720p",
          filesize: 512,
        });
      });

      // Assert
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "vd-download-history",
        expect.stringContaining("Persisted Video")
      );
    });
  });

  describe("user interaction - removeFromHistory", () => {
    it("should remove an item by id", () => {
      // Arrange
      const existingHistory: HistoryItem[] = [
        {
          id: "remove-me",
          platform: "youtube" as Platform,
          title: "To Remove",
          thumbnail: "thumb.jpg",
          creator: "Creator",
          format: "720p",
          filesize: null,
          timestamp: "2026-10-29T12:00:00Z",
        },
        {
          id: "keep-me",
          platform: "tiktok" as Platform,
          title: "To Keep",
          thumbnail: "thumb2.jpg",
          creator: "Creator2",
          format: "HD",
          filesize: null,
          timestamp: "2026-10-29T11:00:00Z",
        },
      ];
      mockLocalStorage.setItem("vd-download-history", JSON.stringify(existingHistory));
      const { result } = renderHook(() => useHistory());

      // Act
      act(() => {
        result.current.removeFromHistory("remove-me");
      });

      // Assert
      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].id).toBe("keep-me");
    });
  });

  describe("state verification - clearHistory", () => {
    it("should clear all history and remove from localStorage", () => {
      // Arrange
      const { result } = renderHook(() => useHistory());
      act(() => {
        result.current.addToHistory({
          platform: "youtube" as Platform,
          title: "Video",
          thumbnail: "t.jpg",
          creator: "C",
          format: "720p",
          filesize: null,
        });
      });

      // Act
      act(() => {
        result.current.clearHistory();
      });

      // Assert
      expect(result.current.history).toEqual([]);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("vd-download-history");
    });
  });
});

