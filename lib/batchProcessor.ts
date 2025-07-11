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
import { env } from "./env";
import { openAIMock } from "./mocks/openai-mock-server";
import { prisma } from "./prisma";

/**
 * Configuration for batch processing
 */
const BATCH_CONFIG = {
  // Maximum number of requests per batch (OpenAI limit is 50,000)
  MAX_REQUESTS_PER_BATCH: 1000,
  // Minimum time to wait before checking batch status (in milliseconds)
  MIN_STATUS_CHECK_INTERVAL: 60000, // 1 minute
  // Maximum time to wait for a batch to complete (24 hours)
  MAX_BATCH_TIMEOUT: 24 * 60 * 60 * 1000,
} as const;

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
): Promise<AIProcessingRequest[]> {
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
      } | null;
    })[]
  >;
}

/**
 * Create a new batch request and upload to OpenAI
 */
export async function createBatchRequest(
  companyId: string,
  requests: AIProcessingRequest[]
): Promise<string> {
  if (requests.length === 0) {
    throw new Error("Cannot create batch with no requests");
  }

  if (requests.length > BATCH_CONFIG.MAX_REQUESTS_PER_BATCH) {
    throw new Error(
      `Batch size ${requests.length} exceeds maximum of ${BATCH_CONFIG.MAX_REQUESTS_PER_BATCH}`
    );
  }

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
          content: getSystemPromptForProcessingType(request.processingType),
        },
        {
          role: "user",
          content: formatMessagesForProcessing(
            (request as any).session?.messages || []
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

  return batchRequest.id;
}

/**
 * Check the status of all in-progress batches for a company
 */
export async function checkBatchStatuses(companyId: string): Promise<void> {
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

  for (const batch of inProgressBatches) {
    try {
      const status = await getOpenAIBatchStatus(batch.openaiBatchId);
      await updateBatchStatus(batch.id, status);
    } catch (error) {
      console.error(`Failed to check status for batch ${batch.id}:`, error);
    }
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

  for (const batch of completedBatches) {
    try {
      await processBatchResults(batch);
    } catch (error) {
      console.error(`Failed to process batch results for ${batch.id}:`, error);
      await prisma.aIBatchRequest.update({
        where: { id: batch.id },
        data: { status: AIBatchRequestStatus.FAILED },
      });
    }
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

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([content], { type: "application/jsonl" }),
    "batch_requests.jsonl"
  );
  formData.append("purpose", "batch");

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload file: ${response.statusText}`);
  }

  return response.json();
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

  const response = await fetch("https://api.openai.com/v1/batches", {
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
  });

  if (!response.ok) {
    throw new Error(`Failed to create batch: ${response.statusText}`);
  }

  return response.json();
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

  const response = await fetch(`https://api.openai.com/v1/batches/${batchId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get batch status: ${response.statusText}`);
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
  if (!batch.outputFileId) {
    throw new Error("No output file available for completed batch");
  }

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
      } else {
        // Handle error result
        await markProcessingRequestAsFailed(
          requestId,
          result.error?.message || "Unknown error"
        );
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
}

/**
 * Download file content from OpenAI (real or mock)
 */
async function downloadOpenAIFile(fileId: string): Promise<string> {
  if (env.OPENAI_MOCK_MODE) {
    console.log(`[OpenAI Mock] Downloading file content for ${fileId}`);
    return openAIMock.mockGetFileContent(fileId);
  }

  const response = await fetch(
    `https://api.openai.com/v1/files/${fileId}/content`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  return response.text();
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
