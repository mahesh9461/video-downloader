import "@testing-library/jest-dom";
import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createTestStore, setCurrentUrl } from "@/lib/store";

// Rule 10 & 11: Mocks defined and imported before main component, starting with mock...
const mockOnSubmit = jest.fn();
const mockReadText = jest.fn();
const mockWriteText = jest.fn();

Object.defineProperty(navigator, "clipboard", {
  value: {
    readText: mockReadText,
    writeText: mockWriteText,
  },
  configurable: true,
  writable: true,
});

import { UrlInput } from "@/components/url-input";

function renderWithProvider(ui: React.ReactElement, testStore: ReturnType<typeof createTestStore>) {
  const { render } = require("@testing-library/react");
  return render(<Provider store={testStore}>{ui}</Provider>);
}

describe("UrlInput", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    // Rule 10: Always clear mocks in beforeEach
    jest.clearAllMocks();
    // Rule 3: Always use the real Redux store configured with configureStore
    store = createTestStore();
    Object.defineProperty(window.navigator, "clipboard", {
      value: {
        readText: mockReadText,
        writeText: mockWriteText,
      },
      configurable: true,
      writable: true,
    });
  });

  describe("render", () => {
    it("should render the input field with placeholder", () => {
      // Arrange & Act
      renderWithProvider(
        <UrlInput onSubmit={mockOnSubmit} isLoading={false} />,
        store
      );

      // Assert
      expect(
        screen.getByPlaceholderText("Paste a YouTube or TikTok URL...")
      ).toBeInTheDocument();
    });

    it("should render the paste button", () => {
      // Arrange & Act
      renderWithProvider(
        <UrlInput onSubmit={mockOnSubmit} isLoading={false} />,
        store
      );

      // Assert
      expect(screen.getByRole("button", { name: /paste/i })).toBeInTheDocument();
    });

    it("should disable input when isLoading is true", () => {
      // Arrange & Act
      renderWithProvider(
        <UrlInput onSubmit={mockOnSubmit} isLoading={true} />,
        store
      );

      // Assert
      expect(
        screen.getByPlaceholderText("Paste a YouTube or TikTok URL...")
      ).toBeDisabled();
    });
  });

  describe("user interaction", () => {
    it("should allow typing and submit valid YouTube URL", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(
        <UrlInput onSubmit={mockOnSubmit} isLoading={false} />,
        store
      );
      const input = screen.getByPlaceholderText("Paste a YouTube or TikTok URL...");

      // Act
      await user.type(input, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      await user.type(input, "{Enter}");

      // Assert
      expect(mockOnSubmit).toHaveBeenCalledWith("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    });

    it("should paste from clipboard when paste button is clicked", async () => {
      // Arrange
      const { fireEvent, act } = require("@testing-library/react");
      mockReadText.mockResolvedValueOnce("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      renderWithProvider(
        <UrlInput onSubmit={mockOnSubmit} isLoading={false} />,
        store
      );
      const pasteButton = screen.getByRole("button", { name: /paste/i });

      // Act
      await act(async () => {
        fireEvent.click(pasteButton);
      });

      // Assert
      expect(mockReadText).toHaveBeenCalled();
      expect(mockOnSubmit).toHaveBeenCalledWith("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    });
  });

  describe("Redux state verification", () => {
    it("should sync URL state with real Redux store", async () => {
      // Arrange
      const targetUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

      // Act
      store.dispatch(setCurrentUrl(targetUrl));
      renderWithProvider(
        <UrlInput onSubmit={mockOnSubmit} isLoading={false} />,
        store
      );

      // Assert
      expect(store.getState().video.currentUrl).toBe(targetUrl);
    });
  });
});
