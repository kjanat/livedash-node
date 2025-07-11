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

const alertQuerySchema = z.object({
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  acknowledged: z.enum(["true", "false"]).optional(),
  limit: z
    .string()
    .transform((val) => Number.parseInt(val, 10))
    .optional(),
  offset: z
    .string()
    .transform((val) => Number.parseInt(val, 10))
    .optional(),
});

const acknowledgeAlertSchema = z.object({
  alertId: z.string().uuid(),
  action: z.literal("acknowledge"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !session.user.isPlatformUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const query = alertQuerySchema.parse(params);

    const context = await createAuditContext(request, session);

    // Get alerts based on filters
    const alerts = securityMonitoring.getActiveAlerts(
      query.severity as AlertSeverity
    );

    // Apply pagination
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const paginatedAlerts = alerts.slice(offset, offset + limit);

    // Log alert access
    await securityAuditLogger.logPlatformAdmin(
      "security_alerts_access",
      AuditOutcome.SUCCESS,
      context,
      undefined,
      {
        alertCount: alerts.length,
        filters: query,
      }
    );

    return NextResponse.json({
      alerts: paginatedAlerts,
      total: alerts.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Security alerts API error:", error);

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

    if (!session?.user || !session.user.isPlatformUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { alertId, action } = acknowledgeAlertSchema.parse(body);
    const context = await createAuditContext(request, session);

    if (action === "acknowledge") {
      const success = await securityMonitoring.acknowledgeAlert(
        alertId,
        session.user.id
      );

      if (!success) {
        return NextResponse.json({ error: "Alert not found" }, { status: 404 });
      }

      // Log alert acknowledgment
      await securityAuditLogger.logPlatformAdmin(
        "security_alert_acknowledged",
        AuditOutcome.SUCCESS,
        context,
        undefined,
        { alertId }
      );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Security alert action error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
