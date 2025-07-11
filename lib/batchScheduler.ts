/**
 * OpenAI Batch Processing Scheduler
 *
 * This scheduler manages the lifecycle of OpenAI batch requests:
 * 1. Creates new batches from pending requests
 * 2. Checks status of in-progress batches
 * 3. Processes completed batch results
 */

import cron, { type ScheduledTask } from "node-cron";
import { batchLogger } from "./batchLogger";
import {
  checkBatchStatuses,
  createBatchRequest,
  getBatchProcessingStats,
  getCircuitBreakerStatus,
  getPendingBatchRequests,
  processCompletedBatches,
  retryFailedRequests,
} from "./batchProcessor";
import { prisma } from "./prisma";
import { getSchedulerConfig } from "./schedulerConfig";

/**
 * Configuration for batch scheduler intervals with enhanced error handling
 */
const SCHEDULER_CONFIG = {
  // Check for new batches to create every 5 minutes
  CREATE_BATCHES_INTERVAL: "*/5 * * * *",
  // Check batch statuses every 2 minutes
  CHECK_STATUS_INTERVAL: "*/2 * * * *",
  // Process completed batches every minute
  PROCESS_RESULTS_INTERVAL: "* * * * *",
  // Retry failed individual requests every 10 minutes
  RETRY_FAILED_INTERVAL: "*/10 * * * *",
  // Minimum batch size to trigger creation
  MIN_BATCH_SIZE: 10,
  // Maximum time to wait before creating a batch (even if under min size)
  MAX_WAIT_TIME_MINUTES: 30,
  // Maximum consecutive errors before pausing scheduler
  MAX_CONSECUTIVE_ERRORS: 5,
  // Pause duration when too many errors occur (in milliseconds)
  ERROR_PAUSE_DURATION: 15 * 60 * 1000, // 15 minutes
} as const;

let createBatchesTask: ScheduledTask | null = null;
let checkStatusTask: ScheduledTask | null = null;
let processResultsTask: ScheduledTask | null = null;
let retryFailedTask: ScheduledTask | null = null;

// Error tracking for scheduler resilience
let consecutiveErrors = 0;
let lastErrorTime = 0;
let isPaused = false;

/**
 * Start the batch processing scheduler
 */
export function startBatchScheduler(): void {
  const config = getSchedulerConfig();

  if (!config.enabled) {
    console.log("Batch scheduler disabled by configuration");
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.log("Batch scheduler disabled: OPENAI_API_KEY not configured");
    return;
  }

  console.log("Starting OpenAI Batch Processing Scheduler...");

  // Schedule batch creation
  createBatchesTask = cron.schedule(
    SCHEDULER_CONFIG.CREATE_BATCHES_INTERVAL,
    () => handleSchedulerTask(createBatchesForAllCompanies, "batch creation")
  );

  // Schedule status checking
  checkStatusTask = cron.schedule(SCHEDULER_CONFIG.CHECK_STATUS_INTERVAL, () =>
    handleSchedulerTask(
      checkBatchStatusesForAllCompanies,
      "batch status checking"
    )
  );

  // Schedule result processing
  processResultsTask = cron.schedule(
    SCHEDULER_CONFIG.PROCESS_RESULTS_INTERVAL,
    () =>
      handleSchedulerTask(
        processCompletedBatchesForAllCompanies,
        "batch result processing"
      )
  );

  // Schedule failed request retry
  retryFailedTask = cron.schedule(SCHEDULER_CONFIG.RETRY_FAILED_INTERVAL, () =>
    handleSchedulerTask(
      retryFailedRequestsForAllCompanies,
      "failed request retry"
    )
  );

  // Start all tasks
  createBatchesTask.start();
  checkStatusTask.start();
  processResultsTask.start();
  retryFailedTask.start();

  console.log(
    "Batch scheduler started successfully with enhanced error handling"
  );
}

/**
 * Stop the batch processing scheduler
 */
export function stopBatchScheduler(): void {
  console.log("Stopping batch scheduler...");

  if (createBatchesTask) {
    createBatchesTask.stop();
    createBatchesTask.destroy();
    createBatchesTask = null;
  }

  if (checkStatusTask) {
    checkStatusTask.stop();
    checkStatusTask.destroy();
    checkStatusTask = null;
  }

  if (processResultsTask) {
    processResultsTask.stop();
    processResultsTask.destroy();
    processResultsTask = null;
  }

  if (retryFailedTask) {
    retryFailedTask.stop();
    retryFailedTask.destroy();
    retryFailedTask = null;
  }

  console.log("Batch scheduler stopped");
}

/**
 * Create batches for all active companies
 */
async function createBatchesForAllCompanies(): Promise<void> {
  try {
    const companies = await prisma.company.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
    });

    for (const company of companies) {
      await createBatchesForCompany(company.id);
    }
  } catch (error) {
    console.error("Failed to create batches for companies:", error);
  }
}

/**
 * Create batches for a specific company if conditions are met
 */
async function createBatchesForCompany(companyId: string): Promise<void> {
  try {
    const pendingRequests = await getPendingBatchRequests(companyId);

    if (pendingRequests.length === 0) {
      return; // No pending requests
    }

    // Check if we should create a batch
    const shouldCreateBatch = await shouldCreateBatchForCompany(
      companyId,
      pendingRequests.length
    );

    if (!shouldCreateBatch) {
      return; // Wait for more requests or more time
    }

    console.log(
      `Creating batch for company ${companyId} with ${pendingRequests.length} requests`
    );

    const batchId = await createBatchRequest(companyId, pendingRequests);

    console.log(
      `Successfully created batch ${batchId} for company ${companyId}`
    );
  } catch (error) {
    console.error(`Failed to create batch for company ${companyId}:`, error);
  }
}

