// SessionImport to Session processor
import { PrismaClient, ImportStatus, SentimentCategory, SessionCategory } from "@prisma/client";
import { getSchedulerConfig } from "./env";
import { fetchTranscriptContent, isValidTranscriptUrl } from "./transcriptFetcher";
import cron from "node-cron";

const prisma = new PrismaClient();

/**
 * Parse European date format (DD.MM.YYYY HH:mm:ss) to JavaScript Date
 */
function parseEuropeanDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  // Handle format: "DD.MM.YYYY HH:mm:ss"
  const [datePart, timePart] = dateStr.trim().split(' ');
  
  if (!datePart || !timePart) {
    throw new Error(`Invalid date format: ${dateStr}. Expected format: DD.MM.YYYY HH:mm:ss`);
  }

  const [day, month, year] = datePart.split('.');
  
  if (!day || !month || !year) {
    throw new Error(`Invalid date part: ${datePart}. Expected format: DD.MM.YYYY`);
  }

  // Convert to ISO format: YYYY-MM-DD HH:mm:ss
  const isoDateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timePart}`;
  const date = new Date(isoDateStr);
  
  if (isNaN(date.getTime())) {
    throw new Error(`Failed to parse date: ${dateStr} -> ${isoDateStr}`);
  }
  
  return date;
}

/**
 * Helper function to parse sentiment from raw string (fallback only)
 */
function parseFallbackSentiment(sentimentRaw: string | null): SentimentCategory | null {
  if (!sentimentRaw) return null;
  
  const sentimentStr = sentimentRaw.toLowerCase();
  if (sentimentStr.includes('positive')) {
    return SentimentCategory.POSITIVE;
  } else if (sentimentStr.includes('negative')) {
    return SentimentCategory.NEGATIVE;
  } else {
    return SentimentCategory.NEUTRAL;
  }
}

/**
 * Helper function to parse boolean from raw string (fallback only)
 */
function parseFallbackBoolean(rawValue: string | null): boolean | null {
  if (!rawValue) return null;
  return ['true', '1', 'yes', 'escalated', 'forwarded'].includes(rawValue.toLowerCase());
}

/**
 * Process a single SessionImport record into a Session record
 * NEW STRATEGY: Only copy minimal fields, let AI processing handle the rest
 */
async function processSingleImport(importRecord: any): Promise<{ success: boolean; error?: string }> {
  try {
    // Parse dates using European format parser
    const startTime = parseEuropeanDate(importRecord.startTimeRaw);
    const endTime = parseEuropeanDate(importRecord.endTimeRaw);

    console.log(`[Import Processor] Parsed dates for ${importRecord.externalSessionId}: ${startTime.toISOString()} - ${endTime.toISOString()}`);

    // Fetch transcript content if URL is provided and not already fetched
    let transcriptContent = importRecord.rawTranscriptContent;
    if (!transcriptContent && importRecord.fullTranscriptUrl && isValidTranscriptUrl(importRecord.fullTranscriptUrl)) {
      console.log(`[Import Processor] Fetching transcript for ${importRecord.externalSessionId}...`);
      
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
        console.log(`[Import Processor] ✓ Fetched transcript for ${importRecord.externalSessionId} (${transcriptContent?.length} chars)`);
        
        // Update the import record with the fetched content
        await prisma.sessionImport.update({
          where: { id: importRecord.id },
          data: { rawTranscriptContent: transcriptContent },
        });
      } else {
        console.log(`[Import Processor] ⚠️ Failed to fetch transcript for ${importRecord.externalSessionId}: ${transcriptResult.error}`);
      }
    }

    // Create or update Session record with MINIMAL processing
    // Only copy fields that don't need AI analysis
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
        
        // AI-processed fields: Leave empty, will be filled by AI processing
        // language: null,        // AI will detect
        // messagesSent: null,    // AI will count from Messages
        // sentiment: null,       // AI will analyze
        // escalated: null,       // AI will detect
        // forwardedHr: null,     // AI will detect
        // category: null,        // AI will categorize
        // summary: null,         // AI will generate
        
        processed: false, // Will be processed later by AI
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
        
        // AI-processed fields: Leave empty, will be filled by AI processing
        // All these will be null initially and filled by AI
        processed: false, // Will be processed later by AI
      },
    });

    // Update import status to DONE
    await prisma.sessionImport.update({
      where: { id: importRecord.id },
      data: {
        status: ImportStatus.DONE,
        processedAt: new Date(),
        errorMsg: null,
      },
    });

    return { success: true };
  } catch (error) {
    // Update import status to ERROR
    await prisma.sessionImport.update({
      where: { id: importRecord.id },
      data: {
        status: ImportStatus.ERROR,
        errorMsg: error instanceof Error ? error.message : String(error),
      },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process queued SessionImport records into Session records
 */
export async function processQueuedImports(batchSize: number = 50): Promise<void> {
  console.log('[Import Processor] Starting to process queued imports...');

  // Find queued imports
  const queuedImports = await prisma.sessionImport.findMany({
    where: {
      status: ImportStatus.QUEUED,
    },
    take: batchSize,
    orderBy: {
      createdAt: 'asc', // Process oldest first
    },
  });

  if (queuedImports.length === 0) {
    console.log('[Import Processor] No queued imports found');
    return;
  }

  console.log(`[Import Processor] Processing ${queuedImports.length} queued imports...`);

  let successCount = 0;
  let errorCount = 0;

  // Process each import
  for (const importRecord of queuedImports) {
    const result = await processSingleImport(importRecord);
    
    if (result.success) {
      successCount++;
      console.log(`[Import Processor] ✓ Processed import ${importRecord.externalSessionId}`);
    } else {
      errorCount++;
      console.log(`[Import Processor] ✗ Failed to process import ${importRecord.externalSessionId}: ${result.error}`);
    }
  }

  console.log(`[Import Processor] Completed: ${successCount} successful, ${errorCount} failed`);
}

/**
 * Start the import processing scheduler
 */
export function startImportProcessingScheduler(): void {
  const config = getSchedulerConfig();
  
  if (!config.enabled) {
    console.log('[Import Processing Scheduler] Disabled via configuration');
    return;
  }

  // Use a more frequent interval for import processing (every 5 minutes by default)
  const interval = process.env.IMPORT_PROCESSING_INTERVAL || '*/5 * * * *';
  const batchSize = parseInt(process.env.IMPORT_PROCESSING_BATCH_SIZE || '50', 10);

  console.log(`[Import Processing Scheduler] Starting with interval: ${interval}`);
  console.log(`[Import Processing Scheduler] Batch size: ${batchSize}`);

  cron.schedule(interval, async () => {
    try {
      await processQueuedImports(batchSize);
    } catch (error) {
      console.error(`[Import Processing Scheduler] Error: ${error}`);
    }
  });
}
