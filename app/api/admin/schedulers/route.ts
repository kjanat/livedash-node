import { type NextRequest, NextResponse } from "next/server";
import { getSchedulerIntegration } from "@/lib/services/schedulers/ServerSchedulerIntegration";

/**
 * Get all schedulers with their status and metrics
 */
export async function GET() {
  try {
    const integration = getSchedulerIntegration();
    const schedulers = integration.getSchedulersList();
    const health = integration.getHealthStatus();

    return NextResponse.json({
      success: true,
      data: {
        health,
        schedulers,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Scheduler Management API] GET Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get scheduler information",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Control scheduler operations (start/stop/trigger)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, schedulerId } = body;

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error: "Action is required",
        },
        { status: 400 }
      );
    }

    const integration = getSchedulerIntegration();

    switch (action) {
      case "start":
        if (!schedulerId) {
          return NextResponse.json(
            {
              success: false,
              error: "schedulerId is required for start action",
            },
            { status: 400 }
          );
        }
        await integration.startScheduler(schedulerId);
        break;

      case "stop":
        if (!schedulerId) {
          return NextResponse.json(
            {
              success: false,
              error: "schedulerId is required for stop action",
            },
            { status: 400 }
          );
        }
        await integration.stopScheduler(schedulerId);
        break;

      case "trigger":
        if (!schedulerId) {
          return NextResponse.json(
            {
              success: false,
              error: "schedulerId is required for trigger action",
            },
            { status: 400 }
          );
        }
        await integration.triggerScheduler(schedulerId);
        break;

      case "startAll":
        await integration.getManager().startAll();
        break;

      case "stopAll":
        await integration.getManager().stopAll();
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Action '${action}' completed successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Scheduler Management API] POST Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