/**
 * Determine if a batch should be created for a company
 */
async function shouldCreateBatchForCompany(
  companyId: string,
  pendingCount: number
): Promise<boolean> {
  // Always create if we have enough requests
  if (pendingCount >= SCHEDULER_CONFIG.MIN_BATCH_SIZE) {
    return true;
  }

  // Check if oldest pending request is old enough to trigger batch creation
  const oldestPending = await prisma.aIProcessingRequest.findFirst({
    where: {
      session: { companyId },
      processingStatus: "PENDING_BATCHING",
    },
    orderBy: { requestedAt: "asc" },
  });

  if (!oldestPending) {
    return false;
  }

  const waitTimeMs = Date.now() - oldestPending.requestedAt.getTime();
  const maxWaitTimeMs = SCHEDULER_CONFIG.MAX_WAIT_TIME_MINUTES * 60 * 1000;

  return waitTimeMs >= maxWaitTimeMs;
}

/**
 * Check batch statuses for all companies
 */
async function checkBatchStatusesForAllCompanies(): Promise<void> {
  try {
    const companies = await prisma.company.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });

    for (const company of companies) {
      await checkBatchStatuses(company.id);
    }
  } catch (error) {
    console.error("Failed to check batch statuses:", error);
  }
}

/**
 * Process completed batches for all companies
 */
async function processCompletedBatchesForAllCompanies(): Promise<void> {
  try {
    const companies = await prisma.company.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });

    for (const company of companies) {
      await processCompletedBatches(company.id);
    }
  } catch (error) {
    console.error("Failed to process completed batches:", error);
  }
}

/**
 * Get batch processing statistics for monitoring
 */
export async function getAllBatchStats() {
  try {
    const companies = await prisma.company.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
    });

    const stats = await Promise.all(
      companies.map(async (company) => ({
        companyId: company.id,
        companyName: company.name,
        ...(await getBatchProcessingStats(company.id)),
      }))
    );

    return stats;
  } catch (error) {
    console.error("Failed to get batch stats:", error);
    return [];
  }
}

/**
 * Force create batches for a specific company (for manual triggering)
 */
export async function forceBatchCreation(companyId: string): Promise<void> {
  console.log(`Force creating batch for company ${companyId}`);
  await createBatchesForCompany(companyId);
}

/**
 * Get current scheduler status
 */
export function getBatchSchedulerStatus() {
  return {
    isRunning: !!(
      createBatchesTask &&
      checkStatusTask &&
      processResultsTask &&
      retryFailedTask
    ),
    createBatchesRunning: !!createBatchesTask,
    checkStatusRunning: !!checkStatusTask,
    processResultsRunning: !!processResultsTask,
    retryFailedRunning: !!retryFailedTask,
    isPaused,
    consecutiveErrors,
    lastErrorTime: lastErrorTime ? new Date(lastErrorTime) : null,
    circuitBreakers: getCircuitBreakerStatus(),
    config: SCHEDULER_CONFIG,
  };
}

/**
 * Handle scheduler task execution with error tracking and recovery
 */
async function handleSchedulerTask(
  taskFunction: () => Promise<void>,
  taskName: string
): Promise<void> {
  // Check if scheduler is paused due to too many errors
  if (isPaused) {
    const now = Date.now();
    if (now - lastErrorTime >= SCHEDULER_CONFIG.ERROR_PAUSE_DURATION) {
      console.log(`Resuming scheduler after error pause: ${taskName}`);
      isPaused = false;
      consecutiveErrors = 0;
    } else {
      console.log(`Scheduler paused due to errors, skipping: ${taskName}`);
      return;
    }
  }

  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;

  try {
    await taskFunction();
    successCount = 1;

    // Reset error counter on success
    if (consecutiveErrors > 0) {
      console.log(
        `Scheduler recovered after ${consecutiveErrors} consecutive errors: ${taskName}`
      );
      consecutiveErrors = 0;
    }
  } catch (error) {
    consecutiveErrors++;
    lastErrorTime = Date.now();
    errorCount = 1;

    console.error(
      `Error in ${taskName} (attempt ${consecutiveErrors}):`,
      error
    );

    // Pause scheduler if too many consecutive errors
    if (consecutiveErrors >= SCHEDULER_CONFIG.MAX_CONSECUTIVE_ERRORS) {
      isPaused = true;
      console.error(
        `Pausing scheduler for ${SCHEDULER_CONFIG.ERROR_PAUSE_DURATION / 1000 / 60} minutes due to ${consecutiveErrors} consecutive errors`
      );
    }
  } finally {
    const duration = Date.now() - startTime;
    await batchLogger.logScheduler(
      taskName,
      duration,
      successCount,
      errorCount,
      errorCount > 0
        ? new Error(`Scheduler task ${taskName} failed`)
        : undefined
    );
  }
}

/**
 * Retry failed individual requests for all companies
 */
async function retryFailedRequestsForAllCompanies(): Promise<void> {
  try {
    const companies = await prisma.company.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });

    for (const company of companies) {
      await retryFailedRequests(company.id);
    }
  } catch (error) {
    console.error("Failed to retry failed requests:", error);
    throw error; // Re-throw to trigger error handling
  }
}

/**
 * Force resume scheduler (for manual recovery)
 */
export function forceResumeScheduler(): void {
  isPaused = false;
  consecutiveErrors = 0;
  lastErrorTime = 0;
  console.log("Scheduler manually resumed, error counters reset");
}
