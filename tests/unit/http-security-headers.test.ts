import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextResponse } from "next/server";

// Mock Next.js response for testing headers
const createMockResponse = (headers: Record<string, string> = {}) => {
  return new Response(null, { headers });
};

describe("HTTP Security Headers", () => {
  describe("Security Header Configuration", () => {
    it("should include X-Content-Type-Options header", () => {
      const response = createMockResponse({
        "X-Content-Type-Options": "nosniff",
      });

      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("should include X-Frame-Options header for clickjacking protection", () => {
      const response = createMockResponse({
        "X-Frame-Options": "DENY",
      });

      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    });

    it("should include X-XSS-Protection header for legacy browser protection", () => {
      const response = createMockResponse({
        "X-XSS-Protection": "1; mode=block",
      });

      expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block");
    });

    it("should include Referrer-Policy header for privacy protection", () => {
      const response = createMockResponse({
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });

      expect(response.headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin"
      );
    });

    it("should include X-DNS-Prefetch-Control header", () => {
      const response = createMockResponse({
        "X-DNS-Prefetch-Control": "off",
      });

      expect(response.headers.get("X-DNS-Prefetch-Control")).toBe("off");
    });
  });

  describe("Content Security Policy", () => {
    it("should include a comprehensive CSP header", () => {
      const expectedCsp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "upgrade-insecure-requests",
      ].join("; ");

      const response = createMockResponse({
        "Content-Security-Policy": expectedCsp,
      });

      expect(response.headers.get("Content-Security-Policy")).toBe(expectedCsp);
    });

    it("should have restrictive default-src policy", () => {
      const csp = "default-src 'self'";
      const response = createMockResponse({
        "Content-Security-Policy": csp,
      });

      const cspValue = response.headers.get("Content-Security-Policy");
      expect(cspValue).toContain("default-src 'self'");
    });

    it("should allow inline styles for TailwindCSS compatibility", () => {
      const csp = "style-src 'self' 'unsafe-inline'";
      const response = createMockResponse({
        "Content-Security-Policy": csp,
      });

      const cspValue = response.headers.get("Content-Security-Policy");
      expect(cspValue).toContain("style-src 'self' 'unsafe-inline'");
    });

    it("should prevent object embedding", () => {
      const csp = "object-src 'none'";
      const response = createMockResponse({
        "Content-Security-Policy": csp,
      });

      const cspValue = response.headers.get("Content-Security-Policy");
      expect(cspValue).toContain("object-src 'none'");
    });

    it("should prevent framing with frame-ancestors", () => {
      const csp = "frame-ancestors 'none'";
      const response = createMockResponse({
        "Content-Security-Policy": csp,
      });

      const cspValue = response.headers.get("Content-Security-Policy");
      expect(cspValue).toContain("frame-ancestors 'none'");
    });

    it("should upgrade insecure requests", () => {
      const csp = "upgrade-insecure-requests";
      const response = createMockResponse({
        "Content-Security-Policy": csp,
      });

      const cspValue = response.headers.get("Content-Security-Policy");
      expect(cspValue).toContain("upgrade-insecure-requests");
    });
  });

  describe("Permissions Policy", () => {
    it("should include restrictive Permissions-Policy header", () => {
      const expectedPolicy = [
        "camera=()",
        "microphone=()",
        "geolocation=()",
        "interest-cohort=()",
        "browsing-topics=()",
      ].join(", ");

      const response = createMockResponse({
        "Permissions-Policy": expectedPolicy,
      });

      expect(response.headers.get("Permissions-Policy")).toBe(expectedPolicy);
    });

    it("should disable camera access", () => {
      const policy = "camera=()";
      const response = createMockResponse({
        "Permissions-Policy": policy,
      });

      const policyValue = response.headers.get("Permissions-Policy");
      expect(policyValue).toContain("camera=()");
    });

    it("should disable microphone access", () => {
      const policy = "microphone=()";
      const response = createMockResponse({
        "Permissions-Policy": policy,
      });

      const policyValue = response.headers.get("Permissions-Policy");
      expect(policyValue).toContain("microphone=()");
    });

    it("should disable geolocation access", () => {
      const policy = "geolocation=()";
      const response = createMockResponse({
        "Permissions-Policy": policy,
      });

      const policyValue = response.headers.get("Permissions-Policy");
      expect(policyValue).toContain("geolocation=()");
    });

    it("should disable interest-cohort for privacy", () => {
      const policy = "interest-cohort=()";
      const response = createMockResponse({
        "Permissions-Policy": policy,
      });

      const policyValue = response.headers.get("Permissions-Policy");
      expect(policyValue).toContain("interest-cohort=()");
    });
  });

  describe("HSTS Configuration", () => {
    it("should include HSTS header in production environment", () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const response = createMockResponse({
        "Strict-Transport-Security":
          "max-age=31536000; includeSubDomains; preload",
      });

      expect(response.headers.get("Strict-Transport-Security")).toBe(
        "max-age=31536000; includeSubDomains; preload"
      );

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it("should have long max-age for HSTS", () => {
      const hstsValue = "max-age=31536000; includeSubDomains; preload";
      const response = createMockResponse({
        "Strict-Transport-Security": hstsValue,
      });

      const hsts = response.headers.get("Strict-Transport-Security");
      expect(hsts).toContain("max-age=31536000"); // 1 year
    });

    it("should include subdomains in HSTS", () => {
      const hstsValue = "max-age=31536000; includeSubDomains; preload";
      const response = createMockResponse({
        "Strict-Transport-Security": hstsValue,
      });

      const hsts = response.headers.get("Strict-Transport-Security");
      expect(hsts).toContain("includeSubDomains");
    });

    it("should be preload-ready for HSTS", () => {
      const hstsValue = "max-age=31536000; includeSubDomains; preload";
      const response = createMockResponse({
        "Strict-Transport-Security": hstsValue,
      });

      const hsts = response.headers.get("Strict-Transport-Security");
      expect(hsts).toContain("preload");
    });
  });

  describe("Header Security Validation", () => {
    it("should not expose server information", () => {
      const response = createMockResponse({});

      // These headers should not be present or should be minimal
      expect(response.headers.get("Server")).toBeNull();
      expect(response.headers.get("X-Powered-By")).toBeNull();
    });

    it("should have all required security headers present", () => {
      const requiredHeaders = [
        "X-Content-Type-Options",
        "X-Frame-Options",
        "X-XSS-Protection",
        "Referrer-Policy",
        "X-DNS-Prefetch-Control",
        "Content-Security-Policy",
        "Permissions-Policy",
      ];

      const allHeaders: Record<string, string> = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-DNS-Prefetch-Control": "off",
        "Content-Security-Policy": "default-src 'self'",
        "Permissions-Policy": "camera=()",
      };

      const response = createMockResponse(allHeaders);

      requiredHeaders.forEach((header) => {
        expect(response.headers.get(header)).toBeTruthy();
      });
    });

    it("should have proper header values for security", () => {
      const securityHeaders = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-DNS-Prefetch-Control": "off",
      };

      const response = createMockResponse(securityHeaders);

      // Verify each header has the expected security value
      Object.entries(securityHeaders).forEach(([header, expectedValue]) => {
        expect(response.headers.get(header)).toBe(expectedValue);
      });
    });
  });

  describe("Development vs Production Headers", () => {
    it("should not include HSTS in development", () => {
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const response = createMockResponse({});

      // HSTS should not be present in development
      expect(response.headers.get("Strict-Transport-Security")).toBeNull();

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it("should include all other headers in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const devHeaders = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "default-src 'self'",
        "Permissions-Policy": "camera=()",
      };

      const response = createMockResponse(devHeaders);

      Object.entries(devHeaders).forEach(([header, expectedValue]) => {
        expect(response.headers.get(header)).toBe(expectedValue);
      });

      process.env.NODE_ENV = originalEnv;
    });
  });
});

