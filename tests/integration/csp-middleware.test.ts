import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

// Mock the CSP utilities
vi.mock("@/lib/csp-server", () => ({
  buildCSP: vi.fn(({ nonce, isDevelopment, reportUri }) => {
    const base = "default-src 'self'; object-src 'none'";
    const script = isDevelopment
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
      : nonce
        ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
        : "script-src 'self'";
    const style = nonce
      ? `style-src 'self' 'nonce-${nonce}'`
      : "style-src 'self' 'unsafe-inline'";
    const report = reportUri ? `report-uri ${reportUri}` : "";

    return [base, script, style, report].filter(Boolean).join("; ");
  }),
  generateNonce: vi.fn(() => "test-nonce-12345"),
}));

describe("CSP Middleware Integration", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  function createMockRequest(url: string, options: RequestInit = {}) {
    return new NextRequest(url, options);
  }

  describe("Route Filtering", () => {
    it("should skip CSP for API routes (except csp-report)", async () => {
      const request = createMockRequest("https://example.com/api/auth/signin");
      const response = await middleware(request);

      expect(response.headers.get("Content-Security-Policy")).toBeNull();
    });

    it("should apply CSP to csp-report endpoint", async () => {
      const request = createMockRequest("https://example.com/api/csp-report");
      const response = await middleware(request);

      expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
    });

    it("should skip CSP for static assets", async () => {
      const staticAssets = [
        "https://example.com/_next/static/chunks/main.js",
        "https://example.com/_next/image/favicon.ico",
        "https://example.com/favicon.ico",
        "https://example.com/logo.png",
      ];

      for (const url of staticAssets) {
        const request = createMockRequest(url);
        const response = await middleware(request);

        expect(response.headers.get("Content-Security-Policy")).toBeNull();
      }
    });

    it("should apply CSP to page routes", async () => {
      const pageRoutes = [
        "https://example.com/",
        "https://example.com/dashboard",
        "https://example.com/platform/settings",
      ];

      for (const url of pageRoutes) {
        const request = createMockRequest(url);
        const response = await middleware(request);

        expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
      }
    });
  });

  describe("Development vs Production CSP", () => {
    it("should use permissive CSP in development", async () => {
      process.env.NODE_ENV = "development";

      const request = createMockRequest("https://example.com/");
      const response = await middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("'unsafe-eval'");
      expect(csp).toContain("'unsafe-inline'");
    });

    it("should use strict CSP in production", async () => {
      process.env.NODE_ENV = "production";

      const request = createMockRequest("https://example.com/");
      const response = await middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("'nonce-test-nonce-12345'");
      expect(csp).toContain("'strict-dynamic'");
      expect(csp).not.toContain("'unsafe-eval'");
    });
  });

  describe("Security Headers", () => {
    it("should set all required security headers", async () => {
      const request = createMockRequest("https://example.com/");
      const response = await middleware(request);

      const expectedHeaders = [
        "Content-Security-Policy",
        "X-Nonce",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "X-XSS-Protection",
        "Referrer-Policy",
        "X-DNS-Prefetch-Control",
        "Permissions-Policy",
        "X-Permitted-Cross-Domain-Policies",
        "Cross-Origin-Embedder-Policy",
        "Cross-Origin-Opener-Policy",
        "Cross-Origin-Resource-Policy",
      ];

      for (const header of expectedHeaders) {
        expect(response.headers.get(header)).toBeTruthy();
      }
    });

    it("should set HSTS only in production", async () => {
      // Test development
      process.env.NODE_ENV = "development";
      let request = createMockRequest("https://example.com/");
      let response = await middleware(request);
      expect(response.headers.get("Strict-Transport-Security")).toBeNull();

      // Test production
      process.env.NODE_ENV = "production";
      request = createMockRequest("https://example.com/");
      response = await middleware(request);
      expect(response.headers.get("Strict-Transport-Security")).toBeTruthy();
    });

    it("should set correct header values", async () => {
      const request = createMockRequest("https://example.com/");
      const response = await middleware(request);

      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block");
      expect(response.headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin"
      );
      expect(response.headers.get("X-DNS-Prefetch-Control")).toBe("off");
    });

    it("should set enhanced Permissions Policy", async () => {
      const request = createMockRequest("https://example.com/");
      const response = await middleware(request);

      const permissionsPolicy = response.headers.get("Permissions-Policy");

      // Check for restrictive permissions
      expect(permissionsPolicy).toContain("camera=()");
      expect(permissionsPolicy).toContain("microphone=()");
      expect(permissionsPolicy).toContain("geolocation=()");
      expect(permissionsPolicy).toContain("payment=()");
      expect(permissionsPolicy).toContain("usb=()");
      expect(permissionsPolicy).toContain("bluetooth=()");

      // Check for allowed permissions
      expect(permissionsPolicy).toContain("fullscreen=(self)");
      expect(permissionsPolicy).toContain("web-share=(self)");
      expect(permissionsPolicy).toContain("autoplay=(self)");
    });

    it("should set CORP headers correctly", async () => {
      const request = createMockRequest("https://example.com/");
      const response = await middleware(request);

      expect(response.headers.get("Cross-Origin-Embedder-Policy")).toBe(
        "require-corp"
      );
      expect(response.headers.get("Cross-Origin-Opener-Policy")).toBe(
        "same-origin"
      );
      expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe(
        "same-origin"
      );
    });
  });

  describe("Nonce Generation", () => {
    it("should generate and set nonce header", async () => {
      const request = createMockRequest("https://example.com/");
      const response = await middleware(request);

      const nonce = response.headers.get("X-Nonce");
      expect(nonce).toBe("test-nonce-12345");
    });

    it("should include nonce in CSP", async () => {
      process.env.NODE_ENV = "production";

      const request = createMockRequest("https://example.com/");
      const response = await middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("'nonce-test-nonce-12345'");
    });
  });

  describe("CSP Report URI", () => {
    it("should include report URI in CSP", async () => {
      const request = createMockRequest("https://example.com/");
      const response = await middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("report-uri /api/csp-report");
    });
  });

  describe("Edge Cases", () => {
    it("should handle requests without proper URL", async () => {
      const request = createMockRequest("https://example.com");
      const response = await middleware(request);

      // Should not throw and should return a response
      expect(response).toBeTruthy();
      expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
    });

    it("should handle multiple middleware calls", async () => {
      const request = createMockRequest("https://example.com/");

      const response1 = await middleware(request);
      const response2 = await middleware(request);

      // Both should have CSP headers
      expect(response1.headers.get("Content-Security-Policy")).toBeTruthy();
      expect(response2.headers.get("Content-Security-Policy")).toBeTruthy();

      // Nonces should be different (new nonce per request)
      expect(response1.headers.get("X-Nonce")).toBe("test-nonce-12345");
      expect(response2.headers.get("X-Nonce")).toBe("test-nonce-12345");
    });
  });

  describe("Performance", () => {
    it("should process requests quickly", async () => {
      const start = Date.now();

      const request = createMockRequest("https://example.com/");
      await middleware(request);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    it("should handle concurrent requests", async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        createMockRequest(`https://example.com/page-${i}`)
      );

      const responses = await Promise.all(
        requests.map((req) => middleware(req))
      );

      // All should have CSP headers
      responses.forEach((response) => {
        expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
        expect(response.headers.get("X-Nonce")).toBeTruthy();
      });
    });
  });
});
