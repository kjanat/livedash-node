// CSP types and browser-safe utilities
// Server-only functions (generateNonce, buildCSP) are in csp-server.ts

export interface CSPConfig {
  nonce?: string;
  isDevelopment?: boolean;
  reportUri?: string;
  enforceMode?: boolean;
  strictMode?: boolean;
  allowedExternalDomains?: string[];
  reportingLevel?: "none" | "violations" | "all";
}

/**
 * Build Content Security Policy string based on configuration
 */
export function buildCSPString(config: CSPConfig = {}): string {
  const {
    nonce,
    isDevelopment = false,
    reportUri,
    strictMode = false,
    allowedExternalDomains = [],
  } = config;

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "style-src": ["'self'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "upgrade-insecure-requests": [],
  };

  // Script source configuration
  if (isDevelopment) {
    directives["script-src"].push("'unsafe-eval'", "'unsafe-inline'");
  } else if (nonce) {
    directives["script-src"].push(
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'unsafe-inline'" // Required for browsers that don't support nonce
    );
  }

  // Style source configuration
  if (isDevelopment) {
    directives["style-src"].push("'unsafe-inline'");
  } else if (nonce) {
    directives["style-src"].push(`'nonce-${nonce}'`);
  }

  // Development-specific relaxations
  if (isDevelopment) {
    // Allow WebSocket connections for hot reload
    directives["connect-src"].push("ws:", "wss:");
    // Allow local development servers
    directives["connect-src"].push("http://localhost:*", "http://127.0.0.1:*");
  }

  // Map tile sources
  directives["img-src"].push(
    "https://*.basemaps.cartocdn.com",
    "https://*.openstreetmap.org",
    "https://unpkg.com" // For Leaflet markers
  );

  // External domains configuration
  if (allowedExternalDomains.length > 0) {
    directives["connect-src"].push(...allowedExternalDomains);
  } else if (!strictMode) {
    // In non-strict mode, allow HTTPS connections
    directives["connect-src"].push("https:");
  }

  // Worker sources
  directives["worker-src"] = ["'self'", "blob:"];

  // Media sources
  directives["media-src"] = ["'self'"];

  // Manifest source
  directives["manifest-src"] = ["'self'"];

  // Report URI
  if (reportUri) {
    directives["report-uri"] = [reportUri];
    directives["report-to"] = ["csp-endpoint"];
  }

  // Build the CSP string
  return Object.entries(directives)
    .filter(
      ([_, values]) =>
        values.length > 0 ||
        ["upgrade-insecure-requests", "block-all-mixed-content"].includes(_)
    )
    .map(([directive, values]) => {
      if (values.length === 0) {
        return directive;
      }
      return `${directive} ${values.join(" ")}`;
    })
    .join("; ");
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
 * Helper function to check unsafe directives
 */
function checkUnsafeDirectives(
  csp: string,
  strictMode: boolean,
  warnings: string[],
  errors: string[],
  recommendations: string[]
): number {
  let scorePenalty = 0;

  if (csp.includes("'unsafe-inline'") && !csp.includes("'nonce-")) {
    warnings.push("Using 'unsafe-inline' without nonce is less secure");
    scorePenalty += 15;
    recommendations.push(
      "Implement nonce-based CSP for inline scripts and styles"
    );
  }

  if (csp.includes("'unsafe-eval'")) {
    if (strictMode) {
      errors.push("'unsafe-eval' is not allowed in strict mode");
      scorePenalty += 25;
    } else {
      warnings.push("'unsafe-eval' allows dangerous code execution");
      scorePenalty += 10;
    }
  }

  return scorePenalty;
}

/**
 * Helper function to check wildcard usage
 */
function checkWildcardUsage(
  csp: string,
  errors: string[],
  recommendations: string[]
): number {
  const hasProblematicWildcards =
    csp.includes(" *") ||
    csp.includes("*://") ||
    (csp.includes("*") && !csp.includes("*.") && !csp.includes("wss: ws:"));

  if (hasProblematicWildcards) {
    errors.push("Wildcard (*) sources are not recommended");
    recommendations.push("Replace wildcards with specific trusted domains");
    return 30;
  }

  return 0;
}

/**
 * Helper function to check security features
 */
function checkSecurityFeatures(
  csp: string,
  warnings: string[],
  recommendations: string[]
): number {
  let scorePenalty = 0;

  if (
    csp.includes("data:") &&
    !csp.includes("img-src") &&
    !csp.includes("font-src")
  ) {
    warnings.push("data: URIs should be limited to specific directives");
    scorePenalty += 5;
  }

  if (!csp.includes("upgrade-insecure-requests")) {
    warnings.push("Missing HTTPS upgrade directive");
    scorePenalty += 10;
    recommendations.push("Add 'upgrade-insecure-requests' directive");
  }

  if (!csp.includes("frame-ancestors")) {
    warnings.push("Missing frame-ancestors directive");
    scorePenalty += 15;
    recommendations.push(
      "Add 'frame-ancestors 'none'' to prevent clickjacking"
    );
  }

  return scorePenalty;
}

/**
 * Helper function to check required directives
 */
function checkRequiredDirectives(csp: string, errors: string[]): number {
  const requiredDirectives = [
    "default-src",
    "script-src",
    "style-src",
    "object-src",
    "base-uri",
    "form-action",
  ];

  let scorePenalty = 0;
  for (const directive of requiredDirectives) {
    if (!csp.includes(directive)) {
      errors.push(`Missing required directive: ${directive}`);
      scorePenalty += 20;
    }
  }

  return scorePenalty;
}

/**
 * Helper function to check additional features
 */
function checkAdditionalFeatures(
  csp: string,
  strictMode: boolean,
  warnings: string[],
  recommendations: string[]
): number {
  let scorePenalty = 0;

  if (csp.includes("'nonce-") && !csp.includes("'strict-dynamic'")) {
    recommendations.push(
      "Consider adding 'strict-dynamic' for better nonce-based security"
    );
  }

  if (!csp.includes("report-uri") && !csp.includes("report-to")) {
    warnings.push("Missing CSP violation reporting");
    scorePenalty += 5;
    recommendations.push("Add CSP violation reporting for monitoring");
  }

  if (strictMode) {
    if (csp.includes("https:") && !csp.includes("connect-src")) {
      warnings.push("Broad HTTPS allowlist detected in strict mode");
      scorePenalty += 10;
      recommendations.push("Replace 'https:' with specific trusted domains");
    }
  }

  return scorePenalty;
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

  securityScore -= checkUnsafeDirectives(
    csp,
    strictMode,
    warnings,
    errors,
    recommendations
  );
  securityScore -= checkWildcardUsage(csp, errors, recommendations);
  securityScore -= checkSecurityFeatures(csp, warnings, recommendations);
  securityScore -= checkRequiredDirectives(csp, errors);
  securityScore -= checkAdditionalFeatures(
    csp,
    strictMode,
    warnings,
    recommendations
  );

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
 * CSP bypass detection patterns - optimized to prevent ReDoS attacks
 */
export const CSP_BYPASS_PATTERNS = [
  // Common XSS bypass attempts (exact matches to prevent ReDoS)
  /^javascript:/i,
  /^data:text\/html/i,
  /^vbscript:/i,
  /^livescript:/i,

  // Base64 encoded attempts (limited quantifiers to prevent ReDoS)
  /^data:[^;]{0,50};base64[^,]{0,100},.*script/i,
  /^data:text\/javascript/i,
  /^data:application\/javascript/i,

  // JSONP callback manipulation (limited lookahead)
  /callback=[^&]{0,200}script/i,

  // Common CSP bypass techniques (limited quantifiers)
  /location\.href[^;]{0,100}javascript/i,
  /document\.write[^;]{0,100}script/i,
  /\beval\s*\(/i,
  /\bnew\s+Function\s*\(/i,
  /setTimeout\s*\(\s*['"`][^'"`]{0,500}['"`]/i,
  /setInterval\s*\(\s*['"`][^'"`]{0,500}['"`]/i,
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

  // Determine risk level based on pattern types (ReDoS-safe patterns)
  const highRiskPatterns = [
    /^javascript:/i,
    /\beval\s*\(/i,
    /\bnew\s+Function\s*\(/i,
    /^data:text\/javascript/i,
    /^data:application\/javascript/i,
    /^data:[^;]{0,50};base64[^,]{0,100},.*script/i,
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
