/**
 * OpenAI Batch Processing Scheduler
 *
 * This scheduler manages the lifecycle of OpenAI batch requests:
 * 1. Creates new batches from pending requests
 * 2. Checks status of in-progress batches
 * 3. Processes completed batch results
 */

import cron, { type ScheduledTask } from "node-cron";
import {
  checkBatchStatuses,
  createBatchRequest,
  getBatchProcessingStats,
  getPendingBatchRequests,
  processCompletedBatches,
} from "./batchProcessor";
import { prisma } from "./prisma";
import { getSchedulerConfig } from "./schedulerConfig";

/**
 * Configuration for batch scheduler intervals
 */
const SCHEDULER_CONFIG = {
  // Check for new batches to create every 5 minutes
  CREATE_BATCHES_INTERVAL: "*/5 * * * *",
  // Check batch statuses every 2 minutes
  CHECK_STATUS_INTERVAL: "*/2 * * * *",
  // Process completed batches every minute
  PROCESS_RESULTS_INTERVAL: "* * * * *",
  // Minimum batch size to trigger creation
  MIN_BATCH_SIZE: 10,
  // Maximum time to wait before creating a batch (even if under min size)
  MAX_WAIT_TIME_MINUTES: 30,
} as const;

let createBatchesTask: ScheduledTask | null = null;
let checkStatusTask: ScheduledTask | null = null;
let processResultsTask: ScheduledTask | null = null;

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
    async () => {
      try {
        await createBatchesForAllCompanies();
      } catch (error) {
        console.error("Error in batch creation scheduler:", error);
      }
    }
  );

  // Schedule status checking
  checkStatusTask = cron.schedule(
    SCHEDULER_CONFIG.CHECK_STATUS_INTERVAL,
    async () => {
      try {
        await checkBatchStatusesForAllCompanies();
      } catch (error) {
        console.error("Error in batch status checker:", error);
      }
    }
  );

  // Schedule result processing
  processResultsTask = cron.schedule(
    SCHEDULER_CONFIG.PROCESS_RESULTS_INTERVAL,
    async () => {
      try {
        await processCompletedBatchesForAllCompanies();
      } catch (error) {
        console.error("Error in batch result processor:", error);
      }
    }
  );

  // Start all tasks
  createBatchesTask.start();
  checkStatusTask.start();
  processResultsTask.start();

  console.log("Batch scheduler started successfully");
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
    isRunning: !!(createBatchesTask && checkStatusTask && processResultsTask),
    createBatchesRunning: !!createBatchesTask,
    checkStatusRunning: !!checkStatusTask,
    processResultsRunning: !!processResultsTask,
    config: SCHEDULER_CONFIG,
  };
}
