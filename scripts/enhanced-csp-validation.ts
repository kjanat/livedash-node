#!/usr/bin/env tsx

import {
  buildCSP,
  validateCSP,
  testCSPImplementation,
  generateNonce,
  detectCSPBypass,
} from "../lib/csp";

interface CSPValidationResult {
  configuration: string;
  csp: string;
  validation: ReturnType<typeof validateCSP>;
  implementation: ReturnType<typeof testCSPImplementation>;
  nonce?: string;
}

class EnhancedCSPValidator {
  private results: CSPValidationResult[] = [];

  async validateAllConfigurations() {
    console.log("🔒 Enhanced CSP Validation Suite");
    console.log("================================\n");

    // Test configurations
    const configurations = [
      {
        name: "Development (Permissive)",
        config: { isDevelopment: true, reportUri: "/api/csp-report" },
      },
      {
        name: "Production (Standard)",
        config: {
          isDevelopment: false,
          nonce: generateNonce(),
          reportUri: "/api/csp-report",
          strictMode: false,
        },
      },
      {
        name: "Production (Strict Mode)",
        config: {
          isDevelopment: false,
          nonce: generateNonce(),
          reportUri: "/api/csp-report",
          strictMode: true,
          allowedExternalDomains: [
            "https://api.openai.com",
            "https://livedash.notso.ai",
          ],
        },
      },
      {
        name: "Production (Maximum Security)",
        config: {
          isDevelopment: false,
          nonce: generateNonce(),
          reportUri: "/api/csp-report",
          strictMode: true,
          allowedExternalDomains: ["https://api.openai.com"],
          reportingLevel: "all" as const,
        },
      },
    ];

    for (const { name, config } of configurations) {
      await this.validateConfiguration(name, config);
    }

    this.generateReport();
    await this.testBypassDetection();
    await this.testRealWorldScenarios();
  }

  private async validateConfiguration(name: string, config: any) {
    console.log(`🧪 Testing ${name}...`);

    const csp = buildCSP(config);
    const validation = validateCSP(csp, { strictMode: config.strictMode });
    const implementation = testCSPImplementation(csp);

    this.results.push({
      configuration: name,
      csp,
      validation,
      implementation,
      nonce: config.nonce,
    });

    // Short summary
    const emoji =
      validation.securityScore >= 90
        ? "🟢"
        : validation.securityScore >= 70
          ? "🟡"
          : "🔴";

    console.log(`  ${emoji} Security Score: ${validation.securityScore}%`);
    console.log(`  📊 Implementation Score: ${implementation.overallScore}%`);

    if (validation.errors.length > 0) {
      console.log(`  ❌ Errors: ${validation.errors.length}`);
    }
    if (validation.warnings.length > 0) {
      console.log(`  ⚠️  Warnings: ${validation.warnings.length}`);
    }
    console.log();
  }

  private generateReport() {
    console.log("📋 Detailed Validation Report");
    console.log("============================\n");

    for (const result of this.results) {
      console.log(`📌 ${result.configuration}`);
      console.log("-".repeat(result.configuration.length + 2));

      // CSP Policy
      console.log(`\nCSP Policy (${result.csp.length} chars):`);
      console.log(
        `${result.csp.substring(0, 120)}${result.csp.length > 120 ? "..." : ""}\n`
      );

      // Security Analysis
      console.log("🛡️  Security Analysis:");
      console.log(`   Score: ${result.validation.securityScore}%`);

      if (result.validation.errors.length > 0) {
        console.log(`   Errors:`);
        for (const error of result.validation.errors) {
          console.log(`     ❌ ${error}`);
        }
      }

      if (result.validation.warnings.length > 0) {
        console.log(`   Warnings:`);
        for (const warning of result.validation.warnings) {
          console.log(`     ⚠️  ${warning}`);
        }
      }

      if (result.validation.recommendations.length > 0) {
        console.log(`   Recommendations:`);
        for (const rec of result.validation.recommendations) {
          console.log(`     💡 ${rec}`);
        }
      }

      // Implementation Tests
      console.log("\n🧪 Implementation Tests:");
      for (const test of result.implementation.testResults) {
        const emoji = test.passed ? "✅" : "❌";
        console.log(`   ${emoji} ${test.name}: ${test.description}`);
        if (test.recommendation) {
          console.log(`      💡 ${test.recommendation}`);
        }
      }

      console.log(
        `   Overall Implementation Score: ${result.implementation.overallScore}%\n`
      );
      console.log();
    }
  }

