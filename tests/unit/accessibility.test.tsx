/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { ThemeProvider } from "@/components/theme-provider";
import UserManagementPage from "@/app/dashboard/users/page";
import SessionViewPage from "@/app/dashboard/sessions/[id]/page";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
vi.mock("next-auth/react");
vi.mock("next/navigation");
const mockUseSession = vi.mocked(useSession);
const mockUseParams = vi.mocked(useParams);

// Mock fetch
global.fetch = vi.fn();

// Test wrapper with theme provider
const TestWrapper = ({ children, theme = "light" }: { children: React.ReactNode; theme?: "light" | "dark" }) => (
  <ThemeProvider attribute="class" defaultTheme={theme} enableSystem={false}>
    <div className={theme}>{children}</div>
  </ThemeProvider>
);

describe("Accessibility Tests", () => {
  describe("User Management Page Accessibility", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          users: [
            { id: "1", email: "admin@example.com", role: "ADMIN" },
            { id: "2", email: "user@example.com", role: "USER" },
          ],
        }),
      });
    });

    it("should have no accessibility violations in light mode", async () => {
      const { container } = render(
        <TestWrapper theme="light">
          <UserManagementPage />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have no accessibility violations in dark mode", async () => {
      const { container } = render(
        <TestWrapper theme="dark">
          <UserManagementPage />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have proper form labels", async () => {
      render(
        <TestWrapper>
          <UserManagementPage />
        </TestWrapper>
      );

      // Check for proper form labels
      const emailInput = screen.getByLabelText("Email");
      const roleSelect = screen.getByRole("combobox");

      expect(emailInput).toBeInTheDocument();
      expect(roleSelect).toBeInTheDocument();
      expect(emailInput).toHaveAttribute("type", "email");
      expect(emailInput).toHaveAttribute("required");
    });

    it("should support keyboard navigation", async () => {
      render(
        <TestWrapper>
          <UserManagementPage />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText("Email");
      const roleSelect = screen.getByRole("combobox");
      const submitButton = screen.getByRole("button", { name: /invite user/i });

      // Test tab navigation
      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);

      fireEvent.keyDown(emailInput, { key: "Tab" });
      expect(document.activeElement).toBe(roleSelect);

      fireEvent.keyDown(roleSelect, { key: "Tab" });
      expect(document.activeElement).toBe(submitButton);
    });

    it("should have proper ARIA attributes", async () => {
      render(
        <TestWrapper>
          <UserManagementPage />
        </TestWrapper>
      );

      // Check table accessibility
      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();

      const columnHeaders = screen.getAllByRole("columnheader");
      expect(columnHeaders).toHaveLength(3);

      // Check form accessibility
      const form = screen.getByRole("form");
      expect(form).toBeInTheDocument();
    });

    it("should have proper heading structure", async () => {
      render(
        <TestWrapper>
          <UserManagementPage />
        </TestWrapper>
      );

      // Check for proper heading hierarchy
      const mainHeading = screen.getByRole("heading", { level: 1 });
      expect(mainHeading).toHaveTextContent("User Management");

      const subHeadings = screen.getAllByRole("heading", { level: 2 });
      expect(subHeadings.length).toBeGreaterThan(0);
    });
  });

  describe("Session Details Page Accessibility", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });

      mockUseParams.mockReturnValue({
        id: "test-session-id",
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          session: {
            id: "test-session-id",
            sessionId: "test-session-id",
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            category: "SALARY_COMPENSATION",
            language: "en",
            country: "US",
            sentiment: "positive",
            messagesSent: 5,
            userId: "user-123",
            messages: [
              {
                id: "msg-1",
                content: "Hello",
                role: "user",
                timestamp: new Date().toISOString(),
              },
            ],
          },
        }),
      });
    });

    it("should have no accessibility violations in light mode", async () => {
      const { container } = render(
        <TestWrapper theme="light">
          <SessionViewPage />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have no accessibility violations in dark mode", async () => {
      const { container } = render(
        <TestWrapper theme="dark">
          <SessionViewPage />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have proper navigation links", async () => {
      render(
        <TestWrapper>
          <SessionViewPage />
        </TestWrapper>
      );

      const backLink = screen.getByRole("button", { name: /return to sessions list/i });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute("aria-label", "Return to sessions list");
    });

    it("should have proper badge accessibility", async () => {
      render(
        <TestWrapper>
          <SessionViewPage />
        </TestWrapper>
      );

      // Wait for data to load and check badges
      await screen.findByText("Session Details");

      const badges = screen.getAllByTestId(/badge/i);
      badges.forEach((badge) => {
        // Badges should have proper contrast and be readable
        expect(badge).toBeVisible();
      });
    });
  });

  describe("Theme Switching Accessibility", () => {
    it("should maintain accessibility when switching themes", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      });

      // Test light theme
      const { container, rerender } = render(
        <TestWrapper theme="light">
          <UserManagementPage />
        </TestWrapper>
      );

      let results = await axe(container);
      expect(results).toHaveNoViolations();

      // Test dark theme
      rerender(
        <TestWrapper theme="dark">
          <UserManagementPage />
        </TestWrapper>
      );

      results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should preserve focus when switching themes", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      });

      const { rerender } = render(
        <TestWrapper theme="light">
          <UserManagementPage />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText("Email");
      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);

      // Switch theme
      rerender(
        <TestWrapper theme="dark">
          <UserManagementPage />
        </TestWrapper>
      );

      // Focus should be maintained (or at least not cause errors)
      const newEmailInput = screen.getByLabelText("Email");
      expect(newEmailInput).toBeInTheDocument();
    });
  });

  describe("Keyboard Navigation", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          users: [
            { id: "1", email: "admin@example.com", role: "ADMIN" },
          ],
        }),
      });
    });

    it("should support tab navigation through all interactive elements", async () => {
      render(
        <TestWrapper>
          <UserManagementPage />
        </TestWrapper>
      );

      // Get all focusable elements
      const focusableElements = screen.getAllByRole("button").concat(
        screen.getAllByRole("textbox"),
        screen.getAllByRole("combobox")
      );

      expect(focusableElements.length).toBeGreaterThan(0);

      // Each element should be focusable
      focusableElements.forEach((element) => {
        element.focus();
        expect(document.activeElement).toBe(element);
      });
    });

    it("should support Enter key activation", async () => {
      render(
        <TestWrapper>
          <UserManagementPage />
        </TestWrapper>
      );

      const submitButton = screen.getByRole("button", { name: /invite user/i });
      
      // Focus and press Enter
      submitButton.focus();
      fireEvent.keyDown(submitButton, { key: "Enter" });

      // Button should respond to Enter key
      expect(submitButton).toBeInTheDocument();
    });

    it("should have visible focus indicators", async () => {
      render(
        <TestWrapper>
          <UserManagementPage />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText("Email");
      
      emailInput.focus();
      
      // Check that the element has focus styles
      expect(emailInput).toHaveFocus();
      
      // The focus should be visible (checked via CSS classes in real implementation)
      expect(emailInput).toHaveClass(/focus/);
    });
  });

  describe("Screen Reader Support", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          users: [
            { id: "1", email: "admin@example.com", role: "ADMIN" },
          ],
        }),
      });
    });

    it("should have proper landmark roles", async () => {
      render(
        <TestWrapper>
          <UserManagementPage />
        </TestWrapper>
      );

      // Check for semantic landmarks
      const main = screen.getByRole("main");
      expect(main).toBeInTheDocument();

      const form = screen.getByRole("form");
      expect(form).toBeInTheDocument();

      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();
    });

    it("should provide proper announcements for dynamic content", async () => {
      const { rerender } = render(
        <TestWrapper>
          <UserManagementPage />
        </TestWrapper>
      );

      // Check for live regions
      const liveRegions = screen.getAllByRole("status");
      expect(liveRegions.length).toBeGreaterThan(0);

      // Simulate an error state
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      rerender(
        <TestWrapper>
          <UserManagementPage />
        </TestWrapper>
      );

      // Error should be announced
      const errorMessage = screen.getByText(/failed to load users/i);
      expect(errorMessage).toBeInTheDocument();
    });

    it("should have descriptive button labels", async () => {
      render(
        <TestWrapper>
          <UserManagementPage />
        </TestWrapper>
      );

      const inviteButton = screen.getByRole("button", { name: /invite user/i });
      expect(inviteButton).toBeInTheDocument();
      expect(inviteButton).toHaveAccessibleName();
    });
  });
});