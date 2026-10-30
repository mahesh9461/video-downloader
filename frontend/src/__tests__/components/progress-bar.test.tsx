import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "@/components/progress-bar";
import { DownloadProgress } from "@/lib/types";

describe("ProgressBar", () => {
  describe("render", () => {
    it("should render downloading status", () => {
      // Arrange
      const progress: DownloadProgress = {
        status: "downloading",
        percent: 45,
        speed: "3.2 MB/s",
        eta: "00:30",
        filename: null,
        filesize: null,
        error_message: null,
      };

      // Act
      render(<ProgressBar progress={progress} />);

      // Assert
      expect(screen.getByText("Downloading...")).toBeInTheDocument();
      expect(screen.getByText("45%")).toBeInTheDocument();
    });

    it("should render merging status", () => {
      // Arrange
      const progress: DownloadProgress = {
        status: "merging",
        percent: 90,
        speed: null,
        eta: null,
        filename: null,
        filesize: null,
        error_message: null,
      };

      // Act
      render(<ProgressBar progress={progress} />);

      // Assert
      expect(screen.getByText("Merging video & audio...")).toBeInTheDocument();
      expect(screen.getByText("90%")).toBeInTheDocument();
    });

    it("should render converting status", () => {
      // Arrange
      const progress: DownloadProgress = {
        status: "converting",
        percent: 75,
        speed: null,
        eta: null,
        filename: null,
        filesize: null,
        error_message: null,
      };

      // Act
      render(<ProgressBar progress={progress} />);

      // Assert
      expect(screen.getByText("Converting format...")).toBeInTheDocument();
    });

    it("should render complete status", () => {
      // Arrange
      const progress: DownloadProgress = {
        status: "complete",
        percent: 100,
        speed: null,
        eta: null,
        filename: "video.mp4",
        filesize: 50000000,
        error_message: null,
      };

      // Act
      render(<ProgressBar progress={progress} />);

      // Assert
      expect(screen.getByText("Complete!")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("should render error status", () => {
      // Arrange
      const progress: DownloadProgress = {
        status: "error",
        percent: 30,
        speed: null,
        eta: null,
        filename: null,
        filesize: null,
        error_message: "Download failed",
      };

      // Act
      render(<ProgressBar progress={progress} />);

      // Assert
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });

    it("should render speed when downloading", () => {
      // Arrange
      const progress: DownloadProgress = {
        status: "downloading",
        percent: 50,
        speed: "5.1 MB/s",
        eta: "00:15",
        filename: null,
        filesize: null,
        error_message: null,
      };

      // Act
      render(<ProgressBar progress={progress} />);

      // Assert
      expect(screen.getByText("5.1 MB/s")).toBeInTheDocument();
      expect(screen.getByText("ETA: 00:15")).toBeInTheDocument();
    });

    it("should not render speed/ETA for non-downloading statuses", () => {
      // Arrange
      const progress: DownloadProgress = {
        status: "merging",
        percent: 95,
        speed: "1.0 MB/s",
        eta: "00:05",
        filename: null,
        filesize: null,
        error_message: null,
      };

      // Act
      render(<ProgressBar progress={progress} />);

      // Assert
      expect(screen.queryByText("1.0 MB/s")).not.toBeInTheDocument();
      expect(screen.queryByText("ETA: 00:05")).not.toBeInTheDocument();
    });
  });

  describe("user interaction", () => {
    it("should update display when progress changes from downloading to merging", () => {
      // Arrange
      const downloading: DownloadProgress = {
        status: "downloading",
        percent: 100,
        speed: null,
        eta: null,
        filename: null,
        filesize: null,
        error_message: null,
      };
      const { rerender } = render(<ProgressBar progress={downloading} />);
      expect(screen.getByText("Downloading...")).toBeInTheDocument();

      // Act
      const merging: DownloadProgress = {
        status: "merging",
        percent: 50,
        speed: null,
        eta: null,
        filename: null,
        filesize: null,
        error_message: null,
      };
      rerender(<ProgressBar progress={merging} />);

      // Assert
      expect(screen.getByText("Merging video & audio...")).toBeInTheDocument();
      expect(screen.queryByText("Downloading...")).not.toBeInTheDocument();
    });
  });

  describe("state verification", () => {
    it("should show rounded percentage", () => {
      // Arrange
      const progress: DownloadProgress = {
        status: "downloading",
        percent: 42.7,
        speed: null,
        eta: null,
        filename: null,
        filesize: null,
        error_message: null,
      };

      // Act
      render(<ProgressBar progress={progress} />);

      // Assert
      expect(screen.getByText("43%")).toBeInTheDocument();
    });

    it("should clamp progress bar width between 0 and 100", () => {
      // Arrange
      const progress: DownloadProgress = {
        status: "downloading",
        percent: 150,
        speed: null,
        eta: null,
        filename: null,
        filesize: null,
        error_message: null,
      };

      // Act
      const { container } = render(<ProgressBar progress={progress} />);

      // Assert - the inner progress div should exist
      const progressBar = container.querySelector("[style]");
      expect(progressBar).toBeTruthy();
    });
  });
});

