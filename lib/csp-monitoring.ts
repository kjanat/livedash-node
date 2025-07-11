import {
  type CSPViolationReport,
  detectCSPBypass,
  parseCSPViolation,
} from "./csp";

export interface CSPMetrics {
  totalViolations: number;
  criticalViolations: number;
  bypassAttempts: number;
  topViolatedDirectives: Array<{ directive: string; count: number }>;
  topBlockedUris: Array<{ uri: string; count: number }>;
  violationTrends: Array<{ date: string; count: number }>;
}

export interface CSPAlert {
  id: string;
  timestamp: Date;
  severity: "low" | "medium" | "high" | "critical";
  type: "violation" | "bypass_attempt" | "policy_change" | "threshold_exceeded";
  message: string;
  metadata: Record<string, unknown>;
}

export class CSPMonitoringService {
  private violations: Array<{
    timestamp: Date;
    ip: string;
    userAgent?: string;
    violation: ReturnType<typeof parseCSPViolation>;
    bypassDetection: ReturnType<typeof detectCSPBypass>;
    originalReport: CSPViolationReport;
  }> = [];

  private alerts: CSPAlert[] = [];
  private alertThresholds = {
    violationsPerMinute: 10,
    bypassAttemptsPerHour: 5,
    criticalViolationsPerHour: 3,
  };

