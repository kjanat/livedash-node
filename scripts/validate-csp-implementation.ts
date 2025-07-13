#!/usr/bin/env tsx

import {
  validateCSP,
  detectCSPBypass,
  testCSPImplementation,
} from "../lib/csp";
import { buildCSP, generateNonce } from "../lib/csp-server";

interface CSPTestResult {
  test: string;
  passed: boolean;
  details?: string;
  recommendations?: string[];
}

class CSPValidator {
  private results: CSPTestResult[] = [];

  private addResult(
    test: string,
    passed: boolean,
    details?: string,
    recommendations?: string[]
  ) {
    this.results.push({ test, passed, details, recommendations });
  }

  async validateNonceGeneration() {
    console.log("🎲 Testing Nonce Generation...");

    // Test uniqueness
    const nonces = new Set();
    const iterations = 1000;
    let duplicateFound = false;

    for (let i = 0; i < iterations; i++) {
      const nonce = generateNonce();
      if (nonces.has(nonce)) {
        duplicateFound = true;
        break;
      }
      nonces.add(nonce);
    }

    this.addResult(
      "Nonce Uniqueness",
      !duplicateFound,
      duplicateFound
        ? "Duplicate nonce detected"
        : `${iterations} unique nonces generated`,
      duplicateFound
        ? ["Check entropy source", "Verify crypto.randomBytes"]
        : undefined
    );

    // Test format
    const testNonce = generateNonce();
    const validFormat = /^[A-Za-z0-9+/]+=*$/.test(testNonce);

    this.addResult(
      "Nonce Format",
      validFormat,
      `Generated nonce: ${testNonce}`,
      !validFormat ? ["Ensure proper base64 encoding"] : undefined
    );

    // Test length
    const decodedLength = Buffer.from(testNonce, "base64").length;
    const correctLength = decodedLength === 16;

    this.addResult(
      "Nonce Length",
      correctLength,
      `Decoded length: ${decodedLength} bytes`,
      !correctLength ? ["Use 16 bytes (128 bits) for security"] : undefined
    );
  }

  async validateProductionCSP() {
    console.log("🛡️ Testing Production CSP...");

    const nonce = generateNonce();
    const productionCSP = buildCSP({
      nonce,
      isDevelopment: false,
      reportUri: "/api/csp-report",
      enforceMode: true,
    });

    console.log("Production CSP:", productionCSP);

    // Validate overall structure
    const validation = validateCSP(productionCSP);
    this.addResult(
      "CSP Validation",
      validation.isValid,
      `Errors: ${validation.errors.length}, Warnings: ${validation.warnings.length}`,
      validation.errors.length > 0 ? validation.errors : undefined
    );

    // Check for secure directives
    const securityTests = [
      {
        name: "No unsafe-inline in scripts",
        test:
          !productionCSP.includes("script-src") ||
          !productionCSP.match(/script-src[^;]*'unsafe-inline'/),
        critical: true,
      },
      {
        name: "No unsafe-eval in scripts",
        test: !productionCSP.includes("'unsafe-eval'"),
        critical: true,
      },
      {
        name: "Nonce-based script execution",
        test: productionCSP.includes(`'nonce-${nonce}'`),
        critical: true,
      },
      {
        name: "Strict dynamic enabled",
        test: productionCSP.includes("'strict-dynamic'"),
        critical: false,
      },
      {
        name: "Object sources blocked",
        test: productionCSP.includes("object-src 'none'"),
        critical: true,
      },
      {
        name: "Base URI restricted",
        test: productionCSP.includes("base-uri 'self'"),
        critical: true,
      },
      {
        name: "Frame ancestors blocked",
        test: productionCSP.includes("frame-ancestors 'none'"),
        critical: true,
      },
      {
        name: "HTTPS upgrade enabled",
        test: productionCSP.includes("upgrade-insecure-requests"),
        critical: false,
      },
      {
        name: "Report URI configured",
        test: productionCSP.includes("report-uri /api/csp-report"),
        critical: false,
      },
    ];

    for (const secTest of securityTests) {
      this.addResult(
        secTest.name,
        secTest.test,
        undefined,
        !secTest.test && secTest.critical
          ? ["This is a critical security requirement"]
          : undefined
      );
    }
  }

