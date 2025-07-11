import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST, OPTIONS } from "@/app/api/csp-report/route";
import { NextRequest } from "next/server";

// Mock rate limiter
vi.mock("@/lib/rateLimiter", () => ({
  rateLimiter: {
    check: vi.fn(() => Promise.resolve({ success: true, remaining: 9 })),
  },
}));

// Mock CSP utilities
vi.mock("@/lib/csp", () => ({
  parseCSPViolation: vi.fn((report) => ({
    directive: report["csp-report"]["violated-directive"],
    blockedUri: report["csp-report"]["blocked-uri"],
    sourceFile: report["csp-report"]["source-file"],
    lineNumber: report["csp-report"]["line-number"],
    isInlineViolation: report["csp-report"]["blocked-uri"] === "inline",
    isCritical:
      report["csp-report"]["violated-directive"].startsWith("script-src"),
  })),
  detectCSPBypass: vi.fn((content) => ({
    isDetected: content.includes("javascript:"),
    patterns: content.includes("javascript:") ? ["javascript:"] : [],
    riskLevel: content.includes("javascript:") ? "high" : "low",
  })),
}));

import { rateLimiter } from "@/lib/rateLimiter";
import { parseCSPViolation, detectCSPBypass } from "@/lib/csp";

describe("CSP Report Endpoint", () => {
  let originalEnv: string | undefined;
  let consoleSpy: any;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    consoleSpy.mockRestore();
  });

  function createCSPRequest(body: any, options: Partial<RequestInit> = {}) {
    return new NextRequest("https://example.com/api/csp-report", {
      method: "POST",
      headers: {
        "content-type": "application/csp-report",
        "x-forwarded-for": "192.168.1.1",
        "user-agent": "Mozilla/5.0 Test Browser",
        ...options.headers,
      },
      body: JSON.stringify(body),
      ...options,
    });
  }

  describe("POST /api/csp-report", () => {
    it("should accept valid CSP reports", async () => {
      const report = {
        "csp-report": {
          "document-uri": "https://example.com/page",
          referrer: "https://example.com/",
          "violated-directive": "script-src 'self'",
          "original-policy": "default-src 'self'; script-src 'self'",
          "blocked-uri": "https://evil.com/script.js",
          "source-file": "https://example.com/page",
          "line-number": 42,
          "column-number": 15,
        },
      };

      const request = createCSPRequest(report);
      const response = await POST(request);

      expect(response.status).toBe(204);
      expect(parseCSPViolation).toHaveBeenCalledWith(report);
      expect(detectCSPBypass).toHaveBeenCalled();
    });

    it("should handle rate limiting", async () => {
      vi.mocked(rateLimiter.check).mockResolvedValueOnce({
        success: false,
        remaining: 0,
      });

      const report = {
        "csp-report": {
          "document-uri": "https://example.com/page",
          referrer: "",
          "violated-directive": "script-src 'self'",
          "original-policy": "",
          "blocked-uri": "inline",
        },
      };

      const request = createCSPRequest(report);
      const response = await POST(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe("Too many CSP reports");
    });

    it("should validate content type", async () => {
      const report = { "csp-report": {} };
      const request = createCSPRequest(report, {
        headers: { "content-type": "text/plain" },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid content type");
    });

    it("should accept application/json content type", async () => {
      const report = {
        "csp-report": {
          "document-uri": "https://example.com/page",
          referrer: "",
          "violated-directive": "img-src 'self'",
          "original-policy": "",
          "blocked-uri": "https://evil.com/image.jpg",
        },
      };

      const request = createCSPRequest(report, {
        headers: { "content-type": "application/json" },
      });

      const response = await POST(request);
      expect(response.status).toBe(204);
    });

    it("should validate report format", async () => {
      const invalidReport = { invalid: "report" };
      const request = createCSPRequest(invalidReport);

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid CSP report format");
    });

    it("should log violations in development", async () => {
      process.env.NODE_ENV = "development";

      const report = {
        "csp-report": {
          "document-uri": "https://example.com/page",
          referrer: "",
          "violated-directive": "script-src 'self'",
          "original-policy": "",
          "blocked-uri": "inline",
        },
      };

      const request = createCSPRequest(report);
      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        "🚨 CSP Violation Detected:",
        expect.any(Object)
      );
    });

    it("should detect and alert critical violations", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      vi.mocked(parseCSPViolation).mockReturnValueOnce({
        directive: "script-src 'self'",
        blockedUri: "https://evil.com/script.js",
        sourceFile: "https://example.com/page",
        lineNumber: 42,
        isInlineViolation: false,
        isCritical: true,
      });

      const report = {
        "csp-report": {
          "document-uri": "https://example.com/page",
          referrer: "",
          "violated-directive": "script-src 'self'",
          "original-policy": "",
          "blocked-uri": "https://evil.com/script.js",
        },
      };

      const request = createCSPRequest(report);
      await POST(request);

      expect(errorSpy).toHaveBeenCalledWith(
        "🔴 CRITICAL CSP VIOLATION:",
        expect.objectContaining({
          directive: "script-src 'self'",
          blockedUri: "https://evil.com/script.js",
          isBypassAttempt: false,
          riskLevel: "low",
        })
      );

      errorSpy.mockRestore();
    });

    it("should detect bypass attempts and alert", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      vi.mocked(detectCSPBypass).mockReturnValueOnce({
        isDetected: true,
        patterns: ["javascript:"],
        riskLevel: "high",
      });

      const report = {
        "csp-report": {
          "document-uri": "https://example.com/page",
          referrer: "",
          "violated-directive": "script-src 'self'",
          "original-policy": "",
          "blocked-uri": "javascript:alert(1)",
          "script-sample": "javascript:alert(1)",
        },
      };

      const request = createCSPRequest(report);
      await POST(request);

      expect(errorSpy).toHaveBeenCalledWith(
        "🔴 CRITICAL CSP VIOLATION:",
        expect.objectContaining({
          isBypassAttempt: true,
          riskLevel: "high",
        })
      );

      errorSpy.mockRestore();
    });

    it("should handle malformed JSON", async () => {
      const request = new NextRequest("https://example.com/api/csp-report", {
        method: "POST",
        headers: {
          "content-type": "application/csp-report",
          "x-forwarded-for": "192.168.1.1",
        },
        body: "invalid json{",
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to process report");
    });

    it("should extract IP from different headers", async () => {
      const report = {
        "csp-report": {
          "document-uri": "https://example.com/page",
          referrer: "",
          "violated-directive": "img-src 'self'",
          "original-policy": "",
          "blocked-uri": "https://evil.com/image.jpg",
        },
      };

      // Test with request.ip
      const requestWithIp = new NextRequest(
        "https://example.com/api/csp-report",
        {
          method: "POST",
          headers: { "content-type": "application/csp-report" },
          body: JSON.stringify(report),
        }
      );
      Object.defineProperty(requestWithIp, "ip", { value: "10.0.0.1" });

      let response = await POST(requestWithIp);
      expect(response.status).toBe(204);

      // Test with x-forwarded-for header
      const requestWithHeader = createCSPRequest(report, {
        headers: {
          "content-type": "application/csp-report",
          "x-forwarded-for": "203.0.113.1",
        },
      });

      response = await POST(requestWithHeader);
      expect(response.status).toBe(204);

      // Verify rate limiting was called with correct IPs
      expect(rateLimiter.check).toHaveBeenCalledWith(
        "csp-report:10.0.0.1",
        10,
        60000
      );
      expect(rateLimiter.check).toHaveBeenCalledWith(
        "csp-report:203.0.113.1",
        10,
        60000
      );
    });

    it("should handle missing IP gracefully", async () => {
      const report = {
        "csp-report": {
          "document-uri": "https://example.com/page",
          referrer: "",
          "violated-directive": "img-src 'self'",
          "original-policy": "",
          "blocked-uri": "https://evil.com/image.jpg",
        },
      };

      const request = new NextRequest("https://example.com/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/csp-report" },
        body: JSON.stringify(report),
      });

      const response = await POST(request);
      expect(response.status).toBe(204);

      // Should use "unknown" as fallback IP
      expect(rateLimiter.check).toHaveBeenCalledWith(
        "csp-report:unknown",
        10,
        60000
      );
    });
  });

  describe("OPTIONS /api/csp-report", () => {
    it("should handle preflight requests", async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "POST, OPTIONS"
      );
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type"
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle rate limiter errors gracefully", async () => {
      vi.mocked(rateLimiter.check).mockRejectedValueOnce(
        new Error("Redis error")
      );

      const report = {
        "csp-report": {
          "document-uri": "https://example.com/page",
          referrer: "",
          "violated-directive": "script-src 'self'",
          "original-policy": "",
          "blocked-uri": "inline",
        },
      };

      const request = createCSPRequest(report);
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to process report");
    });

    it("should handle CSP parsing errors gracefully", async () => {
      vi.mocked(parseCSPViolation).mockImplementationOnce(() => {
        throw new Error("Parsing error");
      });

      const report = {
        "csp-report": {
          "document-uri": "https://example.com/page",
          referrer: "",
          "violated-directive": "script-src 'self'",
          "original-policy": "",
          "blocked-uri": "inline",
        },
      };

      const request = createCSPRequest(report);
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to process report");
    });
  });

  describe("Security", () => {
    it("should rate limit per IP", async () => {
      const report = {
        "csp-report": {
          "document-uri": "https://example.com/page",
          referrer: "",
          "violated-directive": "img-src 'self'",
          "original-policy": "",
          "blocked-uri": "https://evil.com/image.jpg",
        },
      };

      const request = createCSPRequest(report);
      await POST(request);

      expect(rateLimiter.check).toHaveBeenCalledWith(
        "csp-report:192.168.1.1",
        10,
        60000
      );
    });

    it("should validate report structure to prevent injection", async () => {
      const maliciousReport = {
        "csp-report": {
          "document-uri": "<script>alert('xss')</script>",
          referrer: "javascript:alert('xss')",
          "violated-directive": "eval('malicious')",
          "original-policy": "",
          "blocked-uri": "data:text/html,<script>alert(1)</script>",
        },
      };

      const request = createCSPRequest(maliciousReport);
      const response = await POST(request);

      // Should still process but detect as bypass attempt
      expect(response.status).toBe(204);
      expect(detectCSPBypass).toHaveBeenCalled();
    });
  });
});
