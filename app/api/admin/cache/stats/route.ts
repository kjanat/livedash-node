/**
 * Cache Statistics API Endpoint
 *
 * Provides comprehensive cache performance metrics and health status
 * for monitoring Redis + in-memory cache performance.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";
import { Cache } from "../../../../../lib/cache";
import {
  AuditOutcome,
  AuditSeverity,
  createAuditMetadata,
  SecurityEventType,
} from "../../../../../lib/securityAuditLogger";
import { enhancedSecurityLog } from "../../../../../lib/securityMonitoring";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      await enhancedSecurityLog(
        SecurityEventType.AUTHORIZATION,
        "cache_stats_access_denied",
        AuditOutcome.BLOCKED,
        {
          metadata: createAuditMetadata({
            endpoint: "/api/admin/cache/stats",
            reason: "not_authenticated",
          }),
        },
        AuditSeverity.MEDIUM,
        "Unauthenticated access attempt to cache stats endpoint"
      );

      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMIN") {
      await enhancedSecurityLog(
        SecurityEventType.AUTHORIZATION,
        "cache_stats_access_denied",
        AuditOutcome.BLOCKED,
        {
          userId: session.user.id,
          companyId: session.user.companyId,
          metadata: createAuditMetadata({
            endpoint: "/api/admin/cache/stats",
            userRole: session.user.role,
            reason: "insufficient_privileges",
          }),
        },
        AuditSeverity.HIGH,
        "Non-admin user attempted to access cache stats"
      );

      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get cache statistics and health information
    const [stats, healthCheck] = await Promise.all([
      Cache.getStats(),
      Cache.healthCheck(),
    ]);

    const response = {
      success: true,
      data: {
        performance: {
          hits: stats.hits,
          misses: stats.misses,
          sets: stats.sets,
          deletes: stats.deletes,
          errors: stats.errors,
          hitRate: Number((stats.hitRate * 100).toFixed(2)), // Convert to percentage
          redisHits: stats.redisHits,
          memoryHits: stats.memoryHits,
        },
        health: {
          redis: {
            connected: healthCheck.redis.connected,
            latency: healthCheck.redis.latency,
            error: healthCheck.redis.error,
          },
          memory: {
            available: healthCheck.memory.available,
            size: healthCheck.memory.size,
            valid: healthCheck.memory.valid,
            expired: healthCheck.memory.expired,
          },
          overall: {
            available: healthCheck.overall.available,
            fallbackMode: healthCheck.overall.fallbackMode,
          },
        },
        configuration: {
          redisAvailable: stats.redisAvailable,
          fallbackActive: !stats.redisAvailable,
        },
        timestamp: new Date().toISOString(),
      },
    };

    // Log successful access
    await enhancedSecurityLog(
      SecurityEventType.PLATFORM_ADMIN,
      "cache_stats_accessed",
      AuditOutcome.SUCCESS,
      {
        userId: session.user.id,
        companyId: session.user.companyId,
        metadata: createAuditMetadata({
          endpoint: "/api/admin/cache/stats",
          hitRate: response.data.performance.hitRate,
          redisConnected: response.data.health.redis.connected,
        }),
      },
      AuditSeverity.INFO,
      "Cache statistics accessed by admin"
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cache Stats API] Error:", error);

    await enhancedSecurityLog(
      SecurityEventType.API_SECURITY,
      "cache_stats_error",
      AuditOutcome.FAILURE,
      {
        metadata: createAuditMetadata({
          endpoint: "/api/admin/cache/stats",
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      },
      AuditSeverity.HIGH,
      "Cache stats API encountered an error"
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
