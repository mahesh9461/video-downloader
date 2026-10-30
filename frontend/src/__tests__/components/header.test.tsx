import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createTestStore, addHistoryItem } from "@/lib/store";

// Rule 10 & 11: Mocks defined/imported before main component, starting with mock...
const mockOnOpenHistory = jest.fn();

import { Header } from "@/components/header";

function renderWithProvider(ui: React.ReactElement, testStore: ReturnType<typeof createTestStore>) {
  return render(<Provider store={testStore}>{ui}</Provider>);
}

describe("Header", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    // Rule 10: Clear mocks in beforeEach
    jest.clearAllMocks();
    // Rule 3: Always use real Redux store
    store = createTestStore();
  });

  describe("render", () => {
    it("should render the app name and logo", () => {
      // Arrange & Act
      renderWithProvider(<Header onOpenHistory={mockOnOpenHistory} historyCount={0} />, store);

      // Assert
      expect(screen.getByText("SaveIt")).toBeInTheDocument();
      expect(screen.getByText("Pro")).toBeInTheDocument();
    });

    it("should render the history button", () => {
      // Arrange & Act
      renderWithProvider(<Header onOpenHistory={mockOnOpenHistory} historyCount={0} />, store);

      // Assert
      expect(screen.getByRole("button", { name: /history/i })).toBeInTheDocument();
    });

    it("should show history count badge when count > 0", () => {
      // Arrange & Act
      renderWithProvider(<Header onOpenHistory={mockOnOpenHistory} historyCount={5} />, store);

      // Assert
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("should not show history count badge when count is 0", () => {
      // Arrange & Act
      renderWithProvider(<Header onOpenHistory={mockOnOpenHistory} historyCount={0} />, store);

      // Assert
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });
  });

  describe("user interaction", () => {
    it("should call onOpenHistory when history button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(<Header onOpenHistory={mockOnOpenHistory} historyCount={3} />, store);
      const historyButton = screen.getByRole("button", { name: /history/i });

      // Act
      await user.click(historyButton);

      // Assert
      expect(mockOnOpenHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe("Redux state verification", () => {
    it("should reflect Redux store history length in header badge", () => {
      // Arrange
      store.dispatch(
        addHistoryItem({
          id: "hist-1",
          platform: "youtube",
          title: "Test Video",
          thumbnail: "thumb.jpg",
          creator: "Creator",
          format: "720p",
          filesize: 1024,
          timestamp: "2026-10-29T12:00:00Z",
        })
      );

      // Act
      const count = store.getState().video.history.length;
      renderWithProvider(<Header onOpenHistory={mockOnOpenHistory} historyCount={count} />, store);

      // Assert
      expect(store.getState().video.history).toHaveLength(1);
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });
});
