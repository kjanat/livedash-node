/**
 * OpenAI Batch API Processing Utilities
 *
 * This module implements Phase 1 of the AI Session Processing Pipeline refactor
 * to use OpenAI's Batch API for cost-efficient processing of AI requests.
 *
 * Key benefits:
 * - 50% cost reduction compared to real-time API calls
 * - Better rate limiting and throughput management
 * - Improved error handling and retry mechanisms
 */

import {
  AIBatchRequestStatus,
  type AIProcessingRequest,
  AIRequestStatus,
} from "@prisma/client";
import { BatchLogLevel, BatchOperation, batchLogger } from "./batchLogger";
import { env } from "./env";
import { openAIMock } from "./mocks/openai-mock-server";
import { prisma } from "./prisma";

/**
 * Configuration for batch processing with retry logic
 */
const BATCH_CONFIG = {
  // Maximum number of requests per batch (OpenAI limit is 50,000)
  MAX_REQUESTS_PER_BATCH: 1000,
  // Minimum time to wait before checking batch status (in milliseconds)
  MIN_STATUS_CHECK_INTERVAL: 60000, // 1 minute
  // Maximum time to wait for a batch to complete (24 hours)
  MAX_BATCH_TIMEOUT: 24 * 60 * 60 * 1000,
  // Retry configuration
  MAX_RETRIES: 3,
  BASE_RETRY_DELAY: 1000, // 1 second
  MAX_RETRY_DELAY: 30000, // 30 seconds
  EXPONENTIAL_BACKOFF_MULTIPLIER: 2,
  // Circuit breaker configuration
  CIRCUIT_BREAKER_THRESHOLD: 5, // failures before opening circuit
  CIRCUIT_BREAKER_TIMEOUT: 5 * 60 * 1000, // 5 minutes
  // Request timeout
  REQUEST_TIMEOUT: 60000, // 60 seconds
} as const;

/**
 * Circuit breaker state for API operations
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private isOpen = false;

  reset(): void {
    this.failures = 0;
    this.isOpen = false;
    this.lastFailureTime = 0;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      const now = Date.now();
      if (now - this.lastFailureTime < BATCH_CONFIG.CIRCUIT_BREAKER_TIMEOUT) {
        await batchLogger.logCircuitBreaker(
          "batch_operation",
          "OPEN",
          this.failures,
          BATCH_CONFIG.CIRCUIT_BREAKER_THRESHOLD
        );
        throw new CircuitBreakerOpenError("Circuit breaker is open");
      }
      // Half-open state - try to recover
      this.isOpen = false;
      this.failures = 0;
      await batchLogger.logCircuitBreaker(
        "batch_operation",
        "HALF_OPEN",
        this.failures,
        BATCH_CONFIG.CIRCUIT_BREAKER_THRESHOLD
      );
    }

    try {
      const result = await operation();
      if (this.failures > 0) {
        await batchLogger.logCircuitBreaker(
          "batch_operation",
          "CLOSED",
          0,
          BATCH_CONFIG.CIRCUIT_BREAKER_THRESHOLD
        );
      }
      this.failures = 0; // Reset on success
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= BATCH_CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
        this.isOpen = true;
        await batchLogger.logCircuitBreaker(
          "batch_operation",
          "OPEN",
          this.failures,
          BATCH_CONFIG.CIRCUIT_BREAKER_THRESHOLD
        );
      }

      throw error;
    }
  }

  isCircuitOpen(): boolean {
    return this.isOpen;
  }

  getStatus() {
    return {
      isOpen: this.isOpen,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Custom error classes for better error handling
 */
class BatchProcessingError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "BatchProcessingError";
  }
}

class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

class RetryableError extends Error {
  constructor(
    message: string,
    public readonly isRetryable = true
  ) {
    super(message);
    this.name = "RetryableError";
  }
}

class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}

