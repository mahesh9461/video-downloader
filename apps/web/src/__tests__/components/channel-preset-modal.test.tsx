import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createTestStore } from "@/lib/store";
import { YouTubeChannelItem } from "@/lib/types";

// Rule 10 & 11: Mocks defined/imported before main component, starting with mock...
const mockUpdateYouTubeChannelSettings = jest.fn();

jest.mock("@/lib/api", () => ({
  apiClient: {
    updateYouTubeChannelSettings: (...args: unknown[]) => mockUpdateYouTubeChannelSettings(...args),
  },
  DownloadError: class DownloadError extends Error {
    type: string;
    constructor(message: string, type: string) {
      super(message);
      this.type = type;
      this.name = "DownloadError";
    }
  },
}));

import { ChannelPresetModal } from "@/components/channel-preset-modal";

const sampleChannel: YouTubeChannelItem = {
  id: "UCgwgp-cWzUEi4Vw-7mRSfOw",
  channel_id: "UCgwgp-cWzUEi4Vw-7mRSfOw",
  channel_title: "Pipsy Pop",
  thumbnail_url: "https://example.com/pipsy.jpg",
  is_default: false,
  description: "Join Mother Duck and her cute little ducklings!",
  tags: ["Five Little Ducks", "Nursery Rhymes", "Kids Songs"],
  category_id: "1",
  category_name: "Film & Animation",
  made_for_kids: true,
  ai_generated: false,
  paid_promotion: false,
};

function renderWithProvider(ui: React.ReactElement, testStore: ReturnType<typeof createTestStore>) {
  return render(<Provider store={testStore}>{ui}</Provider>);
}

describe("ChannelPresetModal", () => {
  let store: ReturnType<typeof createTestStore>;
  const mockOnClose = jest.fn();
  const mockOnSaved = jest.fn();

  beforeEach(() => {
    // Rule 10: Clear mocks in beforeEach
    jest.clearAllMocks();
    // Rule 3: Real Redux store configured with configureStore
    store = createTestStore();
    mockUpdateYouTubeChannelSettings.mockImplementation(async (_cid, payload) => ({
      ...sampleChannel,
      ...payload,
    }));
  });

  describe("render", () => {
    it("should render channel title, category selector, tags chips, and description", () => {
      // Arrange & Act
      renderWithProvider(
        <ChannelPresetModal
          isOpen={true}
          onClose={mockOnClose}
          channel={sampleChannel}
          onSaved={mockOnSaved}
        />,
        store
      );

      // Assert (Rule 9: Semantic queries)
      expect(screen.getByText("Channel Defaults & Presets")).toBeInTheDocument();
      expect(screen.getByText("Pipsy Pop")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toHaveValue("1");
      expect(screen.getByText("#Five Little Ducks")).toBeInTheDocument();
      expect(screen.getByText("#Nursery Rhymes")).toBeInTheDocument();
      expect(screen.getByText("#Kids Songs")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /save channel defaults/i })).toBeInTheDocument();
    });
  });

  describe("user interaction", () => {
    it("should allow user to add a new tag and save updated settings", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(
        <ChannelPresetModal
          isOpen={true}
          onClose={mockOnClose}
          channel={sampleChannel}
          onSaved={mockOnSaved}
        />,
        store
      );

      // Act: Type a new tag into the tag input box
      const tagInput = screen.getByPlaceholderText(/type tag and press enter/i);
      await user.type(tagInput, "toddler tunes");
      const addBtn = screen.getByRole("button", { name: /^add$/i });
      await user.click(addBtn);

      // Assert tag chip was added
      expect(screen.getByText("#toddler tunes")).toBeInTheDocument();

      // Act: Click save button
      const saveBtn = screen.getByRole("button", { name: /save channel defaults/i });
      await user.click(saveBtn);

      // Assert API was called with the new tag included
      await waitFor(() => {
        expect(mockUpdateYouTubeChannelSettings).toHaveBeenCalledWith(
          "UCgwgp-cWzUEi4Vw-7mRSfOw",
          expect.objectContaining({
            category_id: "1",
            category_name: "Film & Animation",
            tags: expect.arrayContaining(["Five Little Ducks", "toddler tunes"]),
          })
        );
      });
      expect(mockOnSaved).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should allow user to change category to Gaming", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(
        <ChannelPresetModal
          isOpen={true}
          onClose={mockOnClose}
          channel={sampleChannel}
          onSaved={mockOnSaved}
        />,
        store
      );

      // Act: Change category combobox to Gaming (Cat 20)
      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "20");

      // Act: Click save button
      const saveBtn = screen.getByRole("button", { name: /save channel defaults/i });
      await user.click(saveBtn);

      // Assert API called with category 20
      await waitFor(() => {
        expect(mockUpdateYouTubeChannelSettings).toHaveBeenCalledWith(
          "UCgwgp-cWzUEi4Vw-7mRSfOw",
          expect.objectContaining({
            category_id: "20",
            category_name: "Gaming",
            game_title: "Grand Theft Auto VI",
          })
        );
      });
    });

    it("should allow user to apply GTA 6 Gaming Presets in one click and persist game_title", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(
        <ChannelPresetModal
          isOpen={true}
          onClose={mockOnClose}
          channel={sampleChannel}
          onSaved={mockOnSaved}
        />,
        store
      );

      // Act: Click 1-Click GTA 6 Gaming Presets button
      const gtaBtn = screen.getByRole("button", { name: /gta 6 gaming presets/i });
      await user.click(gtaBtn);

      // Assert: Category changed to Gaming (Cat 20)
      expect(screen.getByRole("combobox")).toHaveValue("20");

      // Assert: Game title input is visible with Grand Theft Auto VI
      const gameTitleInput = screen.getByPlaceholderText(/e\.g\. grand theft auto vi/i);
      expect(gameTitleInput).toHaveValue("Grand Theft Auto VI");

      // Assert: Explanation banner is displayed
      expect(
        screen.getByText(/why youtube studio shows "game title \(optional\): none" on api uploads/i)
      ).toBeInTheDocument();

      // Act: Click save button
      const saveBtn = screen.getByRole("button", { name: /save channel defaults/i });
      await user.click(saveBtn);

      // Assert: API called with GTA 6 settings including game_title
      await waitFor(() => {
        expect(mockUpdateYouTubeChannelSettings).toHaveBeenCalledWith(
          "UCgwgp-cWzUEi4Vw-7mRSfOw",
          expect.objectContaining({
            category_id: "20",
            category_name: "Gaming",
            game_title: "Grand Theft Auto VI",
            made_for_kids: false,
            tags: expect.arrayContaining(["GTA 6", "Grand Theft Auto VI", "Rockstar Games"]),
          })
        );
      });
    });
  });

  describe("state verification", () => {
    it("should verify real Redux store state remains valid and unchanged during modal interaction", () => {
      // Arrange
      const initialReduxState = store.getState();

      // Act
      renderWithProvider(
        <ChannelPresetModal
          isOpen={true}
          onClose={mockOnClose}
          channel={sampleChannel}
          onSaved={mockOnSaved}
        />,
        store
      );

      // Assert: Redux store integrity
      const currentReduxState = store.getState();
      expect(currentReduxState.video).toEqual(initialReduxState.video);
      expect(currentReduxState.auth).toEqual(initialReduxState.auth);
    });
  });
});
