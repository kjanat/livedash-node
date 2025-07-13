/**
 * Batch Processor Integration Layer
 *
 * This module provides a unified interface that can switch between
 * the original and optimized batch processing implementations based
 * on environment configuration or runtime decisions.
 */

import { BatchLogLevel, BatchOperation, batchLogger } from "./batchLogger";
// Import both implementations
import * as OriginalProcessor from "./batchProcessor";
import * as OptimizedProcessor from "./batchProcessorOptimized";
import * as OriginalScheduler from "./batchScheduler";
import * as OptimizedScheduler from "./batchSchedulerOptimized";

/**
 * Configuration for batch processing optimization
 */
const OPTIMIZATION_CONFIG = {
  // Enable optimized queries (can be controlled via environment)
  ENABLE_QUERY_OPTIMIZATION: process.env.ENABLE_BATCH_OPTIMIZATION !== "false",
  // Enable batch operations across companies
  ENABLE_BATCH_OPERATIONS: process.env.ENABLE_BATCH_OPERATIONS !== "false",
  // Enable parallel processing
  ENABLE_PARALLEL_PROCESSING:
    process.env.ENABLE_PARALLEL_PROCESSING !== "false",
  // Fallback to original on errors
  FALLBACK_ON_ERRORS: process.env.FALLBACK_ON_ERRORS !== "false",
} as const;

/**
 * Performance tracking for optimization decisions
 */
class PerformanceTracker {
  private metrics = {
    optimized: { totalTime: 0, operationCount: 0, errorCount: 0 },
    original: { totalTime: 0, operationCount: 0, errorCount: 0 },
  };

  recordOperation(
    type: "optimized" | "original",
    duration: number,
    success: boolean
  ): void {
    this.metrics[type].totalTime += duration;
    this.metrics[type].operationCount++;
    if (!success) {
      this.metrics[type].errorCount++;
    }
  }

  getAverageTime(type: "optimized" | "original"): number {
    const metric = this.metrics[type];
    return metric.operationCount > 0
      ? metric.totalTime / metric.operationCount
      : 0;
  }

  getSuccessRate(type: "optimized" | "original"): number {
    const metric = this.metrics[type];
    if (metric.operationCount === 0) return 1;
    return (metric.operationCount - metric.errorCount) / metric.operationCount;
  }

  shouldUseOptimized(): boolean {
    if (!OPTIMIZATION_CONFIG.ENABLE_QUERY_OPTIMIZATION) return false;

    // If we don't have enough data, use optimized
    if (this.metrics.optimized.operationCount < 5) return true;

    // Use optimized if it's faster and has good success rate
    const optimizedAvg = this.getAverageTime("optimized");
    const originalAvg = this.getAverageTime("original");
    const optimizedSuccess = this.getSuccessRate("optimized");

    return optimizedAvg < originalAvg && optimizedSuccess > 0.9;
  }

  getStats() {
    return {
      optimized: {
        averageTime: this.getAverageTime("optimized"),
        successRate: this.getSuccessRate("optimized"),
        ...this.metrics.optimized,
      },
      original: {
        averageTime: this.getAverageTime("original"),
        successRate: this.getSuccessRate("original"),
        ...this.metrics.original,
      },
    };
  }

  reset(): void {
    this.metrics = {
      optimized: { totalTime: 0, operationCount: 0, errorCount: 0 },
      original: { totalTime: 0, operationCount: 0, errorCount: 0 },
    };
  }
}

const performanceTracker = new PerformanceTracker();

/**
 * Wrapper function to execute with performance tracking
 */
