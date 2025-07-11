import { PrismaClient } from "@prisma/client";
import { ProcessingStatusManager } from "./lib/processingStatusManager";

const prisma = new PrismaClient();

/**
 * Log pipeline status for each processing stage
 */
async function logPipelineStatus() {
  const pipelineStatus = await ProcessingStatusManager.getPipelineStatus();
  console.log(`Total Sessions: ${pipelineStatus.totalSessions}\n`);

  const stages = [
    "CSV_IMPORT",
    "TRANSCRIPT_FETCH",
    "SESSION_CREATION",
    "AI_ANALYSIS",
    "QUESTION_EXTRACTION",
  ];

  for (const stage of stages) {
    console.log(`${stage}:`);
    const stageData = pipelineStatus.pipeline[stage] || {};

    const pending = stageData.PENDING || 0;
    const inProgress = stageData.IN_PROGRESS || 0;
    const completed = stageData.COMPLETED || 0;
    const skipped = stageData.SKIPPED || 0;
    const failed = stageData.FAILED || 0;

    console.log(`  PENDING: ${pending}`);
    console.log(`  IN_PROGRESS: ${inProgress}`);
    console.log(`  COMPLETED: ${completed}`);
    console.log(`  SKIPPED: ${skipped}`);
    console.log(`  FAILED: ${failed}\n`);
  }
}

/**
 * Log session import relationship analysis
 */
async function logSessionImportRelationship() {
  console.log("=== SESSION <-> IMPORT RELATIONSHIP ===");

  const sessionWithImport = await prisma.session.count({
    where: { importId: { not: null } },
  });

  const sessionWithoutImport = await prisma.session.count({
    where: { importId: null },
  });

  const importWithSession = await prisma.sessionImport.count({
    where: { session: { isNot: null } },
  });

  const importWithoutSession = await prisma.sessionImport.count({
    where: { session: null },
  });

  console.log(`Sessions with ImportId: ${sessionWithImport}`);
  console.log(`Sessions without ImportId: ${sessionWithoutImport}`);
  console.log(`Imports with Session: ${importWithSession}`);
  console.log(`Imports without Session: ${importWithoutSession}\n`);
}

/**
 * Log failed processing sessions
 */
async function logFailedSessions() {
  console.log("=== FAILED PROCESSING ANALYSIS ===");

  const failedSessions = await prisma.sessionProcessingStatus.findMany({
    where: { status: "FAILED" },
    include: {
      session: {
        select: {
          id: true,
          import: {
            select: { externalSessionId: true },
          },
        },
      },
    },
    take: 5,
  });

  if (failedSessions.length > 0) {
    console.log("Sample failed sessions:");
    for (const failed of failedSessions) {
      console.log(
        `  Session ${failed.session?.import?.externalSessionId || failed.sessionId} - Stage: ${failed.stage}, Error: ${failed.error}`
      );
    }
  } else {
    console.log("No failed processing found");
  }
  console.log("");
}

/**
 * Log processing pipeline needs analysis
 */
async function logProcessingNeeds(pipelineStatus: {
  pipeline: Record<string, Record<string, number>>;
}) {
  console.log("=== WHAT NEEDS PROCESSING? ===");

  const needsTranscriptFetch =
    pipelineStatus.pipeline.TRANSCRIPT_FETCH?.PENDING || 0;
  const needsSessionCreation =
    pipelineStatus.pipeline.SESSION_CREATION?.PENDING || 0;
  const needsAIAnalysis = pipelineStatus.pipeline.AI_ANALYSIS?.PENDING || 0;
  const needsQuestionExtraction =
    pipelineStatus.pipeline.QUESTION_EXTRACTION?.PENDING || 0;

  if (needsTranscriptFetch > 0) {
    console.log(`${needsTranscriptFetch} sessions need transcript fetching`);
  }
  if (needsSessionCreation > 0) {
    console.log(`${needsSessionCreation} sessions need session creation`);
  }
  if (needsAIAnalysis > 0) {
    console.log(`${needsAIAnalysis} sessions need AI analysis`);
  }
  if (needsQuestionExtraction > 0) {
    console.log(`${needsQuestionExtraction} sessions need question extraction`);
  }

  if (
    needsTranscriptFetch +
      needsSessionCreation +
      needsAIAnalysis +
      needsQuestionExtraction ===
    0
  ) {
    console.log("All sessions are fully processed!");
  }
  console.log("");
}

async function debugImportStatus() {
  try {
    console.log("=== DEBUGGING PROCESSING STATUS (REFACTORED SYSTEM) ===\n");

    const pipelineStatus = await ProcessingStatusManager.getPipelineStatus();

    await logPipelineStatus();
    await logSessionImportRelationship();
    await logFailedSessions();
    await logProcessingNeeds(pipelineStatus);
  } catch (error) {
    console.error("Error debugging processing status:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugImportStatus();
