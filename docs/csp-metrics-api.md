# CSP Metrics and Monitoring API

This document describes the Content Security Policy (CSP) metrics and violation reporting APIs that provide real-time monitoring and analysis of CSP violations.

## Overview

The CSP Metrics API provides comprehensive monitoring of Content Security Policy violations, including:

- Real-time violation tracking and metrics
- Bypass attempt detection and risk assessment
- Policy optimization recommendations
- Historical trend analysis
- Export capabilities for security analysis

## API Endpoints

### CSP Violation Reporting

Endpoint for browsers to report CSP violations (automatic).

```http
POST /api/csp-report
```

#### Request Headers

- `Content-Type`: `application/csp-report` or `application/json`

#### Request Body (Automatic from Browser)

```json
{
  "csp-report": {
    "document-uri": "https://example.com/page",
    "violated-directive": "script-src 'self'",
    "blocked-uri": "https://malicious.com/script.js",
    "source-file": "https://example.com/page",
    "line-number": 42,
    "script-sample": "eval(maliciousCode)"
  }
}
```

#### Features

- **Rate Limiting**: 10 reports per minute per IP
- **Risk Assessment**: Automatic classification of violation severity
- **Bypass Detection**: Identifies potential CSP bypass attempts
- **Real-time Processing**: Immediate analysis and alerting

### CSP Metrics API

Retrieve CSP violation metrics and analytics.

```http
GET /api/csp-metrics
```

#### Query Parameters

| Parameter        | Type    | Description               | Default | Example                |
| ---------------- | ------- | ------------------------- | ------- | ---------------------- |
| `timeRange`      | string  | Time range for metrics    | `24h`   | `?timeRange=7d`        |
| `format`         | string  | Response format           | `json`  | `?format=csv`          |
| `groupBy`        | string  | Group results by field    | `hour`  | `?groupBy=directive`   |
| `includeDetails` | boolean | Include violation details | `false` | `?includeDetails=true` |

#### Time Range Options

- `1h` - Last 1 hour
- `6h` - Last 6 hours
- `24h` - Last 24 hours (default)
- `7d` - Last 7 days
- `30d` - Last 30 days

#### Example Request

```javascript
const response = await fetch(
  "/api/csp-metrics?" +
    new URLSearchParams({
      timeRange: "24h",
      groupBy: "directive",
      includeDetails: "true",
    })
);

const metrics = await response.json();
```

#### Response Format

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalViolations": 45,
      "uniqueViolations": 12,
      "highRiskViolations": 3,
      "bypassAttempts": 1,
      "timeRange": "24h",
      "generatedAt": "2024-01-01T12:00:00Z"
    },
    "trends": {
      "hourlyCount": [
        { "hour": "2024-01-01T11:00:00Z", "count": 5 },
        { "hour": "2024-01-01T12:00:00Z", "count": 8 }
      ],
      "trendDirection": "increasing",
      "changePercent": 25.5
    },
    "topViolations": [
      {
        "directive": "script-src",
        "count": 15,
        "percentage": 33.3,
        "riskLevel": "medium",
        "topBlockedUris": ["https://malicious.com/script.js", "inline"]
      }
    ],
    "riskAnalysis": {
      "overallRiskScore": 65,
      "riskLevel": "medium",
      "criticalIssues": 1,
      "recommendations": [
        "Review script-src policy for external domains",
        "Consider implementing nonce-based CSP"
      ]
    },
    "violations": [
      {
        "timestamp": "2024-01-01T12:00:00Z",
        "directive": "script-src",
        "blockedUri": "https://malicious.com/script.js",
        "sourceFile": "https://example.com/page",
        "riskLevel": "high",
        "bypassAttempt": true,
        "ipAddress": "192.168.1.***",
        "userAgent": "Mozilla/5.0 (masked)"
      }
    ]
  }
}
```

## CSP Monitoring Service

The monitoring service (`lib/csp-monitoring.ts`) provides advanced violation analysis.

### Key Features

#### 1. Real-time Violation Processing

```javascript
// Automatic processing when violations are reported
const result = await cspMonitoring.processViolation(violationReport, clientIP, userAgent);

