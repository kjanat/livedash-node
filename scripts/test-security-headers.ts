#!/usr/bin/env tsx

/**
 * Security Headers Testing Script
 *
 * This script tests HTTP security headers on a running Next.js server.
 * Run this against your development or production server to verify
 * that security headers are properly configured.
 *
 * Usage:
 *   pnpm exec tsx scripts/test-security-headers.ts [url]
 *
 * Examples:
 *   pnpm exec tsx scripts/test-security-headers.ts http://localhost:3000
 *   pnpm exec tsx scripts/test-security-headers.ts https://your-domain.com
 */

interface SecurityHeader {
  name: string;
  expectedValue?: string;
  description: string;
  critical: boolean;
}

const SECURITY_HEADERS: SecurityHeader[] = [
  {
    name: "X-Content-Type-Options",
    expectedValue: "nosniff",
    description: "Prevents MIME type sniffing attacks",
    critical: true,
  },
  {
    name: "X-Frame-Options",
    expectedValue: "DENY",
    description: "Prevents clickjacking attacks",
    critical: true,
  },
  {
    name: "X-XSS-Protection",
    expectedValue: "1; mode=block",
    description: "Enables XSS protection in legacy browsers",
    critical: false,
  },
  {
    name: "Referrer-Policy",
    expectedValue: "strict-origin-when-cross-origin",
    description: "Controls referrer information sent with requests",
    critical: false,
  },
  {
    name: "X-DNS-Prefetch-Control",
    expectedValue: "off",
    description: "Prevents DNS rebinding attacks",
    critical: false,
  },
  {
    name: "Content-Security-Policy",
    description: "Prevents code injection attacks",
    critical: true,
  },
  {
    name: "Permissions-Policy",
    description: "Controls browser feature access",
    critical: false,
  },
  {
    name: "Strict-Transport-Security",
    description: "Enforces HTTPS (production only)",
    critical: false,
  },
];

const CSP_DIRECTIVES = [
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
];

const PERMISSIONS_POLICIES = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "interest-cohort=()",
  "browsing-topics=()",
];

async function testSecurityHeaders(url: string): Promise<void> {
  console.log(`🔍 Testing security headers for: ${url}\n`);

  try {
    const response = await fetch(url, {
      method: "HEAD", // Use HEAD to avoid downloading the full response body
    });

    console.log(
      `📊 Response Status: ${response.status} ${response.statusText}\n`
    );

    let criticalMissing = 0;
    let warningCount = 0;

    for (const header of SECURITY_HEADERS) {
      const value = response.headers.get(header.name);

      if (!value) {
        const status = header.critical ? "❌ CRITICAL" : "⚠️  WARNING";
        console.log(`${status} Missing: ${header.name}`);
        console.log(`   Description: ${header.description}\n`);

        if (header.critical) criticalMissing++;
        else warningCount++;
        continue;
      }

      if (header.expectedValue && value !== header.expectedValue) {
        const status = header.critical ? "❌ CRITICAL" : "⚠️  WARNING";
        console.log(`${status} Incorrect: ${header.name}`);
        console.log(`   Expected: ${header.expectedValue}`);
        console.log(`   Actual: ${value}`);
        console.log(`   Description: ${header.description}\n`);

        if (header.critical) criticalMissing++;
        else warningCount++;
        continue;
      }

      console.log(`✅ OK: ${header.name}`);
      console.log(`   Value: ${value}`);
      console.log(`   Description: ${header.description}\n`);
    }

    // Detailed CSP analysis
    const csp = response.headers.get("Content-Security-Policy");
    if (csp) {
      console.log("🔒 Content Security Policy Analysis:");

      let cspIssues = 0;
      for (const directive of CSP_DIRECTIVES) {
        if (csp.includes(directive)) {
          console.log(`   ✅ ${directive}`);
        } else {
          console.log(`   ❌ Missing: ${directive}`);
          cspIssues++;
        }
      }

      if (cspIssues > 0) {
        console.log(
          `   ⚠️  ${cspIssues} CSP directive(s) missing or incorrect\n`
        );
        warningCount += cspIssues;
      } else {
        console.log(`   ✅ All CSP directives present\n`);
      }
    }

    // Detailed Permissions Policy analysis
    const permissionsPolicy = response.headers.get("Permissions-Policy");
    if (permissionsPolicy) {
      console.log("🔐 Permissions Policy Analysis:");

      let policyIssues = 0;
      for (const policy of PERMISSIONS_POLICIES) {
        if (permissionsPolicy.includes(policy)) {
          console.log(`   ✅ ${policy}`);
        } else {
          console.log(`   ❌ Missing: ${policy}`);
          policyIssues++;
        }
      }

      if (policyIssues > 0) {
        console.log(`   ⚠️  ${policyIssues} permission policy(ies) missing\n`);
        warningCount += policyIssues;
      } else {
        console.log(`   ✅ All permission policies present\n`);
      }
    }

    // HSTS environment check
    const hsts = response.headers.get("Strict-Transport-Security");
    const isHttps = url.startsWith("https://");

    if (isHttps && !hsts) {
      console.log("⚠️  WARNING: HTTPS site missing HSTS header");
      console.log(
        "   Consider adding Strict-Transport-Security for production\n"
      );
      warningCount++;
    } else if (hsts && !isHttps) {
      console.log(
        "ℹ️  INFO: HSTS header present on HTTP site (will be ignored by browsers)\n"
      );
    }

    // Summary
    console.log("=".repeat(60));
    console.log("📋 SECURITY HEADERS SUMMARY");
    console.log("=".repeat(60));

    if (criticalMissing === 0 && warningCount === 0) {
      console.log(
        "🎉 EXCELLENT: All security headers are properly configured!"
      );
    } else if (criticalMissing === 0) {
      console.log(`✅ GOOD: No critical issues found`);
      console.log(
        `⚠️  ${warningCount} warning(s) - consider addressing these for optimal security`
      );
    } else {
      console.log(`❌ ISSUES FOUND:`);
      console.log(`   Critical: ${criticalMissing}`);
      console.log(`   Warnings: ${warningCount}`);
      console.log(
        `\n🔧 Please address critical issues before deploying to production`
      );
    }

    // Additional recommendations
    console.log("\n💡 ADDITIONAL RECOMMENDATIONS:");
    console.log(
      "• Regularly test headers with online tools like securityheaders.com"
    );
    console.log("• Monitor CSP violations in production to fine-tune policies");
    console.log(
      "• Consider implementing HSTS preloading for production domains"
    );
    console.log("• Review and update security headers based on new threats");
  } catch (error) {
    console.error(`❌ Error testing headers: ${error}`);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const url = process.argv[2] || "http://localhost:3000";

  console.log("🛡️  Security Headers Testing Tool");
  console.log("=".repeat(60));

  await testSecurityHeaders(url);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
}
