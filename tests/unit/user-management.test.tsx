/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useSession } from "next-auth/react";
import UserManagementPage from "@/app/dashboard/users/page";

// Mock next-auth
vi.mock("next-auth/react");
const mockUseSession = vi.mocked(useSession);

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock user data
const mockUsers = [
  { id: "1", email: "admin@example.com", role: "ADMIN" },
  { id: "2", email: "user@example.com", role: "USER" },
  { id: "3", email: "auditor@example.com", role: "AUDITOR" },
];

describe("UserManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ users: mockUsers }),
    });
  });

  describe("Access Control", () => {
    it("should deny access for non-admin users", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "USER" } },
        status: "authenticated",
      });

      render(<UserManagementPage />);

      await screen.findByText("Access Denied");
      expect(
        screen.getByText("You don't have permission to view user management.")
      ).toBeInTheDocument();
    });

    it("should allow access for admin users", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });

      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("User Management")).toBeInTheDocument();
      });
    });

    it("should show loading state while checking authentication", () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "loading",
      });

      render(<UserManagementPage />);

      expect(screen.getByText("Loading users...")).toBeInTheDocument();
    });
  });

  describe("User List Display", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });
    });

    it("should display all users with correct information", async () => {
      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
        expect(screen.getByText("user@example.com")).toBeInTheDocument();
        expect(screen.getByText("auditor@example.com")).toBeInTheDocument();
      });
    });

    it("should display role badges with correct variants", async () => {
      render(<UserManagementPage />);

      await waitFor(() => {
        // Check for role badges
        const adminBadges = screen.getAllByText("ADMIN");
        const userBadges = screen.getAllByText("USER");
        const auditorBadges = screen.getAllByText("AUDITOR");

        expect(adminBadges.length).toBeGreaterThan(0);
        expect(userBadges.length).toBeGreaterThan(0);
        expect(auditorBadges.length).toBeGreaterThan(0);
      });
    });

    it("should show user count in header", async () => {
      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("Current Users (3)")).toBeInTheDocument();
      });
    });

    it("should handle empty user list", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      });

      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("No users found")).toBeInTheDocument();
      });
    });
  });

  describe("User Invitation Form", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });
    });

    it("should render invitation form with all fields", async () => {
      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email")).toBeInTheDocument();
        expect(screen.getByRole("combobox")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /invite user/i })).toBeInTheDocument();
      });
    });

    it("should handle successful user invitation", async () => {
      const mockInviteResponse = {
        ok: true,
        json: () => Promise.resolve({ message: "User invited successfully" }),
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ users: mockUsers }),
        })
        .mockResolvedValueOnce(mockInviteResponse)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ users: [...mockUsers, { id: "4", email: "new@example.com", role: "USER" }] }),
        });

      render(<UserManagementPage />);

      await waitFor(() => {
        const emailInput = screen.getByLabelText("Email");
        const submitButton = screen.getByRole("button", { name: /invite user/i });

        fireEvent.change(emailInput, { target: { value: "new@example.com" } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText("User invited successfully!")).toBeInTheDocument();
      });
    });

    it("should handle invitation errors", async () => {
      const mockErrorResponse = {
        ok: false,
        json: () => Promise.resolve({ message: "Email already exists" }),
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ users: mockUsers }),
        })
        .mockResolvedValueOnce(mockErrorResponse);

      render(<UserManagementPage />);

      await waitFor(() => {
        const emailInput = screen.getByLabelText("Email");
        const submitButton = screen.getByRole("button", { name: /invite user/i });

        fireEvent.change(emailInput, { target: { value: "existing@example.com" } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to invite user: Email already exists/)).toBeInTheDocument();
      });
    });

    it("should clear form after successful invitation", async () => {
      const mockInviteResponse = {
        ok: true,
        json: () => Promise.resolve({ message: "User invited successfully" }),
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ users: mockUsers }),
        })
        .mockResolvedValueOnce(mockInviteResponse)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ users: mockUsers }),
        });

      render(<UserManagementPage />);

      await waitFor(() => {
        const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
        const submitButton = screen.getByRole("button", { name: /invite user/i });

        fireEvent.change(emailInput, { target: { value: "new@example.com" } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
        expect(emailInput.value).toBe("");
      });
    });
  });

  describe("Form Validation", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });
    });

    it("should require email field", async () => {
      render(<UserManagementPage />);

      await waitFor(() => {
        const submitButton = screen.getByRole("button", { name: /invite user/i });
        fireEvent.click(submitButton);

        // HTML5 validation should prevent submission
        const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
        expect(emailInput.validity.valid).toBeFalsy();
      });
    });

    it("should validate email format", async () => {
      render(<UserManagementPage />);

      await waitFor(() => {
        const emailInput = screen.getByLabelText("Email") as HTMLInputElement;

        fireEvent.change(emailInput, { target: { value: "invalid-email" } });
        fireEvent.blur(emailInput);

        expect(emailInput.validity.valid).toBeFalsy();
      });
    });
  });

  describe("Accessibility", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });
    });

    it("should have proper ARIA labels", async () => {
      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email")).toBeInTheDocument();
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });
    });

    it("should have proper table structure", async () => {
      render(<UserManagementPage />);

      await waitFor(() => {
        const table = screen.getByRole("table");
        expect(table).toBeInTheDocument();

        const columnHeaders = screen.getAllByRole("columnheader");
        expect(columnHeaders).toHaveLength(3);
        expect(columnHeaders[0]).toHaveTextContent("Email");
        expect(columnHeaders[1]).toHaveTextContent("Role");
        expect(columnHeaders[2]).toHaveTextContent("Actions");
      });
    });

    it("should have proper form structure", async () => {
      render(<UserManagementPage />);

      await waitFor(() => {
        const form = screen.getByRole("form");
        expect(form).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });
    });

    it("should handle network errors when fetching users", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      // Mock console.error to avoid noise in tests
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load users.")).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it("should handle network errors when inviting users", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ users: mockUsers }),
        })
        .mockRejectedValueOnce(new Error("Network error"));

      // Mock console.error to avoid noise in tests
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<UserManagementPage />);

      await waitFor(() => {
        const emailInput = screen.getByLabelText("Email");
        const submitButton = screen.getByRole("button", { name: /invite user/i });

        fireEvent.change(emailInput, { target: { value: "test@example.com" } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText("Failed to invite user. Please try again.")).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });
});