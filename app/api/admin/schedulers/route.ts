import { getSchedulerIntegration } from "@/lib/services/schedulers/ServerSchedulerIntegration";
import { createAdminHandler } from "@/lib/api";
import { z } from "zod";

/**
 * Get all schedulers with their status and metrics
 * Requires admin authentication
 */
export const GET = createAdminHandler(async (_context) => {
  const integration = getSchedulerIntegration();
  const schedulers = integration.getSchedulersList();
  const health = integration.getHealthStatus();

  return {
    success: true,
    data: {
      health,
      schedulers,
      timestamp: new Date().toISOString(),
    },
  };
});

const PostInputSchema = z.object({
  action: z.enum(["start", "stop", "trigger", "startAll", "stopAll"]),
  schedulerId: z.string().optional(),
}).refine(
  (data) => {
    // schedulerId is required for individual scheduler actions
    const actionsRequiringSchedulerId = ["start", "stop", "trigger"];
    if (actionsRequiringSchedulerId.includes(data.action)) {
      return data.schedulerId !== undefined && data.schedulerId.length > 0;
    }
    return true;
  },
  {
    message: "schedulerId is required for start, stop, and trigger actions",
    path: ["schedulerId"],
  }
);

/**
 * Control scheduler operations (start/stop/trigger)
 * Requires admin authentication
 */
export const POST = createAdminHandler(async (_context, validatedData) => {
  const { action, schedulerId } = validatedData;

  const integration = getSchedulerIntegration();

  switch (action) {
    case "start":
      if (schedulerId) {
        await integration.startScheduler(schedulerId);
      }
      break;

    case "stop":
      if (schedulerId) {
        await integration.stopScheduler(schedulerId);
      }
      break;

    case "trigger":
      if (schedulerId) {
        await integration.triggerScheduler(schedulerId);
      }
      break;

    case "startAll":
      await integration.getManager().startAll();
      break;

    case "stopAll":
      await integration.getManager().stopAll();
      break;

    default:
      return {
        success: false,
        error: `Unknown action: ${action}`,
      };
  }

  return {
    success: true,
    message: `Action '${action}' completed successfully`,
    timestamp: new Date().toISOString(),
  };
}, {
  validateInput: PostInputSchema,
});
