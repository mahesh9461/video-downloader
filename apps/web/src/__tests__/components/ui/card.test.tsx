import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

describe("Card", () => {
  describe("render", () => {
    it("should render Card with children", () => {
      // Arrange & Act
      render(
        <Card>
          <CardContent>Card content</CardContent>
        </Card>
      );

      // Assert
      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    it("should render full card structure", () => {
      // Arrange & Act
      render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      );

      // Assert
      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
      expect(screen.getByText("Footer")).toBeInTheDocument();
    });

    it("should apply dark theme styles", () => {
      // Arrange & Act
      const { container } = render(<Card>Dark</Card>);

      // Assert
      expect(container.firstChild).toHaveClass("border-zinc-800");
      expect(container.firstChild).toHaveClass("bg-zinc-900/50");
    });
  });

  describe("user interaction", () => {
    it("should accept onClick handler", async () => {
      // Arrange
      const mockOnClick = jest.fn();
      const { container } = render(
        <Card onClick={mockOnClick}>Clickable Card</Card>
      );

      // Act
      container.firstChild && (container.firstChild as HTMLElement).click();

      // Assert
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("state verification", () => {
    it("should apply custom className to Card", () => {
      // Arrange & Act
      const { container } = render(<Card className="custom-card">Styled</Card>);

      // Assert
      expect(container.firstChild).toHaveClass("custom-card");
      // Should still have base styles
      expect(container.firstChild).toHaveClass("rounded-xl");
    });
  });
});

