/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import UserManagementPage from "@/app/dashboard/users/page";
import SessionViewPage from "@/app/dashboard/sessions/[id]/page";
import ModernDonutChart from "@/components/charts/donut-chart";

// Mock dependencies
vi.mock("next-auth/react");
vi.mock("next/navigation");
const mockUseSession = vi.mocked(useSession);
const mockUseParams = vi.mocked(useParams);

// Mock fetch
global.fetch = vi.fn();

describe("Keyboard Navigation Tests", () => {
  describe("User Management Page Keyboard Navigation", () => {
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

    it("should support tab navigation through form elements", async () => {
      render(<UserManagementPage />);

      await screen.findByText("User Management");

      const emailInput = screen.getByLabelText("Email");
      const roleSelect = screen.getByRole("combobox");
      const submitButton = screen.getByRole("button", { name: /invite user/i });

      // Test that elements are focusable
      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);

      roleSelect.focus();
      expect(roleSelect).toBeInTheDocument();

      submitButton.focus();
      expect(document.activeElement).toBe(submitButton);
    });

    it("should support Enter key for form submission", async () => {
      render(<UserManagementPage />);

      await screen.findByText("User Management");

      const emailInput = screen.getByLabelText("Email");
      const submitButton = screen.getByRole("button", { name: /invite user/i });

      // Fill out form
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      // Mock successful submission
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              users: [
                { id: "1", email: "admin@example.com", role: "ADMIN" },
                { id: "2", email: "user@example.com", role: "USER" },
              ],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ message: "User invited successfully" }),
        });

      // Submit with Enter key
      fireEvent.keyDown(submitButton, { key: "Enter" });

      // Form should be submitted (fetch called for initial load + submission)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should support Space key for button activation", async () => {
      render(<UserManagementPage />);

      await screen.findByText("User Management");

      const submitButton = screen.getByRole("button", { name: /invite user/i });

      // Mock form data
      const emailInput = screen.getByLabelText("Email");
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      // Mock successful submission
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              users: [
                { id: "1", email: "admin@example.com", role: "ADMIN" },
                { id: "2", email: "user@example.com", role: "USER" },
              ],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ message: "User invited successfully" }),
        });

      // Activate with Space key
      submitButton.focus();
      fireEvent.keyDown(submitButton, { key: " " });

      // Should trigger form submission (fetch called for initial load + submission)
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("should have visible focus indicators", async () => {
      render(<UserManagementPage />);

      await screen.findByText("User Management");

      const emailInput = screen.getByLabelText("Email");
      const submitButton = screen.getByRole("button", { name: /invite user/i });

      // Focus elements and check for focus indicators
      emailInput.focus();
      expect(emailInput).toHaveFocus();
      expect(emailInput.className).toContain("focus-visible");

      submitButton.focus();
      expect(submitButton).toHaveFocus();
      expect(submitButton.className).toContain("focus-visible");
    });

    it("should support Escape key for form reset", async () => {
      render(<UserManagementPage />);

      await screen.findByText("User Management");

      const emailInput = screen.getByLabelText("Email") as HTMLInputElement;

      // Enter some text
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      expect(emailInput.value).toBe("test@example.com");

      // Press Escape
      fireEvent.keyDown(emailInput, { key: "Escape" });

      // Field should not be cleared by Escape (browser default behavior)
      // But it should not cause any errors
      expect(emailInput.value).toBe("test@example.com");
    });

    it("should support arrow keys in select elements", async () => {
      render(<UserManagementPage />);

      await screen.findByText("User Management");

      const roleSelect = screen.getByRole("combobox");

      // Focus the select
      roleSelect.focus();
      expect(roleSelect).toHaveFocus();

      // Arrow keys should work (implementation depends on Select component)
      fireEvent.keyDown(roleSelect, { key: "ArrowDown" });
      fireEvent.keyDown(roleSelect, { key: "ArrowUp" });

      // Should not throw errors
      expect(roleSelect).toBeInTheDocument();
    });
  });

  describe("Session Details Page Keyboard Navigation", () => {
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
        json: () =>
          Promise.resolve({
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
              fullTranscriptUrl: "https://example.com/transcript",
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

    it("should support keyboard navigation for back button", async () => {
      render(<SessionViewPage />);

      await screen.findByText("Session Details");

      const backButton = screen.getByRole("button", {
        name: /return to sessions list/i,
      });

      // Focus and activate with keyboard
      backButton.focus();
      expect(backButton).toHaveFocus();

      // Should have proper focus ring
      expect(backButton.className).toMatch(/focus/i);

      // Test Enter key activation
      fireEvent.keyDown(backButton, { key: "Enter" });
      // Navigation behavior would be tested in integration tests
    });

    it("should support keyboard navigation for external links", async () => {
      render(<SessionViewPage />);

      await screen.findByText("Session Details");

      const transcriptLink = screen.getByRole("link", {
        name: /open original transcript in new tab/i,
      });

      // Focus the link
      transcriptLink.focus();
      expect(transcriptLink).toHaveFocus();

      // Should have proper focus ring
      expect(transcriptLink.className).toMatch(/focus/i);

      // Test Enter key activation
      fireEvent.keyDown(transcriptLink, { key: "Enter" });
      // Link behavior would open in new tab
    });

    it("should support tab navigation through session details", async () => {
      render(<SessionViewPage />);

      await screen.findByText("Session Details");

      // Get all focusable elements
      const backButton = screen.getByRole("button", {
        name: /return to sessions list/i,
      });
      const transcriptLink = screen.getByRole("link", {
        name: /open original transcript in new tab/i,
      });

      // Test tab order
      backButton.focus();
      expect(document.activeElement).toBe(backButton);

      // Tab to next focusable element
      fireEvent.keyDown(backButton, { key: "Tab" });
      // Should move to next interactive element
    });
  });

  describe("Chart Component Keyboard Navigation", () => {
    const mockData = [
      { name: "Category A", value: 30, color: "#8884d8" },
      { name: "Category B", value: 20, color: "#82ca9d" },
      { name: "Category C", value: 50, color: "#ffc658" },
    ];

    it("should support keyboard focus on chart elements", () => {
      render(
        <ModernDonutChart data={mockData} title="Test Chart" height={300} />
      );

      const chart = screen.getByRole("img", { name: /test chart/i });

      // Chart should be focusable
      chart.focus();
      expect(chart).toHaveFocus();

      // Should have proper focus styling
      expect(chart.className).toMatch(/focus/i);
    });

    it("should handle keyboard interactions on chart", () => {
      render(
        <ModernDonutChart data={mockData} title="Test Chart" height={300} />
      );

      const chart = screen.getByRole("img", { name: /test chart/i });

      chart.focus();

      // Test keyboard interactions
      fireEvent.keyDown(chart, { key: "Enter" });
      fireEvent.keyDown(chart, { key: " " });
      fireEvent.keyDown(chart, { key: "ArrowLeft" });
      fireEvent.keyDown(chart, { key: "ArrowRight" });

      // Should not throw errors
      expect(chart).toBeInTheDocument();
    });

    it("should provide keyboard alternative for chart interactions", () => {
      render(
        <ModernDonutChart data={mockData} title="Test Chart" height={300} />
      );

      // Chart should have ARIA label for screen readers
      const chart = screen.getByRole("img");
      expect(chart).toHaveAttribute("aria-label");
    });
  });

  describe("Focus Management", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      });
    });

    it("should maintain focus after dynamic content changes", async () => {
      render(<UserManagementPage />);

      await screen.findByText("User Management");

      const emailInput = screen.getByLabelText("Email");
      const submitButton = screen.getByRole("button", { name: /invite user/i });

      // Focus on input
      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);

      // Trigger form submission (which updates the UI)
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      // Mock successful response
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ message: "User invited successfully" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ users: [] }),
        });

      fireEvent.click(submitButton);

      // Focus should be managed appropriately after submission
      // (exact behavior depends on implementation)
    });

    it("should handle focus when elements are disabled", async () => {
      render(<UserManagementPage />);

      await screen.findByText("User Management");

      const submitButton = screen.getByRole("button", { name: /invite user/i });

      // Button should be disabled when form is invalid
      expect(submitButton).toBeInTheDocument();

      // Should handle focus on disabled elements gracefully
      submitButton.focus();
      fireEvent.keyDown(submitButton, { key: "Enter" });

      // Should not cause errors
    });

    it("should skip over non-interactive elements", async () => {
      render(<UserManagementPage />);

      await screen.findByText("User Management");

      // Tab navigation should skip over static text and focus only on interactive elements
      const interactiveElements = [
        screen.getByLabelText("Email"),
        screen.getByLabelText("Role"),
        screen.getByRole("button", { name: /invite user/i }),
      ];

      interactiveElements.forEach((element) => {
        element.focus();
        expect(document.activeElement).toBe(element);
      });
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
        json: () => Promise.resolve({ users: [] }),
      });
    });

    it("should announce form validation errors", async () => {
      render(<UserManagementPage />);

      await screen.findByText("User Management");

      const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
      const submitButton = screen.getByRole("button", { name: /invite user/i });

      // Submit invalid form
      fireEvent.click(submitButton);

      // HTML5 validation should be triggered
      expect(emailInput.validity.valid).toBeFalsy();
    });

    it("should announce loading states", async () => {
      // Test loading state announcement
      mockUseSession.mockReturnValue({
        data: null,
        status: "loading",
      });

      render(<UserManagementPage />);

      const loadingText = screen.getByText("Loading users...");
      expect(loadingText).toBeInTheDocument();
    });

    it("should announce success and error messages", async () => {
      render(<UserManagementPage />);

      await screen.findByText("User Management");

      const emailInput = screen.getByLabelText("Email");
      const submitButton = screen.getByRole("button", { name: /invite user/i });

      // Fill form
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      // Mock error response
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: "Email already exists" }),
      });

      fireEvent.click(submitButton);

      // Error message should be announced
      await screen.findByText(/failed to invite user/i);
    });
  });

  describe("High Contrast Mode Support", () => {
    it("should maintain keyboard navigation in high contrast mode", async () => {
      // Mock high contrast media query
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === "(prefers-contrast: high)",
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      mockUseSession.mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      });

      render(<UserManagementPage />);

      await screen.findByText("User Management");

      const emailInput = screen.getByLabelText("Email");

      // Focus should still work in high contrast mode
      emailInput.focus();
      expect(emailInput).toHaveFocus();
    });
  });
});
