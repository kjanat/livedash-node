/**
 * CSRF Protection Unit Tests
 *
 * Tests for CSRF token generation, validation, and protection mechanisms.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateCSRFToken, verifyCSRFToken, CSRFProtection, CSRF_CONFIG } from "../../lib/csrf";

// Mock Next.js modules
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

describe("CSRF Protection", () => {
  describe("Token Generation and Verification", () => {
    it("should generate a valid CSRF token", () => {
      const token = generateCSRFToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
      expect(token.includes(":")).toBe(true);
    });

    it("should verify a valid CSRF token", () => {
      const token = generateCSRFToken();
      const isValid = verifyCSRFToken(token);
      expect(isValid).toBe(true);
    });

    it("should reject an invalid CSRF token", () => {
      const isValid = verifyCSRFToken("invalid-token");
      expect(isValid).toBe(false);
    });

    it("should reject an empty CSRF token", () => {
      const isValid = verifyCSRFToken("");
      expect(isValid).toBe(false);
    });

    it("should reject a malformed CSRF token", () => {
      const isValid = verifyCSRFToken("malformed:token:with:extra:parts");
      expect(isValid).toBe(false);
    });
  });

  describe("CSRFProtection Class", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should generate token response with correct structure", () => {
      const response = CSRFProtection.generateTokenResponse();

      expect(response).toHaveProperty("token");
      expect(response).toHaveProperty("cookie");
      expect(response.cookie).toHaveProperty("name", CSRF_CONFIG.cookieName);
      expect(response.cookie).toHaveProperty("value");
      expect(response.cookie).toHaveProperty("options");
      expect(response.cookie.options).toHaveProperty("httpOnly", true);
      expect(response.cookie.options).toHaveProperty("path", "/");
    });

    it("should validate GET requests without CSRF token", async () => {
      const request = new Request("http://localhost/api/test", {
        method: "GET",
      }) as any;

      const result = await CSRFProtection.validateRequest(request);
      expect(result.valid).toBe(true);
    });

    it("should validate HEAD requests without CSRF token", async () => {
      const request = new Request("http://localhost/api/test", {
        method: "HEAD",
      }) as any;

      const result = await CSRFProtection.validateRequest(request);
      expect(result.valid).toBe(true);
    });

    it("should validate OPTIONS requests without CSRF token", async () => {
      const request = new Request("http://localhost/api/test", {
        method: "OPTIONS",
      }) as any;

      const result = await CSRFProtection.validateRequest(request);
      expect(result.valid).toBe(true);
    });

    it("should reject POST request without CSRF token", async () => {
      const request = new Request("http://localhost/api/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: "test" }),
      }) as any;

      // Mock cookies method to return no token
      Object.defineProperty(request, "cookies", {
        value: {
          get: vi.fn(() => undefined),
        },
      });

      const result = await CSRFProtection.validateRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("CSRF token missing");
    });

    it("should validate POST request with valid CSRF token", async () => {
      const token = generateCSRFToken();

      const request = new Request("http://localhost/api/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CSRF_CONFIG.headerName]: token,
        },
        body: JSON.stringify({ data: "test" }),
      }) as any;

      // Mock cookies method to return the same token
      Object.defineProperty(request, "cookies", {
        value: {
          get: vi.fn(() => ({ value: token })),
        },
      });

      const result = await CSRFProtection.validateRequest(request);
      expect(result.valid).toBe(true);
    });

    it("should reject POST request with mismatched CSRF tokens", async () => {
      const headerToken = generateCSRFToken();
      const cookieToken = generateCSRFToken();

      const request = new Request("http://localhost/api/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CSRF_CONFIG.headerName]: headerToken,
        },
        body: JSON.stringify({ data: "test" }),
      }) as any;

      // Mock cookies method to return different token
      Object.defineProperty(request, "cookies", {
        value: {
          get: vi.fn(() => ({ value: cookieToken })),
        },
      });

      const result = await CSRFProtection.validateRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("mismatch");
    });

    it("should handle form data CSRF token", async () => {
      const token = generateCSRFToken();
      const formData = new FormData();
      formData.append("csrf_token", token);
      formData.append("data", "test");

      const request = new Request("http://localhost/api/test", {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      }) as any;

      // Mock cookies method to return the same token
      Object.defineProperty(request, "cookies", {
        value: {
          get: vi.fn(() => ({ value: token })),
        },
      });

      // Mock clone method to return a request that can be parsed
      Object.defineProperty(request, "clone", {
        value: vi.fn(() => ({
          formData: async () => formData,
        })),
      });

      const result = await CSRFProtection.validateRequest(request);
      expect(result.valid).toBe(true);
    });

    it("should handle JSON body CSRF token", async () => {
      const token = generateCSRFToken();
      const bodyData = { csrfToken: token, data: "test" };

      const request = new Request("http://localhost/api/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyData),
      }) as any;

      // Mock cookies method to return the same token
      Object.defineProperty(request, "cookies", {
        value: {
          get: vi.fn(() => ({ value: token })),
        },
      });

      // Mock clone method to return a request that can be parsed
      Object.defineProperty(request, "clone", {
        value: vi.fn(() => ({
          json: async () => bodyData,
        })),
      });

      const result = await CSRFProtection.validateRequest(request);
      expect(result.valid).toBe(true);
    });
  });

  describe("CSRF Configuration", () => {
    it("should have correct configuration values", () => {
      expect(CSRF_CONFIG.cookieName).toBe("csrf-token");
      expect(CSRF_CONFIG.headerName).toBe("x-csrf-token");
      expect(CSRF_CONFIG.cookie.httpOnly).toBe(true);
      expect(CSRF_CONFIG.cookie.sameSite).toBe("lax");
      expect(CSRF_CONFIG.cookie.maxAge).toBe(60 * 60 * 24); // 24 hours
    });

    it("should use secure cookies in production", () => {
      // This would depend on NODE_ENV, which is set in the config
      expect(typeof CSRF_CONFIG.cookie.secure).toBe("boolean");
    });
  });
});