console.log(result.alertLevel); // low, medium, high, critical
console.log(result.shouldAlert); // boolean
console.log(result.recommendations); // array of suggestions
```

#### 2. Risk Assessment

The service automatically assesses violation risk based on:

- **Directive Type**: Script violations are higher risk than style violations
- **Source Pattern**: External domains vs inline vs data URIs
- **Bypass Indicators**: Known CSP bypass techniques
- **Frequency**: Repeated violations from same source
- **Geographic Factors**: Unusual source locations

#### 3. Bypass Detection

Automatic detection of common CSP bypass attempts:

```javascript
const bypassPatterns = [
  /javascript:/i, // javascript: protocol injection
  /data:text\/html/i, // HTML data URI injection
  /eval\(/i, // Direct eval() calls
  /Function\(/i, // Function constructor
  /setTimeout.*string/i, // Timer string execution
  /location\s*=/i, // Location manipulation
  /document\.write/i, // Document.write injection
];
```

#### 4. Policy Recommendations

Based on violation patterns, the service provides actionable recommendations:

- **Tighten Policies**: Suggest removing broad allowlists
- **Add Domains**: Recommend allowing legitimate external resources
- **Implement Nonces**: Suggest nonce-based policies for inline content
- **Upgrade Directives**: Recommend modern CSP features

## Violation Analysis

### Risk Levels

| Risk Level   | Score  | Description                                   | Action                  |
| ------------ | ------ | --------------------------------------------- | ----------------------- |
| **Critical** | 90-100 | Active bypass attempts, known attack patterns | Immediate investigation |
| **High**     | 70-89  | Suspicious patterns, potential security risks | Urgent review           |
| **Medium**   | 40-69  | Policy violations, may need attention         | Regular monitoring      |
| **Low**      | 0-39   | Minor violations, likely legitimate           | Log for trends          |

### Alert Conditions

```javascript
// High-risk violations trigger immediate alerts
const alertConditions = {
  critical: {
    bypassAttempt: true,
    unknownExternalDomain: true,
    suspiciousUserAgent: true,
  },
  high: {
    repeatedViolations: ">5 in 10 minutes",
    scriptInjectionAttempt: true,
    dataUriWithScript: true,
  },
  medium: {
    newExternalDomain: true,
    inlineScriptViolation: true,
    unknownSource: true,
  },
};
```

## Usage Examples

### Real-time Violation Monitoring

```javascript
// Monitor violations in real-time
async function monitorViolations() {
  const metrics = await fetch("/api/csp-metrics?timeRange=1h");
  const data = await metrics.json();

  if (data.data.summary.highRiskViolations > 0) {
    console.warn("High-risk CSP violations detected:", data.data.summary.highRiskViolations);

    // Get violation details
    const details = await fetch("/api/csp-metrics?includeDetails=true");
    const violations = await details.json();

    violations.data.violations
      .filter((v) => v.riskLevel === "high")
      .forEach((violation) => {
        console.error("High-risk violation:", {
          directive: violation.directive,
          blockedUri: violation.blockedUri,
          timestamp: violation.timestamp,
        });
      });
  }
}

// Run every 5 minutes
setInterval(monitorViolations, 5 * 60 * 1000);
```

### Security Dashboard Integration

```javascript
// Get CSP metrics for security dashboard
async function getCSPDashboardData() {
  const [current, previous] = await Promise.all([
    fetch("/api/csp-metrics?timeRange=24h").then((r) => r.json()),
    fetch("/api/csp-metrics?timeRange=24h&offset=24h").then((r) => r.json()),
  ]);

  return {
    currentViolations: current.data.summary.totalViolations,
    previousViolations: previous.data.summary.totalViolations,
    trend: current.data.trends.trendDirection,
    riskScore: current.data.riskAnalysis.overallRiskScore,
    recommendations: current.data.riskAnalysis.recommendations.slice(0, 3),
  };
}
```

### Export Violation Data

```javascript
// Export violations for external analysis
async function exportViolations(format = "csv", timeRange = "7d") {
  const response = await fetch(`/api/csp-metrics?format=${format}&timeRange=${timeRange}`);

  if (format === "csv") {
    const csvData = await response.text();
    downloadFile(csvData, `csp-violations-${timeRange}.csv`, "text/csv");
  } else {
    const jsonData = await response.json();
    downloadFile(
      JSON.stringify(jsonData, null, 2),
      `csp-violations-${timeRange}.json`,
      "application/json"
    );
  }
}

function downloadFile(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Policy Optimization

```javascript
// Analyze violations to optimize CSP policy
async function optimizeCSPPolicy() {
  const metrics = await fetch("/api/csp-metrics?timeRange=30d&includeDetails=true");
  const data = await metrics.json();

  // Group violations by directive
  const violationsByDirective = data.data.violations.reduce((acc, violation) => {
    if (!acc[violation.directive]) {
      acc[violation.directive] = [];
    }
    acc[violation.directive].push(violation);
    return acc;
  }, {});

  // Generate recommendations
  const recommendations = Object.entries(violationsByDirective).map(([directive, violations]) => {
    const uniqueDomains = [...new Set(violations.map((v) => v.blockedUri))];
    const legitimateCount = violations.filter((v) => v.riskLevel === "low").length;

    if (legitimateCount > violations.length * 0.8) {
      return {
        directive,
        action: "allow",
        domains: uniqueDomains.slice(0, 5),
        confidence: "high",
      };
    } else {
      return {
        directive,
        action: "investigate",
        riskDomains: uniqueDomains.filter(
          (_, i) => violations.find((v) => v.blockedUri === uniqueDomains[i])?.riskLevel === "high"
        ),
        confidence: "medium",
      };
    }
  });

  return recommendations;
}
```

## Configuration and Setup

### CSP Header Configuration

The CSP metrics system requires proper CSP headers with reporting:

```javascript
// In next.config.js or middleware
const cspDirectives = {
  "default-src": "'self'",
  "script-src": "'self' 'nonce-{NONCE}'",
  "report-uri": "/api/csp-report",
  "report-to": "csp-endpoint",
};
```

### Report-To Header

For modern browsers, configure the Report-To header:

```javascript
const reportToHeader = JSON.stringify({
  group: "csp-endpoint",
  max_age: 86400,
  endpoints: [{ url: "/api/csp-report" }],
});

// Add to response headers
headers["Report-To"] = reportToHeader;
```

### Environment Configuration

```bash
# Enable CSP monitoring in production
NODE_ENV=production

# Optional: Configure monitoring sensitivity
CSP_MONITORING_SENSITIVITY=medium  # low, medium, high
CSP_ALERT_THRESHOLD=5              # violations per 10 minutes
```

## Performance Considerations

### Rate Limiting

- **10 reports per minute per IP** prevents spam attacks
- **Exponential backoff** for repeated violations from same source
- **Memory cleanup** removes old violations automatically

### Memory Management

- **Violation buffer** limited to 1 hour of data in memory
- **Automatic cleanup** runs every 100 requests (1% probability)
- **Efficient storage** using Map data structures

### Database Impact

- **No persistent storage** for real-time metrics (memory only)
- **Optional logging** to database for long-term analysis
- **Indexed queries** for historical data retrieval

## Security Considerations

### Privacy Protection

**⚠️ Data Collection Notice:**
- **IP addresses** are collected and stored in memory for security monitoring
- **User agent strings** are stored for browser compatibility analysis
- **Legal basis**: Legitimate interest for security incident detection and prevention
- **Retention**: In-memory storage only, automatically purged after 7 days or application restart
- **Data minimization**: Only violation-related metadata is retained, not page content

**Planned Privacy Enhancements:**
- IP anonymization options for GDPR compliance (roadmap)
- User agent sanitization to remove sensitive information (roadmap)

### Rate Limiting Protection

- **Per-IP limits** prevent DoS attacks on reporting endpoint
- **Content-type validation** ensures proper report format
- **Request size limits** prevent memory exhaustion

### False Positive Handling

- **Learning mode** for new deployments
- **Whitelist support** for known legitimate violations
- **Risk score adjustment** based on historical patterns

## Troubleshooting

### Common Issues

#### High False Positive Rate

```javascript
// Check for legitimate violations being flagged
const metrics = await fetch("/api/csp-metrics?includeDetails=true");
const data = await metrics.json();

const falsePositives = data.data.violations.filter(
  (v) => v.riskLevel === "high" && v.blockedUri.includes("legitimate-domain.com")
);

if (falsePositives.length > 0) {
  console.log("Consider whitelisting:", falsePositives[0].blockedUri);
}
```

#### Missing Violation Reports

```javascript
// Check if CSP headers are properly configured
fetch("/").then((response) => {
  const csp = response.headers.get("Content-Security-Policy");
  if (!csp.includes("report-uri")) {
    console.error("CSP report-uri directive missing");
  }
});
```

#### Performance Issues

```javascript
// Monitor API response times
const start = performance.now();
const response = await fetch("/api/csp-metrics");
const duration = performance.now() - start;

if (duration > 2000) {
  console.warn("CSP metrics API slow response:", duration + "ms");
}
```

## Related Documentation

- [Enhanced CSP Implementation](./security/enhanced-csp.md)
- [Security Monitoring](./security-monitoring.md)
- [Security Headers](./security-headers.md)
- [Rate Limiting](../lib/rateLimiter.ts)

## API Reference Summary

| Endpoint           | Method | Purpose                             | Auth Required |
| ------------------ | ------ | ----------------------------------- | ------------- |
| `/api/csp-report`  | POST   | Receive CSP violation reports       | No (public)   |
| `/api/csp-metrics` | GET    | Get violation metrics and analytics | Admin         |

Both APIs are production-ready and provide comprehensive CSP monitoring capabilities for enterprise security requirements.
