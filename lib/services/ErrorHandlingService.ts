/**
 * Centralized error handling service
 * Provides consistent error handling patterns across the application
 */

import { DATABASE, SCHEDULER } from "../constants";

export interface ErrorContext {
  operation: string;
  component: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  companyId?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;

  private constructor() {}

  static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Execute operation with standardized error handling and retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    retryConfig: Partial<RetryConfig> = {}
  ): Promise<T> {
    const config: RetryConfig = {
      maxAttempts: DATABASE.MAX_RETRY_ATTEMPTS,
      baseDelay: DATABASE.RETRY_DELAY_BASE,
      maxDelay: DATABASE.RETRY_DELAY_MAX,
      backoffMultiplier: 2,
      jitter: true,
      ...retryConfig,
    };

    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation();

        // Log successful retry if previous attempts failed
        if (attempt > 1) {
          console.info(
            `${context.component}.${context.operation} succeeded on attempt ${attempt}`,
            {
              context,
              attempt,
              maxAttempts: config.maxAttempts,
            }
          );
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isLastAttempt = attempt === config.maxAttempts;
        const shouldRetry = this.shouldRetry(
          lastError,
          attempt,
          config.maxAttempts
        );

        if (isLastAttempt || !shouldRetry) {
          this.logError(lastError, context, {
            attempt,
            maxAttempts: config.maxAttempts,
            finalFailure: true,
          });
          throw lastError;
        }

        // Log retry attempt
        this.logError(lastError, context, {
          attempt,
          maxAttempts: config.maxAttempts,
          willRetry: true,
        });

        // Wait before retry with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, config);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Execute scheduler operation with standardized error handling
   */
  async executeSchedulerOperation<T>(
    operation: () => Promise<T>,
    schedulerName: string,
    operationName: string,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const context: ErrorContext = {
      operation: operationName,
      component: `scheduler.${schedulerName}`,
      metadata,
    };

    try {
      const startTime = Date.now();
      const result = await this.executeWithRetry(operation, context);
      const duration = Date.now() - startTime;

      // Log successful operation
      console.debug(
        `Scheduler operation completed: ${schedulerName}.${operationName}`,
        {
          duration,
          metadata,
        }
      );

      return result;
    } catch (error) {
      // Final error logging with enhanced context
      this.logSchedulerError(
        error as Error,
        schedulerName,
        operationName,
        metadata
      );
      throw error;
    }
  }

  /**
   * Execute API operation with timeout and error handling
   */
  async executeApiOperation<T>(
    operation: () => Promise<T>,
    apiName: string,
    operationName: string,
    timeoutMs: number = SCHEDULER.MAX_PROCESSING_TIME,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const context: ErrorContext = {
      operation: operationName,
      component: `api.${apiName}`,
      metadata,
    };

    return this.executeWithRetry(
      () => this.withTimeout(operation(), timeoutMs),
      context
    );
  }

  /**
   * Log error with consistent format and context
   */
  private logError(
    error: Error,
    context: ErrorContext,
    additionalInfo?: Record<string, unknown>
  ): void {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
      timestamp: new Date().toISOString(),
      ...additionalInfo,
    };

    console.error(
      `Error in ${context.component}.${context.operation}:`,
      errorInfo
    );
  }

  /**
   * Log scheduler-specific errors with enhanced context
   */
  private logSchedulerError(
    error: Error,
    schedulerName: string,
    operationName: string,
    metadata?: Record<string, unknown>
  ): void {
    console.error(
      `Scheduler ${schedulerName} failed during ${operationName}:`,
      {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        scheduler: schedulerName,
        operation: operationName,
        metadata,
        timestamp: new Date().toISOString(),
        severity: "ERROR",
      }
    );
  }

  /**
   * Determine if error is retryable
   */
  private shouldRetry(
    error: Error,
    attempt: number,
    maxAttempts: number
  ): boolean {
    if (attempt >= maxAttempts) {
      return false;
    }

    // Don't retry certain types of errors
    const nonRetryableErrors = [
      "ValidationError",
      "AuthenticationError",
      "AuthorizationError",
      "NotFoundError",
      "BadRequestError",
    ];

    if (nonRetryableErrors.includes(error.name)) {
      return false;
    }

    // Don't retry if error message indicates non-retryable condition
    const nonRetryableMessages = [
      "invalid input",
      "unauthorized",
      "forbidden",
      "not found",
      "bad request",
    ];

    const errorMessage = error.message.toLowerCase();
    if (nonRetryableMessages.some((msg) => errorMessage.includes(msg))) {
      return false;
    }

    return true;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay =
      config.baseDelay * config.backoffMultiplier ** (attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

    if (!config.jitter) {
      return cappedDelay;
    }

    // Add jitter: ±25% of the delay
    const jitterRange = cappedDelay * 0.25;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;

    return Math.max(0, cappedDelay + jitter);
  }

  /**
   * Add timeout to a promise
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create error with enhanced context
   */
  createError(
    message: string,
    context: ErrorContext,
    originalError?: Error
  ): Error {
    const enhancedMessage = `${context.component}.${context.operation}: ${message}`;
    const error = new Error(enhancedMessage);

    if (originalError) {
      error.stack = originalError.stack;
      error.cause = originalError;
    }

    return error;
  }
}
