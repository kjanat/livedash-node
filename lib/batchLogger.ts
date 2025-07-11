/**
 * Comprehensive Logging System for OpenAI Batch Processing Operations
 *
 * This module provides structured logging with different log levels,
 * performance metrics tracking, and integration with security audit logging.
 */

import type { AIBatchRequestStatus, AIRequestStatus } from "@prisma/client";
import {
  AuditOutcome,
  AuditSeverity,
  SecurityEventType,
  securityAuditLogger,
} from "./securityAuditLogger";

export enum BatchLogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL",
}

export enum BatchOperation {
  BATCH_CREATION = "BATCH_CREATION",
  BATCH_STATUS_CHECK = "BATCH_STATUS_CHECK",
  BATCH_RESULT_PROCESSING = "BATCH_RESULT_PROCESSING",
  FILE_UPLOAD = "FILE_UPLOAD",
  FILE_DOWNLOAD = "FILE_DOWNLOAD",
  CIRCUIT_BREAKER_ACTION = "CIRCUIT_BREAKER_ACTION",
  RETRY_OPERATION = "RETRY_OPERATION",
  SCHEDULER_ACTION = "SCHEDULER_ACTION",
  INDIVIDUAL_REQUEST_RETRY = "INDIVIDUAL_REQUEST_RETRY",
  COST_TRACKING = "COST_TRACKING",
}

export interface BatchLogContext {
  operation: BatchOperation;
  batchId?: string;
  requestId?: string;
  companyId?: string;
  openaiBatchId?: string;
  fileId?: string;
  requestCount?: number;
  retryAttempt?: number;
  duration?: number;
  statusBefore?: AIBatchRequestStatus | AIRequestStatus;
  statusAfter?: AIBatchRequestStatus | AIRequestStatus;
  errorCode?: string;
  circuitBreakerState?: "OPEN" | "CLOSED" | "HALF_OPEN";
  metadata?: Record<string, unknown>;
}

export interface BatchMetrics {
  operationStartTime: number;
  requestCount: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  totalCost: number;
  averageLatency: number;
  circuitBreakerTrips: number;
  performanceStats: {
    p50: number;
    p95: number;
    p99: number;
  };
}

class BatchLoggerService {
  private metrics: Map<string, BatchMetrics> = new Map();
  private operationTimes: Map<string, number> = new Map();
  private performanceBuffer: Map<BatchOperation, number[]> = new Map();

  private readonly LOG_COLORS = {
    [BatchLogLevel.DEBUG]: "\x1b[36m", // Cyan
    [BatchLogLevel.INFO]: "\x1b[32m", // Green
    [BatchLogLevel.WARN]: "\x1b[33m", // Yellow
    [BatchLogLevel.ERROR]: "\x1b[31m", // Red
    [BatchLogLevel.CRITICAL]: "\x1b[35m", // Magenta
  };

  private readonly RESET_COLOR = "\x1b[0m";

  /**
   * Log a batch processing event with structured data
   */
  async log(
    level: BatchLogLevel,
    message: string,
    context: BatchLogContext,
    error?: Error
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const operationId = context.batchId || context.requestId || "unknown";

    // Create structured log entry
    const logEntry = {
      timestamp,
      level,
      operation: context.operation,
      message,
      context: this.sanitizeContext(context),
      error: error ? this.formatError(error) : undefined,
      operationId,
    };

    // Console logging with colors (development)
    if (process.env.NODE_ENV !== "production") {
      this.logToConsole(logEntry);
    }

    // Structured logging (production)
    this.logToStructured(logEntry);

    // Security audit logging for important events
    await this.logToSecurityAudit(level, message, context, error);

    // Update metrics
    this.updateMetrics(context, error);

    // Performance tracking
    this.trackPerformance(context);
  }

  /**
   * Start timing an operation
   */
  startOperation(operationId: string): void {
    this.operationTimes.set(operationId, Date.now());
  }

  /**
   * End timing an operation and return duration
   */
  endOperation(operationId: string): number {
    const startTime = this.operationTimes.get(operationId);
    if (!startTime) return 0;

    const duration = Date.now() - startTime;
    this.operationTimes.delete(operationId);
    return duration;
  }

