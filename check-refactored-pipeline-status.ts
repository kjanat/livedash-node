import { PrismaClient } from "@prisma/client";
import { ProcessingStatusManager } from "./lib/processingStatusManager";

const prisma = new PrismaClient();
const statusManager = new ProcessingStatusManager(prisma);

const PIPELINE_STAGES = [
  "CSV_IMPORT",
  "TRANSCRIPT_FETCH",
  "SESSION_CREATION",
  "AI_ANALYSIS",
  "QUESTION_EXTRACTION",
];

/**
 * Display status for a single pipeline stage
 */
function displayStageStatus(
  stage: string,
  stageData: Record<string, number> = {}
) {
  console.log(`${stage}:`);
  const pending = stageData.PENDING || 0;
  const inProgress = stageData.IN_PROGRESS || 0;
  const completed = stageData.COMPLETED || 0;
  const failed = stageData.FAILED || 0;
  const skipped = stageData.SKIPPED || 0;

  console.log(`  PENDING: ${pending}`);
  console.log(`  IN_PROGRESS: ${inProgress}`);
  console.log(`  COMPLETED: ${completed}`);
  console.log(`  FAILED: ${failed}`);
  console.log(`  SKIPPED: ${skipped}`);
  console.log("");
}

/**
 * Display what needs processing across all stages
 */
function displayProcessingNeeds(pipelineStatus: {
  pipeline: Record<string, unknown>;
}) {
  console.log("=== WHAT NEEDS PROCESSING ===");

  for (const stage of PIPELINE_STAGES) {
    const stageData = pipelineStatus.pipeline[stage] || {};
    const pending = stageData.PENDING || 0;
    const failed = stageData.FAILED || 0;

    if (pending > 0 || failed > 0) {
      console.log(`• ${stage}: ${pending} pending, ${failed} failed`);
    }
  }
}

/**
 * Display failed sessions summary
 */
function displayFailedSessions(failedSessions: unknown[]) {
  if (failedSessions.length === 0) return;

  console.log("\n=== FAILED SESSIONS ===");
  // biome-ignore lint/suspicious/noExplicitAny: Function parameter types from external API
  failedSessions.slice(0, 5).forEach((failure: any) => {
    console.log(
      `  ${failure.session.import?.externalSessionId || failure.sessionId}: ${failure.stage} - ${failure.errorMessage}`
    );
  });

  if (failedSessions.length > 5) {
    console.log(`  ... and ${failedSessions.length - 5} more failed sessions`);
  }
}

/**
 * Display sessions ready for AI processing
 */
function displayReadyForAI(
  readyForAI: Array<{
    sessionId: string;
    session: {
      import?: { externalSessionId?: string };
      createdAt: Date;
    };
  }>
) {
  if (readyForAI.length === 0) return;

  console.log("\n=== SESSIONS READY FOR AI PROCESSING ===");
  readyForAI.forEach((status) => {
    console.log(
      `  ${status.session.import?.externalSessionId || status.sessionId} (created: ${status.session.createdAt})`
    );
  });
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Main orchestration function - complexity is appropriate for its scope
async function checkRefactoredPipelineStatus() {
  try {
    console.log("=== REFACTORED PIPELINE STATUS ===\n");

    // Get pipeline status using the new system
    const pipelineStatus = await statusManager.getPipelineStatus();
    console.log(`Total Sessions: ${pipelineStatus.totalSessions}\n`);

    // Display status for each stage
    for (const stage of PIPELINE_STAGES) {
      const stageData = pipelineStatus.pipeline[stage] || {};
      displayStageStatus(stage, stageData);
    }

    // Show what needs processing
    displayProcessingNeeds(pipelineStatus);

    // Show failed sessions if any
    const failedSessions = await statusManager.getFailedSessions();
    displayFailedSessions(failedSessions);

    // Show sessions ready for AI processing
    const readyForAI = await statusManager.getSessionsNeedingProcessing(
      "AI_ANALYSIS",
      5
    );
    displayReadyForAI(readyForAI);
  } catch (error) {
    console.error("Error checking pipeline status:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRefactoredPipelineStatus();
