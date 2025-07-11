import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

export interface CSPConfig {
  nonce?: string;
  isDevelopment?: boolean;
  reportUri?: string;
  enforceMode?: boolean;
  strictMode?: boolean;
  allowedExternalDomains?: string[];
  reportingLevel?: "none" | "violations" | "all";
}

export interface CSPViolationReport {
  "csp-report": {
    "document-uri": string;
    referrer: string;
    "violated-directive": string;
    "original-policy": string;
    "blocked-uri": string;
    "source-file"?: string;
    "line-number"?: number;
    "column-number"?: number;
    "script-sample"?: string;
  };
}

/**
 * Generate a cryptographically secure nonce for CSP
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString("base64");
}

/**
 * Build Content Security Policy header value based on configuration
 */
export function buildCSP(config: CSPConfig = {}): string {
  const {
    nonce,
    isDevelopment = false,
    reportUri,
    _enforceMode = true,
    strictMode = false,
    allowedExternalDomains = [],
    _reportingLevel = "violations",
  } = config;

  // Base directives for all environments
  const baseDirectives = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "upgrade-insecure-requests": true,
  };

  // Script sources - more restrictive in production
  const scriptSrc = isDevelopment
    ? ["'self'", "'unsafe-eval'", "'unsafe-inline'"]
    : nonce
      ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]
      : ["'self'"];

  // Style sources - use nonce in production when available
  const styleSrc = nonce
    ? ["'self'", `'nonce-${nonce}'`]
    : ["'self'", "'unsafe-inline'"]; // Fallback for TailwindCSS

  // Image sources - allow self, data URIs, and specific trusted domains
  const imgSrc = [
    "'self'",
    "data:",
    "https://schema.org", // For structured data images
    "https://livedash.notso.ai", // Application domain
    "https://*.basemaps.cartocdn.com", // Leaflet map tiles
    "https://*.openstreetmap.org", // OpenStreetMap tiles
    ...allowedExternalDomains
      .filter((domain) => domain.startsWith("https://"))
      .map((domain) => domain),
  ].filter(Boolean);

  // Font sources - restrict to self and data URIs
  const fontSrc = ["'self'", "data:"];

  // Connect sources - API endpoints and trusted domains
  const connectSrc = isDevelopment
    ? ["'self'", "https:", "wss:", "ws:"] // Allow broader sources in dev for HMR
    : strictMode
      ? [
          "'self'",
          "https://api.openai.com", // OpenAI API
          "https://livedash.notso.ai", // Application API
          ...allowedExternalDomains.filter(
            (domain) =>
              domain.startsWith("https://") || domain.startsWith("wss://")
          ),
        ].filter(Boolean)
      : [
          "'self'",
          "https://api.openai.com", // OpenAI API
          "https://livedash.notso.ai", // Application API
          "https:", // Allow all HTTPS in non-strict mode
        ];

  // Media sources - restrict to self
  const mediaSrc = ["'self'"];

  // Worker sources - restrict to self
  const workerSrc = ["'self'"];

  // Child sources - restrict to self
  const childSrc = ["'self'"];

  // Manifest sources - restrict to self
  const manifestSrc = ["'self'"];

  // Build the directive object
  const directives = {
    ...baseDirectives,
    "script-src": scriptSrc,
    "style-src": styleSrc,
    "img-src": imgSrc,
    "font-src": fontSrc,
    "connect-src": connectSrc,
    "media-src": mediaSrc,
    "worker-src": workerSrc,
    "child-src": childSrc,
    "manifest-src": manifestSrc,
  };

  // Add report URI if provided
  if (reportUri) {
    directives["report-uri"] = [reportUri];
    directives["report-to"] = ["csp-endpoint"];
  }

  // Convert directives to CSP string
  const cspString = Object.entries(directives)
    .map(([directive, value]) => {
      if (value === true) return directive;
      if (Array.isArray(value)) return `${directive} ${value.join(" ")}`;
      return `${directive} ${value}`;
    })
    .join("; ");

  return cspString;
}

/**
 * Create CSP middleware for Next.js
 */
export function createCSPMiddleware(config: CSPConfig = {}) {
  return (_request: NextRequest) => {
    const nonce = generateNonce();
    const isDevelopment = process.env.NODE_ENV === "development";

    const csp = buildCSP({
      ...config,
      nonce,
      isDevelopment,
    });

    const response = NextResponse.next();

    // Set CSP header
    response.headers.set("Content-Security-Policy", csp);

    // Store nonce for use in components
    response.headers.set("X-Nonce", nonce);

    return response;
  };
}

/**
 * Enhanced CSP validation with security best practices
 */
