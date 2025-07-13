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

// Helper function for proper CSV escaping
function escapeCSVField(field: string | number | boolean): string {
  if (typeof field === "number" || typeof field === "boolean") {
    return String(field);
  }

  const strField = String(field);

  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (
    strField.includes(",") ||
    strField.includes('"') ||
    strField.includes("\n")
  ) {
    return `"${strField.replace(/"/g, '""')}"`;
  }

  return strField;
}

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
    const operationParam = url.searchParams.get("operation");
    const format = url.searchParams.get("format") || "json";

    // Validate operation parameter
    const isValidBatchOperation = (
      value: string | null
    ): value is BatchOperation => {
      return (
        value !== null &&
        Object.values(BatchOperation).includes(value as BatchOperation)
      );
    };

    if (operationParam && !isValidBatchOperation(operationParam)) {
      return NextResponse.json(
        {
          error: "Invalid operation parameter",
          validOperations: Object.values(BatchOperation),
        },
        { status: 400 }
      );
    }

    const operation = operationParam as BatchOperation | null;

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
          escapeCSVField(companyId),
          escapeCSVField(new Date(metric.operationStartTime).toISOString()),
          escapeCSVField(metric.requestCount),
          escapeCSVField(metric.successCount),
          escapeCSVField(metric.failureCount),
          escapeCSVField(metric.retryCount),
          escapeCSVField(metric.totalCost.toFixed(4)),
          escapeCSVField(metric.averageLatency.toFixed(2)),
          escapeCSVField(metric.circuitBreakerTrips),
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

    const exportDataJson = batchLogger.exportLogs(timeRange);

    if (format === "csv") {
      // Convert JSON to CSV format
      const data = JSON.parse(exportDataJson);

      // Flatten the data structure for CSV
      const csvRows: string[] = [];

      // Add headers
      csvRows.push(
        "Metric,Company ID,Operation,Batch ID,Request Count,Success Count,Failure Count,Average Latency,Last Updated"
      );

      // Add metrics data
      if (data.metrics) {
        interface MetricData {
          companyId?: string;
          operation?: string;
          batchId?: string;
          requestCount?: number;
          successCount?: number;
          failureCount?: number;
          averageLatency?: number;
          lastUpdated?: string;
        }

        Object.entries(data.metrics).forEach(
          ([key, metric]: [string, MetricData]) => {
            csvRows.push(
              [
                escapeCSVField(key),
                escapeCSVField(metric.companyId || ""),
                escapeCSVField(metric.operation || ""),
                escapeCSVField(metric.batchId || ""),
                escapeCSVField(metric.requestCount || 0),
                escapeCSVField(metric.successCount || 0),
                escapeCSVField(metric.failureCount || 0),
                escapeCSVField(metric.averageLatency || 0),
                escapeCSVField(metric.lastUpdated || ""),
              ].join(",")
            );
          }
        );
      }

      const csvContent = csvRows.join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="batch-logs-${startDate}-${endDate}.csv"`,
        },
      });
    }

    return new NextResponse(exportDataJson, {
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
