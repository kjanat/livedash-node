// Test script for the refactored data processing pipeline
import { PrismaClient } from "@prisma/client";
import { processQueuedImports } from "./lib/importProcessor.ts";
import { processAllUnparsedTranscripts } from "./lib/transcriptParser.ts";
import {
  processUnprocessedSessions,
  getAIProcessingCosts,
} from "./lib/processingScheduler.ts";

const prisma = new PrismaClient();

async function testRefactoredPipeline() {
  console.log("🧪 Testing Refactored Data Processing Pipeline\n");

  // Step 1: Check current state
  console.log("📊 Current Database State:");
  const stats = await getDatabaseStats();
  console.log(stats);
  console.log("");

  // Step 2: Test import processing (minimal fields only)
  console.log("🔄 Testing Import Processing (Phase 1)...");
  await processQueuedImports(5); // Process 5 imports
  console.log("");

  // Step 3: Test transcript parsing
  console.log("📝 Testing Transcript Parsing (Phase 2)...");
  await processAllUnparsedTranscripts();
  console.log("");

  // Step 4: Test AI processing with cost tracking
  console.log("🤖 Testing AI Processing with Cost Tracking (Phase 3)...");
  await processUnprocessedSessions(3, 2); // Process 3 sessions with concurrency 2
  console.log("");

  // Step 5: Show final results
  console.log("📈 Final Results:");
  const finalStats = await getDatabaseStats();
  console.log(finalStats);
  console.log("");

  // Step 6: Show AI processing costs
  console.log("💰 AI Processing Costs:");
  const costs = await getAIProcessingCosts();
  console.log(costs);
  console.log("");

  // Step 7: Show sample processed session
  console.log("🔍 Sample Processed Session:");
  const sampleSession = await getSampleProcessedSession();
  if (sampleSession) {
    console.log(`Session ID: ${sampleSession.id}`);
    console.log(`Language: ${sampleSession.language}`);
    console.log(`Messages Sent: ${sampleSession.messagesSent}`);
    console.log(`Sentiment: ${sampleSession.sentiment}`);
    console.log(`Category: ${sampleSession.category}`);
    console.log(`Escalated: ${sampleSession.escalated}`);
    console.log(`Forwarded HR: ${sampleSession.forwardedHr}`);
    console.log(`Summary: ${sampleSession.summary}`);
    console.log(
      `Questions: ${sampleSession.sessionQuestions.length} questions`
    );
    console.log(
      `AI Requests: ${sampleSession.aiProcessingRequests.length} requests`
    );

    if (sampleSession.sessionQuestions.length > 0) {
      console.log("Sample Questions:");
      sampleSession.sessionQuestions.slice(0, 3).forEach((sq, i) => {
        console.log(`  ${i + 1}. ${sq.question.content}`);
      });
    }
  }
  console.log("");

  console.log("✅ Pipeline test completed!");
}

async function getDatabaseStats() {
  const [
    totalSessions,
    sessionsWithImports,
    sessionsWithMessages,
    processedSessions,
    totalMessages,
    totalQuestions,
    totalSessionQuestions,
    totalAIRequests,
  ] = await Promise.all([
    prisma.session.count(),
    prisma.session.count({ where: { importId: { not: null } } }),
    prisma.session.count({ where: { messages: { some: {} } } }),
    prisma.session.count({ where: { processed: true } }),
    prisma.message.count(),
    prisma.question.count(),
    prisma.sessionQuestion.count(),
    prisma.aIProcessingRequest.count(),
  ]);

  return {
    totalSessions,
    sessionsWithImports,
    sessionsWithMessages,
    processedSessions,
    unprocessedSessions: sessionsWithMessages - processedSessions,
    totalMessages,
    totalQuestions,
    totalSessionQuestions,
    totalAIRequests,
  };
}

async function getSampleProcessedSession() {
  return await prisma.session.findFirst({
    where: {
      processed: true,
      messages: { some: {} },
    },
    include: {
      sessionQuestions: {
        include: {
          question: true,
        },
        orderBy: { order: "asc" },
      },
      aiProcessingRequests: {
        orderBy: { requestedAt: "desc" },
      },
    },
  });
}

// Run the test
testRefactoredPipeline()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
