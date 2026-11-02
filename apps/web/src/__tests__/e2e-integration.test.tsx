import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createTestStore, setCurrentUrl, setMetadata, setIsDownloading } from "@/lib/store";

// Rule 10 & 11: Mocks defined/imported before main component, starting with mock...
const mockImageComponent = jest.fn((props: Record<string, unknown>) => {
  const { fill, unoptimized, ...rest } = props;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...rest} />;
});

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => mockImageComponent(props),
}));

const mockFetchMetadataFn = jest.fn();
const mockDownloadWithProgressFn = jest.fn();

jest.mock("@/lib/api", () => ({
  apiClient: {
    fetchMetadata: (...args: unknown[]) => mockFetchMetadataFn(...args),
    downloadWithProgress: (...args: unknown[]) => mockDownloadWithProgressFn(...args),
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

import Home from "@/app/page";

const mockSampleMetadata = {
  id: "dQw4w9WgXcQ",
  platform: "youtube" as const,
  title: "Rick Astley - Never Gonna Give You Up",
  creator: "RickAstleyVEVO",
  creator_avatar: null,
  duration: 213,
  thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  formats: [
    {
      format_id: "yt-1080p",
      label: "1080p Full HD",
      resolution: "1080p",
      ext: "mp4",
      filesize: 52428800,
      is_audio_only: false,
    },
    {
      format_id: "yt-720p",
      label: "720p HD",
      resolution: "720p",
      ext: "mp4",
      filesize: 26214400,
      is_audio_only: false,
    },
    {
      format_id: "yt-audio-mp3",
      label: "MP3 Audio",
      resolution: null,
      ext: "mp3",
      filesize: 5242880,
      is_audio_only: true,
    },
  ],
};

function renderWithProvider(ui: React.ReactElement, testStore: ReturnType<typeof createTestStore>) {
  return render(<Provider store={testStore}>{ui}</Provider>);
}

describe("E2E Integration Flow", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    // Rule 10: Always clear mocks in beforeEach
    jest.clearAllMocks();
    // Rule 3: Real Redux store configured with configureStore
    store = createTestStore();
  });

  describe("render", () => {
    it("should render main landing page elements, search input, and feature highlights", () => {
      // Arrange & Act
      renderWithProvider(<Home />, store);

      // Assert
      expect(screen.getByText("SaveIt")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /history/i })).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Paste a YouTube or TikTok URL...")
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /paste/i })).toBeInTheDocument();
      expect(screen.getByText(/Engineered for speed & quality/i)).toBeInTheDocument();
      expect(screen.getByText(/How It Works in 3 Simple Steps/i)).toBeInTheDocument();
      expect(screen.getByText(/Frequently Asked Questions/i)).toBeInTheDocument();
    });
  });

  describe("user interaction", () => {
    it("should execute full download flow: paste link, view video preview, choose resolution, and trigger download", async () => {
      // Arrange
      const user = userEvent.setup();
      mockFetchMetadataFn.mockResolvedValueOnce(mockSampleMetadata);
      mockDownloadWithProgressFn.mockImplementation(
        (_url: string, _fmt: string, onProgress: (p: unknown) => void) => {
          onProgress({
            status: "downloading",
            percent: 50.0,
            speed: "4.5 MB/s",
            eta: "00:10",
            filename: null,
            filesize: 26214400,
            error_message: null,
          });
          return jest.fn();
        }
      );

      renderWithProvider(<Home />, store);
      const input = screen.getByPlaceholderText("Paste a YouTube or TikTok URL...");

      // Act 1: Type YouTube URL and submit
      await user.type(input, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      await user.type(input, "{Enter}");

      // Assert 1: Metadata preview displayed
      expect(mockFetchMetadataFn).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      );
      await waitFor(() => {
        expect(
          screen.getByText("Rick Astley - Never Gonna Give You Up")
        ).toBeInTheDocument();
      });
      expect(screen.getByText("RickAstleyVEVO")).toBeInTheDocument();

      // Act 2: Select 1080p format button and click Download Selected
      const formatButton = screen.getByText("1080p Full HD");
      await user.click(formatButton);

      const downloadButton = screen.getByRole("button", { name: /download selected/i });
      await user.click(downloadButton);

      // Assert 2: Download stream started and progress bar rendered
      expect(mockDownloadWithProgressFn).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "yt-1080p",
        expect.any(Function),
        expect.any(Function),
        expect.any(Function)
      );

      await waitFor(() => {
        expect(screen.getByText("Downloading...")).toBeInTheDocument();
      });
      expect(screen.getByText("50%")).toBeInTheDocument();
      expect(screen.getByText("4.5 MB/s")).toBeInTheDocument();
    });
  });

  describe("Redux state verification", () => {
    it("should verify Redux store tracking currentUrl, video metadata, and active downloading state", () => {
      // Arrange
      const targetUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

      // Act
      store.dispatch(setCurrentUrl(targetUrl));
      store.dispatch(setMetadata(mockSampleMetadata));
      store.dispatch(setIsDownloading(true));

      renderWithProvider(<Home />, store);

      // Assert
      const state = store.getState().video;
      expect(state.currentUrl).toBe(targetUrl);
      expect(state.metadata?.title).toBe("Rick Astley - Never Gonna Give You Up");
      expect(state.isDownloading).toBe(true);
    });
  });
});

