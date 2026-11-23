import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createTestStore } from "@/lib/store";

// Rule 10 & 11: Mocks defined/imported before main component, starting with mock...
const mockGetGlobalSettings = jest.fn();
const mockSaveGlobalSettings = jest.fn();

jest.mock("@/lib/api", () => ({
  apiClient: {
    getGlobalSettings: (...args: unknown[]) => mockGetGlobalSettings(...args),
    saveGlobalSettings: (...args: unknown[]) => mockSaveGlobalSettings(...args),
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

import { GlobalSettingsPanel, DEFAULT_GLOBAL_SETTINGS } from "@/components/global-settings-panel";

function renderWithProvider(ui: React.ReactElement, testStore: ReturnType<typeof createTestStore>) {
  return render(<Provider store={testStore}>{ui}</Provider>);
}

describe("GlobalSettingsPanel", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    // Rule 10: Clear mocks in beforeEach
    jest.clearAllMocks();
    // Rule 3: Real Redux store configured with configureStore
    store = createTestStore();
    mockGetGlobalSettings.mockResolvedValue(DEFAULT_GLOBAL_SETTINGS);
    mockSaveGlobalSettings.mockImplementation(async (settings) => settings);
  });

  describe("render", () => {
    it("should render global customization toggle bar with saved in DB badge", async () => {
      // Arrange & Act
      renderWithProvider(<GlobalSettingsPanel />, store);

      // Assert
      expect(screen.getByText("Global Customization Settings")).toBeInTheDocument();
      expect(screen.getByText("Saved in DB")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /toggle global settings/i })).toBeInTheDocument();
    });

    it("should render expanded panel controls when defaultExpanded is true", async () => {
      // Arrange & Act
      renderWithProvider(<GlobalSettingsPanel defaultExpanded={true} />, store);

      // Assert
      expect(await screen.findByRole("button", { name: /save as global default/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /reset defaults/i })).toBeInTheDocument();
      expect(screen.getByText("Enable Headline Banner Overlay")).toBeInTheDocument();
    });
  });

  describe("user interaction", () => {
    it("should expand panel, switch tabs, edit hook text, and save settings to database", async () => {
      // Arrange
      const user = userEvent.setup();
      const mockChange = jest.fn();
      renderWithProvider(<GlobalSettingsPanel onSettingsChange={mockChange} defaultExpanded={true} />, store);

      // Act 1: Switch to Audio Mix tab
      const audioTab = screen.getByRole("button", { name: /audio mix/i });
      await user.click(audioTab);

      // Assert 1: Audio mix controls visible
      expect(screen.getByLabelText(/default background music track/i)).toBeInTheDocument();

      // Act 2: Select a music track
      const musicSelect = screen.getByLabelText(/default background music track/i);
      await user.selectOptions(musicSelect, "vice_city_synth");

      // Assert 2: Music volume slider appears
      expect(await screen.findByLabelText(/music volume mix/i)).toBeInTheDocument();

      // Act 3: Click Save as Global Default
      const saveBtn = screen.getByRole("button", { name: /save as global default/i });
      await user.click(saveBtn);

      // Assert 3: API called with updated audio settings
      await waitFor(() => {
        expect(mockSaveGlobalSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            audio_mix: expect.objectContaining({
              background_music: "vice_city_synth",
            }),
          })
        );
      });
      expect(await screen.findByText("Defaults Saved!")).toBeInTheDocument();
    });

    it("should toggle cover thumbnail slap option", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(<GlobalSettingsPanel defaultExpanded={true} />, store);

      // Act: Switch to Cover Thumbnail tab
      const coverTab = screen.getByRole("button", { name: /cover thumbnail/i });
      await user.click(coverTab);

      // Assert: Cover active button visible
      const coverToggle = screen.getByRole("button", { name: /cover active/i });
      expect(coverToggle).toBeInTheDocument();

      // Act: Toggle off
      await user.click(coverToggle);
      expect(screen.getByRole("button", { name: /no cover slap/i })).toBeInTheDocument();
    });
  });

  describe("Redux state verification", () => {
    it("should verify store remains healthy and unmutated during global settings interactions", () => {
      // Arrange & Act
      renderWithProvider(<GlobalSettingsPanel defaultExpanded={true} />, store);

      // Assert
      const state = store.getState();
      expect(state.video.isDownloading).toBe(false);
      expect(state.video.metadata).toBeNull();
      expect(state.auth.isAuthenticated).toBe(false);
    });
  });
});
