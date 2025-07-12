/**
 * Optimized OpenAI Batch Processing Scheduler
 *
 * This optimized version reduces database load through:
 * - Batch operations across all companies
 * - Company caching to eliminate repeated lookups
 * - Parallel processing with better error isolation
 * - More efficient query patterns
 */

import cron, { type ScheduledTask } from "node-cron";
import { BatchLogLevel, BatchOperation, batchLogger } from "./batchLogger";
import {
  checkBatchStatuses,
  createBatchRequest,
  getCircuitBreakerStatus,
  processCompletedBatches,
  retryFailedRequests,
} from "./batchProcessor";
import {
  getCompletedBatchesForAllCompanies,
  getFailedRequestsForAllCompanies,
  getInProgressBatchesForAllCompanies,
  getOldestPendingRequestOptimized,
  getPendingBatchRequestsForAllCompanies,
} from "./batchProcessorOptimized";
import { getSchedulerConfig } from "./schedulerConfig";

/**
 * Enhanced configuration with optimization flags
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
  // Performance optimization flags
  USE_BATCH_OPERATIONS: true,
  PARALLEL_COMPANY_PROCESSING: true,
  MAX_CONCURRENT_COMPANIES: 5,
} as const;

let createBatchesTask: ScheduledTask | null = null;
let checkStatusTask: ScheduledTask | null = null;
let processResultsTask: ScheduledTask | null = null;
let retryFailedTask: ScheduledTask | null = null;

// Enhanced error tracking with performance monitoring
let consecutiveErrors = 0;
let lastErrorTime = 0;
let isPaused = false;
let totalOperationTime = 0;
let operationCount = 0;

/**
 * Start the optimized batch processing scheduler
 */
export function startOptimizedBatchScheduler(): void {
  const config = getSchedulerConfig();

  if (!config.enabled) {
    console.log("Batch scheduler disabled by configuration");
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.log("Batch scheduler disabled: OPENAI_API_KEY not configured");
    return;
  }

  console.log("Starting Optimized OpenAI Batch Processing Scheduler...");

  // Schedule optimized batch creation
  createBatchesTask = cron.schedule(
    SCHEDULER_CONFIG.CREATE_BATCHES_INTERVAL,
    () =>
      handleSchedulerTask(createBatchesOptimized, "optimized batch creation")
  );

  // Schedule optimized status checking
  checkStatusTask = cron.schedule(SCHEDULER_CONFIG.CHECK_STATUS_INTERVAL, () =>
    handleSchedulerTask(
      checkBatchStatusesOptimized,
      "optimized batch status checking"
    )
  );

  // Schedule optimized result processing
  processResultsTask = cron.schedule(
    SCHEDULER_CONFIG.PROCESS_RESULTS_INTERVAL,
    () =>
      handleSchedulerTask(
        processCompletedBatchesOptimized,
        "optimized batch result processing"
      )
  );

  // Schedule optimized failed request retry
  retryFailedTask = cron.schedule(SCHEDULER_CONFIG.RETRY_FAILED_INTERVAL, () =>
    handleSchedulerTask(
      retryFailedRequestsOptimized,
      "optimized failed request retry"
    )
  );

  // Start all tasks
  createBatchesTask.start();
  checkStatusTask.start();
  processResultsTask.start();
  retryFailedTask.start();

  console.log("Optimized batch scheduler started successfully");
}

/**
 * Stop the optimized batch processing scheduler
 */
export function stopOptimizedBatchScheduler(): void {
  console.log("Stopping optimized batch scheduler...");

  const tasks = [
    { task: createBatchesTask, name: "createBatchesTask" },
    { task: checkStatusTask, name: "checkStatusTask" },
    { task: processResultsTask, name: "processResultsTask" },
    { task: retryFailedTask, name: "retryFailedTask" },
  ];

  for (const { task, name: _name } of tasks) {
    if (task) {
      task.stop();
      task.destroy();
    }
  }

  createBatchesTask = null;
  checkStatusTask = null;
  processResultsTask = null;
  retryFailedTask = null;

  console.log("Optimized batch scheduler stopped");
}

/**
 * Optimized batch creation for all companies
 */