  /**
   * Log batch creation events
   */
  async logBatchCreation(
    companyId: string,
    requestCount: number,
    batchId?: string,
    openaiBatchId?: string,
    error?: Error
  ): Promise<void> {
    const level = error ? BatchLogLevel.ERROR : BatchLogLevel.INFO;
    const message = error
      ? `Failed to create batch for company ${companyId} with ${requestCount} requests`
      : `Successfully created batch for company ${companyId} with ${requestCount} requests`;

    await this.log(
      level,
      message,
      {
        operation: BatchOperation.BATCH_CREATION,
        companyId,
        batchId,
        openaiBatchId,
        requestCount,
      },
      error
    );
  }

  /**
   * Log batch status check events
   */
  async logStatusCheck(
    batchId: string,
    openaiBatchId: string,
    statusBefore: AIBatchRequestStatus,
    statusAfter: AIBatchRequestStatus,
    duration: number,
    error?: Error
  ): Promise<void> {
    const level = error ? BatchLogLevel.ERROR : BatchLogLevel.DEBUG;
    const statusChanged = statusBefore !== statusAfter;
    const message = error
      ? `Failed to check status for batch ${batchId}`
      : statusChanged
        ? `Batch ${batchId} status changed from ${statusBefore} to ${statusAfter}`
        : `Batch ${batchId} status remains ${statusAfter}`;

    await this.log(
      level,
      message,
      {
        operation: BatchOperation.BATCH_STATUS_CHECK,
        batchId,
        openaiBatchId,
        statusBefore,
        statusAfter,
        duration,
      },
      error
    );
  }

  /**
   * Log batch result processing events
   */
  async logResultProcessing(
    batchId: string,
    openaiBatchId: string,
    successCount: number,
    failureCount: number,
    duration: number,
    error?: Error
  ): Promise<void> {
    const level = error ? BatchLogLevel.ERROR : BatchLogLevel.INFO;
    const totalProcessed = successCount + failureCount;
    const message = error
      ? `Failed to process results for batch ${batchId}`
      : `Processed ${totalProcessed} results for batch ${batchId} (${successCount} success, ${failureCount} failed)`;

    await this.log(
      level,
      message,
      {
        operation: BatchOperation.BATCH_RESULT_PROCESSING,
        batchId,
        openaiBatchId,
        duration,
        metadata: { successCount, failureCount, totalProcessed },
      },
      error
    );
  }

  /**
   * Log circuit breaker events
   */
  async logCircuitBreaker(
    operation: string,
    state: "OPEN" | "CLOSED" | "HALF_OPEN",
    failures: number,
    threshold: number
  ): Promise<void> {
    const level = state === "OPEN" ? BatchLogLevel.WARN : BatchLogLevel.INFO;
    const message = `Circuit breaker ${state.toLowerCase()} for ${operation} (${failures}/${threshold} failures)`;

    await this.log(level, message, {
      operation: BatchOperation.CIRCUIT_BREAKER_ACTION,
      circuitBreakerState: state,
      metadata: { operation, failures, threshold },
    });
  }

  /**
   * Log retry attempts
   */
  async logRetry(
    operation: BatchOperation,
    operationName: string,
    attempt: number,
    maxRetries: number,
    delay: number,
    error: Error,
    batchId?: string,
    requestId?: string
  ): Promise<void> {
    const level =
      attempt === maxRetries ? BatchLogLevel.ERROR : BatchLogLevel.WARN;
    const message =
      attempt === maxRetries
        ? `Final retry failed for ${operationName} (${attempt}/${maxRetries})`
        : `Retry attempt ${attempt}/${maxRetries} for ${operationName} (next retry in ${delay}ms)`;

    await this.log(
      level,
      message,
      {
        operation,
        batchId,
        requestId,
        retryAttempt: attempt,
        metadata: { operationName, maxRetries, delay },
      },
      error
    );
  }

  /**
   * Log scheduler events
   */
  async logScheduler(
    action: string,
    duration: number,
    successCount: number,
    errorCount: number,
    error?: Error
  ): Promise<void> {
    const level = error
      ? BatchLogLevel.ERROR
      : errorCount > 0
        ? BatchLogLevel.WARN
        : BatchLogLevel.INFO;
    const message = `Scheduler ${action} completed in ${duration}ms (${successCount} success, ${errorCount} errors)`;

    await this.log(
      level,
      message,
      {
        operation: BatchOperation.SCHEDULER_ACTION,
        duration,
        metadata: { action, successCount, errorCount },
      },
      error
    );
  }

