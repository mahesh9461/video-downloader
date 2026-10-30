import "@testing-library/jest-dom";
import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createTestStore, setIsDownloading } from "@/lib/store";

// Rule 10 & 11: Mocks defined/imported before main component, starting with mock...
const mockOnDownload = jest.fn();

import { DownloadOptions } from "@/components/download-options";
import { VideoMetadata } from "@/lib/types";

const mockYouTubeMetadata: VideoMetadata = {
  id: "yt-test",
  platform: "youtube",
  title: "YouTube Test",
  creator: "Creator",
  creator_avatar: null,
  duration: 120,
  thumbnail: "thumb.jpg",
  formats: [
    { format_id: "360p", label: "360p", resolution: "360p", ext: "mp4", filesize: 20000000, is_audio_only: false },
    { format_id: "720p", label: "720p", resolution: "720p", ext: "mp4", filesize: 50000000, is_audio_only: false },
    { format_id: "1080p", label: "1080p", resolution: "1080p", ext: "mp4", filesize: 100000000, is_audio_only: false },
    { format_id: "mp3", label: "MP3", resolution: null, ext: "mp3", filesize: 5000000, is_audio_only: true },
    { format_id: "m4a", label: "M4A", resolution: null, ext: "m4a", filesize: 6000000, is_audio_only: true },
  ],
};

const mockTikTokMetadata: VideoMetadata = {
  id: "tt-test",
  platform: "tiktok",
  title: "TikTok Test",
  creator: "TikTokUser",
  creator_avatar: null,
  duration: 15,
  thumbnail: "thumb.jpg",
  formats: [
    { format_id: "nowm", label: "No Watermark", resolution: "720p", ext: "mp4", filesize: 8000000, is_audio_only: false },
    { format_id: "hd", label: "HD Video", resolution: "1080p", ext: "mp4", filesize: 15000000, is_audio_only: false },
    { format_id: "audio", label: "MP3 Audio", resolution: null, ext: "mp3", filesize: 2000000, is_audio_only: true },
  ],
};

function renderWithProvider(ui: React.ReactElement, testStore: ReturnType<typeof createTestStore>) {
  const { render } = require("@testing-library/react");
  return render(<Provider store={testStore}>{ui}</Provider>);
}

describe("DownloadOptions", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    // Rule 10: Clear mocks in beforeEach
    jest.clearAllMocks();
    // Rule 3: Real Redux store configured with configureStore
    store = createTestStore();
  });

  describe("render - YouTube and TikTok", () => {
    it("should render Download Options title and format buttons for YouTube", () => {
      // Arrange & Act
      renderWithProvider(
        <DownloadOptions
          metadata={mockYouTubeMetadata}
          onDownload={mockOnDownload}
          isDownloading={false}
          activeFormatId={null}
        />,
        store
      );

      // Assert
      expect(screen.getByText("Download Options")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /download selected/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /download selected/i })).toBeDisabled();
    });

    it("should render TikTok download options when platform is TikTok", () => {
      // Arrange & Act
      renderWithProvider(
        <DownloadOptions
          metadata={mockTikTokMetadata}
          onDownload={mockOnDownload}
          isDownloading={false}
          activeFormatId={null}
        />,
        store
      );

      // Assert
      expect(screen.getByText("TikTok Download")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /no watermark/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /hd video/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /extract audio/i })).toBeInTheDocument();
    });
  });

  describe("user interaction", () => {
    it("should select format and trigger download on button click", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(
        <DownloadOptions
          metadata={mockYouTubeMetadata}
          onDownload={mockOnDownload}
          isDownloading={false}
          activeFormatId={null}
        />,
        store
      );

      // Act
      await user.click(screen.getByText("720p"));
      await user.click(screen.getByRole("button", { name: /download selected/i }));

      // Assert
      expect(mockOnDownload).toHaveBeenCalledWith("720p", "720p");
    });

    it("should trigger download directly on TikTok option click", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(
        <DownloadOptions
          metadata={mockTikTokMetadata}
          onDownload={mockOnDownload}
          isDownloading={false}
          activeFormatId={null}
        />,
        store
      );

      // Act
      await user.click(screen.getByRole("button", { name: /no watermark/i }));

      // Assert
      expect(mockOnDownload).toHaveBeenCalledWith("nowm", "No Watermark");
    });
  });

  describe("Redux state verification", () => {
    it("should verify active downloading state in Redux store", () => {
      // Arrange
      store.dispatch(setIsDownloading(true));

      // Act
      const isDownloadingFromStore = store.getState().video.isDownloading;
      renderWithProvider(
        <DownloadOptions
          metadata={mockYouTubeMetadata}
          onDownload={mockOnDownload}
          isDownloading={isDownloadingFromStore}
          activeFormatId="720p"
        />,
        store
      );

      // Assert
      expect(store.getState().video.isDownloading).toBe(true);
      expect(screen.getByRole("button", { name: /processing/i })).toBeInTheDocument();
    });
  });
});
