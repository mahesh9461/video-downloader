import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBanner } from "@/components/error-banner";

const mockOnDismiss = jest.fn();

describe("ErrorBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("render", () => {
    it("should render error message", () => {
      // Arrange & Act
      render(<ErrorBanner message="Something went wrong" />);

      // Assert
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("should render correct title for private error type", () => {
      // Arrange & Act
      render(<ErrorBanner message="This video is private" type="private" />);

      // Assert
      expect(screen.getByText("Private Video")).toBeInTheDocument();
      expect(screen.getByText("This video is private")).toBeInTheDocument();
    });

    it("should render correct title for geo_restricted error type", () => {
      // Arrange & Act
      render(<ErrorBanner message="Not available in your region" type="geo_restricted" />);

      // Assert
      expect(screen.getByText("Geo-Restricted")).toBeInTheDocument();
    });

    it("should render correct title for deleted error type", () => {
      // Arrange & Act
      render(<ErrorBanner message="Video was deleted" type="deleted" />);

      // Assert
      expect(screen.getByText("Content Unavailable")).toBeInTheDocument();
    });

    it("should render correct title for rate_limit error type", () => {
      // Arrange & Act
      render(<ErrorBanner message="Too many requests" type="rate_limit" />);

      // Assert
      expect(screen.getByText("Rate Limited")).toBeInTheDocument();
    });

    it("should render correct title for network error type", () => {
      // Arrange & Act
      render(<ErrorBanner message="Cannot reach server" type="network" />);

      // Assert
      expect(screen.getByText("Network Error")).toBeInTheDocument();
    });

    it("should default to 'Error' title for unknown type", () => {
      // Arrange & Act
      render(<ErrorBanner message="Unknown issue" type="unknown" />);

      // Assert
      expect(screen.getByText("Error")).toBeInTheDocument();
    });

    it("should default to 'Error' when type is null", () => {
      // Arrange & Act
      render(<ErrorBanner message="Something broke" type={null} />);

      // Assert
      expect(screen.getByText("Error")).toBeInTheDocument();
    });

    it("should render dismiss button when onDismiss is provided", () => {
      // Arrange & Act
      render(<ErrorBanner message="Error" onDismiss={mockOnDismiss} />);

      // Assert
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should not render dismiss button when onDismiss is not provided", () => {
      // Arrange & Act
      render(<ErrorBanner message="Error" />);

      // Assert
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("user interaction", () => {
    it("should call onDismiss when dismiss button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<ErrorBanner message="Error" onDismiss={mockOnDismiss} />);
      const dismissButton = screen.getByRole("button");

      // Act
      await user.click(dismissButton);

      // Assert
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe("state verification", () => {
    it("should update message when props change", () => {
      // Arrange
      const { rerender } = render(<ErrorBanner message="First error" type="network" />);
      expect(screen.getByText("First error")).toBeInTheDocument();

      // Act
      rerender(<ErrorBanner message="Second error" type="private" />);

      // Assert
      expect(screen.getByText("Second error")).toBeInTheDocument();
      expect(screen.queryByText("First error")).not.toBeInTheDocument();
      expect(screen.getByText("Private Video")).toBeInTheDocument();
    });
  });
});