async function createBatchesOptimized(): Promise<void> {
  const startTime = Date.now();

  if (SCHEDULER_CONFIG.USE_BATCH_OPERATIONS) {
    // Single query to get pending requests for all companies
    const pendingRequestsByCompany =
      await getPendingBatchRequestsForAllCompanies();

    if (pendingRequestsByCompany.size === 0) {
      await batchLogger.log(
        BatchLogLevel.DEBUG,
        "No pending requests found across all companies",
        { operation: BatchOperation.BATCH_CREATION }
      );
      return;
    }

    // Process companies in parallel batches
    const companyIds = Array.from(pendingRequestsByCompany.keys());
    const processingPromises: Promise<void>[] = [];

    for (
      let i = 0;
      i < companyIds.length;
      i += SCHEDULER_CONFIG.MAX_CONCURRENT_COMPANIES
    ) {
      const batch = companyIds.slice(
        i,
        i + SCHEDULER_CONFIG.MAX_CONCURRENT_COMPANIES
      );

      const batchPromise = Promise.allSettled(
        batch.map(async (companyId) => {
          const pendingRequests = pendingRequestsByCompany.get(companyId) || [];

          if (pendingRequests.length === 0) return;

          const shouldCreate = await shouldCreateBatchForCompanyOptimized(
            companyId,
            pendingRequests.length
          );

          if (shouldCreate) {
            await createBatchRequest(companyId, pendingRequests);
          }
        })
      );

      processingPromises.push(batchPromise.then(() => {}));
    }

    await Promise.all(processingPromises);
  } else {
    // Fallback to original sequential processing
    console.warn("Using fallback sequential processing for batch creation");
    // Implementation would call original functions
  }

  const duration = Date.now() - startTime;
  updatePerformanceMetrics(duration);
}

/**
 * Optimized batch status checking for all companies
 */
async function checkBatchStatusesOptimized(): Promise<void> {
  const startTime = Date.now();

  if (SCHEDULER_CONFIG.USE_BATCH_OPERATIONS) {
    // Single query to get in-progress batches for all companies
    const batchesByCompany = await getInProgressBatchesForAllCompanies();

    if (batchesByCompany.size === 0) {
      return;
    }

    // Process companies in parallel
    const companyIds = Array.from(batchesByCompany.keys());
    const processingPromises: Promise<void>[] = [];

    for (
      let i = 0;
      i < companyIds.length;
      i += SCHEDULER_CONFIG.MAX_CONCURRENT_COMPANIES
    ) {
      const batch = companyIds.slice(
        i,
        i + SCHEDULER_CONFIG.MAX_CONCURRENT_COMPANIES
      );

      const batchPromise = Promise.allSettled(
        batch.map(async (companyId) => {
          await checkBatchStatuses(companyId);
        })
      );

      processingPromises.push(batchPromise.then(() => {}));
    }

    await Promise.all(processingPromises);
  }

  const duration = Date.now() - startTime;
  updatePerformanceMetrics(duration);
}

/**
 * Optimized completed batch processing for all companies
 */
async function processCompletedBatchesOptimized(): Promise<void> {
  const startTime = Date.now();

  if (SCHEDULER_CONFIG.USE_BATCH_OPERATIONS) {
    // Single query to get completed batches for all companies
    const batchesByCompany = await getCompletedBatchesForAllCompanies();

    if (batchesByCompany.size === 0) {
      return;
    }

    // Process companies in parallel
    const companyIds = Array.from(batchesByCompany.keys());
    const processingPromises: Promise<void>[] = [];

    for (
      let i = 0;
      i < companyIds.length;
      i += SCHEDULER_CONFIG.MAX_CONCURRENT_COMPANIES
    ) {
      const batch = companyIds.slice(
        i,
        i + SCHEDULER_CONFIG.MAX_CONCURRENT_COMPANIES
      );

      const batchPromise = Promise.allSettled(
        batch.map(async (companyId) => {
          await processCompletedBatches(companyId);
        })
      );

      processingPromises.push(batchPromise.then(() => {}));
    }

    await Promise.all(processingPromises);
  }

  const duration = Date.now() - startTime;
  updatePerformanceMetrics(duration);
}

/**
 * Optimized failed request retry for all companies
 */
async function retryFailedRequestsOptimized(): Promise<void> {
  const startTime = Date.now();

  if (SCHEDULER_CONFIG.USE_BATCH_OPERATIONS) {
    // Single query to get failed requests for all companies
    const failedRequestsByCompany = await getFailedRequestsForAllCompanies();

    if (failedRequestsByCompany.size === 0) {
      return;
    }

    // Process companies in parallel
    const companyIds = Array.from(failedRequestsByCompany.keys());
    const processingPromises: Promise<void>[] = [];

    for (
      let i = 0;
      i < companyIds.length;
      i += SCHEDULER_CONFIG.MAX_CONCURRENT_COMPANIES
    ) {
      const batch = companyIds.slice(
        i,
        i + SCHEDULER_CONFIG.MAX_CONCURRENT_COMPANIES
      );

      const batchPromise = Promise.allSettled(
        batch.map(async (companyId) => {
          await retryFailedRequests(companyId);
        })
      );

      processingPromises.push(batchPromise.then(() => {}));
    }

    await Promise.all(processingPromises);
  }

  const duration = Date.now() - startTime;
  updatePerformanceMetrics(duration);
}

