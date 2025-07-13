import { NextResponse } from "next/server";
import { getSchedulerIntegration } from "@/lib/services/schedulers/ServerSchedulerIntegration";

/**
 * Health check endpoint for schedulers
 * Used by load balancers and orchestrators for health monitoring
 */
export async function GET() {
  try {
    const integration = getSchedulerIntegration();
    const health = integration.getHealthStatus();

    // Return appropriate HTTP status based on health
    const status = health.healthy ? 200 : 503;

    return NextResponse.json(
      {
        healthy: health.healthy,
        status: health.healthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        schedulers: {
          total: health.totalSchedulers,
          running: health.runningSchedulers,
          errors: health.errorSchedulers,
        },
        details: health.schedulerStatuses,
      },
      { status }
    );
  } catch (error) {
    console.error("[Scheduler Health API] Error:", error);

    return NextResponse.json(
      {
        healthy: false,
        status: "error",
        timestamp: new Date().toISOString(),
        error: "Failed to get scheduler health status",
      },
      { status: 500 }
    );
  }
}

/**
 * Readiness check endpoint
 * Used by Kubernetes and other orchestrators
 */
export async function HEAD() {
  try {
    const integration = getSchedulerIntegration();
    const health = integration.getHealthStatus();

    // Return 200 if healthy, 503 if not
    const status = health.healthy ? 200 : 503;

    return new NextResponse(null, { status });
  } catch (_error) {
    return new NextResponse(null, { status: 500 });
  }
}
