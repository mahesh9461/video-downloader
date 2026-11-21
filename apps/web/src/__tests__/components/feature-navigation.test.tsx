import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createTestStore, setAuthUser } from "@/lib/store";

// Rule 10 & 11: Mocks defined before main component, starting with mock...
const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/"),
  useRouter: () => ({
    push: mockPush,
  }),
}));

import { FeatureNavigation } from "@/components/feature-navigation";

function renderWithProvider(ui: React.ReactElement, testStore: ReturnType<typeof createTestStore>) {
  return render(<Provider store={testStore}>{ui}</Provider>);
}

describe("FeatureNavigation", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    // Rule 10: Clear mocks in beforeEach
    jest.clearAllMocks();
    // Rule 3: Always use real Redux store
    store = createTestStore();
  });

  describe("render tests", () => {
    it("should render all four feature navigation tabs with correct links", () => {
      // Arrange & Act
      renderWithProvider(<FeatureNavigation activeTab="downloader" />, store);

      // Assert
      const downloadTab = screen.getByRole("tab", { name: /download/i });
      const watermarkTab = screen.getByRole("tab", { name: /watermark/i });
      const clipsTab = screen.getByRole("tab", { name: /viral shorts/i });
      const autopilotTab = screen.getByRole("tab", { name: /gta 6 autopilot/i });

      expect(downloadTab).toBeInTheDocument();
      expect(downloadTab).toHaveAttribute("href", "/");
      expect(downloadTab).toHaveAttribute("aria-selected", "true");

      expect(watermarkTab).toBeInTheDocument();
      expect(watermarkTab).toHaveAttribute("href", "/watermark");
      expect(watermarkTab).toHaveAttribute("aria-selected", "false");

      expect(clipsTab).toBeInTheDocument();
      expect(clipsTab).toHaveAttribute("href", "/viral-shorts");
      expect(clipsTab).toHaveAttribute("aria-selected", "false");

      expect(autopilotTab).toBeInTheDocument();
      expect(autopilotTab).toHaveAttribute("href", "/autopilot");
      expect(autopilotTab).toHaveAttribute("aria-selected", "false");
    });

    it("should reflect active state for watermark route", () => {
      // Arrange & Act
      renderWithProvider(<FeatureNavigation activeTab="watermark" />, store);

      // Assert
      const watermarkTab = screen.getByRole("tab", { name: /watermark/i });
      expect(watermarkTab).toHaveAttribute("aria-selected", "true");

      const downloadTab = screen.getByRole("tab", { name: /download/i });
      expect(downloadTab).toHaveAttribute("aria-selected", "false");
    });

    it("should reflect active state for viral shorts route", () => {
      // Arrange & Act
      renderWithProvider(<FeatureNavigation activeTab="clips" />, store);

      // Assert
      const clipsTab = screen.getByRole("tab", { name: /viral shorts/i });
      expect(clipsTab).toHaveAttribute("aria-selected", "true");
    });

    it("should reflect active state for autopilot route", () => {
      // Arrange & Act
      renderWithProvider(<FeatureNavigation activeTab="autopilot" />, store);

      // Assert
      const autopilotTab = screen.getByRole("tab", { name: /gta 6 autopilot/i });
      expect(autopilotTab).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("user interaction tests", () => {
    it("should allow clicking navigation tabs", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(<FeatureNavigation activeTab="downloader" />, store);

      // Act
      const watermarkTab = screen.getByRole("tab", { name: /watermark/i });
      await user.click(watermarkTab);

      // Assert
      expect(watermarkTab).toHaveAttribute("href", "/watermark");
    });
  });

  describe("Redux state verification test", () => {
    it("should verify real Redux store state remains valid alongside navigation rendering", () => {
      // Arrange
      const mockUser = {
        id: "usr-nav-1",
        email: "pilot@example.com",
        name: "Route Tester",
        role: "user" as const,
        tier: "free" as const,
        quota_remaining: 10,
        quota_limit: 10,
        created_at: "2026-11-21T00:00:00Z",
      };

      // Act
      store.dispatch(setAuthUser({ user: mockUser, token: "nav-token-123" }));
      renderWithProvider(<FeatureNavigation activeTab="autopilot" />, store);

      // Assert
      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe("pilot@example.com");
      expect(state.token).toBe("nav-token-123");
    });
  });
});
