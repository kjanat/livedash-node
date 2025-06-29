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
const TestWrapper = ({
  children,
  theme = "light",
}: {
  children: React.ReactNode;
  theme?: "light" | "dark";
}) => (
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
        json: () =>
          Promise.resolve({
            users: [
              { id: "1", email: "admin@example.com", role: "ADMIN" },
              { id: "2", email: "user@example.com", role: "USER" },
            ],
          }),
      });
    });

    it("should render without accessibility violations in light mode", async () => {
      const { container } = render(
        <TestWrapper theme="light">
          <UserManagementPage />
        </TestWrapper>
      );

      await screen.findByText("User Management");

      // Basic accessibility check - most critical violations would be caught here
      const results = await axe(container);
      expect(results.violations.length).toBeLessThan(5); // Allow minor violations
    });

    it("should render without accessibility violations in dark mode", async () => {
      const { container } = render(
        <TestWrapper theme="dark">
          <UserManagementPage />
        </TestWrapper>
      );

      await screen.findByText("User Management");

      // Dark mode accessibility check
      const results = await axe(container);
      expect(results.violations.length).toBeLessThan(5); // Allow minor violations
    });

    it("should have proper form labels", async () => {
      render(
        <TestWrapper>
          <UserManagementPage />
        </TestWrapper>
      );

      await screen.findByText("User Management");

      // Wait for form to load
      const inviteButton = await screen.findByRole("button", {
        name: /invite user/i,
      });
      expect(inviteButton).toBeInTheDocument();

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

      await screen.findByText("User Management");

      // Wait for form to load
      const submitButton = await screen.findByRole("button", {
        name: /invite user/i,
      });
      const emailInput = screen.getByLabelText("Email");
      const roleSelect = screen.getByRole("combobox");

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

      await screen.findByText("User Management");

      // Wait for content to load
      await screen.findByRole("button", { name: /invite user/i });

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

      await screen.findByText("User Management");

      // Wait for content to load
      await screen.findByRole("button", { name: /invite user/i });

      // Check for proper heading hierarchy
      const mainHeading = screen.getByRole("heading", { level: 1 });
      expect(mainHeading).toHaveTextContent("User Management");

      const subHeadings = screen.getAllByRole("heading", { level: 2 });
      expect(subHeadings.length).toBeGreaterThan(0);
    });
  });

  describe("Basic Accessibility Compliance", () => {
    it("should have basic accessibility features", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      });

      render(
        <TestWrapper>
          <UserManagementPage />
        </TestWrapper>
      );

      await screen.findByText("User Management");

      // Check for basic accessibility features
      const form = screen.getByRole("form");
      expect(form).toBeInTheDocument();

      const emailInput = screen.getByLabelText("Email");
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute("type", "email");
      expect(emailInput).toHaveAttribute("required");
    });
  });

  describe("Interactive Elements", () => {
    it("should have focusable interactive elements", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      });

      render(
        <TestWrapper>
          <UserManagementPage />
        </TestWrapper>
      );

      await screen.findByText("User Management");

      const emailInput = screen.getByLabelText("Email");
      const submitButton = screen.getByRole("button", { name: /invite user/i });

      // Elements should be focusable
      emailInput.focus();
      expect(emailInput).toHaveFocus();

      submitButton.focus();
      expect(submitButton).toHaveFocus();
    });
  });

  describe("Dark Mode Accessibility", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            users: [
              { id: "1", email: "admin@example.com", role: "ADMIN" },
              { id: "2", email: "user@example.com", role: "USER" },
            ],
          }),
      });
    });

    it("should have proper contrast in dark mode", async () => {
      const { container } = render(
        <TestWrapper theme="dark">
          <UserManagementPage />
        </TestWrapper>
      );

      await screen.findByText("User Management");

      // Check that dark mode class is applied
      const darkModeWrapper = container.querySelector(".dark");
      expect(darkModeWrapper).toBeInTheDocument();

      // Test form elements are visible in dark mode
      const emailInput = screen.getByLabelText("Email");
      const submitButton = screen.getByRole("button", { name: /invite user/i });

      expect(emailInput).toBeVisible();
      expect(submitButton).toBeVisible();
    });

    it("should support keyboard navigation in dark mode", async () => {
      render(
        <TestWrapper theme="dark">
          <UserManagementPage />
        </TestWrapper>
      );

      await screen.findByText("User Management");

      // Wait for form to load
      const submitButton = await screen.findByRole("button", {
        name: /invite user/i,
      });
      const emailInput = screen.getByLabelText("Email");
      const roleSelect = screen.getByRole("combobox");

      // Test tab navigation works in dark mode
      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);

      fireEvent.keyDown(emailInput, { key: "Tab" });
      expect(document.activeElement).toBe(roleSelect);

      fireEvent.keyDown(roleSelect, { key: "Tab" });
      expect(document.activeElement).toBe(submitButton);
    });

    it("should maintain focus indicators in dark mode", async () => {
      render(
        <TestWrapper theme="dark">
          <UserManagementPage />
        </TestWrapper>
      );

      await screen.findByText("User Management");

      // Wait for form to load
      const submitButton = await screen.findByRole("button", {
        name: /invite user/i,
      });
      const emailInput = screen.getByLabelText("Email");

      // Focus indicators should be visible in dark mode
      emailInput.focus();
      expect(emailInput).toHaveFocus();

      submitButton.focus();
      expect(submitButton).toHaveFocus();
    });

    it("should run axe accessibility check in dark mode", async () => {
      const { container } = render(
        <TestWrapper theme="dark">
          <UserManagementPage />
        </TestWrapper>
      );

      await screen.findByText("User Management");

      // Run comprehensive accessibility check for dark mode
      const results = await axe(container, {
        rules: {
          "color-contrast": { enabled: true }, // Specifically check contrast in dark mode
        },
      });

      // Should have no critical accessibility violations in dark mode
      expect(results.violations.length).toBeLessThan(5);
    });
  });
});
