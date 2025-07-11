import { PrismaClient, ProcessingStage } from "@prisma/client";
import { ProcessingStatusManager } from "./lib/processingStatusManager";

const prisma = new PrismaClient();

interface MigrationSessionImport {
  rawTranscriptContent?: string;
  externalSessionId?: string;
}

interface MigrationMessage {
  id: string;
  role: string;
  content: string;
  timestamp?: Date;
  order: number;
}

interface MigrationSession {
  id: string;
  summary?: string;
  sentiment?: string;
  category?: string;
  language?: string;
  import?: MigrationSessionImport;
}

/**
 * Migrates CSV import stage for a session
 */
async function migrateCsvImportStage(
  sessionId: string,
  importId: string | null
) {
  await ProcessingStatusManager.completeStage(
    sessionId,
    ProcessingStage.CSV_IMPORT,
    {
      migratedFrom: "existing_session",
      importId,
    }
  );
}

/**
 * Migrates transcript fetch stage for a session
 */
async function migrateTranscriptFetchStage(
  sessionId: string,
  sessionImport: MigrationSessionImport,
  externalSessionId?: string
) {
  if (sessionImport?.rawTranscriptContent) {
    await ProcessingStatusManager.completeStage(
      sessionId,
      ProcessingStage.TRANSCRIPT_FETCH,
      {
        migratedFrom: "existing_transcript",
        contentLength: sessionImport.rawTranscriptContent.length,
      }
    );
  } else if (!sessionImport?.fullTranscriptUrl) {
    await ProcessingStatusManager.skipStage(
      sessionId,
      ProcessingStage.TRANSCRIPT_FETCH,
      "No transcript URL in original import"
    );
  } else {
    console.log(`  - Transcript fetch pending for ${externalSessionId}`);
  }
}

/**
 * Migrates session creation stage for a session
 */
async function migrateSessionCreationStage(
  sessionId: string,
  messages: MigrationMessage[],
  sessionImport: MigrationSessionImport,
  externalSessionId?: string
) {
  if (messages.length > 0) {
    await ProcessingStatusManager.completeStage(
      sessionId,
      ProcessingStage.SESSION_CREATION,
      {
        migratedFrom: "existing_messages",
        messageCount: messages.length,
      }
    );
  } else if (sessionImport?.rawTranscriptContent) {
    console.log(
      `  - Session creation pending for ${externalSessionId} (has transcript but no messages)`
    );
  } else if (!sessionImport?.fullTranscriptUrl) {
    await ProcessingStatusManager.skipStage(
      sessionId,
      ProcessingStage.SESSION_CREATION,
      "No transcript content available"
    );
  }
}

/**
 * Checks if session has AI analysis data
 */
function hasAIAnalysisData(session: MigrationSession): boolean {
  return !!(
    session.summary ||
    session.sentiment ||
    session.category ||
    session.language
  );
}

/**
 * Migrates AI analysis stage for a session
 */
async function migrateAIAnalysisStage(
  sessionId: string,
  session: MigrationSession,
  messages: MigrationMessage[],
  externalSessionId?: string
) {
  const hasAIAnalysis = hasAIAnalysisData(session);

  if (hasAIAnalysis) {
    await ProcessingStatusManager.completeStage(
      sessionId,
      ProcessingStage.AI_ANALYSIS,
      {
        migratedFrom: "existing_ai_analysis",
        hasSummary: !!session.summary,
        hasSentiment: !!session.sentiment,
        hasCategory: !!session.category,
        hasLanguage: !!session.language,
      }
    );
  } else if (messages.length > 0) {
    console.log(`  - AI analysis pending for ${externalSessionId}`);
  }

  return hasAIAnalysis;
}

/**
 * Migrates question extraction stage for a session
 */
async function migrateQuestionExtractionStage(
  sessionId: string,
  sessionQuestions: { question: { content: string } }[],
  hasAIAnalysis: boolean,
  externalSessionId?: string
) {
  if (sessionQuestions.length > 0) {
    await ProcessingStatusManager.completeStage(
      sessionId,
      ProcessingStage.QUESTION_EXTRACTION,
      {
        migratedFrom: "existing_questions",
        questionCount: sessionQuestions.length,
      }
    );
  } else if (hasAIAnalysis) {
    console.log(`  - Question extraction pending for ${externalSessionId}`);
  }
}

/**
 * Migrates a single session to the refactored processing system
 */
async function migrateSession(session: MigrationSession) {
  const externalSessionId = session.import?.externalSessionId;
  console.log(`Migrating session ${externalSessionId || session.id}...`);

  await ProcessingStatusManager.initializeSession(session.id);

  // Migrate each stage
  await migrateCsvImportStage(session.id, session.importId);
  await migrateTranscriptFetchStage(
    session.id,
    session.import,
    externalSessionId
  );
  await migrateSessionCreationStage(
    session.id,
    session.messages,
    session.import,
    externalSessionId
  );

  const hasAIAnalysis = await migrateAIAnalysisStage(
    session.id,
    session,
    session.messages,
    externalSessionId
  );

  await migrateQuestionExtractionStage(
    session.id,
    session.sessionQuestions,
    hasAIAnalysis,
    externalSessionId
  );
}

/**
 * Displays the final migration status
 */
async function displayFinalStatus() {
  console.log("\n=== MIGRATION COMPLETE - FINAL STATUS ===");
  const pipelineStatus = await ProcessingStatusManager.getPipelineStatus();

  const stages = [
    "CSV_IMPORT",
    "TRANSCRIPT_FETCH",
    "SESSION_CREATION",
    "AI_ANALYSIS",
    "QUESTION_EXTRACTION",
  ];

  for (const stage of stages) {
    const stageData = pipelineStatus.pipeline[stage] || {};
    const pending = stageData.PENDING || 0;
    const completed = stageData.COMPLETED || 0;
    const skipped = stageData.SKIPPED || 0;

    console.log(
      `${stage}: ${completed} completed, ${pending} pending, ${skipped} skipped`
    );
  }
}

async function migrateToRefactoredSystem() {
  try {
    console.log("=== MIGRATING TO REFACTORED PROCESSING SYSTEM ===\n");

    const sessions = await prisma.session.findMany({
      include: {
        import: true,
        messages: true,
        sessionQuestions: true,
      },
      orderBy: { createdAt: "asc" },
    });

    console.log(`Found ${sessions.length} sessions to migrate...\n`);

    let migratedCount = 0;
    for (const session of sessions) {
      await migrateSession(session);
      migratedCount++;

      if (migratedCount % 10 === 0) {
        console.log(
          `  Migrated ${migratedCount}/${sessions.length} sessions...`
        );
      }
    }

    console.log(
      `\n✓ Successfully migrated ${migratedCount} sessions to the new processing system`
    );

    await displayFinalStatus();
  } catch (error) {
    console.error("Error migrating to refactored system:", error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateToRefactoredSystem();
