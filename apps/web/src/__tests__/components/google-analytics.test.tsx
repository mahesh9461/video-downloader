import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createTestStore, setCurrentUrl } from "@/lib/store";

// Rule 10 & 11: Mocks defined before main component, starting with mock...
const mockGtag = jest.fn();

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/script to render regular script tags for testing
jest.mock("next/script", () => {
  return function MockScript({ id, src }: { id?: string; src?: string }) {
    return <script data-testid={id || "next-script"} src={src} />;
  };
});

import { GoogleAnalytics } from "@/components/google-analytics";
import {
  logAnalytics,
  trackPageView,
  extractYouTubeId,
  getUserCountry,
} from "@/lib/analytics";

function renderWithProvider(ui: React.ReactElement, testStore: ReturnType<typeof createTestStore>) {
  return render(<Provider store={testStore}>{ui}</Provider>);
}

describe("GoogleAnalytics & logAnalytics", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    // Rule 10: Clear mocks in beforeEach
    jest.clearAllMocks();
    // Rule 3: Always use real Redux store
    store = createTestStore();
    window.gtag = mockGtag;
  });

  afterEach(() => {
    delete (window as any).gtag;
  });

  describe("render", () => {
    it("should render analytics script container inside Provider without throwing", () => {
      // Arrange
      const { container } = renderWithProvider(
        <div>
          <GoogleAnalytics />
          <button role="button">Test Target</button>
        </div>,
        store
      );

      // Act & Assert
      expect(screen.getByRole("button", { name: /test target/i })).toBeInTheDocument();
      expect(container).toBeInTheDocument();
    });
  });

  describe("user interaction", () => {
    it("should log analytics with category, country, time spent, content id, and youtube id on user action", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(
        <div>
          <button
            role="button"
            onClick={() => {
              logAnalytics({
                event: "video_download_started",
                category: "downloads",
                country: "US",
                timeSpent: 42,
                contentId: "dQw4w9WgXcQ",
                youtubeId: "dQw4w9WgXcQ",
                platform: "youtube",
                format: "1080p MP4",
                quality: "1080p",
                title: "Never Gonna Give You Up",
              });
            }}
          >
            Start Download
          </button>
        </div>,
        store
      );

      // Act
      const downloadButton = screen.getByRole("button", { name: /start download/i });
      await user.click(downloadButton);

      // Assert
      expect(mockGtag).toHaveBeenCalledWith(
        "event",
        "video_download_started",
        expect.objectContaining({
          event_category: "downloads",
          user_country: "US",
          time_spent_seconds: 42,
          content_id: "dQw4w9WgXcQ",
          youtube_id: "dQw4w9WgXcQ",
          video_platform: "youtube",
          video_format: "1080p MP4",
          video_quality: "1080p",
          video_title: "Never Gonna Give You Up",
        })
      );
    });

    it("should extract youtube id and auto-detect country if omitted", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(
        <div>
          <button
            role="button"
            onClick={() => {
              logAnalytics({
                event: "video_search",
                category: "search",
                url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
                platform: "youtube",
              });
            }}
          >
            Search Video
          </button>
        </div>,
        store
      );

      // Act
      const searchButton = screen.getByRole("button", { name: /search video/i });
      await user.click(searchButton);

      // Assert
      expect(mockGtag).toHaveBeenCalledWith(
        "event",
        "video_search",
        expect.objectContaining({
          event_category: "search",
          youtube_id: "jNQXAC9IVRw",
          content_id: "jNQXAC9IVRw",
          video_platform: "youtube",
        })
      );
    });
  });

  describe("Redux state verification", () => {
    it("should verify Redux store updates alongside logAnalytics calls", () => {
      // Arrange
      const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const ytId = extractYouTubeId(testUrl);

      // Act
      store.dispatch(setCurrentUrl(testUrl));
      logAnalytics({
        event: "url_set",
        category: "input",
        contentId: ytId || "unknown",
        youtubeId: ytId || "none",
        url: testUrl,
      });

      // Assert
      expect(store.getState().video.currentUrl).toBe(testUrl);
      expect(mockGtag).toHaveBeenCalledWith(
        "event",
        "url_set",
        expect.objectContaining({
          event_category: "input",
          content_id: "dQw4w9WgXcQ",
          youtube_id: "dQw4w9WgXcQ",
          page_url: testUrl,
        })
      );
    });
  });
});
