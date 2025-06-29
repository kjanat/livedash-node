// SessionImport to Session processor
import {
  PrismaClient,
  ProcessingStage,
  SentimentCategory,
} from "@prisma/client";
import cron from "node-cron";
import { getSchedulerConfig } from "./env";
import { ProcessingStatusManager } from "./processingStatusManager";
import {
  fetchTranscriptContent,
  isValidTranscriptUrl,
} from "./transcriptFetcher";

const prisma = new PrismaClient();

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
  } else if (sentimentStr.includes("negative")) {
    return SentimentCategory.NEGATIVE;
  } else {
    return SentimentCategory.NEUTRAL;
  }
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
 * Process a single SessionImport record into a Session record
 * Uses new unified processing status tracking
 */
async function processSingleImport(
  importRecord: any
): Promise<{ success: boolean; error?: string }> {
  let sessionId: string | null = null;

  try {
    // Parse dates using European format parser
    const startTime = parseEuropeanDate(importRecord.startTimeRaw);
    const endTime = parseEuropeanDate(importRecord.endTimeRaw);

    console.log(
      `[Import Processor] Processing ${importRecord.externalSessionId}: ${startTime.toISOString()} - ${endTime.toISOString()}`
    );

    // Create or update Session record with MINIMAL processing
    const session = await prisma.session.upsert({
      where: {
        importId: importRecord.id,
      },
      update: {
        startTime,
        endTime,
        // Direct copies (minimal processing)
        ipAddress: importRecord.ipAddress,
        country: importRecord.countryCode, // Keep as country code
        fullTranscriptUrl: importRecord.fullTranscriptUrl,
        avgResponseTime: importRecord.avgResponseTimeSeconds,
        initialMsg: importRecord.initialMessage,
      },
      create: {
        companyId: importRecord.companyId,
        importId: importRecord.id,
        startTime,
        endTime,
        // Direct copies (minimal processing)
        ipAddress: importRecord.ipAddress,
        country: importRecord.countryCode, // Keep as country code
        fullTranscriptUrl: importRecord.fullTranscriptUrl,
        avgResponseTime: importRecord.avgResponseTimeSeconds,
        initialMsg: importRecord.initialMessage,
      },
    });

    sessionId = session.id;

    // Initialize processing status for this session
    await ProcessingStatusManager.initializeSession(sessionId);

    // Mark CSV_IMPORT as completed
    await ProcessingStatusManager.completeStage(
      sessionId,
      ProcessingStage.CSV_IMPORT
    );

    // Handle transcript fetching
    let transcriptContent = importRecord.rawTranscriptContent;

    if (
      !transcriptContent &&
      importRecord.fullTranscriptUrl &&
      isValidTranscriptUrl(importRecord.fullTranscriptUrl)
    ) {
      await ProcessingStatusManager.startStage(
        sessionId,
        ProcessingStage.TRANSCRIPT_FETCH
      );

      console.log(
        `[Import Processor] Fetching transcript for ${importRecord.externalSessionId}...`
      );

      // Get company credentials for transcript fetching
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

        // Update the import record with the fetched content
        await prisma.sessionImport.update({
          where: { id: importRecord.id },
          data: { rawTranscriptContent: transcriptContent },
        });

        await ProcessingStatusManager.completeStage(
          sessionId,
          ProcessingStage.TRANSCRIPT_FETCH,
          {
            contentLength: transcriptContent?.length || 0,
            url: importRecord.fullTranscriptUrl,
          }
        );
      } else {
        console.log(
          `[Import Processor] ⚠️ Failed to fetch transcript for ${importRecord.externalSessionId}: ${transcriptResult.error}`
        );
        await ProcessingStatusManager.failStage(
          sessionId,
          ProcessingStage.TRANSCRIPT_FETCH,
          transcriptResult.error || "Unknown error"
        );
      }
    } else if (!importRecord.fullTranscriptUrl) {
      // No transcript URL available - skip this stage
      await ProcessingStatusManager.skipStage(
        sessionId,
        ProcessingStage.TRANSCRIPT_FETCH,
        "No transcript URL provided"
      );
    } else {
      // Transcript already fetched
      await ProcessingStatusManager.completeStage(
        sessionId,
        ProcessingStage.TRANSCRIPT_FETCH,
        {
          contentLength: transcriptContent?.length || 0,
          source: "already_fetched",
        }
      );
    }

    // Handle session creation (parse messages)
    await ProcessingStatusManager.startStage(
      sessionId,
      ProcessingStage.SESSION_CREATION
    );

    if (transcriptContent) {
      await parseTranscriptIntoMessages(sessionId, transcriptContent);
    }

    await ProcessingStatusManager.completeStage(
      sessionId,
      ProcessingStage.SESSION_CREATION,
      {
        hasTranscript: !!transcriptContent,
        transcriptLength: transcriptContent?.length || 0,
      }
    );

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Mark the current stage as failed if we have a sessionId
    if (sessionId) {
      // Determine which stage failed based on the error
      if (
        errorMessage.includes("transcript") ||
        errorMessage.includes("fetch")
      ) {
        await ProcessingStatusManager.failStage(
          sessionId,
          ProcessingStage.TRANSCRIPT_FETCH,
          errorMessage
        );
      } else if (
        errorMessage.includes("message") ||
        errorMessage.includes("parse")
      ) {
        await ProcessingStatusManager.failStage(
          sessionId,
          ProcessingStage.SESSION_CREATION,
          errorMessage
        );
      } else {
        // General failure - mark CSV_IMPORT as failed
        await ProcessingStatusManager.failStage(
          sessionId,
          ProcessingStage.CSV_IMPORT,
          errorMessage
        );
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Process unprocessed SessionImport records into Session records
 * Uses new processing status system to find imports that need processing
 */
export async function processQueuedImports(
  batchSize: number = 50
): Promise<void> {
  console.log("[Import Processor] Starting to process unprocessed imports...");

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
  const batchSize = parseInt(
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
