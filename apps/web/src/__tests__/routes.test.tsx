import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createTestStore, setCurrentUrl, setAuthUser } from "@/lib/store";

// Rule 10 & 11: Mocks defined/imported before main component, starting with mock...
const mockGetMe = jest.fn().mockResolvedValue(null);
const mockGetRemoteHistory = jest.fn().mockResolvedValue([]);
const mockGetYouTubeStatus = jest.fn().mockResolvedValue({
  configured: false,
  connected: false,
  channels: [],
});
const mockGetAutopilotStatus = jest.fn().mockResolvedValue({
  running: false,
  paused: false,
  active_step: "idle",
  current_stage: "idle",
  pipeline_status: "idle",
  progress: 0,
  clips_generated: 0,
  clips_uploaded: 0,
  clips_published: 0,
  recent_clips: [],
  history: [],
  logs: [],
});
const mockGetAutopilotAudio = jest.fn().mockResolvedValue({ tracks: [] });
const mockGetYouTubeChannels = jest.fn().mockResolvedValue({ channels: [] });
const mockFetchMetadata = jest.fn();

jest.mock("@/lib/api", () => ({
  apiClient: {
    getMe: (...args: unknown[]) => mockGetMe(...args),
    getRemoteHistory: (...args: unknown[]) => mockGetRemoteHistory(...args),
    getYouTubeStatus: (...args: unknown[]) => mockGetYouTubeStatus(...args),
    getAutopilotStatus: (...args: unknown[]) => mockGetAutopilotStatus(...args),
    getAutopilotAudio: (...args: unknown[]) => mockGetAutopilotAudio(...args),
    getYouTubeChannels: (...args: unknown[]) => mockGetYouTubeChannels(...args),
    fetchMetadata: (...args: unknown[]) => mockFetchMetadata(...args),
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

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/"),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

import WatermarkPage from "@/app/watermark/page";
import ViralShortsPage from "@/app/viral-shorts/page";
import AutopilotPage from "@/app/autopilot/page";
import ShortsPage from "@/app/shorts/page";
import DownloadAliasPage from "@/app/download/page";

function renderWithProvider(ui: React.ReactElement, testStore: ReturnType<typeof createTestStore>) {
  return render(<Provider store={testStore}>{ui}</Provider>);
}

describe("Dedicated Route Pages", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    // Rule 10: Clear mocks in beforeEach
    jest.clearAllMocks();
    // Rule 3: Real Redux store
    store = createTestStore();
  });

  describe("Watermark Route (/watermark)", () => {
    it("should render watermark heading, instructions, and feature navigation", () => {
      // Arrange & Act
      renderWithProvider(<WatermarkPage />, store);

      // Assert
      expect(
        screen.getByRole("heading", { name: /remove watermarks from any video\./i })
      ).toBeInTheDocument();
      expect(screen.getByText(/ai-powered watermark removal/i)).toBeInTheDocument();
      const watermarkTab = screen.getByRole("tab", { name: /watermark/i });
      expect(watermarkTab).toHaveAttribute("aria-selected", "true");
    });

    it("should allow interacting with watermark route elements", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(<WatermarkPage />, store);

      // Act
      const downloadTab = screen.getByRole("tab", { name: /download/i });
      await user.click(downloadTab);

      // Assert
      expect(downloadTab).toHaveAttribute("href", "/");
    });

    it("should verify Redux store state during watermark page lifecycle", () => {
      // Arrange
      const targetUrl = "https://www.tiktok.com/@test/video/12345";

      // Act
      store.dispatch(setCurrentUrl(targetUrl));
      renderWithProvider(<WatermarkPage />, store);

      // Assert
      expect(store.getState().video.currentUrl).toBe(targetUrl);
    });
  });

  describe("Viral Shorts Route (/viral-shorts and /shorts)", () => {
    it("should render viral shorts heading, instructions, and feature navigation", () => {
      // Arrange & Act
      renderWithProvider(<ViralShortsPage />, store);

      // Assert
      expect(
        screen.getByRole("heading", { name: /turn long videos into viral 9:16 shorts\./i })
      ).toBeInTheDocument();
      expect(screen.getByText(/viral shorts & reel generator/i)).toBeInTheDocument();
      const clipsTab = screen.getByRole("tab", { name: /viral shorts/i });
      expect(clipsTab).toHaveAttribute("aria-selected", "true");
    });

    it("should render correctly through the /shorts alias route", () => {
      // Arrange & Act
      renderWithProvider(<ShortsPage />, store);

      // Assert
      expect(
        screen.getByRole("heading", { name: /turn long videos into viral 9:16 shorts\./i })
      ).toBeInTheDocument();
    });

    it("should verify Redux store state during viral shorts lifecycle", () => {
      // Arrange
      const user = {
        id: "usr-shorts-1",
        email: "editor@example.com",
        name: "Video Editor",
        role: "user" as const,
        tier: "free" as const,
        quota_remaining: 5,
        quota_limit: 10,
        created_at: "2026-11-21T00:00:00Z",
      };

      // Act
      store.dispatch(setAuthUser({ user, token: "jwt-editor" }));
      renderWithProvider(<ViralShortsPage />, store);

      // Assert
      expect(store.getState().auth.isAuthenticated).toBe(true);
      expect(store.getState().auth.user?.name).toBe("Video Editor");
    });
  });

  describe("Autopilot Route (/autopilot)", () => {
    it("should render autopilot dashboard and active feature navigation tab", () => {
      // Arrange & Act
      renderWithProvider(<AutopilotPage />, store);

      // Assert
      const autopilotTab = screen.getByRole("tab", { name: /gta 6 autopilot/i });
      expect(autopilotTab).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("heading", { name: "SaveIt" })).toBeInTheDocument();
    });

    it("should allow interacting with navigation on autopilot route", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(<AutopilotPage />, store);

      // Act
      const clipsTab = screen.getByRole("tab", { name: /viral shorts/i });
      await user.click(clipsTab);

      // Assert
      expect(clipsTab).toHaveAttribute("href", "/viral-shorts");
    });

    it("should verify Redux store remains consistent on autopilot route", () => {
      // Arrange & Act
      renderWithProvider(<AutopilotPage />, store);

      // Assert
      const authState = store.getState().auth;
      expect(authState.isAuthenticated).toBe(false);
    });
  });

  describe("Download Route Alias (/download)", () => {
    it("should render landing page via DownloadAliasPage", () => {
      // Arrange & Act
      renderWithProvider(<DownloadAliasPage />, store);

      // Assert
      expect(screen.getByPlaceholderText("Paste a YouTube or TikTok URL...")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /download/i })).toHaveAttribute("aria-selected", "true");
    });
  });
});