  /**
   * Log cost tracking information
   */
  async logCostTracking(
    companyId: string,
    requestCount: number,
    totalCost: number,
    tokenUsage: { prompt: number; completion: number; total: number },
    batchId?: string
  ): Promise<void> {
    const costPerRequest = totalCost / requestCount;
    const message = `Cost tracking for ${requestCount} requests: €${totalCost.toFixed(4)} (€${costPerRequest.toFixed(4)} per request)`;

    await this.log(BatchLogLevel.INFO, message, {
      operation: BatchOperation.COST_TRACKING,
      companyId,
      batchId,
      requestCount,
      metadata: { totalCost, costPerRequest, tokenUsage },
    });
  }

  /**
   * Log performance metrics
   */
  async logPerformanceMetrics(operation: BatchOperation): Promise<void> {
    const timings = this.performanceBuffer.get(operation) || [];
    if (timings.length === 0) return;

    const sorted = [...timings].sort((a, b) => a - b);
    const stats = {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };

    const message = `Performance metrics for ${operation}: avg=${stats.avg.toFixed(2)}ms, p95=${stats.p95}ms, p99=${stats.p99}ms`;

    await this.log(BatchLogLevel.INFO, message, {
      operation,
      metadata: { performanceStats: stats },
    });

    // Clear buffer after reporting
    this.performanceBuffer.delete(operation);
  }

  /**
   * Get comprehensive metrics for monitoring
   */
  getMetrics(companyId?: string): BatchMetrics | Record<string, BatchMetrics> {
    if (companyId) {
      return this.metrics.get(companyId) || this.createEmptyMetrics();
    }

    const allMetrics: Record<string, BatchMetrics> = {};
    for (const [key, metrics] of this.metrics) {
      allMetrics[key] = metrics;
    }
    return allMetrics;
  }

