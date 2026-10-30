import "@testing-library/jest-dom";
import { cn, formatDuration, formatFileSize, formatTimestamp } from "@/lib/utils";

describe("utils", () => {
  describe("cn (class name merge)", () => {
    // Arrange → Act → Assert

    it("should merge class names correctly", () => {
      // Arrange
      const classes = ["text-white", "bg-black"];

      // Act
      const result = cn(...classes);

      // Assert
      expect(result).toBe("text-white bg-black");
    });

    it("should handle conditional classes", () => {
      // Arrange
      const isActive = true;
      const isDisabled = false;

      // Act
      const result = cn("base", isActive && "active", isDisabled && "disabled");

      // Assert
      expect(result).toBe("base active");
    });

    it("should merge conflicting Tailwind classes", () => {
      // Arrange & Act
      const result = cn("text-red-500", "text-blue-500");

      // Assert
      expect(result).toBe("text-blue-500");
    });

    it("should handle empty inputs", () => {
      // Arrange & Act
      const result = cn();

      // Assert
      expect(result).toBe("");
    });

    it("should handle undefined and null values", () => {
      // Arrange & Act
      const result = cn("base", undefined, null, "end");

      // Assert
      expect(result).toBe("base end");
    });
  });

  describe("formatDuration", () => {
    it("should format seconds-only durations", () => {
      // Arrange
      const seconds = 45;

      // Act
      const result = formatDuration(seconds);

      // Assert
      expect(result).toBe("0:45");
    });

    it("should format minutes and seconds", () => {
      // Arrange
      const seconds = 185; // 3:05

      // Act
      const result = formatDuration(seconds);

      // Assert
      expect(result).toBe("3:05");
    });

    it("should format hours, minutes, and seconds", () => {
      // Arrange
      const seconds = 3661; // 1:01:01

      // Act
      const result = formatDuration(seconds);

      // Assert
      expect(result).toBe("1:01:01");
    });

    it("should handle zero duration", () => {
      // Arrange & Act
      const result = formatDuration(0);

      // Assert
      expect(result).toBe("0:00");
    });

    it("should pad single-digit seconds", () => {
      // Arrange
      const seconds = 63; // 1:03

      // Act
      const result = formatDuration(seconds);

      // Assert
      expect(result).toBe("1:03");
    });

    it("should handle exactly one hour", () => {
      // Arrange
      const seconds = 3600;

      // Act
      const result = formatDuration(seconds);

      // Assert
      expect(result).toBe("1:00:00");
    });
  });

  describe("formatFileSize", () => {
    it("should format zero bytes", () => {
      // Arrange & Act
      const result = formatFileSize(0);

      // Assert
      expect(result).toBe("0 B");
    });

    it("should format bytes", () => {
      // Arrange & Act
      const result = formatFileSize(500);

      // Assert
      expect(result).toBe("500 B");
    });

    it("should format kilobytes", () => {
      // Arrange
      const bytes = 1536; // 1.5 KB

      // Act
      const result = formatFileSize(bytes);

      // Assert
      expect(result).toBe("1.5 KB");
    });

    it("should format megabytes", () => {
      // Arrange
      const bytes = 10485760; // 10 MB

      // Act
      const result = formatFileSize(bytes);

      // Assert
      expect(result).toBe("10 MB");
    });

    it("should format gigabytes", () => {
      // Arrange
      const bytes = 2147483648; // 2 GB

      // Act
      const result = formatFileSize(bytes);

      // Assert
      expect(result).toBe("2 GB");
    });
  });

  describe("formatTimestamp", () => {
    it("should format an ISO timestamp", () => {
      // Arrange
      const iso = "2026-10-29T12:30:00Z";

      // Act
      const result = formatTimestamp(iso);

      // Assert
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
      // Should contain "Oct" and "29"
      expect(result).toContain("Oct");
    });

    it("should handle different dates", () => {
      // Arrange
      const iso = "2026-01-15T08:00:00Z";

      // Act
      const result = formatTimestamp(iso);

      // Assert
      expect(result).toContain("Jan");
    });
  });
});

