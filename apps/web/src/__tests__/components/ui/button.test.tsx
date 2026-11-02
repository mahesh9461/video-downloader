import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  describe("render", () => {
    it("should render with default variant", () => {
      // Arrange & Act
      render(<Button>Click me</Button>);

      // Assert
      expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
    });

    it("should render with gradient variant", () => {
      // Arrange & Act
      render(<Button variant="gradient">Download</Button>);

      // Assert
      const button = screen.getByRole("button", { name: "Download" });
      expect(button).toHaveClass("bg-gradient-to-r");
    });

    it("should render with different sizes", () => {
      // Arrange & Act
      render(<Button size="lg">Large</Button>);

      // Assert
      const button = screen.getByRole("button", { name: "Large" });
      expect(button).toHaveClass("h-12");
    });

    it("should render as disabled", () => {
      // Arrange & Act
      render(<Button disabled>Disabled</Button>);

      // Assert
      expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
    });
  });

  describe("user interaction", () => {
    it("should call onClick when clicked", async () => {
      // Arrange
      const mockOnClick = jest.fn();
      const user = userEvent.setup();
      render(<Button onClick={mockOnClick}>Click</Button>);

      // Act
      await user.click(screen.getByRole("button", { name: "Click" }));

      // Assert
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it("should not call onClick when disabled", async () => {
      // Arrange
      const mockOnClick = jest.fn();
      const user = userEvent.setup();
      render(<Button onClick={mockOnClick} disabled>Click</Button>);

      // Act
      await user.click(screen.getByRole("button", { name: "Click" }));

      // Assert
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe("state verification", () => {
    it("should apply custom className", () => {
      // Arrange & Act
      render(<Button className="custom-class">Custom</Button>);

      // Assert
      expect(screen.getByRole("button", { name: "Custom" })).toHaveClass("custom-class");
    });

    it("should apply outline variant styles", () => {
      // Arrange & Act
      render(<Button variant="outline">Outline</Button>);

      // Assert
      const button = screen.getByRole("button", { name: "Outline" });
      expect(button).toHaveClass("border");
      expect(button).toHaveClass("bg-transparent");
    });
  });
});

