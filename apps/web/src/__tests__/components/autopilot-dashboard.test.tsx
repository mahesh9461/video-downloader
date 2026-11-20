import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createTestStore, setCurrentUrl } from "@/lib/store";

// Rule 10 & 11: Mocks defined before main component, names start with mock...
const mockGetAutopilotStatus = jest.fn();
const mockStartAutopilot = jest.fn();
const mockPauseAutopilot = jest.fn();
const mockTriggerAutopilot = jest.fn();
const mockCleanupAutopilotDisk = jest.fn();
const mockGetAutopilotAudio = jest.fn();

jest.mock("@/lib/api", () => ({
  apiClient: {
    getAutopilotStatus: (...args: any[]) => mockGetAutopilotStatus(...args),
    startAutopilot: (...args: any[]) => mockStartAutopilot(...args),
    pauseAutopilot: (...args: any[]) => mockPauseAutopilot(...args),
    triggerAutopilot: (...args: any[]) => mockTriggerAutopilot(...args),
    cleanupAutopilotDisk: (...args: any[]) => mockCleanupAutopilotDisk(...args),
    getAutopilotAudio: (...args: any[]) => mockGetAutopilotAudio(...args),
  },
}));

import { AutopilotDashboard } from "@/components/autopilot-dashboard";

function renderWithProvider(ui: React.ReactElement, store: ReturnType<typeof createTestStore>) {
  return render(<Provider store={store}>{ui}</Provider>);
}