  /**
   * Export logs for analysis (structured JSON format)
   */
  exportLogs(timeRange: { start: Date; end: Date }): string {
    // In production, this would read from persistent log storage
    // For now, return current metrics as example
    const exportData = {
      exportTime: new Date().toISOString(),
      timeRange,
      metrics: Object.fromEntries(this.metrics),
      performanceBuffers: Object.fromEntries(this.performanceBuffer),
      summary: {
        totalOperations: this.operationTimes.size,
        activeOperations: this.operationTimes.size,
        metricsTracked: this.metrics.size,
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Clear old metrics to prevent memory leaks
   */
  cleanupMetrics(olderThanHours = 24): void {
    const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;

    for (const [key, metrics] of this.metrics) {
      if (metrics.operationStartTime < cutoff) {
        this.metrics.delete(key);
      }
    }

    // Clear old operation times
    for (const [operationId, startTime] of this.operationTimes) {
      if (startTime < cutoff) {
        this.operationTimes.delete(operationId);
      }
    }

    console.log(
      `Cleaned up batch processing metrics older than ${olderThanHours} hours`
    );
  }

  private logToConsole(logEntry: {
    timestamp: string;
    level: BatchLogLevel;
    operation: BatchOperation;
    message: string;
    context: BatchLogContext;
    error?: {
      name: string;
      message: string;
      stack?: string;
      cause?: string;
    };
    operationId: string;
  }): void {
    const color = this.LOG_COLORS[logEntry.level as BatchLogLevel] || "";
    const prefix = `${color}[BATCH-${logEntry.level}]${this.RESET_COLOR}`;

    console.log(`${prefix} ${logEntry.timestamp} ${logEntry.message}`);

    if (logEntry.context && Object.keys(logEntry.context).length > 0) {
      console.log("  Context:", this.formatContextForConsole(logEntry.context));
    }

    if (logEntry.error) {
      console.log("  Error:", logEntry.error);
    }
  }

  private logToStructured(logEntry: {
    timestamp: string;
    level: BatchLogLevel;
    operation: BatchOperation;
    message: string;
    context: BatchLogContext;
    error?: {
      name: string;
      message: string;
      stack?: string;
      cause?: string;
    };
    operationId: string;
  }): void {
    // In production, this would write to structured logging service
    // (e.g., Winston, Pino, or cloud logging service)
    if (process.env.NODE_ENV === "production") {
      // JSON structured logging for production
      console.log(JSON.stringify(logEntry));
    }
  }

  private async logToSecurityAudit(
    level: BatchLogLevel,
    _message: string,
    context: BatchLogContext,
    error?: Error
  ): Promise<void> {
    // Log to security audit system for important events
    if (level === BatchLogLevel.ERROR || level === BatchLogLevel.CRITICAL) {
      await securityAuditLogger.log({
        eventType: SecurityEventType.API_SECURITY,
        action: `batch_processing_${context.operation.toLowerCase()}`,
        outcome: error ? AuditOutcome.FAILURE : AuditOutcome.SUCCESS,
        severity:
          level === BatchLogLevel.CRITICAL
            ? AuditSeverity.CRITICAL
            : AuditSeverity.HIGH,
        errorMessage: error?.message,
        context: {
          companyId: context.companyId,
          metadata: {
            operation: context.operation,
            batchId: context.batchId,
            requestId: context.requestId,
            retryAttempt: context.retryAttempt,
            ...context.metadata,
          },
        },
      });
    }
  }

  private updateMetrics(context: BatchLogContext, error?: Error): void {
    const key = context.companyId || "global";
    let metrics = this.metrics.get(key);

    if (!metrics) {
      metrics = this.createEmptyMetrics();
      this.metrics.set(key, metrics);
    }

    if (error) {
      metrics.failureCount++;
    } else {
      metrics.successCount++;
    }

    if (context.retryAttempt) {
      metrics.retryCount++;
    }

    if (context.operation === BatchOperation.CIRCUIT_BREAKER_ACTION) {
      metrics.circuitBreakerTrips++;
    }

    if (context.duration) {
      const operationCount = metrics.successCount + metrics.failureCount;
      metrics.averageLatency =
        (metrics.averageLatency * (operationCount - 1) + context.duration) /
        operationCount;
    }

    // Update request count if provided
    if (context.requestCount) {
      metrics.requestCount += context.requestCount;
    }
  }

  private trackPerformance(context: BatchLogContext): void {
    if (context.duration && context.operation) {
      const timings = this.performanceBuffer.get(context.operation) || [];
      timings.push(context.duration);

      // Keep only last 100 measurements to prevent memory issues
      if (timings.length > 100) {
        timings.splice(0, timings.length - 100);
      }

      this.performanceBuffer.set(context.operation, timings);
    }
  }

  private createEmptyMetrics(): BatchMetrics {
    return {
      operationStartTime: Date.now(),
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      retryCount: 0,
      totalCost: 0,
      averageLatency: 0,
      circuitBreakerTrips: 0,
      performanceStats: { p50: 0, p95: 0, p99: 0 },
    };
  }

  private sanitizeContext(context: BatchLogContext): Omit<
    BatchLogContext,
    "metadata"
  > & {
    metadata?: Record<string, unknown>;
  } {
    // Remove sensitive information from context before logging
    const sanitized = { ...context };
    delete sanitized.metadata?.apiKey;
    delete sanitized.metadata?.credentials;
    return sanitized;
  }

  private formatError(error: Error): {
    name: string;
    message: string;
    stack?: string;
    cause?: string;
  } {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      cause: error.cause ? String(error.cause) : undefined,
    };
  }

  private formatContextForConsole(context: BatchLogContext): string {
    const important = {
      operation: context.operation,
      batchId: context.batchId,
      requestId: context.requestId,
      companyId: context.companyId,
      requestCount: context.requestCount,
      duration: context.duration ? `${context.duration}ms` : undefined,
      retryAttempt: context.retryAttempt,
      circuitBreakerState: context.circuitBreakerState,
    };

    // Filter out undefined values
    const filtered = Object.fromEntries(
      Object.entries(important).filter(([_, value]) => value !== undefined)
    );

    return JSON.stringify(filtered, null, 2);
  }
}

// Singleton instance for global use
export const batchLogger = new BatchLoggerService();

// Start cleanup interval
setInterval(
  () => {
    batchLogger.cleanupMetrics();
  },
  60 * 60 * 1000
); // Every hour

// Helper functions for common logging patterns
export const logBatchOperation = async <T>(
  operation: BatchOperation,
  operationId: string,
  fn: () => Promise<T>,
  context: Partial<BatchLogContext> = {}
): Promise<T> => {
  batchLogger.startOperation(operationId);

  try {
    const result = await fn();
    const duration = batchLogger.endOperation(operationId);

    await batchLogger.log(
      BatchLogLevel.INFO,
      `${operation} completed successfully`,
      {
        operation,
        duration,
        ...context,
      }
    );

    return result;
  } catch (error) {
    const duration = batchLogger.endOperation(operationId);

    await batchLogger.log(
      BatchLogLevel.ERROR,
      `${operation} failed`,
      {
        operation,
        duration,
        ...context,
      },
      error as Error
    );

    throw error;
  }
};

export const logBatchMetrics = async (
  operation: BatchOperation
): Promise<void> => {
  await batchLogger.logPerformanceMetrics(operation);
};
