import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { extractClientIP } from "../../../../lib/rateLimiter";
import {
  AuditOutcome,
  createAuditMetadata,
  securityAuditLogger,
} from "../../../../lib/securityAuditLogger";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const ip = extractClientIP(request);
    const userAgent = request.headers.get("user-agent") || undefined;

    if (!session?.user) {
      await securityAuditLogger.logAuthorization(
        "audit_logs_unauthorized_access",
        AuditOutcome.BLOCKED,
        {
          ipAddress: ip,
          userAgent,
          metadata: createAuditMetadata({
            error: "no_session",
          }),
        },
        "Unauthorized attempt to access audit logs"
      );

      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only allow ADMIN users to view audit logs
    if (session.user.role !== "ADMIN") {
      await securityAuditLogger.logAuthorization(
        "audit_logs_insufficient_permissions",
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
        "Insufficient permissions to access audit logs"
      );

      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const page = Number.parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(
      Number.parseInt(url.searchParams.get("limit") || "50"),
      100
    );
    const eventType = url.searchParams.get("eventType");
    const outcome = url.searchParams.get("outcome");
    const severity = url.searchParams.get("severity");
    const userId = url.searchParams.get("userId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const skip = (page - 1) * limit;

    // Build filter conditions
    const where: {
      companyId: string;
      eventType?: string;
      outcome?: string;
      timestamp?: {
        gte?: Date;
        lte?: Date;
      };
    } = {
      companyId: session.user.companyId, // Only show logs for user's company
    };

    if (eventType) {
      where.eventType = eventType;
    }

    if (outcome) {
      where.outcome = outcome;
    }

    if (severity) {
      where.severity = severity;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // Get audit logs with pagination
    const [auditLogs, totalCount] = await Promise.all([
      prisma.securityAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
          platformUser: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      }),
      prisma.securityAuditLog.count({ where }),
    ]);

    // Log successful audit log access
    await securityAuditLogger.logDataPrivacy(
      "audit_logs_accessed",
      AuditOutcome.SUCCESS,
      {
        userId: session.user.id,
        companyId: session.user.companyId,
        ipAddress: ip,
        userAgent,
        metadata: createAuditMetadata({
          page,
          limit,
          filters: {
            eventType,
            outcome,
            severity,
            userId,
            startDate,
            endDate,
          },
          recordsReturned: auditLogs.length,
        }),
      },
      "Audit logs accessed by admin user"
    );

    return NextResponse.json({
      success: true,
      data: {
        auditLogs,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: skip + limit < totalCount,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);

    await securityAuditLogger.logDataPrivacy(
      "audit_logs_server_error",
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
      `Server error while fetching audit logs: ${error}`
    );

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
