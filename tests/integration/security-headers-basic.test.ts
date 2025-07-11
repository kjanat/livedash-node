import { describe, it, expect } from "vitest";

describe("Security Headers Configuration", () => {
  describe("Next.js Config Validation", () => {
    it("should have valid security headers configuration", async () => {
      // Import the Next.js config
      const nextConfig = await import("../../next.config.js");

      expect(nextConfig.default).toBeDefined();
      expect(nextConfig.default.headers).toBeDefined();
      expect(typeof nextConfig.default.headers).toBe("function");
    });

    it("should generate expected headers structure", async () => {
      const nextConfig = await import("../../next.config.js");
      const headers = await nextConfig.default.headers();

      expect(Array.isArray(headers)).toBe(true);
      expect(headers.length).toBeGreaterThan(0);

      // Find the main security headers configuration
      const securityConfig = headers.find(
        (h) => h.source === "/(.*)" && h.headers.length > 1
      );
      expect(securityConfig).toBeDefined();

      if (securityConfig) {
        const headerNames = securityConfig.headers.map((h) => h.key);

        // Check required security headers are present
        expect(headerNames).toContain("X-Content-Type-Options");
        expect(headerNames).toContain("X-Frame-Options");
        expect(headerNames).toContain("X-XSS-Protection");
        expect(headerNames).toContain("Referrer-Policy");
        expect(headerNames).toContain("Content-Security-Policy");
        expect(headerNames).toContain("Permissions-Policy");
        expect(headerNames).toContain("X-DNS-Prefetch-Control");
      }
    });

    it("should have correct security header values", async () => {
      const nextConfig = await import("../../next.config.js");
      const headers = await nextConfig.default.headers();

      const securityConfig = headers.find(
        (h) => h.source === "/(.*)" && h.headers.length > 1
      );

      if (securityConfig) {
        const headerMap = new Map(
          securityConfig.headers.map((h) => [h.key, h.value])
        );

        expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
        expect(headerMap.get("X-Frame-Options")).toBe("DENY");
        expect(headerMap.get("X-XSS-Protection")).toBe("1; mode=block");
        expect(headerMap.get("Referrer-Policy")).toBe(
          "strict-origin-when-cross-origin"
        );
        expect(headerMap.get("X-DNS-Prefetch-Control")).toBe("off");

        // CSP should contain essential directives
        const csp = headerMap.get("Content-Security-Policy");
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).toContain("object-src 'none'");

        // Permissions Policy should restrict dangerous features
        const permissions = headerMap.get("Permissions-Policy");
        expect(permissions).toContain("camera=()");
        expect(permissions).toContain("microphone=()");
        expect(permissions).toContain("geolocation=()");
      }
    });

    it("should handle HSTS header based on environment", async () => {
      const nextConfig = await import("../../next.config.js");

      // Test production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const prodHeaders = await nextConfig.default.headers();
      const hstsConfig = prodHeaders.find((h) =>
        h.headers.some((header) => header.key === "Strict-Transport-Security")
      );

      if (hstsConfig) {
        const hstsHeader = hstsConfig.headers.find(
          (h) => h.key === "Strict-Transport-Security"
        );
        expect(hstsHeader?.value).toBe(
          "max-age=31536000; includeSubDomains; preload"
        );
      }

      // Test development environment
      process.env.NODE_ENV = "development";

      const devHeaders = await nextConfig.default.headers();
      const devHstsConfig = devHeaders.find((h) =>
        h.headers.some((header) => header.key === "Strict-Transport-Security")
      );

      // In development, HSTS header array should be empty
      if (devHstsConfig) {
        expect(devHstsConfig.headers.length).toBe(0);
      }

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("CSP Directive Validation", () => {
    it("should have comprehensive CSP directives", async () => {
      const nextConfig = await import("../../next.config.js");
      const headers = await nextConfig.default.headers();

      const securityConfig = headers.find(
        (h) => h.source === "/(.*)" && h.headers.length > 1
      );
      const cspHeader = securityConfig?.headers.find(
        (h) => h.key === "Content-Security-Policy"
      );

      expect(cspHeader).toBeDefined();

      if (cspHeader) {
        const csp = cspHeader.value;

        // Essential security directives
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'self'");
        expect(csp).toContain("form-action 'self'");
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).toContain("upgrade-insecure-requests");

        // Next.js compatibility directives
        expect(csp).toContain(
          "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
        );
        expect(csp).toContain("style-src 'self' 'unsafe-inline'");
        expect(csp).toContain("img-src 'self' data: https:");
        expect(csp).toContain("font-src 'self' data:");
        expect(csp).toContain("connect-src 'self' https:");
      }
    });
  });

  describe("Permissions Policy Validation", () => {
    it("should restrict dangerous browser features", async () => {
      const nextConfig = await import("../../next.config.js");
      const headers = await nextConfig.default.headers();

      const securityConfig = headers.find(
        (h) => h.source === "/(.*)" && h.headers.length > 1
      );
      const permissionsHeader = securityConfig?.headers.find(
        (h) => h.key === "Permissions-Policy"
      );

      expect(permissionsHeader).toBeDefined();

      if (permissionsHeader) {
        const permissions = permissionsHeader.value;

        // Should disable privacy-sensitive features
        expect(permissions).toContain("camera=()");
        expect(permissions).toContain("microphone=()");
        expect(permissions).toContain("geolocation=()");
        expect(permissions).toContain("interest-cohort=()");
        expect(permissions).toContain("browsing-topics=()");
      }
    });
  });
});
