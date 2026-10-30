import "@testing-library/jest-dom";
import { detectPlatform, isValidUrl } from "@/lib/validators";

describe("validators", () => {
  describe("detectPlatform", () => {
    // ─── YouTube URLs ───

    it("should detect standard YouTube watch URL", () => {
      // Arrange
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

      // Act
      const result = detectPlatform(url);

      // Assert
      expect(result).toBe("youtube");
    });

    it("should detect YouTube watch URL without www", () => {
      // Arrange
      const url = "https://youtube.com/watch?v=dQw4w9WgXcQ";

      // Act
      const result = detectPlatform(url);

      // Assert
      expect(result).toBe("youtube");
    });

    it("should detect YouTube short URL (youtu.be)", () => {
      // Arrange
      const url = "https://youtu.be/dQw4w9WgXcQ";

      // Act
      const result = detectPlatform(url);

      // Assert
      expect(result).toBe("youtube");
    });

    it("should detect YouTube Shorts URL", () => {
      // Arrange
      const url = "https://www.youtube.com/shorts/dQw4w9WgXcQ";

      // Act
      const result = detectPlatform(url);

      // Assert
      expect(result).toBe("youtube");
    });

    it("should detect YouTube embed URL", () => {
      // Arrange
      const url = "https://www.youtube.com/embed/dQw4w9WgXcQ";

      // Act
      const result = detectPlatform(url);

      // Assert
      expect(result).toBe("youtube");
    });

    it("should detect YouTube mobile URL", () => {
      // Arrange
      const url = "https://m.youtube.com/watch?v=dQw4w9WgXcQ";

      // Act
      const result = detectPlatform(url);

      // Assert
      expect(result).toBe("youtube");
    });

    it("should detect YouTube URL without protocol", () => {
      // Arrange
      const url = "www.youtube.com/watch?v=dQw4w9WgXcQ";

      // Act
      const result = detectPlatform(url);

      // Assert
      expect(result).toBe("youtube");
    });

    it("should detect YouTube URL with http (not https)", () => {
      // Arrange
      const url = "http://www.youtube.com/watch?v=dQw4w9WgXcQ";

      // Act
      const result = detectPlatform(url);

      // Assert
      expect(result).toBe("youtube");
    });

    // ─── TikTok URLs ───

    it("should detect standard TikTok video URL", () => {
      // Arrange
      const url = "https://www.tiktok.com/@username/video/1234567890123456789";

      // Act
      const result = detectPlatform(url);

      // Assert
      expect(result).toBe("tiktok");
    });

    it("should detect TikTok short URL (vm.tiktok.com)", () => {
      // Arrange
      const url = "https://vm.tiktok.com/ZMJabc123/";

      // Act
      const result = detectPlatform(url);

      // Assert
      expect(result).toBe("tiktok");
    });

    it("should detect TikTok short URL (vt.tiktok.com)", () => {
      // Arrange
      const url = "https://vt.tiktok.com/ZSabc123/";

      // Act
      const result = detectPlatform(url);

      // Assert
      expect(result).toBe("tiktok");
    });

    it("should detect TikTok /t/ short URL", () => {
      // Arrange
      const url = "https://www.tiktok.com/t/ZTRabc123/";

      // Act
      const result = detectPlatform(url);

      // Assert
      expect(result).toBe("tiktok");
    });

    it("should detect TikTok URL without www", () => {
      // Arrange
      const url = "https://tiktok.com/@user.name/video/1234567890123456789";

      // Act
      const result = detectPlatform(url);

      // Assert
      expect(result).toBe("tiktok");
    });

    // ─── Invalid URLs ───

    it("should return null for empty string", () => {
      // Arrange & Act
      const result = detectPlatform("");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for whitespace-only string", () => {
      // Arrange & Act
      const result = detectPlatform("   ");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for random text", () => {
      // Arrange & Act
      const result = detectPlatform("hello world");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for other website URLs", () => {
      // Arrange & Act
      const result = detectPlatform("https://www.google.com");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for Instagram URLs", () => {
      // Arrange & Act
      const result = detectPlatform("https://www.instagram.com/reel/abc123/");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for Vimeo URLs", () => {
      // Arrange & Act
      const result = detectPlatform("https://vimeo.com/123456");

      // Assert
      expect(result).toBeNull();
    });

    it("should handle URL with leading/trailing whitespace", () => {
      // Arrange
      const url = "  https://www.youtube.com/watch?v=dQw4w9WgXcQ  ";

      // Act
      const result = detectPlatform(url);

      // Assert
      expect(result).toBe("youtube");
    });
  });

  describe("isValidUrl", () => {
    it("should return true for valid YouTube URLs", () => {
      // Arrange
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

      // Act
      const result = isValidUrl(url);

      // Assert
      expect(result).toBe(true);
    });

    it("should return true for valid TikTok URLs", () => {
      // Arrange
      const url = "https://www.tiktok.com/@user/video/1234567890123456789";

      // Act
      const result = isValidUrl(url);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false for invalid URLs", () => {
      // Arrange
      const url = "https://www.google.com";

      // Act
      const result = isValidUrl(url);

      // Assert
      expect(result).toBe(false);
    });

    it("should return false for empty string", () => {
      // Arrange & Act
      const result = isValidUrl("");

      // Assert
      expect(result).toBe(false);
    });
  });
});

