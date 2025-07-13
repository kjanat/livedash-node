#!/usr/bin/env tsx

import { validateCSP } from "../lib/csp";
import { buildCSP, generateNonce } from "../lib/csp-server";

interface TestCase {
  name: string;
  config: Parameters<typeof buildCSP>[0];
  shouldPass: boolean;
  expectedWarnings?: number;
  expectedErrors?: number;
}

const testCases: TestCase[] = [
  {
    name: "Development CSP",
    config: { isDevelopment: true },
    shouldPass: true,
    expectedWarnings: 3, // unsafe-eval, unsafe-inline, and missing reporting warnings
  },
  {
    name: "Production CSP with nonce",
    config: {
      nonce: generateNonce(),
      isDevelopment: false,
      reportUri: "/api/csp-report",
    },
    shouldPass: true,
    expectedWarnings: 0,
  },
  {
    name: "Production CSP without nonce (fallback)",
    config: {
      isDevelopment: false,
      reportUri: "/api/csp-report",
    },
    shouldPass: true,
    expectedWarnings: 1, // unsafe-inline warning for styles
  },
  {
    name: "Enforce mode enabled",
    config: {
      nonce: generateNonce(),
      isDevelopment: false,
      enforceMode: true,
      reportUri: "/api/csp-report",
    },
    shouldPass: true,
    expectedWarnings: 0,
  },
];

function runCSPTests() {
  console.log("🔒 Running CSP Tests\n");

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);

    try {
      // Build CSP
      const csp = buildCSP(testCase.config);
      console.log(`  CSP: ${csp.substring(0, 100)}...`);

      // Validate CSP
      const validation = validateCSP(csp);

      console.log(`  Valid: ${validation.isValid}`);
      console.log(`  Warnings: ${validation.warnings.length}`);
      console.log(`  Errors: ${validation.errors.length}`);

      if (validation.warnings.length > 0) {
        console.log(`  Warning details: ${validation.warnings.join(", ")}`);
      }

      if (validation.errors.length > 0) {
        console.log(`  Error details: ${validation.errors.join(", ")}`);
      }

      // Check expectations
      const passedValidation = validation.isValid === testCase.shouldPass;
      const warningsMatch =
        testCase.expectedWarnings === undefined ||
        validation.warnings.length === testCase.expectedWarnings;
      const errorsMatch =
        testCase.expectedErrors === undefined ||
        validation.errors.length === testCase.expectedErrors;

      if (passedValidation && warningsMatch && errorsMatch) {
        console.log("  ✅ PASSED\n");
        passed++;
      } else {
        console.log("  ❌ FAILED");
        if (!passedValidation) {
          console.log(
            `    Expected valid: ${testCase.shouldPass}, got: ${validation.isValid}`
          );
        }
        if (!warningsMatch) {
          console.log(
            `    Expected warnings: ${testCase.expectedWarnings}, got: ${validation.warnings.length}`
          );
        }
        if (!errorsMatch) {
          console.log(
            `    Expected errors: ${testCase.expectedErrors}, got: ${validation.errors.length}`
          );
        }
        console.log("");
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ FAILED: ${error}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

function testCSPDirectives() {
  console.log("\n🔍 Testing CSP Directives\n");

  const nonce = generateNonce();
  const productionCSP = buildCSP({
    nonce,
    isDevelopment: false,
    reportUri: "/api/csp-report",
  });

  console.log("Production CSP:");
  console.log(productionCSP);
  console.log("");

  // Check for required directives
  const requiredDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    "report-uri /api/csp-report",
  ];

  console.log("Required directives check:");
  for (const directive of requiredDirectives) {
    const present = productionCSP.includes(directive);
    console.log(`  ${present ? "✅" : "❌"} ${directive}`);
  }

  console.log("\nDevelopment CSP:");
  const devCSP = buildCSP({ isDevelopment: true });
  console.log(devCSP);
}

function testNonceGeneration() {
  console.log("\n🎲 Testing Nonce Generation\n");

  const nonces = new Set();
  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    const nonce = generateNonce();

    // Check format
    if (!/^[A-Za-z0-9+/]+=*$/.test(nonce)) {
      console.log(`❌ Invalid nonce format: ${nonce}`);
      return;
    }

    // Check uniqueness
    if (nonces.has(nonce)) {
      console.log(`❌ Duplicate nonce detected: ${nonce}`);
      return;
    }

    nonces.add(nonce);
  }

  console.log(`✅ Generated ${iterations} unique nonces`);
  console.log(`✅ All nonces have valid base64 format`);
  console.log(`Example nonce: ${Array.from(nonces)[0]}`);
}

// Run all tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runCSPTests();
  testCSPDirectives();
  testNonceGeneration();
}