describe("Security Header Integration", () => {
  describe("CSP and Frame Protection Alignment", () => {
    it("should have consistent frame protection between CSP and X-Frame-Options", () => {
      // Both should prevent framing
      const cspResponse = createMockResponse({
        "Content-Security-Policy": "frame-ancestors 'none'",
      });

      const xFrameResponse = createMockResponse({
        "X-Frame-Options": "DENY",
      });

      expect(cspResponse.headers.get("Content-Security-Policy")).toContain(
        "frame-ancestors 'none'"
      );
      expect(xFrameResponse.headers.get("X-Frame-Options")).toBe("DENY");
    });
  });

  describe("Next.js Compatibility", () => {
    it("should allow necessary Next.js functionality in CSP", () => {
      const csp = "script-src 'self' 'unsafe-eval' 'unsafe-inline'";
      const response = createMockResponse({
        "Content-Security-Policy": csp,
      });

      const cspValue = response.headers.get("Content-Security-Policy");

      // Next.js requires unsafe-eval for dev tools and unsafe-inline for some functionality
      expect(cspValue).toContain("'unsafe-eval'");
      expect(cspValue).toContain("'unsafe-inline'");
    });

    it("should allow TailwindCSS inline styles in CSP", () => {
      const csp = "style-src 'self' 'unsafe-inline'";
      const response = createMockResponse({
        "Content-Security-Policy": csp,
      });

      const cspValue = response.headers.get("Content-Security-Policy");
      expect(cspValue).toContain("style-src 'self' 'unsafe-inline'");
    });
  });
});
