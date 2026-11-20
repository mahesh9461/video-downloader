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
const mockResetAutopilot = jest.fn();
const mockRetryAutopilotClip = jest.fn();
const mockGetYouTubeStatus = jest.fn();
const mockConfigureYouTubeOAuth = jest.fn();
const mockDisconnectYouTube = jest.fn();
const mockSetYouTubeToken = jest.fn();

jest.mock("@/lib/api", () => ({
  apiClient: {
    getAutopilotStatus: (...args: any[]) => mockGetAutopilotStatus(...args),
    startAutopilot: (...args: any[]) => mockStartAutopilot(...args),
    pauseAutopilot: (...args: any[]) => mockPauseAutopilot(...args),
    triggerAutopilot: (...args: any[]) => mockTriggerAutopilot(...args),
    cleanupAutopilotDisk: (...args: any[]) => mockCleanupAutopilotDisk(...args),
    getAutopilotAudio: (...args: any[]) => mockGetAutopilotAudio(...args),
    resetAutopilot: (...args: any[]) => mockResetAutopilot(...args),
    retryAutopilotClip: (...args: any[]) => mockRetryAutopilotClip(...args),
    getYouTubeStatus: (...args: any[]) => mockGetYouTubeStatus(...args),
    configureYouTubeOAuth: (...args: any[]) => mockConfigureYouTubeOAuth(...args),
    disconnectYouTube: (...args: any[]) => mockDisconnectYouTube(...args),
    setYouTubeToken: (...args: any[]) => mockSetYouTubeToken(...args),
    resolveUrl: (path: string) => `http://localhost:8000${path}`,
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
    all_published_videos: [],
    recent_errors: [],
  };

  beforeEach(() => {
    // Rule 10: Clear mocks in beforeEach
    jest.clearAllMocks();
    mockGetAutopilotStatus.mockResolvedValue(defaultStatus);
    mockGetAutopilotAudio.mockResolvedValue({
      custom_tracks: ["night_pulse.mp3", "synthwave_loop.mp3"],
      count: 2,
    });
    mockResetAutopilot.mockResolvedValue(defaultStatus);
    mockRetryAutopilotClip.mockResolvedValue(defaultStatus);
    mockGetYouTubeStatus.mockResolvedValue({
      configured: true,
      connected: false,
      auth_url: "https://accounts.google.com/o/oauth2/auth",
    });
    mockSetYouTubeToken.mockResolvedValue({
      status: "connected",
      youtube_status: { configured: true, connected: true, channel_title: "My Channel" },
    });
    mockConfigureYouTubeOAuth.mockResolvedValue({
      status: "configured",
      youtube_status: { configured: true, connected: false, auth_url: "https://accounts.google.com/o/oauth2/auth" },
    });
    mockDisconnectYouTube.mockResolvedValue({ status: "disconnected" });
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
              preview_url: "/api/file/gta6_short_batch_gta_01_1.mp4",
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
              preview_url: "/api/file/gta6_short_batch_gta_01_2.mp4",
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
      const matchingTitles = await screen.findAllByText(/SECRET UNDERWATER LAB DISCOVERED/i);
      expect(matchingTitles.length).toBeGreaterThan(0);
      expect(screen.getByText(/NEW VICE CITY POLICE CAR CHASE/i)).toBeInTheDocument();
      expect(screen.getByText(/Short #1 of 6/i)).toBeInTheDocument();
      expect(screen.getByText(/Short #2 of 6/i)).toBeInTheDocument();

      const ytLinks = screen.getAllByRole("link", { name: /View on YouTube|Watch on YouTube/i });
      expect(ytLinks.length).toBeGreaterThan(0);
      expect(ytLinks[0]).toHaveAttribute("href", "https://youtube.com/shorts/yt_001");
    });

    test("should render pipeline stages, video preview player, and error issues when present", async () => {
      // Arrange
      const statusWithErrors = {
        ...defaultStatus,
        is_running: true,
        state: "error",
        current_batch: {
          batch_id: "batch_err_01",
          source_video_id: "vid_999",
          source_title: "Vice City Vice Secrets",
          source_url: "https://youtube.com/watch?v=vid_999",
          created_at: "2026-11-20T12:00:00Z",
          clips: [
            {
              id: "clip_err_1",
              source_video_id: "vid_999",
              source_title: "Vice City Vice Secrets",
              clip_index: 1,
              start_time: 10.0,
              end_time: 40.0,
              duration: 30.0,
              hook_title: "CRAZIEST POLICE ENCOUNTER",
              hook_style: "hormozi_bold",
              progress_bar_color: "yellow",
              layout: "center_crop",
              background_music: "night_pulse.mp3",
              filename: "gta6_short_err.mp4",
              preview_url: "/api/file/gta6_short_err.mp4",
              status: "failed",
              error: "YouTube account is not connected",
            },
          ],
        },
      };
      mockGetAutopilotStatus.mockResolvedValue(statusWithErrors);

      // Act
      renderWithProvider(<AutopilotDashboard />, store);

      // Assert
      expect(await screen.findByText(/Pipeline Issues & Diagnostics/i)).toBeInTheDocument();
      expect(screen.getAllByText(/YouTube account is not connected/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Hook Created/i)).toBeInTheDocument();
      expect(screen.getByText(/Text & Song/i)).toBeInTheDocument();
      expect(screen.getByText(/Video Preview/i)).toBeInTheDocument();
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

    test("should allow typing custom video URL and submitting to pipeline", async () => {
      // Arrange
      const user = userEvent.setup();
      mockTriggerAutopilot.mockResolvedValue({
        ...defaultStatus,
        is_running: true,
        state: "rendering",
      });

      renderWithProvider(<AutopilotDashboard />, store);
      const input = await screen.findByPlaceholderText(/Paste YouTube video or podcast URL/i);
      const queueBtn = screen.getByRole("button", { name: /Queue Next Video Now/i });

      // Act
      await user.type(input, "https://www.youtube.com/watch?v=custom_video_123");
      await user.click(queueBtn);

      // Assert
      expect(mockTriggerAutopilot).toHaveBeenCalledWith("https://www.youtube.com/watch?v=custom_video_123");
    });

    test("should reset quota and cooldown when Reset button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      mockResetAutopilot.mockResolvedValue({
        ...defaultStatus,
        daily_uploads_count: 0,
        cooldown_until: null,
      });

      renderWithProvider(<AutopilotDashboard />, store);
      const resetBtn = await screen.findByRole("button", { name: /Reset Cooldown/i });

      // Act
      await user.click(resetBtn);

      // Assert
      expect(mockResetAutopilot).toHaveBeenCalledTimes(1);
    });

    test("should allow applying manual token to connect YouTube channel", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(<AutopilotDashboard />, store);

      const setupBtn = await screen.findByRole("button", { name: /Setup Credentials \/ Token/i });

      // Act
      await user.click(setupBtn);

      const tokenInput = screen.getByPlaceholderText(/Paste Access Token/i);
      const applyBtn = screen.getByRole("button", { name: /Apply Token & Connect Channel/i });

      await user.type(tokenInput, "ya29.test_token_string_123");
      await user.click(applyBtn);

      // Assert
      expect(mockSetYouTubeToken).toHaveBeenCalledWith("ya29.test_token_string_123");
    });

    test("should allow inline YouTube connect and retry directly from failed clip card", async () => {
      // Arrange
      const user = userEvent.setup();
      const failedBatchStatus = {
        ...defaultStatus,
        is_running: true,
        state: "error",
        current_batch: {
          batch_id: "batch_gta_failed",
          source_video_id: "vid_failed",
          source_title: "GTA 6 Gameplay Walkthrough",
          source_url: "https://youtube.com/watch?v=vid_failed",
          created_at: "2026-11-20T12:00:00Z",
          clips: [
            {
              id: "clip_token_error_1",
              clip_index: 1,
              start_time: 10,
              end_time: 40,
              hook_title: "WAIT FOR WHAT HAPPENS NEXT...",
              hook_style: "hormozi_bold",
              progress_bar_color: "yellow",
              layout: "center_crop",
              status: "failed",
              error: "No YouTube access token available. Please connect your YouTube channel or provide an access token.",
            },
          ],
        },
      };
      mockGetAutopilotStatus.mockResolvedValue(failedBatchStatus);
      renderWithProvider(<AutopilotDashboard />, store);

      // Act
      const cardTokenInput = await screen.findByPlaceholderText(/Paste Access Token \(ya29\.\.\.\)/i);
      const connectRetryBtn = screen.getByRole("button", { name: /Connect & Retry/i });

      await user.type(cardTokenInput, "ya29.inline_token_clip_1");
      await user.click(connectRetryBtn);

      // Assert
      expect(mockSetYouTubeToken).toHaveBeenCalledWith("ya29.inline_token_clip_1");
      expect(mockRetryAutopilotClip).toHaveBeenCalledWith("clip_token_error_1");
    });

    test("should open modal when Connect YouTube Channel is clicked on failed clip card", async () => {
      // Arrange
      const user = userEvent.setup();
      const failedBatchStatus = {
        ...defaultStatus,
        is_running: true,
        state: "error",
        current_batch: {
          batch_id: "batch_gta_failed",
          source_video_id: "vid_failed",
          source_title: "GTA 6 Gameplay Walkthrough",
          source_url: "https://youtube.com/watch?v=vid_failed",
          created_at: "2026-11-20T12:00:00Z",
          clips: [
            {
              id: "clip_token_error_2",
              clip_index: 1,
              start_time: 10,
              end_time: 40,
              hook_title: "WAIT FOR WHAT HAPPENS NEXT...",
              hook_style: "hormozi_bold",
              progress_bar_color: "yellow",
              layout: "center_crop",
              status: "failed",
              error: "No YouTube access token available. Please connect your YouTube channel or provide an access token.",
            },
          ],
        },
      };
      mockGetAutopilotStatus.mockResolvedValue(failedBatchStatus);
      renderWithProvider(<AutopilotDashboard />, store);

      // Act: Click Connect YouTube Channel on the card
      const connectButtons = await screen.findAllByRole("button", { name: /Connect YouTube Channel/i });
      await user.click(connectButtons[0]);

      // Assert: Modal dialog opens
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/Authorizing to upload Short #1/i)).toBeInTheDocument();
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
