import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  type BatchOperation,
  batchLogger,
  logBatchMetrics,
} from "@/lib/batchLogger";
import { getCircuitBreakerStatus } from "@/lib/batchProcessor";
import { getBatchSchedulerStatus } from "@/lib/batchProcessorIntegration";

/**
 * GET /api/admin/batch-monitoring
 * Get comprehensive batch processing monitoring data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");
    const operation = url.searchParams.get("operation") as BatchOperation;
    const format = url.searchParams.get("format") || "json";

    // Get batch processing metrics
    const metrics = batchLogger.getMetrics(companyId || undefined);

    // Get scheduler status
    const schedulerStatus = getBatchSchedulerStatus();

    // Get circuit breaker status
    const circuitBreakerStatus = getCircuitBreakerStatus();

    // Generate performance metrics for specific operation if requested
    if (operation) {
      await logBatchMetrics(operation);
    }

    const monitoringData = {
      timestamp: new Date().toISOString(),
      metrics,
      schedulerStatus,
      circuitBreakerStatus,
      systemHealth: {
        schedulerRunning: schedulerStatus.isRunning,
        circuitBreakersOpen: Object.values(circuitBreakerStatus).some(
          (cb) => cb.isOpen
        ),
        pausedDueToErrors: schedulerStatus.isPaused,
        consecutiveErrors: schedulerStatus.consecutiveErrors,
      },
    };

    if (
      format === "csv" &&
      typeof metrics === "object" &&
      !Array.isArray(metrics)
    ) {
      // Convert metrics to CSV format
      const headers = [
        "company_id",
        "operation_start_time",
        "request_count",
        "success_count",
        "failure_count",
        "retry_count",
        "total_cost",
        "average_latency",
        "circuit_breaker_trips",
      ].join(",");

      const rows = Object.entries(metrics).map(([companyId, metric]) =>
        [
          companyId,
          new Date(metric.operationStartTime).toISOString(),
          metric.requestCount,
          metric.successCount,
          metric.failureCount,
          metric.retryCount,
          metric.totalCost.toFixed(4),
          metric.averageLatency.toFixed(2),
          metric.circuitBreakerTrips,
        ].join(",")
      );

      return new NextResponse([headers, ...rows].join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="batch-monitoring-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(monitoringData);
  } catch (error) {
    console.error("Batch monitoring API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch batch monitoring data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/batch-monitoring/export
 * Export batch processing logs
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { startDate, endDate, format = "json" } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required" },
        { status: 400 }
      );
    }

    const timeRange = {
      start: new Date(startDate),
      end: new Date(endDate),
    };

    const exportData = batchLogger.exportLogs(timeRange);

    if (format === "csv") {
      return new NextResponse(exportData, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="batch-logs-${startDate}-${endDate}.csv"`,
        },
      });
    }

    return new NextResponse(exportData, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="batch-logs-${startDate}-${endDate}.json"`,
      },
    });
  } catch (error) {
    console.error("Batch log export error:", error);
    return NextResponse.json(
      { error: "Failed to export batch logs" },
      { status: 500 }
    );
  }
}
