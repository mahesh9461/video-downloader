import "@testing-library/jest-dom";
import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createTestStore, setMetadata } from "@/lib/store";

// Rule 11: Ensure all mocks are imported before the main component being tested
// Rule 10: Mock function name starts with mock...
const mockImageComponent = jest.fn((props: Record<string, unknown>) => {
  const { fill, unoptimized, ...rest } = props;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...rest} />;
});

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => mockImageComponent(props),
}));

// Main component imported after mocks
import { VideoPreview } from "@/components/video-preview";
import { VideoMetadata } from "@/lib/types";

const mockVideoMetadata: VideoMetadata = {
  id: "test-video-id",
  platform: "youtube",
  title: "An Amazing Test Video Title",
  creator: "TestCreator",
  creator_avatar: "https://example.com/avatar.jpg",
  duration: 185,
  thumbnail: "https://example.com/thumbnail.jpg",
  formats: [
    { format_id: "720p", label: "720p", resolution: "720p", ext: "mp4", filesize: 50000000, is_audio_only: false },
    { format_id: "360p", label: "360p", resolution: "360p", ext: "mp4", filesize: 20000000, is_audio_only: false },
    { format_id: "mp3", label: "MP3", resolution: null, ext: "mp3", filesize: 5000000, is_audio_only: true },
  ],
};

const mockTikTokVideoMetadata: VideoMetadata = {
  id: "tiktok-id",
  platform: "tiktok",
  title: "TikTok Dance Video",
  creator: "TikTokUser",
  creator_avatar: null,
  duration: 30,
  thumbnail: "https://example.com/tiktok-thumb.jpg",
  formats: [
    { format_id: "nowm", label: "No Watermark", resolution: "720p", ext: "mp4", filesize: 10000000, is_audio_only: false },
  ],
};

function renderWithProvider(ui: React.ReactElement, testStore: ReturnType<typeof createTestStore>) {
  const { render } = require("@testing-library/react");
  return render(<Provider store={testStore}>{ui}</Provider>);
}

describe("VideoPreview", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    // Rule 10: Clear mocks in beforeEach
    jest.clearAllMocks();
    // Rule 3: Always use the real Redux store configured with configureStore
    store = createTestStore();
  });

  describe("render", () => {
    it("should render nothing when metadata is null and not loading", () => {
      // Arrange & Act
      const { container } = renderWithProvider(
        <VideoPreview metadata={null} isLoading={false} />,
        store
      );

      // Assert
      expect(container.firstChild).toBeNull();
    });

    it("should render loading skeleton when isLoading is true", () => {
      // Arrange & Act
      renderWithProvider(
        <VideoPreview metadata={null} isLoading={true} />,
        store
      );

      // Assert
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("should render video title and creator details", () => {
      // Arrange & Act
      renderWithProvider(
        <VideoPreview metadata={mockVideoMetadata} isLoading={false} />,
        store
      );

      // Assert
      expect(screen.getByText("An Amazing Test Video Title")).toBeInTheDocument();
      expect(screen.getByText("TestCreator")).toBeInTheDocument();
    });

    it("should render thumbnail image with correct alt text", () => {
      // Arrange & Act
      renderWithProvider(
        <VideoPreview metadata={mockVideoMetadata} isLoading={false} />,
        store
      );

      // Assert
      const img = screen.getByAltText("An Amazing Test Video Title");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/thumbnail.jpg");
    });
  });

  describe("user interaction", () => {
    it("should update display when transition occurs from loading to metadata loaded", async () => {
      // Arrange
      const { rerender } = renderWithProvider(
        <VideoPreview metadata={null} isLoading={true} />,
        store
      );
      expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);

      // Act
      rerender(
        <Provider store={store}>
          <VideoPreview metadata={mockVideoMetadata} isLoading={false} />
        </Provider>
      );

      // Assert
      expect(screen.getByText("An Amazing Test Video Title")).toBeInTheDocument();
    });
  });

  describe("Redux state verification", () => {
    it("should synchronize and verify with the real Redux store state", () => {
      // Arrange
      store.dispatch(setMetadata(mockVideoMetadata));

      // Act
      const stateMetadata = store.getState().video.metadata;
      renderWithProvider(
        <VideoPreview metadata={stateMetadata} isLoading={false} />,
        store
      );

      // Assert
      expect(store.getState().video.metadata?.id).toBe("test-video-id");
      expect(screen.getByText("An Amazing Test Video Title")).toBeInTheDocument();
      expect(screen.getByText("YouTube")).toBeInTheDocument();
    });
  });
});