  /**
   * Process a CSP violation report
   */
  async processViolation(
    report: CSPViolationReport,
    ip: string,
    userAgent?: string
  ): Promise<{
    shouldAlert: boolean;
    alertLevel: "low" | "medium" | "high" | "critical";
    recommendations: string[];
  }> {
    const violation = parseCSPViolation(report);
    const bypassDetection = detectCSPBypass(
      report["csp-report"]["blocked-uri"] +
        " " +
        (report["csp-report"]["script-sample"] || "")
    );

    // Store violation
    this.violations.push({
      timestamp: new Date(),
      ip,
      userAgent,
      violation,
      bypassDetection,
      originalReport: report,
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      violation,
      bypassDetection
    );

    // Determine alert level
    const alertLevel = this.determineAlertLevel(violation, bypassDetection);

    // Check if we should alert
    const shouldAlert = await this.shouldTriggerAlert(
      violation,
      bypassDetection
    );

    if (shouldAlert) {
      await this.createAlert({
        severity: alertLevel,
        type: bypassDetection.isDetected ? "bypass_attempt" : "violation",
        message: this.formatAlertMessage(violation, bypassDetection),
        metadata: {
          directive: violation.directive,
          blockedUri: violation.blockedUri,
          ip,
          userAgent,
          bypassRisk: bypassDetection.riskLevel,
        },
      });
    }

    return {
      shouldAlert,
      alertLevel,
      recommendations,
    };
  }

  /**
   * Get CSP violation metrics
   */
  getMetrics(timeRange: { start: Date; end: Date }): CSPMetrics {
    const filteredViolations = this.violations.filter(
      (v) => v.timestamp >= timeRange.start && v.timestamp <= timeRange.end
    );

    // Count violations by directive
    const directiveCounts = new Map<string, number>();
    const uriCounts = new Map<string, number>();
    const dailyCounts = new Map<string, number>();

    for (const v of filteredViolations) {
      // Directive counts
      const directive = v.violation.directive;
      directiveCounts.set(directive, (directiveCounts.get(directive) || 0) + 1);

      // URI counts
      const uri = v.violation.blockedUri;
      uriCounts.set(uri, (uriCounts.get(uri) || 0) + 1);

      // Daily counts
      const dateKey = v.timestamp.toISOString().split("T")[0];
      dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1);
    }

    return {
      totalViolations: filteredViolations.length,
      criticalViolations: filteredViolations.filter(
        (v) => v.violation.isCritical
      ).length,
      bypassAttempts: filteredViolations.filter(
        (v) => v.bypassDetection.isDetected
      ).length,
      topViolatedDirectives: Array.from(directiveCounts.entries())
        .map(([directive, count]) => ({ directive, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topBlockedUris: Array.from(uriCounts.entries())
        .map(([uri, count]) => ({ uri, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      violationTrends: Array.from(dailyCounts.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  /**
   * Generate policy recommendations based on violations
   */
  generatePolicyRecommendations(timeRange: { start: Date; end: Date }): {
    allowlist: string[];
    tighten: string[];
    investigate: string[];
  } {
    const metrics = this.getMetrics(timeRange);
    const allowlist: string[] = [];
    const tighten: string[] = [];
    const investigate: string[] = [];

    // Analyze top blocked URIs for potential allowlisting
    for (const { uri, count } of metrics.topBlockedUris) {
      if (count > 5 && this.isLegitimateResource(uri)) {
        allowlist.push(`Consider allowlisting: ${uri} (${count} violations)`);
      } else if (count > 10) {
        investigate.push(
          `High volume blocking: ${uri} (${count} violations) - investigate if legitimate`
        );
      }
    }

    // Analyze directives for tightening
    for (const { directive, count } of metrics.topViolatedDirectives) {
      if (directive.includes("'unsafe-")) {
        tighten.push(
          `${directive} has ${count} violations - consider removing unsafe directives`
        );
      } else if (count > 20) {
        tighten.push(
          `${directive} has high violation count (${count}) - review necessity`
        );
      }
    }

    return { allowlist, tighten, investigate };
  }

  /**
   * Export violations for external analysis
   */
  exportViolations(format: "json" | "csv" = "json"): string {
    if (format === "csv") {
      const headers = [
        "timestamp",
        "ip",
        "userAgent",
        "directive",
        "blockedUri",
        "sourceFile",
        "lineNumber",
        "isCritical",
        "isInlineViolation",
        "bypassDetected",
        "riskLevel",
      ].join(",");

      const rows = this.violations.map((v) =>
        [
          v.timestamp.toISOString(),
          v.ip,
          v.userAgent || "",
          v.violation.directive,
          v.violation.blockedUri,
          v.violation.sourceFile || "",
          v.violation.lineNumber || "",
          v.violation.isCritical.toString(),
          v.violation.isInlineViolation.toString(),
          v.bypassDetection.isDetected.toString(),
          v.bypassDetection.riskLevel,
        ]
          .map((field) => `"${field}"`)
          .join(",")
      );

      return [headers, ...rows].join("\n");
    }

    return JSON.stringify(this.violations, null, 2);
  }

  private generateRecommendations(
    violation: ReturnType<typeof parseCSPViolation>,
    bypassDetection: ReturnType<typeof detectCSPBypass>
  ): string[] {
    const recommendations: string[] = [];

    if (violation.isInlineViolation) {
      recommendations.push("Consider using nonce-based CSP for inline content");
    }

    if (violation.directive.startsWith("script-src")) {
      recommendations.push(
        "Review script sources and consider using 'strict-dynamic'"
      );
    }

    if (bypassDetection.isDetected) {
      recommendations.push(
        "Potential security threat detected - investigate immediately"
      );

      if (bypassDetection.riskLevel === "high") {
        recommendations.push(
          "High-risk bypass attempt - consider blocking source IP"
        );
      }
    }

    if (violation.blockedUri.includes("data:")) {
      recommendations.push(
        "Review data URI usage - limit to necessary resources only"
      );
    }

    return recommendations;
  }

  private determineAlertLevel(
    violation: ReturnType<typeof parseCSPViolation>,
    bypassDetection: ReturnType<typeof detectCSPBypass>
  ): "low" | "medium" | "high" | "critical" {
    if (bypassDetection.isDetected && bypassDetection.riskLevel === "high") {
      return "critical";
    }

    if (violation.isCritical || bypassDetection.riskLevel === "high") {
      return "high";
    }

    if (bypassDetection.isDetected || violation.isInlineViolation) {
      return "medium";
    }

    return "low";
  }

  private async shouldTriggerAlert(
    violation: ReturnType<typeof parseCSPViolation>,
    bypassDetection: ReturnType<typeof detectCSPBypass>
  ): Promise<boolean> {
    // Always alert on critical violations or high-risk bypass attempts
    if (violation.isCritical || bypassDetection.riskLevel === "high") {
      return true;
    }

    // Check rate-based thresholds
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const recentViolations = this.violations.filter(
      (v) => v.timestamp >= oneMinuteAgo
    );
    const recentBypassAttempts = this.violations.filter(
      (v) => v.timestamp >= oneHourAgo && v.bypassDetection.isDetected
    );
    const recentCriticalViolations = this.violations.filter(
      (v) => v.timestamp >= oneHourAgo && v.violation.isCritical
    );

    return (
      recentViolations.length >= this.alertThresholds.violationsPerMinute ||
      recentBypassAttempts.length >=
        this.alertThresholds.bypassAttemptsPerHour ||
      recentCriticalViolations.length >=
        this.alertThresholds.criticalViolationsPerHour
    );
  }

  private async createAlert(
    alertData: Omit<CSPAlert, "id" | "timestamp">
  ): Promise<void> {
    const alert: CSPAlert = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...alertData,
    };

    this.alerts.push(alert);

    // In production, you would send this to your monitoring service
    console.error(
      `🚨 CSP Alert [${alert.severity.toUpperCase()}]: ${alert.message}`
    );

    // You could integrate with services like:
    // - Slack/Discord webhooks
    // - PagerDuty
    // - Email alerts
    // - Monitoring dashboards (DataDog, New Relic, etc.)
  }

  private formatAlertMessage(
    violation: ReturnType<typeof parseCSPViolation>,
    bypassDetection: ReturnType<typeof detectCSPBypass>
  ): string {
    if (bypassDetection.isDetected) {
      return `CSP bypass attempt detected: ${violation.directive} blocked ${violation.blockedUri} (Risk: ${bypassDetection.riskLevel})`;
    }

    return `CSP violation: ${violation.directive} blocked ${violation.blockedUri}${violation.isCritical ? " (CRITICAL)" : ""}`;
  }

  private isLegitimateResource(uri: string): boolean {
    // Simple heuristics to identify potentially legitimate resources
    const legitimatePatterns = [
      /^https:\/\/[a-zA-Z0-9.-]+\.(googleapis|gstatic|cloudflare|jsdelivr|unpkg)\.com/,
      /^https:\/\/[a-zA-Z0-9.-]+\.(png|jpg|jpeg|gif|svg|webp|ico)$/,
      /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
      /^https:\/\/api\.[a-zA-Z0-9.-]+\.com/,
    ];

    return legitimatePatterns.some((pattern) => pattern.test(uri));
  }

  /**
   * Clean up old violations to prevent memory leaks
   */
  cleanupOldViolations(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAge);
    this.violations = this.violations.filter((v) => v.timestamp >= cutoff);
    this.alerts = this.alerts.filter((a) => a.timestamp >= cutoff);
  }
}

// Singleton instance for application use
export const cspMonitoring = new CSPMonitoringService();
