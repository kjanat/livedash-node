/**
 * Cache Invalidation API Endpoint
 *
 * Allows administrators to manually invalidate cache entries or patterns
 * for troubleshooting and cache management.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "../../../../../lib/auth";
import { invalidateCompanyCache } from "../../../../../lib/batchProcessorOptimized";
import { Cache } from "../../../../../lib/cache";
import {
  AuditOutcome,
  AuditSeverity,
  createAuditMetadata,
  SecurityEventType,
} from "../../../../../lib/securityAuditLogger";
import { enhancedSecurityLog } from "../../../../../lib/securityMonitoring";

const invalidationSchema = z.object({
  type: z.enum(["key", "pattern", "company", "user", "all"]),
  value: z.string().optional(),
});

async function validateCacheAccess(
  session: { user?: { id?: string; companyId?: string; role?: string } } | null
) {
  if (!session?.user) {
    await enhancedSecurityLog(
      SecurityEventType.AUTHORIZATION,
      "cache_invalidation_access_denied",
      AuditOutcome.BLOCKED,
      {
        metadata: createAuditMetadata({
          endpoint: "/api/admin/cache/invalidate",
          reason: "not_authenticated",
        }),
      },
      AuditSeverity.MEDIUM,
      "Unauthenticated access attempt to cache invalidation endpoint"
    );
    return { valid: false, status: 401, error: "Authentication required" };
  }

  if (session.user.role !== "ADMIN") {
    await enhancedSecurityLog(
      SecurityEventType.AUTHORIZATION,
      "cache_invalidation_access_denied",
      AuditOutcome.BLOCKED,
      {
        userId: session.user.id,
        companyId: session.user.companyId,
        metadata: createAuditMetadata({
          endpoint: "/api/admin/cache/invalidate",
          userRole: session.user.role,
          reason: "insufficient_privileges",
        }),
      },
      AuditSeverity.HIGH,
      "Non-admin user attempted to access cache invalidation"
    );
    return { valid: false, status: 403, error: "Admin access required" };
  }

  return { valid: true };
}

async function performCacheInvalidation(type: string, value?: string) {
  let deletedCount = 0;
  let operation = "";

  switch (type) {
    case "key": {
      if (!value) {
        return {
          error: "Key value required for key invalidation",
          status: 400,
        };
      }
      const deleted = await Cache.delete(value);
      deletedCount = deleted ? 1 : 0;
      operation = `key: ${value}`;
      break;
    }
    case "pattern": {
      if (!value) {
        return {
          error: "Pattern value required for pattern invalidation",
          status: 400,
        };
      }
      deletedCount = await Cache.invalidatePattern(value);
      operation = `pattern: ${value}`;
      break;
    }
    case "company": {
      if (!value) {
        return {
          error: "Company ID required for company invalidation",
          status: 400,
        };
      }
      deletedCount = await Cache.invalidateCompany(value);
      await invalidateCompanyCache();
      operation = `company: ${value}`;
      break;
    }
    case "user": {
      if (!value) {
        return { error: "User ID required for user invalidation", status: 400 };
      }
      await Cache.invalidateUser(value);
      await Cache.invalidatePattern("user:email:*");
      deletedCount = 1;
      operation = `user: ${value}`;
      break;
    }
    case "all": {
      await Promise.all([
        Cache.invalidatePattern("user:*"),
        Cache.invalidatePattern("company:*"),
        Cache.invalidatePattern("session:*"),
        Cache.invalidatePattern("*"),
        invalidateCompanyCache(),
      ]);
      deletedCount = 1;
      operation = "all caches";
      break;
    }
    default:
      return { error: "Invalid invalidation type", status: 400 };
  }

  return { success: true, deletedCount, operation };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    const authResult = await validateCacheAccess(session);
    if (!authResult.valid) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await request.json();
    const validation = invalidationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request format",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { type, value } = validation.data;
    const result = await performCacheInvalidation(type, value);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    const response = {
      success: true,
      data: {
        type,
        value,
        deletedCount: result.deletedCount,
        operation: result.operation,
        timestamp: new Date().toISOString(),
      },
    };

    await enhancedSecurityLog(
      SecurityEventType.PLATFORM_ADMIN,
      "cache_invalidation_executed",
      AuditOutcome.SUCCESS,
      {
        userId: session?.user?.id,
        companyId: session?.user?.companyId,
        metadata: createAuditMetadata({
          endpoint: "/api/admin/cache/invalidate",
          invalidationType: type,
          invalidationValue: value,
          deletedCount: result.deletedCount,
        }),
      },
      AuditSeverity.MEDIUM,
      `Cache invalidation executed: ${result.operation}`
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cache Invalidation API] Error:", error);

    await enhancedSecurityLog(
      SecurityEventType.API_SECURITY,
      "cache_invalidation_error",
      AuditOutcome.FAILURE,
      {
        metadata: createAuditMetadata({
          endpoint: "/api/admin/cache/invalidate",
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      },
      AuditSeverity.HIGH,
      "Cache invalidation API encountered an error"
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