  async validateDevelopmentCSP() {
    console.log("🔧 Testing Development CSP...");

    const devCSP = buildCSP({
      isDevelopment: true,
      reportUri: "/api/csp-report",
    });

    console.log("Development CSP:", devCSP);

    // Development should be more permissive but still secure
    const devTests = [
      {
        name: "Allows unsafe-eval for dev tools",
        test: devCSP.includes("'unsafe-eval'"),
      },
      {
        name: "Allows unsafe-inline for hot reload",
        test: devCSP.includes("'unsafe-inline'"),
      },
      {
        name: "Allows WebSocket connections",
        test: devCSP.includes("wss:") || devCSP.includes("ws:"),
      },
      {
        name: "Still blocks objects",
        test: devCSP.includes("object-src 'none'"),
      },
      {
        name: "Still restricts base URI",
        test: devCSP.includes("base-uri 'self'"),
      },
    ];

    for (const devTest of devTests) {
      this.addResult(devTest.name, devTest.test);
    }
  }

  async validateBypassDetection() {
    console.log("🕵️ Testing Bypass Detection...");

    const bypassTests = [
      {
        name: "Detects javascript: protocol",
        content: "window.location.href = 'javascript:alert(1)'",
        shouldDetect: true,
      },
      {
        name: "Detects data: HTML injection",
        content: "iframe.src = 'data:text/html,<script>alert(1)</script>'",
        shouldDetect: true,
      },
      {
        name: "Detects eval injection",
        content: "eval('malicious code')",
        shouldDetect: true,
      },
      {
        name: "Detects Function constructor",
        content: "new Function('alert(1)')()",
        shouldDetect: true,
      },
      {
        name: "Detects setTimeout string",
        content: "setTimeout('alert(1)', 1000)",
        shouldDetect: true,
      },
      {
        name: "Ignores legitimate content",
        content: "This is normal text with no dangerous patterns",
        shouldDetect: false,
      },
      {
        name: "Ignores safe JavaScript",
        content: "function safeFunction() { return 'hello'; }",
        shouldDetect: false,
      },
    ];

    for (const bypassTest of bypassTests) {
      const detection = detectCSPBypass(bypassTest.content);
      const passed = detection.isDetected === bypassTest.shouldDetect;

      this.addResult(
        bypassTest.name,
        passed,
        `Detected: ${detection.isDetected}, Risk: ${detection.riskLevel}`,
        !passed ? ["Review bypass detection patterns"] : undefined
      );
    }
  }

  async validateContentSources() {
    console.log("🌐 Testing Content Source Restrictions...");

    const nonce = generateNonce();
    const csp = buildCSP({
      nonce,
      isDevelopment: false,
      reportUri: "/api/csp-report",
    });

    // Check specific content source restrictions
    const sourceTests = [
      {
        name: "Script sources are restrictive",
        test: () => {
          const scriptMatch = csp.match(/script-src ([^;]+)/);
          if (!scriptMatch) return false;
          const sources = scriptMatch[1];
          return (
            sources.includes("'self'") &&
            sources.includes(`'nonce-${nonce}'`) &&
            !sources.includes("'unsafe-inline'") &&
            !sources.includes("*")
          );
        },
      },
      {
        name: "Style sources use nonce",
        test: () => {
          const styleMatch = csp.match(/style-src ([^;]+)/);
          if (!styleMatch) return false;
          const sources = styleMatch[1];
          return (
            sources.includes("'self'") && sources.includes(`'nonce-${nonce}'`)
          );
        },
      },
      {
        name: "Image sources are limited",
        test: () => {
          const imgMatch = csp.match(/img-src ([^;]+)/);
          if (!imgMatch) return false;
          const sources = imgMatch[1];
          return (
            sources.includes("'self'") &&
            sources.includes("data:") &&
            !sources.includes("*")
          );
        },
      },
      {
        name: "Connect sources are specific",
        test: () => {
          const connectMatch = csp.match(/connect-src ([^;]+)/);
          if (!connectMatch) return false;
          const sources = connectMatch[1];
          return (
            sources.includes("'self'") &&
            sources.includes("https://api.openai.com") &&
            !sources.includes("ws:") &&
            !sources.includes("wss:")
          );
        },
      },
      {
        name: "Font sources are restricted",
        test: () => {
          const fontMatch = csp.match(/font-src ([^;]+)/);
          if (!fontMatch) return false;
          const sources = fontMatch[1];
          return (
            sources.includes("'self'") &&
            sources.includes("data:") &&
            !sources.includes("*")
          );
        },
      },
    ];

    for (const sourceTest of sourceTests) {
      this.addResult(
        sourceTest.name,
        sourceTest.test(),
        undefined,
        !sourceTest.test()
          ? ["Review and tighten content source restrictions"]
          : undefined
      );
    }
  }