describe("AutopilotDashboard", () => {
  let store: ReturnType<typeof createTestStore>;

  const defaultStatus = {
    is_running: false,
    state: "idle",
    current_batch: null,
    next_upload_time: null,
    seconds_until_next_upload: null,
    daily_uploads_count: 0,
    daily_upload_limit: 6,
    cooldown_until: null,
    disk_space_cleaned_mb: 245.5,
    last_cleaned_at: "2026-11-20T12:00:00Z",
    cpu_mode: "low_load_threads_2",
    recent_logs: ["[12:00:00] Autopilot initialized."],
  };

  beforeEach(() => {
    // Rule 10: Clear mocks in beforeEach
    jest.clearAllMocks();
    mockGetAutopilotStatus.mockResolvedValue(defaultStatus);
    mockGetAutopilotAudio.mockResolvedValue({
      custom_tracks: ["night_pulse.mp3", "synthwave_loop.mp3"],
      count: 2,
    });
    // Rule 3: Always use real Redux store configured with configureStore
    store = createTestStore();
  });

  describe("render tests", () => {
    test("should render the GTA 6 viral autopilot title and primary controls", async () => {
      // Arrange
      renderWithProvider(<AutopilotDashboard />, store);

      // Act & Assert
      expect(await screen.findByRole("heading", { name: /GTA 6 Autonomous Viral Shorts Pipeline/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Start Autopilot/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Queue Next Video Now/i })).toBeInTheDocument();
      expect(screen.getByText(/Max 6 uploads\/day protects your 10,000 Google API quota limit/i)).toBeInTheDocument();
    });

    test("should render the 6 scheduled clips when a batch is active", async () => {
      // Arrange
      const batchStatus = {
        ...defaultStatus,
        is_running: true,
        state: "queued",
        current_batch: {
          batch_id: "batch_gta_01",
          source_video_id: "vid_123",
          source_title: "GTA 6 Leaked Map Secrets",
          source_url: "https://youtube.com/watch?v=vid_123",
          created_at: "2026-11-20T12:00:00Z",
          clips: [
            {
              id: "clip_1",
              source_video_id: "vid_123",
              source_title: "GTA 6 Leaked Map Secrets",
              clip_index: 1,
              start_time: 10.0,
              end_time: 40.0,
              duration: 30.0,
              hook_title: "SECRET UNDERWATER LAB DISCOVERED",
              hook_style: "hormozi_bold",
              progress_bar_color: "yellow",
              layout: "center_crop",
              background_music: "night_pulse.mp3",
              filename: "gta6_short_batch_gta_01_1.mp4",
              scheduled_time: "2026-11-20T12:01:00Z",
              status: "published",
              youtube_video_id: "yt_001",
              youtube_url: "https://youtube.com/shorts/yt_001",
            },
            {
              id: "clip_2",
              source_video_id: "vid_123",
              source_title: "GTA 6 Leaked Map Secrets",
              clip_index: 2,
              start_time: 60.0,
              end_time: 95.0,
              duration: 35.0,
              hook_title: "NEW VICE CITY POLICE CAR CHASE",
              hook_style: "mrbeast_urgency",
              progress_bar_color: "red",
              layout: "blurred_background",
              background_music: "synthwave_loop.mp3",
              filename: "gta6_short_batch_gta_01_2.mp4",
              scheduled_time: "2026-11-20T13:00:00Z",
              status: "queued",
            },
          ],
        },
      };
      mockGetAutopilotStatus.mockResolvedValue(batchStatus);

      // Act
      renderWithProvider(<AutopilotDashboard />, store);

      // Assert
      expect(await screen.findByText(/SECRET UNDERWATER LAB DISCOVERED/i)).toBeInTheDocument();
      expect(screen.getByText(/NEW VICE CITY POLICE CAR CHASE/i)).toBeInTheDocument();
      expect(screen.getByText(/Short #1 of 6/i)).toBeInTheDocument();
      expect(screen.getByText(/Short #2 of 6/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /View on YouTube/i })).toHaveAttribute(
        "href",
        "https://youtube.com/shorts/yt_001"
      );
    });
  });

  describe("user interaction tests", () => {
    test("should start autopilot when Start button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      mockStartAutopilot.mockResolvedValue({
        ...defaultStatus,
        is_running: true,
        state: "idle",
      });

      renderWithProvider(<AutopilotDashboard />, store);
      const startBtn = await screen.findByRole("button", { name: /Start Autopilot/i });

      // Act
      await user.click(startBtn);

      // Assert
      expect(mockStartAutopilot).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole("button", { name: /Pause/i })).toBeInTheDocument();
    });

    test("should pause autopilot when Pause button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      mockGetAutopilotStatus.mockResolvedValue({
        ...defaultStatus,
        is_running: true,
        state: "queued",
      });
      mockPauseAutopilot.mockResolvedValue({
        ...defaultStatus,
        is_running: false,
        state: "paused",
      });

      renderWithProvider(<AutopilotDashboard />, store);
      const pauseBtn = await screen.findByRole("button", { name: /Pause/i });

      // Act
      await user.click(pauseBtn);

      // Assert
      expect(mockPauseAutopilot).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole("button", { name: /Start Autopilot/i })).toBeInTheDocument();
    });

    test("should trigger instant video discovery when Queue Next Video Now is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      mockTriggerAutopilot.mockResolvedValue({
        ...defaultStatus,
        is_running: true,
        state: "searching",
      });

      renderWithProvider(<AutopilotDashboard />, store);
      const queueBtn = await screen.findByRole("button", { name: /Queue Next Video Now/i });

      // Act
      await user.click(queueBtn);

      // Assert
      expect(mockTriggerAutopilot).toHaveBeenCalledTimes(1);
    });
  });

  describe("Redux state verification test", () => {
    test("should verify real Redux store state remains valid during autopilot interaction", async () => {
      // Arrange: Real store initial state
      expect(store.getState().video.currentUrl).toBe("");

      // Act: Dispatch action on real Redux store
      store.dispatch(setCurrentUrl("https://www.youtube.com/watch?v=gta6_trailer_official"));

      renderWithProvider(<AutopilotDashboard />, store);

      // Assert: Real Redux store reflects state update
      expect(store.getState().video.currentUrl).toBe("https://www.youtube.com/watch?v=gta6_trailer_official");
      expect(await screen.findByRole("heading", { name: /GTA 6 Autonomous Viral Shorts Pipeline/i })).toBeInTheDocument();
    });
  });
});
