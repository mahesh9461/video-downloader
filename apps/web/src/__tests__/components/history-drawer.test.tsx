import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryDrawer } from "@/components/history-drawer";
import { HistoryItem } from "@/lib/types";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, unoptimized, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

const mockOnOpenChange = jest.fn();
const mockOnClear = jest.fn();
const mockOnRemove = jest.fn();

const mockHistory: HistoryItem[] = [
  {
    id: "hist-1",
    platform: "youtube",
    title: "First Video Download",
    thumbnail: "https://example.com/thumb1.jpg",
    creator: "Creator1",
    format: "720p",
    filesize: 52428800,
    timestamp: "2026-10-29T12:00:00Z",
  },
  {
    id: "hist-2",
    platform: "tiktok",
    title: "Second TikTok Video",
    thumbnail: "https://example.com/thumb2.jpg",
    creator: "TikTokUser",
    format: "No Watermark",
    filesize: 10485760,
    timestamp: "2026-10-28T15:30:00Z",
  },
];

describe("HistoryDrawer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("render", () => {
    it("should render Download History title when open", () => {
      // Arrange & Act
      render(
        <HistoryDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          history={mockHistory}
          onClear={mockOnClear}
          onRemove={mockOnRemove}
        />
      );

      // Assert
      expect(screen.getByText("Download History")).toBeInTheDocument();
    });

    it("should render history items", () => {
      // Arrange & Act
      render(
        <HistoryDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          history={mockHistory}
          onClear={mockOnClear}
          onRemove={mockOnRemove}
        />
      );

      // Assert
      expect(screen.getByText("First Video Download")).toBeInTheDocument();
      expect(screen.getByText("Second TikTok Video")).toBeInTheDocument();
    });

    it("should render platform badges for history items", () => {
      // Arrange & Act
      render(
        <HistoryDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          history={mockHistory}
          onClear={mockOnClear}
          onRemove={mockOnRemove}
        />
      );

      // Assert
      expect(screen.getByText("YT")).toBeInTheDocument();
      expect(screen.getByText("TT")).toBeInTheDocument();
    });

    it("should render format labels", () => {
      // Arrange & Act
      render(
        <HistoryDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          history={mockHistory}
          onClear={mockOnClear}
          onRemove={mockOnRemove}
        />
      );

      // Assert
      expect(screen.getByText("720p")).toBeInTheDocument();
      expect(screen.getByText("No Watermark")).toBeInTheDocument();
    });

    it("should render file sizes", () => {
      // Arrange & Act
      render(
        <HistoryDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          history={mockHistory}
          onClear={mockOnClear}
          onRemove={mockOnRemove}
        />
      );

      // Assert
      expect(screen.getByText("50 MB")).toBeInTheDocument();
      expect(screen.getByText("10 MB")).toBeInTheDocument();
    });

    it("should render download count description", () => {
      // Arrange & Act
      render(
        <HistoryDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          history={mockHistory}
          onClear={mockOnClear}
          onRemove={mockOnRemove}
        />
      );

      // Assert
      expect(screen.getByText("2 downloads recorded")).toBeInTheDocument();
    });

    it("should show empty state when history is empty", () => {
      // Arrange & Act
      render(
        <HistoryDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          history={[]}
          onClear={mockOnClear}
          onRemove={mockOnRemove}
        />
      );

      // Assert
      expect(screen.getByText("No downloads yet. Start by pasting a video URL.")).toBeInTheDocument();
    });

    it("should render Clear All button when history has items", () => {
      // Arrange & Act
      render(
        <HistoryDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          history={mockHistory}
          onClear={mockOnClear}
          onRemove={mockOnRemove}
        />
      );

      // Assert
      expect(screen.getByRole("button", { name: /clear all/i })).toBeInTheDocument();
    });

    it("should not render Clear All button when history is empty", () => {
      // Arrange & Act
      render(
        <HistoryDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          history={[]}
          onClear={mockOnClear}
          onRemove={mockOnRemove}
        />
      );

      // Assert
      expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
    });

    it("should not render content when drawer is closed", () => {
      // Arrange & Act
      render(
        <HistoryDrawer
          open={false}
          onOpenChange={mockOnOpenChange}
          history={mockHistory}
          onClear={mockOnClear}
          onRemove={mockOnRemove}
        />
      );

      // Assert
      expect(screen.queryByText("Download History")).not.toBeInTheDocument();
    });

    it("should show singular 'download' for single item", () => {
      // Arrange & Act
      render(
        <HistoryDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          history={[mockHistory[0]]}
          onClear={mockOnClear}
          onRemove={mockOnRemove}
        />
      );

      // Assert
      expect(screen.getByText("1 download recorded")).toBeInTheDocument();
    });
  });

  describe("user interaction", () => {
    it("should call onClear when Clear All is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <HistoryDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          history={mockHistory}
          onClear={mockOnClear}
          onRemove={mockOnRemove}
        />
      );

      // Act
      await user.click(screen.getByRole("button", { name: /clear all/i }));

      // Assert
      expect(mockOnClear).toHaveBeenCalledTimes(1);
    });
  });

  describe("state verification", () => {
    it("should update when history items change", () => {
      // Arrange
      const { rerender } = render(
        <HistoryDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          history={mockHistory}
          onClear={mockOnClear}
          onRemove={mockOnRemove}
        />
      );
      expect(screen.getByText("2 downloads recorded")).toBeInTheDocument();

      // Act
      rerender(
        <HistoryDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          history={[mockHistory[0]]}
          onClear={mockOnClear}
          onRemove={mockOnRemove}
        />
      );

      // Assert
      expect(screen.getByText("1 download recorded")).toBeInTheDocument();
    });
  });
});