/**
 * Optimized version of shouldCreateBatchForCompany
 */
async function shouldCreateBatchForCompanyOptimized(
  companyId: string,
  pendingCount: number
): Promise<boolean> {
  // Always create if we have enough requests
  if (pendingCount >= SCHEDULER_CONFIG.MIN_BATCH_SIZE) {
    return true;
  }

  // Check if oldest pending request is old enough (optimized query)
  const oldestPending = await getOldestPendingRequestOptimized(companyId);

  if (!oldestPending) {
    return false;
  }

  const waitTimeMs = Date.now() - oldestPending.requestedAt.getTime();
  const maxWaitTimeMs = SCHEDULER_CONFIG.MAX_WAIT_TIME_MINUTES * 60 * 1000;

  return waitTimeMs >= maxWaitTimeMs;
}

/**
 * Enhanced scheduler task handler with performance monitoring
 */
async function handleSchedulerTask(
  taskFunction: () => Promise<void>,
  taskName: string
): Promise<void> {
  // Check if scheduler is paused due to too many errors
  if (isPaused) {
    const now = Date.now();
    if (now - lastErrorTime >= SCHEDULER_CONFIG.ERROR_PAUSE_DURATION) {
      console.log(
        `Resuming optimized scheduler after error pause: ${taskName}`
      );
      isPaused = false;
      consecutiveErrors = 0;
    } else {
      console.log(
        `Optimized scheduler paused due to errors, skipping: ${taskName}`
      );
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
        `Optimized scheduler recovered after ${consecutiveErrors} consecutive errors: ${taskName}`
      );
      consecutiveErrors = 0;
    }
  } catch (error) {
    consecutiveErrors++;
    lastErrorTime = Date.now();
    errorCount = 1;

    console.error(
      `Error in optimized ${taskName} (attempt ${consecutiveErrors}):`,
      error
    );

    // Pause scheduler if too many consecutive errors
    if (consecutiveErrors >= SCHEDULER_CONFIG.MAX_CONSECUTIVE_ERRORS) {
      isPaused = true;
      console.error(
        `Pausing optimized scheduler for ${SCHEDULER_CONFIG.ERROR_PAUSE_DURATION / 1000 / 60} minutes due to ${consecutiveErrors} consecutive errors`
      );
    }
  } finally {
    const duration = Date.now() - startTime;
    await batchLogger.logScheduler(
      `optimized_${taskName}`,
      duration,
      successCount,
      errorCount,
      errorCount > 0
        ? new Error(`Optimized scheduler task ${taskName} failed`)
        : undefined
    );

    updatePerformanceMetrics(duration);
  }
}

/**
 * Track performance metrics
 */
function updatePerformanceMetrics(duration: number): void {
  totalOperationTime += duration;
  operationCount++;
}

/**
 * Get optimized scheduler status with performance metrics
 */
export function getOptimizedBatchSchedulerStatus() {
  const baseStatus = {
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

  // Add performance metrics
  const performanceMetrics = {
    averageOperationTime:
      operationCount > 0 ? totalOperationTime / operationCount : 0,
    totalOperations: operationCount,
    totalOperationTime,
    optimizationsEnabled: {
      batchOperations: SCHEDULER_CONFIG.USE_BATCH_OPERATIONS,
      parallelProcessing: SCHEDULER_CONFIG.PARALLEL_COMPANY_PROCESSING,
      maxConcurrentCompanies: SCHEDULER_CONFIG.MAX_CONCURRENT_COMPANIES,
    },
  };

  return {
    ...baseStatus,
    performanceMetrics,
    isOptimized: true,
  };
}

/**
 * Force resume optimized scheduler (for manual recovery)
 */
export function forceResumeOptimizedScheduler(): void {
  isPaused = false;
  consecutiveErrors = 0;
  lastErrorTime = 0;
  console.log("Optimized scheduler manually resumed, error counters reset");
}

/**
 * Reset performance metrics
 */
export function resetPerformanceMetrics(): void {
  totalOperationTime = 0;
  operationCount = 0;
  console.log("Optimized scheduler performance metrics reset");
}
