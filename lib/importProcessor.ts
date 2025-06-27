// SessionImport to Session processor
import { PrismaClient, ImportStatus, SentimentCategory } from "@prisma/client";
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
 * Process a single SessionImport record into a Session record
 */
async function processSingleImport(importRecord: any): Promise<{ success: boolean; error?: string }> {
  try {
    // Parse dates using European format parser
    const startTime = parseEuropeanDate(importRecord.startTimeRaw);
    const endTime = parseEuropeanDate(importRecord.endTimeRaw);

    console.log(`[Import Processor] Parsed dates for ${importRecord.externalSessionId}: ${startTime.toISOString()} - ${endTime.toISOString()}`);

    // Process sentiment
    let sentiment: number | null = null;
    let sentimentCategory: SentimentCategory | null = null;
    
    if (importRecord.sentimentRaw) {
      const sentimentStr = importRecord.sentimentRaw.toLowerCase();
      if (sentimentStr.includes('positive')) {
        sentiment = 0.8;
        sentimentCategory = SentimentCategory.POSITIVE;
      } else if (sentimentStr.includes('negative')) {
        sentiment = -0.8;
        sentimentCategory = SentimentCategory.NEGATIVE;
      } else {
        sentiment = 0.0;
        sentimentCategory = SentimentCategory.NEUTRAL;
      }
    }

    // Process boolean fields
    const escalated = importRecord.escalatedRaw ? 
      ['true', '1', 'yes', 'escalated'].includes(importRecord.escalatedRaw.toLowerCase()) : null;
    
    const forwardedHr = importRecord.forwardedHrRaw ? 
      ['true', '1', 'yes', 'forwarded'].includes(importRecord.forwardedHrRaw.toLowerCase()) : null;

    // Keep country code as-is, will be processed by OpenAI later
    const country = importRecord.countryCode;

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

    // Create or update Session record
    const session = await prisma.session.upsert({
      where: {
        importId: importRecord.id,
      },
      update: {
        startTime,
        endTime,
        ipAddress: importRecord.ipAddress,
        country,
        language: importRecord.language,
        messagesSent: importRecord.messagesSent,
        sentiment,
        sentimentCategory,
        escalated,
        forwardedHr,
        fullTranscriptUrl: importRecord.fullTranscriptUrl,
        avgResponseTime: importRecord.avgResponseTimeSeconds,
        tokens: importRecord.tokens,
        tokensEur: importRecord.tokensEur,
        category: importRecord.category,
        initialMsg: importRecord.initialMessage,
        processed: false, // Will be processed later by AI
      },
      create: {
        companyId: importRecord.companyId,
        importId: importRecord.id,
        startTime,
        endTime,
        ipAddress: importRecord.ipAddress,
        country,
        language: importRecord.language,
        messagesSent: importRecord.messagesSent,
        sentiment,
        sentimentCategory,
        escalated,
        forwardedHr,
        fullTranscriptUrl: importRecord.fullTranscriptUrl,
        avgResponseTime: importRecord.avgResponseTimeSeconds,
        tokens: importRecord.tokens,
        tokensEur: importRecord.tokensEur,
        category: importRecord.category,
        initialMsg: importRecord.initialMessage,
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
