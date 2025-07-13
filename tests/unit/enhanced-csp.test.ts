import { describe, it, expect, beforeEach } from "vitest";
import {
  validateCSP,
  testCSPImplementation,
  detectCSPBypass,
  type CSPConfig,
} from "../../lib/csp";
import { buildCSP, generateNonce } from "../../lib/csp-server";
import { cspMonitoring } from "../../lib/csp-monitoring";

describe("Enhanced CSP Implementation", () => {
  describe("CSP Building", () => {
    it("should build development CSP with unsafe directives", () => {
      const csp = buildCSP({ isDevelopment: true });

      expect(csp).toContain("'unsafe-eval'");
      expect(csp).toContain("'unsafe-inline'");
      expect(csp).toContain("wss:");
      expect(csp).toContain("ws:");
    });

    it("should build production CSP with nonce-based execution", () => {
      const nonce = generateNonce();
      const csp = buildCSP({
        isDevelopment: false,
        nonce,
        strictMode: true,
      });

      expect(csp).toContain(`'nonce-${nonce}'`);
      expect(csp).toContain("'strict-dynamic'");
      expect(csp).not.toContain("'unsafe-inline'");
      expect(csp).not.toContain("'unsafe-eval'");
    });

    it("should handle external domains in strict mode", () => {
      const config: CSPConfig = {
        isDevelopment: false,
        strictMode: true,
        allowedExternalDomains: [
          "https://api.openai.com",
          "https://example.com",
        ],
      };

      const csp = buildCSP(config);

      expect(csp).toContain("https://api.openai.com");
      expect(csp).toContain("https://example.com");

      // Check that connect-src doesn't have broad https: allowlist (only specific domains)
      const connectSrcMatch = csp.match(/connect-src[^;]+/);
      // Should not contain "https:" as a standalone directive (which would allow all HTTPS)
      expect(connectSrcMatch?.[0]).not.toMatch(/\bhttps:\s/);
      expect(connectSrcMatch?.[0]).not.toMatch(/\shttps:$/);
      // But should contain specific domains
      expect(connectSrcMatch?.[0]).toContain("https://api.openai.com");
    });

    it("should include proper map tile sources", () => {
      const csp = buildCSP({ isDevelopment: false });

      expect(csp).toContain("https://*.basemaps.cartocdn.com");
      expect(csp).toContain("https://*.openstreetmap.org");
    });
  });

  describe("CSP Validation", () => {
    it("should validate development CSP with appropriate warnings", () => {
      const csp = buildCSP({ isDevelopment: true });
      const validation = validateCSP(csp);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some((w) => w.includes("unsafe-eval"))).toBe(
        true
      );
      expect(validation.securityScore).toBeLessThan(100);
    });

    it("should validate production CSP with higher security score", () => {
      const nonce = generateNonce();
      const csp = buildCSP({
        isDevelopment: false,
        nonce,
        strictMode: true,
        reportUri: "/api/csp-report",
      });
      const validation = validateCSP(csp, { strictMode: true });

      expect(validation.isValid).toBe(true);
      expect(validation.securityScore).toBeGreaterThan(80);
      expect(validation.recommendations).toBeDefined();
    });
  });

  describe("CSP Bypass Detection", () => {
    it("should detect JavaScript protocol attempts", () => {
      const content = "javascript:alert(1)";
      const detection = detectCSPBypass(content);

      expect(detection.isDetected).toBe(true);
      expect(detection.riskLevel).toBe("high");
      expect(detection.patterns.length).toBeGreaterThan(0);
    });

    it("should detect data URI script injection", () => {
      const content = "data:text/javascript,alert(1)";
      const detection = detectCSPBypass(content);

      expect(detection.isDetected).toBe(true);
      expect(detection.riskLevel).toBe("high");
    });

    it("should detect eval injection attempts", () => {
      const content = "eval('malicious code')";
      const detection = detectCSPBypass(content);

      expect(detection.isDetected).toBe(true);
      expect(detection.riskLevel).toBe("high");
    });

    it("should not flag legitimate JavaScript", () => {
      const content = "const x = document.getElementById('safe');";
      const detection = detectCSPBypass(content);

      expect(detection.isDetected).toBe(false);
      expect(detection.riskLevel).toBe("low");
    });
  });

  describe("Nonce Generation", () => {
    it("should generate cryptographically secure nonces", () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      expect(nonce1).not.toBe(nonce2);
      expect(nonce1.length).toBeGreaterThan(10);
      expect(typeof nonce1).toBe("string");

      // Should be base64 encoded
      expect(() => atob(nonce1)).not.toThrow();
    });

    it("should generate unique nonces", () => {
      const nonces = new Set();
      for (let i = 0; i < 1000; i++) {
        nonces.add(generateNonce());
      }

      expect(nonces.size).toBe(1000);
    });
  });
});
