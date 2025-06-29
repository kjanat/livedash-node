// SessionImport to Session processor
import { ProcessingStage, SentimentCategory } from "@prisma/client";
import cron from "node-cron";
import { withRetry } from "./database-retry.js";
import { getSchedulerConfig } from "./env";
import { prisma } from "./prisma.js";
import {
  completeStage,
  failStage,
  initializeSession,
  skipStage,
  startStage,
} from "./processingStatusManager.js";
import {
  fetchTranscriptContent,
  isValidTranscriptUrl,
} from "./transcriptFetcher";

interface ImportRecord {
  id: string;
  companyId: string;
  startTimeRaw: string;
  endTimeRaw: string;
  externalSessionId: string;
  sessionId?: string;
  userId?: string;
  category?: string;
  language?: string;
  sentiment?: string;
  escalated?: boolean;
  forwardedHr?: boolean;
  avgResponseTime?: number;
  messagesSent?: number;
  fullTranscriptUrl?: string;
  rawTranscriptContent?: string;
  aiSummary?: string;
  initialMsg?: string;
}

/**
 * Parse European date format (DD.MM.YYYY HH:mm:ss) to JavaScript Date
 */
function parseEuropeanDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== "string") {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  // Handle format: "DD.MM.YYYY HH:mm:ss"
  const [datePart, timePart] = dateStr.trim().split(" ");

  if (!datePart || !timePart) {
    throw new Error(
      `Invalid date format: ${dateStr}. Expected format: DD.MM.YYYY HH:mm:ss`
    );
  }

  const [day, month, year] = datePart.split(".");

  if (!day || !month || !year) {
    throw new Error(
      `Invalid date part: ${datePart}. Expected format: DD.MM.YYYY`
    );
  }

  // Convert to ISO format: YYYY-MM-DD HH:mm:ss
  const isoDateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")} ${timePart}`;
  const date = new Date(isoDateStr);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Failed to parse date: ${dateStr} -> ${isoDateStr}`);
  }

  return date;
}

/**
 * Helper function to parse sentiment from raw string (fallback only)
 */
function _parseFallbackSentiment(
  sentimentRaw: string | null
): SentimentCategory | null {
  if (!sentimentRaw) return null;

  const sentimentStr = sentimentRaw.toLowerCase();
  if (sentimentStr.includes("positive")) {
    return SentimentCategory.POSITIVE;
  }
  if (sentimentStr.includes("negative")) {
    return SentimentCategory.NEGATIVE;
  }
  return SentimentCategory.NEUTRAL;
}

/**
 * Helper function to parse boolean from raw string (fallback only)
 */
function _parseFallbackBoolean(rawValue: string | null): boolean | null {
  if (!rawValue) return null;
  return ["true", "1", "yes", "escalated", "forwarded"].includes(
    rawValue.toLowerCase()
  );
}

/**
 * Parse transcript content into Message records
 */
async function parseTranscriptIntoMessages(
  sessionId: string,
  transcriptContent: string
): Promise<void> {
  // Clear existing messages for this session
  await prisma.message.deleteMany({
    where: { sessionId },
  });

  // Split transcript into lines and parse each message
  const lines = transcriptContent.split("\n").filter((line) => line.trim());
  let order = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Try to parse different formats:
    // Format 1: "User: message" or "Assistant: message"
    // Format 2: "[timestamp] User: message" or "[timestamp] Assistant: message"

    let role = "unknown";
    let content = trimmedLine;
    let timestamp: Date | null = null;

    // Check for timestamp format: [DD.MM.YYYY HH:mm:ss] Role: content
    const timestampMatch = trimmedLine.match(/^\[([^\]]+)\]\s*(.+)$/);
    if (timestampMatch) {
      try {
        timestamp = parseEuropeanDate(timestampMatch[1]);
        content = timestampMatch[2];
      } catch (_error) {
        // If timestamp parsing fails, treat the whole line as content
        content = trimmedLine;
      }
    }

    // Extract role and message content
    const roleMatch = content.match(/^(User|Assistant|System):\s*(.*)$/i);
    if (roleMatch) {
      role = roleMatch[1].toLowerCase();
      content = roleMatch[2].trim();
    } else {
      // If no role prefix found, try to infer from context or use 'unknown'
      role = "unknown";
    }

    // Skip empty content
    if (!content) continue;

    // Create message record
    await prisma.message.create({
      data: {
        sessionId,
        timestamp,
        role,
        content,
        order,
      },
    });

    order++;
  }

  console.log(
    `[Import Processor] ✓ Parsed ${order} messages for session ${sessionId}`
  );
}

/**
 * Create or update a Session record from ImportRecord
 */
async function createSession(importRecord: ImportRecord): Promise<string> {
  const startTime = parseEuropeanDate(importRecord.startTimeRaw);
  const endTime = parseEuropeanDate(importRecord.endTimeRaw);

  console.log(
    `[Import Processor] Processing ${importRecord.externalSessionId}: ${startTime.toISOString()} - ${endTime.toISOString()}`
  );

  const session = await prisma.session.upsert({
    where: {
      importId: importRecord.id,
    },
    update: {
      startTime,
      endTime,
      ipAddress: importRecord.ipAddress,
      country: importRecord.countryCode,
      fullTranscriptUrl: importRecord.fullTranscriptUrl,
      avgResponseTime: importRecord.avgResponseTimeSeconds,
      initialMsg: importRecord.initialMessage,
    },
    create: {
      companyId: importRecord.companyId,
      importId: importRecord.id,
      startTime,
      endTime,
      ipAddress: importRecord.ipAddress,
      country: importRecord.countryCode,
      fullTranscriptUrl: importRecord.fullTranscriptUrl,
      avgResponseTime: importRecord.avgResponseTimeSeconds,
      initialMsg: importRecord.initialMessage,
    },
  });

  return session.id;
}

/**
 * Handle transcript fetching for a session
 */
async function handleTranscriptFetching(
  sessionId: string,
  importRecord: ImportRecord
): Promise<string | null> {
  let transcriptContent = importRecord.rawTranscriptContent;

  if (
    !transcriptContent &&
    importRecord.fullTranscriptUrl &&
    isValidTranscriptUrl(importRecord.fullTranscriptUrl)
  ) {
    await startStage(sessionId, ProcessingStage.TRANSCRIPT_FETCH);

    console.log(
      `[Import Processor] Fetching transcript for ${importRecord.externalSessionId}...`
    );

    const company = await prisma.company.findUnique({
      where: { id: importRecord.companyId },
      select: { csvUsername: true, csvPassword: true },
    });

    const transcriptResult = await fetchTranscriptContent(
      importRecord.fullTranscriptUrl,
      company?.csvUsername || undefined,
      company?.csvPassword || undefined
    );

    if (transcriptResult.success) {
      transcriptContent = transcriptResult.content;
      console.log(
        `[Import Processor] ✓ Fetched transcript for ${importRecord.externalSessionId} (${transcriptContent?.length} chars)`
      );

      await prisma.sessionImport.update({
        where: { id: importRecord.id },
        data: { rawTranscriptContent: transcriptContent },
      });

      await completeStage(sessionId, ProcessingStage.TRANSCRIPT_FETCH, {
        contentLength: transcriptContent?.length || 0,
        url: importRecord.fullTranscriptUrl,
      });
    } else {
      console.log(
        `[Import Processor] ⚠️ Failed to fetch transcript for ${importRecord.externalSessionId}: ${transcriptResult.error}`
      );
      await failStage(
        sessionId,
        ProcessingStage.TRANSCRIPT_FETCH,
        transcriptResult.error || "Unknown error"
      );
    }
  } else if (!importRecord.fullTranscriptUrl) {
    await skipStage(
      sessionId,
      ProcessingStage.TRANSCRIPT_FETCH,
      "No transcript URL provided"
    );
  } else {
    await completeStage(sessionId, ProcessingStage.TRANSCRIPT_FETCH, {
      contentLength: transcriptContent?.length || 0,
      source: "already_fetched",
    });
  }

  return transcriptContent;
}

/**
 * Handle session creation (message parsing)
 */
async function handleSessionCreation(
  sessionId: string,
  transcriptContent: string | null
): Promise<void> {
  await startStage(sessionId, ProcessingStage.SESSION_CREATION);

  if (transcriptContent) {
    await parseTranscriptIntoMessages(sessionId, transcriptContent);
  }

  await completeStage(sessionId, ProcessingStage.SESSION_CREATION, {
    hasTranscript: !!transcriptContent,
    transcriptLength: transcriptContent?.length || 0,
  });
}

/**
 * Handle errors and mark appropriate stage as failed
 */
async function handleProcessingError(
  sessionId: string | null,
  error: unknown
): Promise<void> {
  if (!sessionId) return;

  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes("transcript") || errorMessage.includes("fetch")) {
    await failStage(sessionId, ProcessingStage.TRANSCRIPT_FETCH, errorMessage);
  } else if (
    errorMessage.includes("message") ||
    errorMessage.includes("parse")
  ) {
    await failStage(sessionId, ProcessingStage.SESSION_CREATION, errorMessage);
  } else {
    await failStage(sessionId, ProcessingStage.CSV_IMPORT, errorMessage);
  }
}

/**
 * Process a single SessionImport record into a Session record
 * Uses new unified processing status tracking
 */
async function processSingleImport(
  importRecord: ImportRecord
): Promise<{ success: boolean; error?: string }> {
  let sessionId: string | null = null;

  try {
    sessionId = await createSession(importRecord);
    await initializeSession(sessionId);
    await completeStage(sessionId, ProcessingStage.CSV_IMPORT);

    const transcriptContent = await handleTranscriptFetching(
      sessionId,
      importRecord
    );
    await handleSessionCreation(sessionId, transcriptContent);

    return { success: true };
  } catch (error) {
    await handleProcessingError(sessionId, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process unprocessed SessionImport records into Session records
 * Uses new processing status system to find imports that need processing
 */
export async function processQueuedImports(batchSize = 50): Promise<void> {
  console.log("[Import Processor] Starting to process unprocessed imports...");

  try {
    await withRetry(
      async () => {
        await processQueuedImportsInternal(batchSize);
      },
      {
        maxRetries: 3,
        initialDelay: 2000,
        maxDelay: 10000,
        backoffMultiplier: 2,
      },
      "processQueuedImports"
    );
  } catch (error) {
    console.error("[Import Processor] Failed after all retries:", error);
    throw error;
  }
}

async function processQueuedImportsInternal(batchSize = 50): Promise<void> {
  let totalSuccessCount = 0;
  let totalErrorCount = 0;
  let batchNumber = 1;

  while (true) {
    // Find SessionImports that don't have a corresponding Session yet
    const unprocessedImports = await prisma.sessionImport.findMany({
      where: {
        session: null, // No session created yet
        company: {
          status: "ACTIVE", // Only process imports from active companies
        },
      },
      take: batchSize,
      orderBy: {
        createdAt: "asc", // Process oldest first
      },
    });

    if (unprocessedImports.length === 0) {
      if (batchNumber === 1) {
        console.log("[Import Processor] No unprocessed imports found");
      } else {
        console.log(
          `[Import Processor] All batches completed. Total: ${totalSuccessCount} successful, ${totalErrorCount} failed`
        );
      }
      return;
    }

    console.log(
      `[Import Processor] Processing batch ${batchNumber}: ${unprocessedImports.length} imports...`
    );

    let batchSuccessCount = 0;
    let batchErrorCount = 0;

    // Process imports in parallel batches for better performance
    const batchPromises = unprocessedImports.map(async (importRecord) => {
      const result = await processSingleImport(importRecord);
      return { importRecord, result };
    });

    // Process with concurrency limit to avoid overwhelming the database
    const concurrencyLimit = 5;
    const results = [];

    for (let i = 0; i < batchPromises.length; i += concurrencyLimit) {
      const chunk = batchPromises.slice(i, i + concurrencyLimit);
      const chunkResults = await Promise.all(chunk);
      results.push(...chunkResults);
    }

    // Process results
    for (const { importRecord, result } of results) {
      if (result.success) {
        batchSuccessCount++;
        totalSuccessCount++;
        console.log(
          `[Import Processor] ✓ Processed import ${importRecord.externalSessionId}`
        );
      } else {
        batchErrorCount++;
        totalErrorCount++;
        console.log(
          `[Import Processor] ✗ Failed to process import ${importRecord.externalSessionId}: ${result.error}`
        );
      }
    }

    console.log(
      `[Import Processor] Batch ${batchNumber} completed: ${batchSuccessCount} successful, ${batchErrorCount} failed`
    );
    batchNumber++;

    // If this batch was smaller than the batch size, we're done
    if (unprocessedImports.length < batchSize) {
      console.log(
        `[Import Processor] All batches completed. Total: ${totalSuccessCount} successful, ${totalErrorCount} failed`
      );
      return;
    }
  }
}

/**
 * Start the import processing scheduler
 */
export function startImportProcessingScheduler(): void {
  const config = getSchedulerConfig();

  if (!config.enabled) {
    console.log("[Import Processing Scheduler] Disabled via configuration");
    return;
  }

  // Use a more frequent interval for import processing (every 5 minutes by default)
  const interval = process.env.IMPORT_PROCESSING_INTERVAL || "*/5 * * * *";
  const batchSize = Number.parseInt(
    process.env.IMPORT_PROCESSING_BATCH_SIZE || "50",
    10
  );

  console.log(
    `[Import Processing Scheduler] Starting with interval: ${interval}`
  );
  console.log(`[Import Processing Scheduler] Batch size: ${batchSize}`);

  cron.schedule(interval, async () => {
    try {
      await processQueuedImports(batchSize);
    } catch (error) {
      console.error(`[Import Processing Scheduler] Error: ${error}`);
    }
  });
}
