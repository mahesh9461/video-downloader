import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Progress } from "@/components/ui/progress";

describe("Progress", () => {
  describe("render", () => {
    it("should render progress bar", () => {
      // Arrange & Act
      const { container } = render(<Progress value={50} />);

      // Assert
      expect(container.firstChild).toBeInTheDocument();
      expect(container.firstChild).toHaveClass("overflow-hidden");
    });

    it("should render with 0 value", () => {
      // Arrange & Act
      const { container } = render(<Progress value={0} />);

      // Assert
      const indicator = container.querySelector("[style]");
      expect(indicator).toHaveStyle({ width: "0%" });
    });

    it("should render with 100 value", () => {
      // Arrange & Act
      const { container } = render(<Progress value={100} />);

      // Assert
      const indicator = container.querySelector("[style]");
      expect(indicator).toHaveStyle({ width: "100%" });
    });
  });

  describe("user interaction", () => {
    it("should update width when value changes", () => {
      // Arrange
      const { container, rerender } = render(<Progress value={25} />);
      const indicator = container.querySelector("[style]");
      expect(indicator).toHaveStyle({ width: "25%" });

      // Act
      rerender(<Progress value={75} />);

      // Assert
      expect(indicator).toHaveStyle({ width: "75%" });
    });
  });

  describe("state verification", () => {
    it("should clamp value to max 100", () => {
      // Arrange & Act
      const { container } = render(<Progress value={150} />);

      // Assert
      const indicator = container.querySelector("[style]");
      expect(indicator).toHaveStyle({ width: "100%" });
    });

    it("should clamp value to min 0", () => {
      // Arrange & Act
      const { container } = render(<Progress value={-20} />);

      // Assert
      const indicator = container.querySelector("[style]");
      expect(indicator).toHaveStyle({ width: "0%" });
    });

    it("should apply custom className", () => {
      // Arrange & Act
      const { container } = render(<Progress value={50} className="h-4" />);

      // Assert
      expect(container.firstChild).toHaveClass("h-4");
    });

    it("should apply indicator className", () => {
      // Arrange & Act
      const { container } = render(
        <Progress value={50} indicatorClassName="bg-red-500" />
      );

      // Assert
      const indicator = container.querySelector("[style]");
      expect(indicator).toHaveClass("bg-red-500");
    });
  });
});

