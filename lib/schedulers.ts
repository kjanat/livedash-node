// Combined scheduler initialization
// Note: Removed cron-based scheduler imports to avoid Next.js compatibility issues
// import { startScheduler } from "./scheduler";
// import { startProcessingScheduler } from "./processingScheduler";

/**
 * Initialize all schedulers
 * - Session refresh scheduler (runs every 15 minutes)
 * - Session processing scheduler (runs every hour)
 */
export function initializeSchedulers() {
  // Note: All schedulers disabled due to Next.js compatibility issues
  // Use manual triggers via API endpoints instead
  console.log("Schedulers disabled - using manual triggers via API endpoints");
  // startScheduler();
  // startProcessingScheduler();
}
