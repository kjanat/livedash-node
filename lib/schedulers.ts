// Combined scheduler initialization
import { startScheduler } from "./scheduler";
import { startProcessingScheduler } from "./processingScheduler";

/**
 * Initialize all schedulers
 * - Session refresh scheduler (runs every 15 minutes)
 * - Session processing scheduler (runs every hour)
 */
export function initializeSchedulers() {
  // Start the session refresh scheduler
  startScheduler();

  // Start the session processing scheduler
  startProcessingScheduler();

  console.log("All schedulers initialized successfully");
}
