import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import {
  AuditLogRetentionManager,
  DEFAULT_RETENTION_POLICIES,
  executeScheduledRetention,
} from "../../../../../lib/auditLogRetention";
import { auditLogScheduler } from "../../../../../lib/auditLogScheduler";
import { authOptions } from "../../../../../lib/auth";
import { extractClientIP } from "../../../../../lib/rateLimiter";
import {
  AuditOutcome,
  createAuditMetadata,
  securityAuditLogger,
} from "../../../../../lib/securityAuditLogger";

// GET /api/admin/audit-logs/retention - Get retention statistics and policy status
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  try {
    const ip = extractClientIP(request);
    const userAgent = request.headers.get("user-agent") || undefined;

    if (!session?.user) {
      await securityAuditLogger.logAuthorization(
        "audit_retention_unauthorized_access",
        AuditOutcome.BLOCKED,
        {
          ipAddress: ip,
          userAgent,
          metadata: createAuditMetadata({
            error: "no_session",
          }),
        },
        "Unauthorized attempt to access audit retention management"
      );

      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only allow ADMIN users to manage audit log retention
    if (session.user.role !== "ADMIN") {
      await securityAuditLogger.logAuthorization(
        "audit_retention_insufficient_permissions",
        AuditOutcome.BLOCKED,
        {
          userId: session.user.id,
          companyId: session.user.companyId,
          ipAddress: ip,
          userAgent,
          metadata: createAuditMetadata({
            userRole: session.user.role,
            requiredRole: "ADMIN",
          }),
        },
        "Insufficient permissions to access audit retention management"
      );

      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const manager = new AuditLogRetentionManager();

    // Get retention statistics and policy information
    const [statistics, policyValidation, schedulerStatus] = await Promise.all([
      manager.getRetentionStatistics(),
      manager.validateRetentionPolicies(),
      Promise.resolve(auditLogScheduler.getStatus()),
    ]);

    // Log successful retention info access
    await securityAuditLogger.logDataPrivacy(
      "audit_retention_info_accessed",
      AuditOutcome.SUCCESS,
      {
        userId: session.user.id,
        companyId: session.user.companyId,
        ipAddress: ip,
        userAgent,
        metadata: createAuditMetadata({
          totalLogs: statistics.totalLogs,
          schedulerRunning: schedulerStatus.isRunning,
        }),
      },
      "Audit retention information accessed by admin"
    );

    return NextResponse.json({
      success: true,
      data: {
        statistics,
        policies: DEFAULT_RETENTION_POLICIES,
        policyValidation,
        scheduler: schedulerStatus,
      },
    });
  } catch (error) {
    console.error("Error fetching audit retention info:", error);

    await securityAuditLogger.logDataPrivacy(
      "audit_retention_info_error",
      AuditOutcome.FAILURE,
      {
        userId: session?.user?.id,
        companyId: session?.user?.companyId,
        ipAddress: extractClientIP(request),
        userAgent: request.headers.get("user-agent") || undefined,
        metadata: createAuditMetadata({
          error: "server_error",
        }),
      },
      `Server error while fetching audit retention info: ${error}`
    );

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/audit-logs/retention - Execute retention policies manually
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  try {
    const ip = extractClientIP(request);
    const userAgent = request.headers.get("user-agent") || undefined;

    if (!session?.user || session.user.role !== "ADMIN") {
      await securityAuditLogger.logAuthorization(
        "audit_retention_execute_unauthorized",
        AuditOutcome.BLOCKED,
        {
          userId: session?.user?.id,
          companyId: session?.user?.companyId,
          ipAddress: ip,
          userAgent,
          metadata: createAuditMetadata({
            error: "insufficient_permissions",
          }),
        },
        "Unauthorized attempt to execute audit retention"
      );

      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, isDryRun = true } = body;

    if (action !== "execute") {
      return NextResponse.json(
        { success: false, error: "Invalid action. Use 'execute'" },
        { status: 400 }
      );
    }

    // Log retention execution attempt
    await securityAuditLogger.logDataPrivacy(
      "audit_retention_manual_execution",
      AuditOutcome.SUCCESS,
      {
        userId: session.user.id,
        companyId: session.user.companyId,
        ipAddress: ip,
        userAgent,
        metadata: createAuditMetadata({
          isDryRun,
          triggerType: "manual_admin",
        }),
      },
      `Admin manually triggered audit retention (dry run: ${isDryRun})`
    );

    // Execute retention policies
    const results = await executeScheduledRetention(isDryRun);

    return NextResponse.json({
      success: true,
      data: {
        message: isDryRun
          ? "Dry run completed successfully"
          : "Retention policies executed successfully",
        isDryRun,
        results,
      },
    });
  } catch (error) {
    console.error("Error executing audit retention:", error);

    await securityAuditLogger.logDataPrivacy(
      "audit_retention_execution_error",
      AuditOutcome.FAILURE,
      {
        userId: session?.user?.id,
        companyId: session?.user?.companyId,
        ipAddress: extractClientIP(request),
        userAgent: request.headers.get("user-agent") || undefined,
        metadata: createAuditMetadata({
          error: "server_error",
        }),
      },
      `Server error while executing audit retention: ${error}`
    );

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
