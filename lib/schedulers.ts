// Combined scheduler initialization

import { startProcessingScheduler } from "./processingScheduler";
import { startCsvImportScheduler } from "./scheduler";

/**
 * Initialize all schedulers
 * - CSV import scheduler (runs every 15 minutes)
 * - Session processing scheduler (runs every hour)
 */
export function initializeSchedulers() {
  // Start the CSV import scheduler
  startCsvImportScheduler();

  // Start the session processing scheduler
  startProcessingScheduler();

  console.log("All schedulers initialized successfully");
}