// Global circuit breakers for different operations
const fileUploadCircuitBreaker = new CircuitBreaker();
const batchCreationCircuitBreaker = new CircuitBreaker();
const batchStatusCircuitBreaker = new CircuitBreaker();
const fileDownloadCircuitBreaker = new CircuitBreaker();

/**
 * Check if an error should prevent retries
 */
function shouldNotRetry(error: Error): boolean {
  return (
    error instanceof NonRetryableError ||
    error instanceof CircuitBreakerOpenError ||
    !isErrorRetryable(error)
  );
}

/**
 * Calculate exponential backoff delay
 */
function calculateRetryDelay(attempt: number): number {
  return Math.min(
    BATCH_CONFIG.BASE_RETRY_DELAY *
      BATCH_CONFIG.EXPONENTIAL_BACKOFF_MULTIPLIER ** attempt,
    BATCH_CONFIG.MAX_RETRY_DELAY
  );
}

/**
 * Handle retry attempt logging and delay
 */
async function handleRetryAttempt(
  operationName: string,
  attempt: number,
  maxRetries: number,
  error: Error
): Promise<void> {
  const delay = calculateRetryDelay(attempt);

  await batchLogger.logRetry(
    BatchOperation.RETRY_OPERATION,
    operationName,
    attempt + 1,
    maxRetries + 1,
    delay,
    error
  );

  console.warn(
    `${operationName} failed on attempt ${attempt + 1}, retrying in ${delay}ms:`,
    error.message
  );

  await sleep(delay);
}

/**
 * Retry utility with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries = BATCH_CONFIG.MAX_RETRIES
): Promise<T> {
  let lastError: Error = new Error("Operation failed");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      if (attempt > 0) {
        console.log(`${operationName} succeeded on attempt ${attempt + 1}`);
      }
      return result;
    } catch (error) {
      lastError = error as Error;

      if (shouldNotRetry(lastError)) {
        throw lastError;
      }

      if (attempt === maxRetries) {
        throw new BatchProcessingError(
          `${operationName} failed after ${maxRetries + 1} attempts`,
          lastError
        );
      }

      await handleRetryAttempt(operationName, attempt, maxRetries, lastError);
    }
  }

  throw lastError || new Error("Operation failed after retries");
}

/**
 * Determine if an error is retryable
 */
