/**
 * CSRF Hooks Tests
 *
 * Tests for React hooks that manage CSRF tokens on the client side.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCSRF, useCSRFFetch, useCSRFForm } from "../../lib/hooks/useCSRF";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock document.cookie
Object.defineProperty(document, "cookie", {
  writable: true,
  value: "",
});

describe("CSRF Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "";
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("useCSRF", () => {
    it("should initialize with loading state", () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, token: "test-token" }),
      });

      const { result } = renderHook(() => useCSRF());

      expect(result.current.loading).toBe(true);
      expect(result.current.token).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("should fetch token on mount when no cookie exists", async () => {
      const mockToken = "test-csrf-token";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, token: mockToken }),
      });

      const { result } = renderHook(() => useCSRF());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/csrf-token", {
        method: "GET",
        credentials: "include",
      });
      expect(result.current.token).toBe(mockToken);
      expect(result.current.error).toBeNull();
    });

    it("should use existing token from cookies", async () => {
      const existingToken = "existing-csrf-token";
      document.cookie = `csrf-token=${existingToken}`;

      // Mock fetch to ensure it's not called when token exists
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, token: "should-not-be-used" }),
      });

      const { result } = renderHook(() => useCSRF());

      await waitFor(() => {
        expect(result.current.token).toBe(existingToken);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not fetch from server if cookie exists
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle fetch errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useCSRF());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.token).toBeNull();
    });

    it("should handle invalid response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false }),
      });

      const { result } = renderHook(() => useCSRF());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.token).toBeNull();
    });

    it("should refresh token manually", async () => {
      const newToken = "refreshed-csrf-token";
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, token: "initial-token" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, token: newToken }),
        });

      const { result } = renderHook(() => useCSRF());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.refreshToken();

      await waitFor(() => {
        expect(result.current.token).toBe(newToken);
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("useCSRFFetch", () => {
    it("should add CSRF token to POST requests", async () => {
      const token = "test-token";
      document.cookie = `csrf-token=${token}`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { result } = renderHook(() => useCSRFFetch());

      await waitFor(() => {
        expect(result.current.token).toBe(token);
      });

      await result.current.csrfFetch("/api/test", {
        method: "POST",
        body: JSON.stringify({ data: "test" }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          headers: expect.objectContaining({
            "x-csrf-token": token,
          }),
        })
      );
    });

    it("should not add CSRF token to GET requests", async () => {
      const token = "test-token";
      document.cookie = `csrf-token=${token}`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { result } = renderHook(() => useCSRFFetch());

      await waitFor(() => {
        expect(result.current.token).toBe(token);
      });

      await result.current.csrfFetch("/api/test", {
        method: "GET",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          method: "GET",
          credentials: "include",
        })
      );

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers?.["x-csrf-token"]).toBeUndefined();
    });

    it("should handle missing token gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { result } = renderHook(() => useCSRFFetch());

      await result.current.csrfFetch("/api/test", {
        method: "POST",
        body: JSON.stringify({ data: "test" }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );
    });
  });

  describe("useCSRFForm", () => {
    it("should add CSRF token to form data", async () => {
      const token = "test-token";
      document.cookie = `csrf-token=${token}`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { result } = renderHook(() => useCSRFForm());

      await waitFor(() => {
        expect(result.current.token).toBe(token);
      });

      const formData = new FormData();
      formData.append("data", "test");

      await result.current.submitForm("/api/test", formData);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: expect.any(FormData),
        })
      );

      const callArgs = mockFetch.mock.calls[0][1];
      const submittedFormData = callArgs.body as FormData;
      expect(submittedFormData.get("csrf_token")).toBe(token);
    });

    it("should add CSRF token to JSON data", async () => {
      const token = "test-token";
      document.cookie = `csrf-token=${token}`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { result } = renderHook(() => useCSRFForm());

      await waitFor(() => {
        expect(result.current.token).toBe(token);
      });

      const data = { data: "test" };

      await result.current.submitJSON("/api/test", data);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ ...data, csrfToken: token }),
        })
      );
    });

    it("should handle missing token in form submission", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { result } = renderHook(() => useCSRFForm());

      const formData = new FormData();
      formData.append("data", "test");

      await result.current.submitForm("/api/test", formData);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: expect.any(FormData),
        })
      );
    });
  });
});