  private async testBypassDetection() {
    console.log("🕵️  CSP Bypass Detection Tests");
    console.log("==============================\n");

    const bypassAttempts = [
      {
        name: "JavaScript Protocol",
        content: "<a href='javascript:alert(1)'>Click</a>",
        expectedRisk: "high",
      },
      {
        name: "Data URI Script",
        content: "<script src='data:text/javascript,alert(1)'></script>",
        expectedRisk: "high",
      },
      {
        name: "Eval Injection",
        content: "eval('alert(1)')",
        expectedRisk: "high",
      },
      {
        name: "Function Constructor",
        content: "new Function('alert(1)')()",
        expectedRisk: "high",
      },
      {
        name: "setTimeout String",
        content: "setTimeout('alert(1)', 1000)",
        expectedRisk: "medium",
      },
      {
        name: "JSONP Callback",
        content: "callback=<script>alert(1)</script>",
        expectedRisk: "medium",
      },
      {
        name: "Safe Content",
        content: "const x = document.getElementById('safe');",
        expectedRisk: "low",
      },
    ];

    let detectionTests = 0;
    let passedDetections = 0;

    for (const attempt of bypassAttempts) {
      const detection = detectCSPBypass(attempt.content);
      const testPassed =
        detection.isDetected === (attempt.expectedRisk !== "low");

      detectionTests++;
      if (testPassed) passedDetections++;

      const emoji = testPassed ? "✅" : "❌";
      const riskEmoji =
        detection.riskLevel === "high"
          ? "🚨"
          : detection.riskLevel === "medium"
            ? "⚠️"
            : "🟢";

      console.log(`${emoji} ${attempt.name}`);
      console.log(
        `   Content: ${attempt.content.substring(0, 50)}${attempt.content.length > 50 ? "..." : ""}`
      );
      console.log(
        `   ${riskEmoji} Risk Level: ${detection.riskLevel} (expected: ${attempt.expectedRisk})`
      );
      console.log(`   Detected: ${detection.isDetected}`);
      if (detection.patterns.length > 0) {
        console.log(`   Patterns: ${detection.patterns.length} matched`);
      }
      console.log();
    }

    console.log(
      `🎯 Bypass Detection Score: ${Math.round((passedDetections / detectionTests) * 100)}%\n`
    );
  }

  private async testRealWorldScenarios() {
    console.log("🌍 Real-World Scenario Tests");
    console.log("============================\n");

    const scenarios = [
      {
        name: "Leaflet Maps Integration",
        sources: [
          "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js",
        ],
        test: (csp: string) => {
          return (
            csp.includes("https://*.openstreetmap.org") ||
            csp.includes("https://tile.openstreetmap.org") ||
            csp.includes("https:")
          );
        },
      },
      {
        name: "OpenAI API Integration",
        sources: [
          "https://api.openai.com/v1/chat/completions",
          "https://api.openai.com/v1/files",
        ],
        test: (csp: string) => {
          return (
            csp.includes("https://api.openai.com") || csp.includes("https:")
          );
        },
      },
      {
        name: "Schema.org Structured Data",
        sources: ["https://schema.org/SoftwareApplication"],
        test: (csp: string) => {
          return csp.includes("https://schema.org") || csp.includes("https:");
        },
      },
      {
        name: "WebSocket Development (HMR)",
        sources: [
          "ws://localhost:3000/_next/webpack-hmr",
          "wss://localhost:3000/_next/webpack-hmr",
        ],
        test: (csp: string) => {
          return csp.includes("ws:") || csp.includes("wss:");
        },
      },
    ];

    for (const scenario of scenarios) {
      console.log(`🧪 ${scenario.name}`);

      // Test with production strict mode
      const productionCSP = buildCSP({
        isDevelopment: false,
        nonce: generateNonce(),
        strictMode: true,
        allowedExternalDomains: [
          "https://api.openai.com",
          "https://schema.org",
        ],
      });

      // Test with development mode
      const devCSP = buildCSP({
        isDevelopment: true,
        reportUri: "/api/csp-report",
      });

      const prodSupport = scenario.test(productionCSP);
      const devSupport = scenario.test(devCSP);

      console.log(
        `   Production (Strict): ${prodSupport ? "✅ Supported" : "❌ Blocked"}`
      );
      console.log(
        `   Development: ${devSupport ? "✅ Supported" : "❌ Blocked"}`
      );

      if (!prodSupport && scenario.name !== "WebSocket Development (HMR)") {
        console.log(`   💡 May need to add domains to allowedExternalDomains`);
      }

      console.log(`   Required sources: ${scenario.sources.length}`);
      for (const source of scenario.sources.slice(0, 2)) {
        console.log(`     - ${source}`);
      }
      if (scenario.sources.length > 2) {
        console.log(`     ... and ${scenario.sources.length - 2} more`);
      }
      console.log();
    }
  }

  async run() {
    try {
      await this.validateAllConfigurations();

      // Final summary
      const scores = this.results.map((r) => r.validation.securityScore);
      const avgScore = Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length
      );

      console.log("🎯 Final Assessment");
      console.log("==================");
      console.log(`Average Security Score: ${avgScore}%`);

      if (avgScore >= 95) {
        console.log(
          "🏆 Excellent CSP implementation! Industry-leading security."
        );
      } else if (avgScore >= 85) {
        console.log("🥇 Very good CSP implementation with strong security.");
      } else if (avgScore >= 70) {
        console.log("🥈 Good CSP implementation with room for improvement.");
      } else {
        console.log(
          "🥉 CSP implementation needs significant security improvements."
        );
      }

      console.log("\n💡 General Recommendations:");
      console.log("- Test CSP changes in development before deploying");
      console.log("- Monitor CSP violation reports regularly");
      console.log("- Review and update CSP policies quarterly");
      console.log("- Use strict mode in production environments");
      console.log("- Keep allowed external domains to minimum necessary");
    } catch (error) {
      console.error("❌ Validation failed:", error);
      process.exit(1);
    }
  }
}

// Run validation if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new EnhancedCSPValidator();
  validator.run();
}

export default EnhancedCSPValidator;