function isErrorRetryable(error: Error): boolean {
  // Network errors are usually retryable
  if (
    error.message.includes("ECONNRESET") ||
    error.message.includes("ETIMEDOUT") ||
    error.message.includes("ENOTFOUND") ||
    error.message.includes("socket hang up")
  ) {
    return true;
  }

  // HTTP errors - check status codes
  if (
    error.message.includes("fetch failed") ||
    error.message.includes("Failed to")
  ) {
    // 5xx errors are retryable, 4xx errors are usually not
    if (
      error.message.includes("500") ||
      error.message.includes("502") ||
      error.message.includes("503") ||
      error.message.includes("504") ||
      error.message.includes("429")
    ) {
      // Rate limit
      return true;
    }

    // 4xx errors are usually not retryable
    if (
      error.message.includes("400") ||
      error.message.includes("401") ||
      error.message.includes("403") ||
      error.message.includes("404")
    ) {
      return false;
    }
  }

  // Default to retryable for unknown errors
  return true;
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a fetch request with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = BATCH_CONFIG.REQUEST_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === "AbortError") {
      throw new RetryableError(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Represents a single request in an OpenAI batch
 */
interface OpenAIBatchRequest {
  custom_id: string;
  method: "POST";
  url: "/v1/chat/completions";
  body: {
    model: string;
    messages: Array<{
      role: string;
      content: string;
    }>;
    temperature?: number;
    max_tokens?: number;
  };
}

/**
 * OpenAI Batch API response format
 */
interface OpenAIBatchResponse {
  id: string;
  object: "batch";
  endpoint: string;
  errors: {
    object: "list";
    data: Array<{
      code: string;
      message: string;
      param?: string;
      type: string;
    }>;
  };
  input_file_id: string;
  completion_window: string;
  status:
    | "validating"
    | "failed"
    | "in_progress"
    | "finalizing"
    | "completed"
    | "expired"
    | "cancelling"
    | "cancelled";
  output_file_id?: string;
  error_file_id?: string;
  created_at: number;
  in_progress_at?: number;
  expires_at?: number;
  finalizing_at?: number;
  completed_at?: number;
  failed_at?: number;
  expired_at?: number;
  cancelling_at?: number;
  cancelled_at?: number;
  request_counts: {
    total: number;
    completed: number;
    failed: number;
  };
  metadata?: Record<string, string>;
}

/**
 * Get pending AI processing requests that need to be batched
 */
export async function getPendingBatchRequests(
  companyId: string,
  limit: number = BATCH_CONFIG.MAX_REQUESTS_PER_BATCH
): Promise<AIProcessingRequestWithSession[]> {
  return prisma.aIProcessingRequest.findMany({
    where: {
      session: {
        companyId,
      },
      processingStatus: AIRequestStatus.PENDING_BATCHING,
      batchId: null,
    },
    include: {
      session: {
        include: {
          messages: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
    take: limit,
    orderBy: {
      requestedAt: "asc",
    },
  }) as Promise<
    (AIProcessingRequest & {
      session: {
        id: string;
        companyId: string;
        messages: Array<{
          id: string;
          role: string;
          content: string;
          order: number;
        }>;
      };
    })[]
  >;
}

/**
 * Create a new batch request and upload to OpenAI
 */
type AIProcessingRequestWithSession = AIProcessingRequest & {
  session: {
    messages: Array<{
      id: string;
      order: number;
      role: string;
      content: string;
    }>;
  };
};

export async function createBatchRequest(
  companyId: string,
  requests: AIProcessingRequestWithSession[]
): Promise<string> {
  if (requests.length === 0) {
    throw new Error("Cannot create batch with no requests");
  }

  if (requests.length > BATCH_CONFIG.MAX_REQUESTS_PER_BATCH) {
    throw new Error(
      `Batch size ${requests.length} exceeds maximum of ${BATCH_CONFIG.MAX_REQUESTS_PER_BATCH}`
    );
  }

  try {
    await batchLogger.log(
      BatchLogLevel.INFO,
      `Starting batch creation for company ${companyId} with ${requests.length} requests`,
      {
        operation: BatchOperation.BATCH_CREATION,
        companyId,
        requestCount: requests.length,
      }
    );

    // Create batch requests in OpenAI format
    const batchRequests: OpenAIBatchRequest[] = requests.map((request) => ({
      custom_id: request.id,
      method: "POST",
      url: "/v1/chat/completions",
      body: {
        model: request.model,
        messages: [
          {
            role: "system",
            content: getSystemPromptForProcessingType(
              request.processingType || "full_analysis"
            ),
          },
          {
            role: "user",
            content: formatMessagesForProcessing(
              request.session?.messages || []
            ),
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      },
    }));

    // Convert to JSONL format for OpenAI
    const jsonlContent = batchRequests
      .map((req) => JSON.stringify(req))
      .join("\n");

    // Upload file to OpenAI
    const fileResponse = await uploadFileToOpenAI(jsonlContent);

    // Create batch on OpenAI
    const batchResponse = await createOpenAIBatch(fileResponse.id);

    // Store batch request in our database
    const batchRequest = await prisma.aIBatchRequest.create({
      data: {
        companyId,
        openaiBatchId: batchResponse.id,
        inputFileId: fileResponse.id,
        status: AIBatchRequestStatus.IN_PROGRESS,
        processingRequests: {
          connect: requests.map((req) => ({ id: req.id })),
        },
      },
    });

    // Update individual requests to mark them as batching
    await prisma.aIProcessingRequest.updateMany({
      where: {
        id: {
          in: requests.map((req) => req.id),
        },
      },
      data: {
        processingStatus: AIRequestStatus.BATCHING_IN_PROGRESS,
        batchId: batchRequest.id,
      },
    });

    await batchLogger.logBatchCreation(
      companyId,
      requests.length,
      batchRequest.id,
      batchResponse.id
    );

    return batchRequest.id;
  } catch (error) {
    await batchLogger.logBatchCreation(
      companyId,
      requests.length,
      undefined,
      undefined,
      error as Error
    );
    throw error;
  }
}

/**
 * Check the status of all in-progress batches for a company
 */
export async function checkBatchStatuses(companyId: string): Promise<void> {
  const startTime = Date.now();

  const inProgressBatches = await prisma.aIBatchRequest.findMany({
    where: {
      companyId,
      status: {
        in: [
          AIBatchRequestStatus.IN_PROGRESS,
          AIBatchRequestStatus.VALIDATING,
          AIBatchRequestStatus.FINALIZING,
        ],
      },
    },
  });

  await batchLogger.log(
    BatchLogLevel.DEBUG,
    `Checking status for ${inProgressBatches.length} batches in company ${companyId}`,
    {
      operation: BatchOperation.BATCH_STATUS_CHECK,
      companyId,
      requestCount: inProgressBatches.length,
    }
  );

  // Process batches concurrently but with error isolation
  const results = await Promise.allSettled(
    inProgressBatches.map(async (batch) => {
      try {
        const statusBefore = batch.status;
        const status = await retryWithBackoff(
          () =>
            batchStatusCircuitBreaker.execute(() =>
              getOpenAIBatchStatus(batch.openaiBatchId)
            ),
          `Check batch status ${batch.id}`
        );

        await updateBatchStatus(batch.id, status);

        await batchLogger.logStatusCheck(
          batch.id,
          batch.openaiBatchId,
          statusBefore,
          status.status === "completed"
            ? AIBatchRequestStatus.COMPLETED
            : status.status === "failed"
              ? AIBatchRequestStatus.FAILED
              : statusBefore,
          Date.now() - startTime
        );
      } catch (error) {
        console.error(`Failed to check status for batch ${batch.id}:`, error);

        // Mark batch as failed if circuit breaker is open or too many retries
        if (
          error instanceof CircuitBreakerOpenError ||
          error instanceof BatchProcessingError
        ) {
          await markBatchAsFailed(batch.id, (error as Error).message);
        }

        throw error;
      }
    })
  );

  // Log any failures
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    console.warn(
      `${failures.length}/${inProgressBatches.length} batch status checks failed for company ${companyId}`
    );
  }
}

/**
 * Process completed batches and extract results
 */
export async function processCompletedBatches(
  companyId: string
): Promise<void> {
  const completedBatches = await prisma.aIBatchRequest.findMany({
    where: {
      companyId,
      status: AIBatchRequestStatus.COMPLETED,
      outputFileId: {
        not: null,
      },
    },
    include: {
      processingRequests: {
        include: {
          session: true,
        },
      },
    },
  });

  // Process batches concurrently but with error isolation
  const results = await Promise.allSettled(
    completedBatches.map(async (batch) => {
      try {
        await retryWithBackoff(
          () =>
            fileDownloadCircuitBreaker.execute(() =>
              processBatchResults(batch)
            ),
          `Process batch results ${batch.id}`
        );
      } catch (error) {
        console.error(
          `Failed to process batch results for ${batch.id}:`,
          error
        );

        // Mark batch as failed and handle failed requests
        await markBatchAsFailed(batch.id, (error as Error).message);

        // Mark individual requests as failed so they can be retried individually
        await handleFailedBatchRequests(
          batch.processingRequests,
          (error as Error).message
        );

        throw error;
      }
    })
  );

  // Log any failures
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    console.warn(
      `${failures.length}/${completedBatches.length} batch result processing failed for company ${companyId}`
    );
  }
}

/**
 * Helper function to upload file content to OpenAI (real or mock)
 */
async function uploadFileToOpenAI(content: string): Promise<{ id: string }> {
  if (env.OPENAI_MOCK_MODE) {
    console.log(
      `[OpenAI Mock] Uploading batch file with ${content.split("\n").length} requests`
    );
    return openAIMock.mockUploadFile({
      file: content,
      purpose: "batch",
    });
  }

  return retryWithBackoff(
    () =>
      fileUploadCircuitBreaker.execute(async () => {
        const formData = new FormData();
        formData.append(
          "file",
          new Blob([content], { type: "application/jsonl" }),
          "batch_requests.jsonl"
        );
        formData.append("purpose", "batch");

        const response = await fetchWithTimeout(
          "https://api.openai.com/v1/files",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          if (response.status >= 400 && response.status < 500) {
            throw new NonRetryableError(
              `Failed to upload file: ${response.status} ${response.statusText} - ${errorText}`
            );
          }
          throw new RetryableError(
            `Failed to upload file: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        return response.json();
      }),
    "Upload file to OpenAI"
  );
}

/**
 * Helper function to create a batch request on OpenAI (real or mock)
 */
async function createOpenAIBatch(
  inputFileId: string
): Promise<OpenAIBatchResponse> {
  if (env.OPENAI_MOCK_MODE) {
    console.log(`[OpenAI Mock] Creating batch with input file ${inputFileId}`);
    return openAIMock.mockCreateBatch({
      input_file_id: inputFileId,
      endpoint: "/v1/chat/completions",
      completion_window: "24h",
    });
  }

  return retryWithBackoff(
    () =>
      batchCreationCircuitBreaker.execute(async () => {
        const response = await fetchWithTimeout(
          "https://api.openai.com/v1/batches",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input_file_id: inputFileId,
              endpoint: "/v1/chat/completions",
              completion_window: "24h",
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          if (response.status >= 400 && response.status < 500) {
            throw new NonRetryableError(
              `Failed to create batch: ${response.status} ${response.statusText} - ${errorText}`
            );
          }
          throw new RetryableError(
            `Failed to create batch: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        return response.json();
      }),
    "Create OpenAI batch"
  );
}

/**
 * Helper function to get batch status from OpenAI (real or mock)
 */
async function getOpenAIBatchStatus(
  batchId: string
): Promise<OpenAIBatchResponse> {
  if (env.OPENAI_MOCK_MODE) {
    console.log(`[OpenAI Mock] Getting batch status for ${batchId}`);
    return openAIMock.mockGetBatch(batchId);
  }

  const response = await fetchWithTimeout(
    `https://api.openai.com/v1/batches/${batchId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    if (response.status >= 400 && response.status < 500) {
      throw new NonRetryableError(
        `Failed to get batch status: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
    throw new RetryableError(
      `Failed to get batch status: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return response.json();
}

/**
 * Update batch status in our database based on OpenAI response
 */
async function updateBatchStatus(
  batchId: string,
  openAIResponse: OpenAIBatchResponse
): Promise<void> {
  const statusMapping: Record<string, AIBatchRequestStatus> = {
    validating: AIBatchRequestStatus.VALIDATING,
    failed: AIBatchRequestStatus.FAILED,
    in_progress: AIBatchRequestStatus.IN_PROGRESS,
    finalizing: AIBatchRequestStatus.FINALIZING,
    completed: AIBatchRequestStatus.COMPLETED,
    expired: AIBatchRequestStatus.FAILED,
    cancelled: AIBatchRequestStatus.CANCELLED,
  };

  const ourStatus =
    statusMapping[openAIResponse.status] || AIBatchRequestStatus.FAILED;

  await prisma.aIBatchRequest.update({
    where: { id: batchId },
    data: {
      status: ourStatus,
      outputFileId: openAIResponse.output_file_id,
      errorFileId: openAIResponse.error_file_id,
      completedAt: openAIResponse.completed_at
        ? new Date(openAIResponse.completed_at * 1000)
        : null,
    },
  });
}

/**
 * Process results from a completed batch
 */
async function processBatchResults(batch: {
  id: string;
  outputFileId: string | null;
  processingRequests: Array<{ sessionId: string }>;
}): Promise<void> {
  const startTime = Date.now();
  let successCount = 0;
  let failureCount = 0;

  if (!batch.outputFileId) {
    throw new Error("No output file available for completed batch");
  }

  try {
    await batchLogger.log(
      BatchLogLevel.INFO,
      `Starting result processing for batch ${batch.id}`,
      {
        operation: BatchOperation.BATCH_RESULT_PROCESSING,
        batchId: batch.id,
        requestCount: batch.processingRequests.length,
      }
    );

    // Download results from OpenAI
    const results = await downloadOpenAIFile(batch.outputFileId);

    // Parse JSONL results
    const resultLines = results.split("\n").filter((line) => line.trim());

    for (const line of resultLines) {
      try {
        const result = JSON.parse(line);
        const requestId = result.custom_id;

        if (result.response?.body?.choices?.[0]?.message?.content) {
          // Process successful result
          await updateProcessingRequestWithResult(
            requestId,
            result.response.body
          );
          successCount++;
        } else {
          // Handle error result
          await markProcessingRequestAsFailed(
            requestId,
            result.error?.message || "Unknown error"
          );
          failureCount++;
        }
      } catch (error) {
        console.error("Failed to process batch result line:", error);
      }
    }

    // Mark batch as processed
    await prisma.aIBatchRequest.update({
      where: { id: batch.id },
      data: {
        status: AIBatchRequestStatus.PROCESSED,
        processedAt: new Date(),
      },
    });

    const duration = Date.now() - startTime;
    await batchLogger.logResultProcessing(
      batch.id,
      "processed",
      successCount,
      failureCount,
      duration
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    await batchLogger.logResultProcessing(
      batch.id,
      "error",
      successCount,
      failureCount,
      duration,
      error as Error
    );
    throw error;
  }
}

/**
 * Download file content from OpenAI (real or mock)
 */
async function downloadOpenAIFile(fileId: string): Promise<string> {
  if (env.OPENAI_MOCK_MODE) {
    console.log(`[OpenAI Mock] Downloading file content for ${fileId}`);
    return openAIMock.mockGetFileContent(fileId);
  }

  return retryWithBackoff(
    () =>
      fileDownloadCircuitBreaker.execute(async () => {
        const response = await fetchWithTimeout(
          `https://api.openai.com/v1/files/${fileId}/content`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          if (response.status >= 400 && response.status < 500) {
            throw new NonRetryableError(
              `Failed to download file: ${response.status} ${response.statusText} - ${errorText}`
            );
          }
          throw new RetryableError(
            `Failed to download file: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        return response.text();
      }),
    "Download file from OpenAI"
  );
}

/**
 * Update processing request with successful AI result
 */
async function updateProcessingRequestWithResult(
  requestId: string,
  aiResponse: {
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    choices: Array<{
      message: {
        content: string;
      };
    }>;
  }
): Promise<void> {
  const usage = aiResponse.usage;
  const content = aiResponse.choices[0].message.content;

  try {
    const parsedResult = JSON.parse(content);

    // Update the processing request with usage data
    await prisma.aIProcessingRequest.update({
      where: { id: requestId },
      data: {
        processingStatus: AIRequestStatus.PROCESSING_COMPLETE,
        success: true,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        completedAt: new Date(),
      },
    });

    // Update the session with AI analysis results
    const request = await prisma.aIProcessingRequest.findUnique({
      where: { id: requestId },
      include: { session: true },
    });

    if (request?.session) {
      await prisma.session.update({
        where: { id: request.sessionId },
        data: {
          summary: parsedResult.summary,
          sentiment: parsedResult.sentiment,
          category: parsedResult.category,
          language: parsedResult.language,
        },
      });
    }
  } catch (error) {
    console.error(`Failed to parse AI result for request ${requestId}:`, error);
    await markProcessingRequestAsFailed(
      requestId,
      "Failed to parse AI response"
    );
  }
}

/**
 * Mark processing request as failed
 */
async function markProcessingRequestAsFailed(
  requestId: string,
  errorMessage: string
): Promise<void> {
  await prisma.aIProcessingRequest.update({
    where: { id: requestId },
    data: {
      processingStatus: AIRequestStatus.PROCESSING_FAILED,
      success: false,
      errorMessage,
      completedAt: new Date(),
    },
  });
}

/**
 * Get system prompt based on processing type
 */
function getSystemPromptForProcessingType(processingType: string): string {
  const prompts = {
    sentiment_analysis:
      'Analyze the sentiment of this conversation and respond with JSON containing: {"sentiment": "POSITIVE|NEUTRAL|NEGATIVE"}',
    categorization:
      'Categorize this conversation and respond with JSON containing: {"category": "CATEGORY_NAME"}',
    summary:
      'Summarize this conversation and respond with JSON containing: {"summary": "Brief summary"}',
    full_analysis: `Analyze this conversation for sentiment, category, and provide a summary. Respond with JSON:
{
  "sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
  "category": "SCHEDULE_HOURS|LEAVE_VACATION|SICK_LEAVE_RECOVERY|SALARY_COMPENSATION|CONTRACT_HOURS|ONBOARDING|OFFBOARDING|WORKWEAR_STAFF_PASS|TEAM_CONTACTS|PERSONAL_QUESTIONS|ACCESS_LOGIN|SOCIAL_QUESTIONS|UNRECOGNIZED_OTHER",
  "summary": "Brief summary of the conversation",
  "language": "en|de|fr|es|it|pt|nl|sv|da|no|fi|pl|cs|sk|hu|ro|bg|hr|sl|et|lv|lt|el|mt"
}`,
  };

  return (
    prompts[processingType as keyof typeof prompts] || prompts.full_analysis
  );
}

/**
 * Format session messages for AI processing
 */
function formatMessagesForProcessing(
  messages: Array<{
    role: string;
    content: string;
  }>
): string {
  return messages.map((msg) => `${msg.role}: ${msg.content}`).join("\n");
}

/**
 * Get statistics about batch processing
 */
export async function getBatchProcessingStats(companyId: string) {
  const stats = await prisma.aIBatchRequest.groupBy({
    by: ["status"],
    where: { companyId },
    _count: true,
  });

  const pendingRequests = await prisma.aIProcessingRequest.count({
    where: {
      session: { companyId },
      processingStatus: AIRequestStatus.PENDING_BATCHING,
    },
  });

  return {
    batchStats: stats.reduce(
      (acc, stat) => {
        acc[stat.status] = stat._count;
        return acc;
      },
      {} as Record<string, number>
    ),
    pendingRequests,
  };
}

/**
 * Mark a batch as failed and update all related requests
 */
async function markBatchAsFailed(
  batchId: string,
  errorMessage: string
): Promise<void> {
  try {
    await prisma.aIBatchRequest.update({
      where: { id: batchId },
      data: {
        status: AIBatchRequestStatus.FAILED,
        completedAt: new Date(),
      },
    });

    // Mark all related processing requests as failed so they can be retried individually
    await prisma.aIProcessingRequest.updateMany({
      where: { batchId },
      data: {
        processingStatus: AIRequestStatus.PROCESSING_FAILED,
        batchId: null, // Remove batch association so they can be retried
        errorMessage: `Batch failed: ${errorMessage}`,
      },
    });

    console.warn(`Marked batch ${batchId} as failed: ${errorMessage}`);
  } catch (error) {
    console.error(`Failed to mark batch ${batchId} as failed:`, error);
  }
}

/**
 * Handle failed batch requests by marking them for individual retry
 */
async function handleFailedBatchRequests(
  requests: Array<{ sessionId: string }>,
  errorMessage: string
): Promise<void> {
  try {
    const requestIds = requests.map((req) => req.sessionId);

    // Reset requests to PENDING_BATCHING so they can be retried individually
    await prisma.aIProcessingRequest.updateMany({
      where: {
        sessionId: { in: requestIds },
        processingStatus: AIRequestStatus.BATCHING_IN_PROGRESS,
      },
      data: {
        processingStatus: AIRequestStatus.PENDING_BATCHING,
        batchId: null,
        errorMessage: `Batch processing failed: ${errorMessage}`,
      },
    });

    console.warn(
      `Reset ${requestIds.length} requests for individual retry after batch failure`
    );
  } catch (error) {
    console.error("Failed to handle failed batch requests:", error);
  }
}

/**
 * Retry failed individual requests using the regular OpenAI API
 */
export async function retryFailedRequests(
  companyId: string,
  _maxRetries = 5
): Promise<void> {
  const failedRequests = await prisma.aIProcessingRequest.findMany({
    where: {
      session: { companyId },
      processingStatus: AIRequestStatus.PROCESSING_FAILED,
    },
    include: {
      session: {
        include: {
          messages: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
    take: 10, // Process in small batches to avoid overwhelming the API
  });

  for (const request of failedRequests) {
    try {
      await retryWithBackoff(async () => {
        // Transform request to match processIndividualRequest interface
        const transformedRequest = {
          id: request.id,
          model: request.model,
          messages: [
            {
              role: "user",
              content: formatMessagesForProcessing(
                request.session?.messages || []
              ),
            },
          ],
          temperature: 0.1,
          max_tokens: 1000,
          processingType: request.processingType,
          session: request.session,
        };

        // Process individual request using regular OpenAI API
        const result = await processIndividualRequest(transformedRequest);
        await updateProcessingRequestWithResult(request.id, result);
      }, `Retry individual request ${request.id}`);

      // Mark as successful retry
      console.log(`Successfully retried request ${request.id}`);
    } catch (error) {
      console.error(`Failed to retry request ${request.id}:`, error);

      // Mark as permanently failed
      await prisma.aIProcessingRequest.update({
        where: { id: request.id },
        data: {
          processingStatus: AIRequestStatus.PROCESSING_FAILED,
          errorMessage: `Final retry failed: ${(error as Error).message}`,
        },
      });
    }
  }
}

/**
 * Process an individual request using the regular OpenAI API (fallback)
 */
async function processIndividualRequest(request: {
  id: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  processingType?: string;
  session?: {
    messages: Array<{
      role: string;
      content: string;
      order: number;
    }>;
  };
}): Promise<{
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: Array<{ message: { content: string } }>;
}> {
  if (env.OPENAI_MOCK_MODE) {
    console.log(`[OpenAI Mock] Processing individual request ${request.id}`);
    return {
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      choices: [
        {
          message: {
            content: JSON.stringify({
              sentiment: "NEUTRAL",
              category: "UNRECOGNIZED_OTHER",
              summary: "Mock AI analysis result",
              language: "en",
            }),
          },
        },
      ],
    };
  }

  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        messages: [
          {
            role: "system",
            content: getSystemPromptForProcessingType(
              request.processingType || "full_analysis"
            ),
          },
          {
            role: "user",
            content: formatMessagesForProcessing(
              request.session?.messages || []
            ),
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    if (response.status >= 400 && response.status < 500) {
      throw new NonRetryableError(
        `Individual request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
    throw new RetryableError(
      `Individual request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return response.json();
}

/**
 * Get circuit breaker status for monitoring
 */
export function getCircuitBreakerStatus() {
  return {
    fileUpload: fileUploadCircuitBreaker.getStatus(),
    batchCreation: batchCreationCircuitBreaker.getStatus(),
    batchStatus: batchStatusCircuitBreaker.getStatus(),
    fileDownload: fileDownloadCircuitBreaker.getStatus(),
  };
}

/**
 * Reset circuit breakers (for manual recovery)
 */
export function resetCircuitBreakers(): void {
  fileUploadCircuitBreaker.reset();
  batchCreationCircuitBreaker.reset();
  batchStatusCircuitBreaker.reset();
  fileDownloadCircuitBreaker.reset();

  console.log("All circuit breakers have been reset");
}
