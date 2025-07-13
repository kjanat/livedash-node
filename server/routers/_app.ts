/**
 * Main tRPC Application Router
 *
 * This file combines all individual routers into a single app router.
 * All tRPC endpoints are organized and exported from here.
 */

import { router } from "@/lib/trpc";
import { authRouter } from "./auth";
import { dashboardRouter } from "./dashboard";
import { adminRouter } from "./admin";

/**
 * Main application router that combines all feature routers
 */
export const appRouter = router({
  auth: authRouter,
  dashboard: dashboardRouter,
  admin: adminRouter,
});

// Export type definition for use in client
export type AppRouter = typeof appRouter;