  async validateCompatibility() {
    console.log("🔄 Testing Framework Compatibility...");

    // Test that CSP works with Next.js requirements
    const compatibilityTests = [
      {
        name: "Next.js development compatibility",
        test: () => {
          const devCSP = buildCSP({ isDevelopment: true });
          return devCSP.includes("'unsafe-eval'"); // Required for Next.js dev
        },
      },
      {
        name: "TailwindCSS compatibility",
        test: () => {
          const csp = buildCSP({ isDevelopment: false });
          // Should either have nonce or unsafe-inline for styles
          return (
            csp.includes("'nonce-") ||
            csp.includes("style-src 'self' 'unsafe-inline'")
          );
        },
      },
      {
        name: "JSON-LD support",
        test: () => {
          const nonce = generateNonce();
          const csp = buildCSP({ nonce, isDevelopment: false });
          // Should allow nonce-based inline scripts
          return csp.includes(`'nonce-${nonce}'`);
        },
      },
    ];

    for (const compatTest of compatibilityTests) {
      this.addResult(
        compatTest.name,
        compatTest.test(),
        undefined,
        !compatTest.test() ? ["Ensure framework compatibility"] : undefined
      );
    }
  }

  generateReport() {
    console.log("\n📊 CSP Validation Report");
    console.log("=".repeat(50));

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => r.passed === false).length;
    const critical = this.results.filter(
      (r) =>
        !r.passed && r.recommendations?.some((rec) => rec.includes("critical"))
    ).length;

    console.log(`\n📈 Summary: ${passed} passed, ${failed} failed`);
    if (critical > 0) {
      console.log(`⚠️  Critical issues: ${critical}`);
    }

    console.log("\n📋 Detailed Results:");

    for (const result of this.results) {
      const status = result.passed ? "✅" : "❌";
      console.log(`${status} ${result.test}`);

      if (result.details) {
        console.log(`   ${result.details}`);
      }

      if (result.recommendations) {
        for (const rec of result.recommendations) {
          console.log(`   💡 ${rec}`);
        }
      }
    }

    // Security score
    const securityScore = Math.round((passed / this.results.length) * 100);
    console.log(`\n🛡️ Security Score: ${securityScore}%`);

    if (securityScore >= 90) {
      console.log("🎉 Excellent CSP implementation!");
    } else if (securityScore >= 80) {
      console.log("🔧 Good CSP implementation with room for improvement");
    } else if (securityScore >= 70) {
      console.log("⚠️  CSP implementation needs attention");
    } else {
      console.log("🚨 CSP implementation has serious security issues");
    }

    return {
      passed,
      failed,
      critical,
      securityScore,
      success: failed === 0 && critical === 0,
    };
  }

  async run() {
    console.log("🔒 Enhanced CSP Implementation Validation");
    console.log("=".repeat(50));

    await this.validateNonceGeneration();
    await this.validateProductionCSP();
    await this.validateDevelopmentCSP();
    await this.validateBypassDetection();
    await this.validateContentSources();
    await this.validateCompatibility();

    return this.generateReport();
  }
}

// Run validation if this script is called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new CSPValidator();
  validator
    .run()
    .then((report) => {
      if (!report.success) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("❌ Validation failed:", error);
      process.exit(1);
    });
}