export function validateCSP(
  csp: string,
  options: { strictMode?: boolean } = {}
): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  securityScore: number;
  recommendations: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const recommendations: string[] = [];
  const { strictMode = false } = options;

  let securityScore = 100;

  // Check for unsafe directives
  if (csp.includes("'unsafe-inline'") && !csp.includes("'nonce-")) {
    warnings.push("Using 'unsafe-inline' without nonce is less secure");
    securityScore -= 15;
    recommendations.push(
      "Implement nonce-based CSP for inline scripts and styles"
    );
  }

  if (csp.includes("'unsafe-eval'")) {
    if (strictMode) {
      errors.push("'unsafe-eval' is not allowed in strict mode");
      securityScore -= 25;
    } else {
      warnings.push("'unsafe-eval' allows dangerous code execution");
      securityScore -= 10;
    }
  }

  // Check for overly permissive directives (but exclude font wildcards and subdomain wildcards)
  const hasProblematicWildcards =
    csp.includes(" *") ||
    csp.includes("*://") ||
    (csp.includes("*") && !csp.includes("*.") && !csp.includes("wss: ws:"));

  if (hasProblematicWildcards) {
    errors.push("Wildcard (*) sources are not recommended");
    securityScore -= 30;
    recommendations.push("Replace wildcards with specific trusted domains");
  }

  if (
    csp.includes("data:") &&
    !csp.includes("img-src") &&
    !csp.includes("font-src")
  ) {
    warnings.push("data: URIs should be limited to specific directives");
    securityScore -= 5;
  }

  // Check for HTTPS upgrade
  if (!csp.includes("upgrade-insecure-requests")) {
    warnings.push("Missing HTTPS upgrade directive");
    securityScore -= 10;
    recommendations.push("Add 'upgrade-insecure-requests' directive");
  }

  // Check for frame protection
  if (!csp.includes("frame-ancestors")) {
    warnings.push("Missing frame-ancestors directive");
    securityScore -= 15;
    recommendations.push(
      "Add 'frame-ancestors 'none'' to prevent clickjacking"
    );
  }

  // Check required directives
  const requiredDirectives = [
    "default-src",
    "script-src",
    "style-src",
    "object-src",
    "base-uri",
    "form-action",
  ];

  for (const directive of requiredDirectives) {
    if (!csp.includes(directive)) {
      errors.push(`Missing required directive: ${directive}`);
      securityScore -= 20;
    }
  }

  // Check for modern CSP features
  if (csp.includes("'nonce-") && !csp.includes("'strict-dynamic'")) {
    recommendations.push(
      "Consider adding 'strict-dynamic' for better nonce-based security"
    );
  }

  // Check reporting setup
  if (!csp.includes("report-uri") && !csp.includes("report-to")) {
    warnings.push("Missing CSP violation reporting");
    securityScore -= 5;
    recommendations.push("Add CSP violation reporting for monitoring");
  }

  // Strict mode additional checks
  if (strictMode) {
    if (csp.includes("https:") && !csp.includes("connect-src")) {
      warnings.push("Broad HTTPS allowlist detected in strict mode");
      securityScore -= 10;
      recommendations.push("Replace 'https:' with specific trusted domains");
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    securityScore: Math.max(0, securityScore),
    recommendations,
  };
}

/**
 * Parse CSP violation report
 */
export function parseCSPViolation(report: CSPViolationReport): {
  directive: string;
  blockedUri: string;
  sourceFile?: string;
  lineNumber?: number;
  isInlineViolation: boolean;
  isCritical: boolean;
} {
  const cspReport = report["csp-report"];

  const isInlineViolation =
    cspReport["blocked-uri"] === "inline" ||
    cspReport["blocked-uri"] === "eval";

  const isCritical =
    cspReport["violated-directive"].startsWith("script-src") ||
    cspReport["violated-directive"].startsWith("object-src");

  return {
    directive: cspReport["violated-directive"],
    blockedUri: cspReport["blocked-uri"],
    sourceFile: cspReport["source-file"],
    lineNumber: cspReport["line-number"],
    isInlineViolation,
    isCritical,
  };
}

/**
 * CSP bypass detection patterns
 */
