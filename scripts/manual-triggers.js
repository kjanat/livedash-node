// Manual trigger scripts for both schedulers
import { fetchAndStoreSessionsForAllCompanies } from "../lib/csvFetcher.js";
import { processAllUnparsedTranscripts } from "../lib/transcriptParser.js";
import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";

const prisma = new PrismaClient();

/**
 * Manually trigger the session refresh scheduler
 */
async function triggerSessionRefresh() {
  console.log("=== Manual Session Refresh Trigger ===");
  try {
    await fetchAndStoreSessionsForAllCompanies();
    console.log("✅ Session refresh completed successfully");
  } catch (error) {
    console.error("❌ Session refresh failed:", error);
  }
}

/**
 * Manually trigger the processing scheduler
 */
async function triggerProcessingScheduler() {
  console.log("=== Manual Processing Scheduler Trigger ===");

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY environment variable is not set");
    return;
  }

  try {
    // Find sessions that need processing
    const sessionsToProcess = await prisma.session.findMany({
      where: {
        AND: [
          { messages: { some: {} } },
          { processed: { not: true } }, // Either false or null
        ],
      },
      select: {
        id: true,
        processed: true,
      },
      take: 5, // Process 5 sessions for manual testing
    });

    console.log(`Found ${sessionsToProcess.length} sessions to process:`);
    sessionsToProcess.forEach(session => {
      console.log(`- Session ${session.id}: processed=${session.processed}`);
    });

    if (sessionsToProcess.length === 0) {
      console.log("✅ No sessions found requiring processing");
      return;
    }

    // Import and run the processing function
    const { processUnprocessedSessions } = await import("../lib/processingScheduler.js");
    await processUnprocessedSessions();

    console.log("✅ Processing scheduler completed");
  } catch (error) {
    console.error("❌ Processing scheduler failed:", error);
  }
}

/**
 * Manually trigger transcript parsing
 */
async function triggerTranscriptParsing() {
  console.log("=== Manual Transcript Parsing Trigger ===");
  try {
    const result = await processAllUnparsedTranscripts();
    console.log(`✅ Transcript parsing completed: ${result.processed} processed, ${result.errors} errors`);
  } catch (error) {
    console.error("❌ Transcript parsing failed:", error);
  }
}

/**
 * Show current processing status
 */
async function showProcessingStatus() {
  console.log("=== Processing Status ===");

  try {
    const totalSessions = await prisma.session.count();
    const processedSessions = await prisma.session.count({
      where: { processed: true }
    });
    const unprocessedSessions = await prisma.session.count({
      where: { processed: { not: true } }
    });
    const withMessages = await prisma.session.count({
      where: {
        messages: {
          some: {}
        }
      }
    });
    const readyForProcessing = await prisma.session.count({
      where: {
        AND: [
          { messages: { some: {} } },
          { processed: { not: true } }
        ]
      }
    });

    console.log(`📊 Total sessions: ${totalSessions}`);
    console.log(`✅ Processed sessions: ${processedSessions}`);
    console.log(`⏳ Unprocessed sessions: ${unprocessedSessions}`);
    console.log(`📄 Sessions with messages: ${withMessages}`);
    console.log(`🔄 Ready for processing: ${readyForProcessing}`);

    // Show some examples of unprocessed sessions
    if (readyForProcessing > 0) {
      console.log("\n📋 Sample unprocessed sessions:");
      const samples = await prisma.session.findMany({
        where: {
          AND: [
            { messages: { some: {} } },
            { processed: { not: true } }
          ]
        },
        select: {
          id: true,
          processed: true,
          startTime: true,
        },
        take: 3
      });

      samples.forEach(session => {
        console.log(`- ${session.id} (${session.startTime.toISOString()}) - processed: ${session.processed}`);
      });
    }

  } catch (error) {
    console.error("❌ Failed to get processing status:", error);
  }
}

// Main execution based on command line argument
const command = process.argv[2];

switch (command) {
  case 'refresh':
    await triggerSessionRefresh();
    break;
  case 'process':
    await triggerProcessingScheduler();
    break;
  case 'parse':
    await triggerTranscriptParsing();
    break;
  case 'status':
    await showProcessingStatus();
    break;
  case 'both':
    await triggerSessionRefresh();
    console.log("\n" + "=".repeat(50) + "\n");
    await triggerProcessingScheduler();
    break;
  case 'all':
    await triggerSessionRefresh();
    console.log("\n" + "=".repeat(50) + "\n");
    await triggerTranscriptParsing();
    console.log("\n" + "=".repeat(50) + "\n");
    await triggerProcessingScheduler();
    break;
  default:
    console.log("Usage: node scripts/manual-triggers.js [command]");
    console.log("Commands:");
    console.log("  refresh  - Trigger session refresh (fetch new sessions from CSV)");
    console.log("  parse    - Parse transcripts into structured messages");
    console.log("  process  - Trigger processing scheduler (process unprocessed sessions)");
    console.log("  status   - Show current processing status");
    console.log("  both     - Run both refresh and processing");
    console.log("  all      - Run refresh, parse, and processing in sequence");
    break;
}

await prisma.$disconnect();
