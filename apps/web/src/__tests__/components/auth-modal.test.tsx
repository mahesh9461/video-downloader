import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createTestStore, setAuthUser, logoutUser } from "@/lib/store";

// Rule 10 & 11: Mocks defined before main component, starting with mock...
const mockOnClose = jest.fn();
const mockOnSuccess = jest.fn();
const mockSignup = jest.fn();
const mockLogin = jest.fn();
const mockLogout = jest.fn();

jest.mock("@/lib/api", () => ({
  apiClient: {
    signup: (...args: any[]) => mockSignup(...args),
    login: (...args: any[]) => mockLogin(...args),
    logout: (...args: any[]) => mockLogout(...args),
    resolveUrl: (path: string) => `http://localhost:8000${path}`,
  },
}));

import { AuthModal } from "@/components/auth-modal";

function renderWithProvider(ui: React.ReactElement, testStore: ReturnType<typeof createTestStore>) {
  return render(<Provider store={testStore}>{ui}</Provider>);
}

describe("AuthModal", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    // Rule 10: Clear mocks in beforeEach
    jest.clearAllMocks();
    // Rule 3: Always use real Redux store configured with configureStore
    store = createTestStore();
  });

  describe("render tests", () => {
    test("should render the sign in form when modal is open and user is logged out", () => {
      // Arrange & Act
      renderWithProvider(
        <AuthModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
        store
      );

      // Assert
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Sign In to SaveIt/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Submit Sign In/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Create Account/i })).toBeInTheDocument();
    });

    test("should render user profile and Sign Out button when user is logged in", () => {
      // Arrange
      store.dispatch(
        setAuthUser({
          user: {
            id: "usr_gta_creator_123",
            email: "creator@gtaviceverse.com",
            name: "GTA Creator",
          },
          token: "tok_test_session_token_123",
        })
      );

      // Act
      renderWithProvider(
        <AuthModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
        store
      );

      // Assert
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /GTA Creator/i })).toBeInTheDocument();
      expect(screen.getByText("creator@gtaviceverse.com")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sign Out/i })).toBeInTheDocument();
    });
  });

  describe("user interaction tests", () => {
    test("should switch between Sign In and Create Account modes", async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProvider(
        <AuthModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
        store
      );

      // Act
      const createAccountTab = screen.getByRole("tab", { name: /Create Account/i });
      await user.click(createAccountTab);

      // Assert
      expect(screen.getByRole("heading", { name: /Create Your Account/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. Alex Vance/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Submit Create Account/i })).toBeInTheDocument();
    });

    test("should submit login form and dispatch user into Redux store", async () => {
      // Arrange
      const user = userEvent.setup();
      mockLogin.mockResolvedValueOnce({
        user: {
          id: "usr_login_success_777",
          email: "player1@vicecity.com",
          name: "Vice Player",
        },
        access_token: "tok_player_token_777",
      });

      renderWithProvider(
        <AuthModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
        store
      );

      const emailInput = screen.getByPlaceholderText(/creator@example\.com/i);
      const passwordInput = screen.getByPlaceholderText(/••••••••/i);
      const submitBtn = screen.getByRole("button", { name: /Submit Sign In/i });

      // Act
      await user.type(emailInput, "player1@vicecity.com");
      await user.type(passwordInput, "secret123");
      await user.click(submitBtn);

      // Assert
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith("player1@vicecity.com", "secret123");
      });
      expect(store.getState().auth.isAuthenticated).toBe(true);
      expect(store.getState().auth.user?.email).toBe("player1@vicecity.com");
    });
  });

  describe("Redux state verification test", () => {
    test("should verify real Redux store state transitions for authentication and sign out", async () => {
      // Arrange: Initial logged out state
      expect(store.getState().auth.isAuthenticated).toBe(false);
      expect(store.getState().auth.user).toBeNull();

      // Act 1: Dispatch auth user
      store.dispatch(
        setAuthUser({
          user: {
            id: "usr_state_verified_99",
            email: "verified@example.com",
            name: "Verified User",
          },
          token: "tok_state_99",
        })
      );

      // Assert 1: Store updated
      expect(store.getState().auth.isAuthenticated).toBe(true);
      expect(store.getState().auth.user?.id).toBe("usr_state_verified_99");
      expect(store.getState().auth.token).toBe("tok_state_99");

      // Act 2: Dispatch logout
      store.dispatch(logoutUser());

      // Assert 2: Store cleared
      expect(store.getState().auth.isAuthenticated).toBe(false);
      expect(store.getState().auth.user).toBeNull();
      expect(store.getState().auth.token).toBeNull();
    });
  });
});