export const CSP_BYPASS_PATTERNS = [
  // Common XSS bypass attempts
  /javascript:/i,
  /data:text\/html/i,
  /vbscript:/i,
  /livescript:/i,

  // Base64 encoded attempts
  /data:.*base64.*script/i,
  /data:text\/javascript/i,
  /data:application\/javascript/i,

  // JSONP callback manipulation
  /callback=.*script/i,

  // Common CSP bypass techniques
  /location\.href.*javascript/i,
  /document\.write.*script/i,
  /eval\(/i,
  /\bnew\s+Function\s*\(/i,
  /setTimeout\s*\(\s*['"`].*['"`]/i,
  /setInterval\s*\(\s*['"`].*['"`]/i,
];

/**
 * Test CSP implementation with common scenarios
 */
export function testCSPImplementation(csp: string): {
  testResults: Array<{
    name: string;
    passed: boolean;
    description: string;
    recommendation?: string;
  }>;
  overallScore: number;
} {
  const testResults = [];

  // Test 1: Script injection protection
  testResults.push({
    name: "Script Injection Protection",
    passed: !csp.includes("'unsafe-inline'") || csp.includes("'nonce-"),
    description: "Checks if inline scripts are properly controlled",
    recommendation:
      csp.includes("'unsafe-inline'") && !csp.includes("'nonce-")
        ? "Use nonce-based CSP instead of 'unsafe-inline'"
        : undefined,
  });

  // Test 2: Eval protection
  testResults.push({
    name: "Eval Protection",
    passed: !csp.includes("'unsafe-eval'"),
    description: "Ensures eval() and similar functions are blocked",
    recommendation: csp.includes("'unsafe-eval'")
      ? "Remove 'unsafe-eval' to prevent code injection"
      : undefined,
  });

  // Test 3: Object blocking
  testResults.push({
    name: "Object Blocking",
    passed: csp.includes("object-src 'none'"),
    description: "Blocks dangerous object, embed, and applet elements",
    recommendation: !csp.includes("object-src 'none'")
      ? "Add 'object-src 'none'' to block plugins"
      : undefined,
  });

  // Test 4: Frame protection
  testResults.push({
    name: "Frame Protection",
    passed:
      csp.includes("frame-ancestors 'none'") ||
      csp.includes("frame-ancestors 'self'"),
    description: "Prevents clickjacking attacks",
    recommendation: !csp.includes("frame-ancestors")
      ? "Add 'frame-ancestors 'none'' for clickjacking protection"
      : undefined,
  });

  // Test 5: HTTPS enforcement
  testResults.push({
    name: "HTTPS Enforcement",
    passed: csp.includes("upgrade-insecure-requests"),
    description: "Automatically upgrades HTTP requests to HTTPS",
    recommendation: !csp.includes("upgrade-insecure-requests")
      ? "Add 'upgrade-insecure-requests' for automatic HTTPS"
      : undefined,
  });

  // Test 6: Base URI restriction
  testResults.push({
    name: "Base URI Restriction",
    passed: csp.includes("base-uri 'self'") || csp.includes("base-uri 'none'"),
    description: "Prevents base tag injection attacks",
    recommendation: !csp.includes("base-uri")
      ? "Add 'base-uri 'self'' to prevent base tag attacks"
      : undefined,
  });

  // Test 7: Form action restriction
  testResults.push({
    name: "Form Action Restriction",
    passed: csp.includes("form-action 'self'") || csp.includes("form-action"),
    description: "Controls where forms can be submitted",
    recommendation: !csp.includes("form-action")
      ? "Add 'form-action 'self'' to control form submissions"
      : undefined,
  });

  // Test 8: Reporting configuration
  testResults.push({
    name: "Violation Reporting",
    passed: csp.includes("report-uri") || csp.includes("report-to"),
    description: "Enables CSP violation monitoring",
    recommendation:
      !csp.includes("report-uri") && !csp.includes("report-to")
        ? "Add 'report-uri' for violation monitoring"
        : undefined,
  });

  const passedTests = testResults.filter((test) => test.passed).length;
  const overallScore = Math.round((passedTests / testResults.length) * 100);

  return {
    testResults,
    overallScore,
  };
}

/**
 * Detect potential CSP bypass attempts
 */
export function detectCSPBypass(content: string): {
  isDetected: boolean;
  patterns: string[];
  riskLevel: "low" | "medium" | "high";
} {
  const detectedPatterns: string[] = [];

  for (const pattern of CSP_BYPASS_PATTERNS) {
    if (pattern.test(content)) {
      detectedPatterns.push(pattern.source);
    }
  }

  // Determine risk level based on pattern types
  const highRiskPatterns = [
    /javascript:/i,
    /eval\(/i,
    /\bnew\s+Function\s*\(/i,
    /data:text\/javascript/i,
    /data:application\/javascript/i,
    /data:.*base64.*script/i,
  ];

  const hasHighRiskPattern = detectedPatterns.some((pattern) =>
    highRiskPatterns.some((highRisk) => highRisk.source === pattern)
  );

  const riskLevel =
    hasHighRiskPattern || detectedPatterns.length >= 3
      ? "high"
      : detectedPatterns.length >= 1
        ? "medium"
        : "low";

  return {
    isDetected: detectedPatterns.length > 0,
    patterns: detectedPatterns,
    riskLevel,
  };
}