async function executeWithTracking<T>(
  optimizedFn: () => Promise<T>,
  originalFn: () => Promise<T>,
  operationName: string
): Promise<T> {
  const useOptimized = performanceTracker.shouldUseOptimized();
  const startTime = Date.now();

  try {
    let result: T;

    if (useOptimized) {
      await batchLogger.log(
        BatchLogLevel.DEBUG,
        `Using optimized implementation for ${operationName}`,
        {
          operation: BatchOperation.SCHEDULER_ACTION,
          metadata: { operationName },
        }
      );
      result = await optimizedFn();
      performanceTracker.recordOperation(
        "optimized",
        Date.now() - startTime,
        true
      );
    } else {
      await batchLogger.log(
        BatchLogLevel.DEBUG,
        `Using original implementation for ${operationName}`,
        {
          operation: BatchOperation.SCHEDULER_ACTION,
          metadata: { operationName },
        }
      );
      result = await originalFn();
      performanceTracker.recordOperation(
        "original",
        Date.now() - startTime,
        true
      );
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (useOptimized) {
      performanceTracker.recordOperation("optimized", duration, false);

      if (OPTIMIZATION_CONFIG.FALLBACK_ON_ERRORS) {
        await batchLogger.log(
          BatchLogLevel.WARN,
          `Optimized ${operationName} failed, falling back to original implementation`,
          {
            operation: BatchOperation.SCHEDULER_ACTION,
            metadata: { operationName },
          },
          error as Error
        );

        try {
          const result = await originalFn();
          performanceTracker.recordOperation(
            "original",
            Date.now() - startTime,
            true
          );
          return result;
        } catch (fallbackError) {
          performanceTracker.recordOperation(
            "original",
            Date.now() - startTime,
            false
          );
          throw fallbackError;
        }
      }
    } else {
      performanceTracker.recordOperation("original", duration, false);
    }

    throw error;
  }
}

/**
 * Unified interface for batch processing operations
 */
export const IntegratedBatchProcessor = {
  /**
   * Get pending batch requests with automatic optimization
   */
  getPendingBatchRequests: async (companyId: string, limit?: number) => {
    return executeWithTracking(
      () =>
        OptimizedProcessor.getPendingBatchRequestsOptimized(companyId, limit),
      () => OriginalProcessor.getPendingBatchRequests(companyId, limit),
      "getPendingBatchRequests"
    );
  },

  /**
   * Get batch processing statistics with optimization
   */
  getBatchProcessingStats: async (companyId?: string) => {
    return executeWithTracking(
      () => OptimizedProcessor.getBatchProcessingStatsOptimized(companyId),
      async () => {
        // Adapter function to transform original output to match optimized output
        const originalResult = await OriginalProcessor.getBatchProcessingStats(
          companyId || ""
        );
        const batchStats = originalResult.batchStats as Record<string, number>;

        return {
          totalBatches: Object.values(batchStats).reduce(
            (sum, count) => sum + count,
            0
          ),
          pendingRequests: originalResult.pendingRequests,
          inProgressBatches:
            (batchStats.IN_PROGRESS || 0) +
            (batchStats.VALIDATING || 0) +
            (batchStats.UPLOADING || 0) +
            (batchStats.FINALIZING || 0),
          completedBatches:
            (batchStats.COMPLETED || 0) + (batchStats.PROCESSED || 0),
          failedRequests:
            (batchStats.FAILED || 0) + (batchStats.CANCELLED || 0),
        };
      },
      "getBatchProcessingStats"
    );
  },

  /**
   * Check if we should create a batch for a company
   */
  shouldCreateBatch: async (
    companyId: string,
    pendingCount: number
  ): Promise<boolean> => {
    if (performanceTracker.shouldUseOptimized()) {
      // Always create if we have enough requests
      if (pendingCount >= 10) {
        // MIN_BATCH_SIZE
        return true;
      }

      // Check if oldest pending request is old enough (optimized query)
      const oldestPending =
        await OptimizedProcessor.getOldestPendingRequestOptimized(companyId);
      if (!oldestPending) {
        return false;
      }

      const waitTimeMs = Date.now() - oldestPending.requestedAt.getTime();
      const maxWaitTimeMs = 30 * 60 * 1000; // MAX_WAIT_TIME_MINUTES

      return waitTimeMs >= maxWaitTimeMs;
    }
    // Use original implementation logic
    return false; // Simplified fallback
  },

  /**
   * Start the appropriate scheduler based on configuration
   */
  startScheduler: (): void => {
    if (OPTIMIZATION_CONFIG.ENABLE_QUERY_OPTIMIZATION) {
      OptimizedScheduler.startOptimizedBatchScheduler();
    } else {
      OriginalScheduler.startBatchScheduler();
    }
  },

  /**
   * Stop the appropriate scheduler
   */
  stopScheduler: (): void => {
    if (OPTIMIZATION_CONFIG.ENABLE_QUERY_OPTIMIZATION) {
      OptimizedScheduler.stopOptimizedBatchScheduler();
    } else {
      OriginalScheduler.stopBatchScheduler();
    }
  },

  /**
   * Get scheduler status with optimization info
   */
  getSchedulerStatus: () => {
    const baseStatus = OPTIMIZATION_CONFIG.ENABLE_QUERY_OPTIMIZATION
      ? OptimizedScheduler.getOptimizedBatchSchedulerStatus()
      : OriginalScheduler.getBatchSchedulerStatus();

    return {
      ...baseStatus,
      optimization: {
        enabled: OPTIMIZATION_CONFIG.ENABLE_QUERY_OPTIMIZATION,
        config: OPTIMIZATION_CONFIG,
        performance: performanceTracker.getStats(),
      },
    };
  },

  /**
   * Force invalidate caches (useful for testing or manual intervention)
   */
  invalidateCaches: (): void => {
    if (OPTIMIZATION_CONFIG.ENABLE_QUERY_OPTIMIZATION) {
      OptimizedProcessor.invalidateCompanyCache();
    }
  },

  /**
   * Get cache statistics
   */
  getCacheStats: () => {
    if (OPTIMIZATION_CONFIG.ENABLE_QUERY_OPTIMIZATION) {
      return OptimizedProcessor.getCompanyCacheStats();
    }
    return null;
  },

  /**
   * Reset performance tracking (useful for testing)
   */
  resetPerformanceTracking: (): void => {
    performanceTracker.reset();
  },
};

/**
 * Export unified functions that can be used as drop-in replacements
 */
export const getPendingBatchRequests =
  IntegratedBatchProcessor.getPendingBatchRequests;
export const getBatchProcessingStats =
  IntegratedBatchProcessor.getBatchProcessingStats;
export const startBatchScheduler = IntegratedBatchProcessor.startScheduler;
export const stopBatchScheduler = IntegratedBatchProcessor.stopScheduler;
export const getBatchSchedulerStatus =
  IntegratedBatchProcessor.getSchedulerStatus;

/**
 * Log optimization configuration on module load
 */
(async () => {
  await batchLogger.log(
    BatchLogLevel.INFO,
    "Batch processor integration initialized",
    {
      operation: BatchOperation.SCHEDULER_ACTION,
      metadata: {
        optimizationEnabled: OPTIMIZATION_CONFIG.ENABLE_QUERY_OPTIMIZATION,
        config: OPTIMIZATION_CONFIG,
      },
    }
  );
})();
