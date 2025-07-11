import { type NextRequest, NextResponse } from "next/server";
import {
  type CSPViolationReport,
  detectCSPBypass,
  parseCSPViolation,
} from "@/lib/csp";
import { cspMonitoring } from "@/lib/csp-monitoring";
import { rateLimiter } from "@/lib/rateLimiter";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting for CSP reports
    const ip =
      request.ip || request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitResult = await rateLimiter.check(
      `csp-report:${ip}`,
      10, // 10 reports
      60 * 1000 // per minute
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many CSP reports" },
        { status: 429 }
      );
    }

    const contentType = request.headers.get("content-type");
    if (
      !contentType?.includes("application/csp-report") &&
      !contentType?.includes("application/json")
    ) {
      return NextResponse.json(
        { error: "Invalid content type" },
        { status: 400 }
      );
    }

    const report: CSPViolationReport = await request.json();

    if (!report["csp-report"]) {
      return NextResponse.json(
        { error: "Invalid CSP report format" },
        { status: 400 }
      );
    }

    // Process violation through monitoring service
    const monitoringResult = await cspMonitoring.processViolation(
      report,
      ip,
      request.headers.get("user-agent") || undefined
    );

    // Enhanced logging based on monitoring analysis
    const logEntry = {
      timestamp: new Date().toISOString(),
      ip,
      userAgent: request.headers.get("user-agent"),
      violation: parseCSPViolation(report),
      bypassDetection: detectCSPBypass(
        report["csp-report"]["blocked-uri"] +
          " " +
          (report["csp-report"]["script-sample"] || "")
      ),
      originalReport: report,
      alertLevel: monitoringResult.alertLevel,
      shouldAlert: monitoringResult.shouldAlert,
      recommendations: monitoringResult.recommendations,
    };

    // In development, log to console with recommendations
    if (process.env.NODE_ENV === "development") {
      console.warn("🚨 CSP Violation Detected:", {
        ...logEntry,
        recommendations: monitoringResult.recommendations,
      });

      if (monitoringResult.recommendations.length > 0) {
        console.info("💡 Recommendations:", monitoringResult.recommendations);
      }
    }

    // Enhanced alerting based on monitoring service analysis
    if (monitoringResult.shouldAlert) {
      const alertEmoji = {
        low: "🟡",
        medium: "🟠",
        high: "🔴",
        critical: "🚨",
      }[monitoringResult.alertLevel];

      console.error(
        `${alertEmoji} CSP ${monitoringResult.alertLevel.toUpperCase()} ALERT:`,
        {
          directive: logEntry.violation.directive,
          blockedUri: logEntry.violation.blockedUri,
          isBypassAttempt: logEntry.bypassDetection.isDetected,
          riskLevel: logEntry.bypassDetection.riskLevel,
          recommendations: monitoringResult.recommendations.slice(0, 3), // Limit to 3 recommendations
        }
      );
    }

    // Clean up old violations periodically (every 100 requests)
    if (Math.random() < 0.01) {
      cspMonitoring.cleanupOldViolations();
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error processing CSP report:", error);
    return NextResponse.json(
      { error: "Failed to process report" },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
