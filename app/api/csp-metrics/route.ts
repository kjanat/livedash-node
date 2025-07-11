import { type NextRequest, NextResponse } from "next/server";
import { cspMonitoring } from "@/lib/csp-monitoring";
import { rateLimiter } from "@/lib/rateLimiter";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting for metrics endpoint
    const ip =
      request.ip || request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitResult = await rateLimiter.check(
      `csp-metrics:${ip}`,
      30, // 30 requests
      60 * 1000 // per minute
    );

    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const timeRange = url.searchParams.get("range") || "24h";
    const format = url.searchParams.get("format") || "json";

    // Calculate time range
    const now = new Date();
    let start: Date;

    switch (timeRange) {
      case "1h":
        start = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case "6h":
        start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case "24h":
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get metrics from monitoring service
    const metrics = cspMonitoring.getMetrics({ start, end: now });

    // Get policy recommendations
    const recommendations = cspMonitoring.generatePolicyRecommendations({
      start,
      end: now,
    });

    const response = {
      timeRange: {
        start: start.toISOString(),
        end: now.toISOString(),
        range: timeRange,
      },
      summary: {
        totalViolations: metrics.totalViolations,
        criticalViolations: metrics.criticalViolations,
        bypassAttempts: metrics.bypassAttempts,
        violationRate:
          metrics.totalViolations /
          ((now.getTime() - start.getTime()) / (60 * 60 * 1000)), // per hour
      },
      topViolatedDirectives: metrics.topViolatedDirectives,
      topBlockedUris: metrics.topBlockedUris,
      violationTrends: metrics.violationTrends,
      recommendations: recommendations,
      lastUpdated: now.toISOString(),
    };

    // Export format handling
    if (format === "csv") {
      const csv = cspMonitoring.exportViolations("csv");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="csp-violations-${timeRange}.csv"`,
        },
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching CSP metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
