import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createTestStore, setCurrentUrl } from "@/lib/store";

// Rule 10 & 11: Mocks defined before main component, names start with mock...
const mockAnalyzeClips = jest.fn();
const mockRenderClip = jest.fn();
const mockGenerateClipAiHook = jest.fn();

jest.mock("@/lib/api", () => ({
  apiClient: {
    analyzeClips: (...args: any[]) => mockAnalyzeClips(...args),
    renderClip: (...args: any[]) => mockRenderClip(...args),
    generateClipAiHook: (...args: any[]) => mockGenerateClipAiHook(...args),
  },
}));

import { ViralClips } from "@/components/viral-clips";

function renderWithProvider(ui: React.ReactElement, store: ReturnType<typeof createTestStore>) {
  return render(<Provider store={store}>{ui}</Provider>);
}

describe("ViralClips", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    // Rule 10: Clear mocks in beforeEach
    jest.clearAllMocks();
    // Rule 3: Always use real Redux store configured with configureStore
    store = createTestStore();
  });

  describe("render", () => {
    it("should render search input and analyze button", () => {
      // Arrange & Act
      renderWithProvider(<ViralClips />, store);

      // Assert
      expect(screen.getByPlaceholderText(/paste long youtube video/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /find viral moments/i })).toBeInTheDocument();
    });
  });

  describe("user interaction", () => {
    it("should analyze URL, customize viral Short with kinetic progress bar, and trigger render", async () => {
      // Arrange
      const user = userEvent.setup();
      mockAnalyzeClips.mockResolvedValueOnce({
        video_id: "test12345",
        title: "Test Podcast Episode 42",
        total_duration: 300,
        clips: [
          {
            clip_id: "clip_10_50",
            start_time: 10,
            end_time: 50,
            duration: 40,
            viral_score: 95,
            hook_title: "THE BIGGEST MISTAKE YOU MAKE",
            summary: "Speaker explains why startups fail.",
            reason: "High curiosity question and speech cadence",
            thumbnail_url: "https://i.ytimg.com/vi/test12345/hqdefault.jpg",
            retention_rate: "96% Retention",
            hook_rating: "Top 1% Virality",
          },
        ],
      });

      mockRenderClip.mockResolvedValueOnce({
        filename: "test_viral_short.mp4",
        filesize: 5800000,
        duration: 40,
        download_url: "/api/file/test_viral_short.mp4",
        layout: "blurred_background",
        hook_title: "THE BIGGEST MISTAKE YOU MAKE",
      });

      renderWithProvider(<ViralClips />, store);

      // Act 1: Analyze URL
      const input = screen.getByPlaceholderText(/paste long youtube video/i);
      await user.type(input, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      await user.click(screen.getByRole("button", { name: /find viral moments/i }));

      // Assert 1: Video card rendered with virality indicators
      expect(await screen.findByText("THE BIGGEST MISTAKE YOU MAKE")).toBeInTheDocument();
      expect(screen.getByText(/95\/100 virality/i)).toBeInTheDocument();
      expect(screen.getByText("96% Retention")).toBeInTheDocument();
      expect(screen.getByText("Top 1% Virality")).toBeInTheDocument();

      // Act 2: Render 9:16 Short
      const renderBtn = screen.getByRole("button", { name: /generate 9:16 viral short/i });
      await user.click(renderBtn);

      // Assert 2: renderClip called with kinetic progress bar enabled
      expect(mockRenderClip).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          start_time: 10,
          end_time: 50,
          layout: "blurred_background",
          progress_bar: true,
          progress_bar_color: "yellow",
        })
      );
      expect(await screen.findByText("Viral Short Ready!")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /download 9:16 short/i })).toBeInTheDocument();
    });
  });

  describe("Redux state verification", () => {
    it("should verify Redux store updates alongside viral clips actions", () => {
      // Arrange
      renderWithProvider(<ViralClips />, store);

      // Act
      store.dispatch(setCurrentUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));

      // Assert
      expect(store.getState().video.currentUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    });
  });
});
