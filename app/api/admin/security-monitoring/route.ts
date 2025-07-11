import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  AuditOutcome,
  createAuditContext,
  securityAuditLogger,
} from "@/lib/securityAuditLogger";
import {
  type AlertSeverity,
  securityMonitoring,
} from "@/lib/securityMonitoring";

const metricsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  companyId: z.string().uuid().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

const configUpdateSchema = z.object({
  thresholds: z
    .object({
      failedLoginsPerMinute: z.number().min(1).max(100).optional(),
      failedLoginsPerHour: z.number().min(1).max(1000).optional(),
      rateLimitViolationsPerMinute: z.number().min(1).max(100).optional(),
      cspViolationsPerMinute: z.number().min(1).max(100).optional(),
      adminActionsPerHour: z.number().min(1).max(100).optional(),
      massDataAccessThreshold: z.number().min(10).max(10000).optional(),
      suspiciousIPThreshold: z.number().min(1).max(100).optional(),
    })
    .optional(),
  alerting: z
    .object({
      enabled: z.boolean().optional(),
      channels: z
        .array(z.enum(["EMAIL", "WEBHOOK", "SLACK", "DISCORD", "PAGERDUTY"]))
        .optional(),
      suppressDuplicateMinutes: z.number().min(1).max(1440).optional(),
      escalationTimeoutMinutes: z.number().min(5).max(1440).optional(),
    })
    .optional(),
  retention: z
    .object({
      alertRetentionDays: z.number().min(1).max(3650).optional(),
      metricsRetentionDays: z.number().min(1).max(3650).optional(),
    })
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only platform admins can access security monitoring
    if (!session.user.isPlatformUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const query = metricsQuerySchema.parse(params);

    const context = await createAuditContext(request, session);

    const timeRange = {
      start: query.startDate
        ? new Date(query.startDate)
        : new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: query.endDate ? new Date(query.endDate) : new Date(),
    };

    // Get security metrics
    const metrics = await securityMonitoring.getSecurityMetrics(
      timeRange,
      query.companyId
    );

    // Get active alerts
    const alerts = securityMonitoring.getActiveAlerts(
      query.severity as AlertSeverity
    );

    // Get monitoring configuration
    const config = securityMonitoring.getConfig();

    // Log access to security monitoring
    await securityAuditLogger.logPlatformAdmin(
      "security_monitoring_access",
      AuditOutcome.SUCCESS,
      context
    );

    return NextResponse.json({
      metrics,
      alerts,
      config,
      timeRange,
    });
  } catch (error) {
    console.error("Security monitoring API error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.isPlatformUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const config = configUpdateSchema.parse(body);
    const context = await createAuditContext(request, session);

    // Update monitoring configuration
    securityMonitoring.updateConfig(config);

    // Log configuration change
    await securityAuditLogger.logPlatformAdmin(
      "security_monitoring_config_update",
      AuditOutcome.SUCCESS,
      context,
      undefined,
      { configChanges: config }
    );

    return NextResponse.json({
      success: true,
      config: securityMonitoring.getConfig(),
    });
  } catch (error) {
    console.error("Security monitoring config update error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid configuration", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
