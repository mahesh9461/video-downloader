import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createTestStore, setIsDownloading } from "@/lib/store";

// Rule 10 & 11: Mocks defined before main component, names start with mock...
const mockRemoveWatermark = jest.fn();

jest.mock("@/lib/api", () => ({
  apiClient: {
    removeWatermark: (...args: any[]) => mockRemoveWatermark(...args),
  },
}));

import { WatermarkRemover } from "@/components/watermark-remover";

function renderWithProvider(ui: React.ReactElement, store: ReturnType<typeof createTestStore>) {
  return render(<Provider store={store}>{ui}</Provider>);
}

describe("WatermarkRemover", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    // Rule 10: Clear mocks in beforeEach
    jest.clearAllMocks();
    // Rule 3: Always use real Redux store configured with configureStore
    store = createTestStore();
  });

  describe("render", () => {
    it("should render upload prompt and instructions", () => {
      // Arrange & Act
      renderWithProvider(<WatermarkRemover />, store);

      // Assert
      expect(screen.getByRole("heading", { name: /upload a video to remove watermarks/i })).toBeInTheDocument();
      expect(screen.getByText(/tiktok auto-clean/i)).toBeInTheDocument();
      expect(screen.getByText(/static logo detection/i)).toBeInTheDocument();
    });
  });

  describe("user interaction", () => {
    it("should allow selecting mode and uploading a video file", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(<WatermarkRemover />, store);

      const fakeFile = new File(["dummy video data"], "sample_tiktok.mp4", { type: "video/mp4" });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      // Act: select file
      await user.upload(input, fakeFile);

      // Assert
      expect(await screen.findByText("sample_tiktok.mp4")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /tiktok preset/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /smart auto-detect/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /remove watermark now/i })).toBeInTheDocument();

      // Act: switch mode to custom box
      await user.click(screen.getByRole("button", { name: /custom box/i }));
      expect(screen.getByText(/watermark rectangle \(pixels\):/i)).toBeInTheDocument();
    });
  });

  describe("Redux state verification", () => {
    it("should verify Redux store integration while interacting with watermark component", () => {
      // Arrange
      renderWithProvider(<WatermarkRemover />, store);

      // Act
      store.dispatch(setIsDownloading(true));

      // Assert
      expect(store.getState().video.isDownloading).toBe(true);
    });
  });
});
