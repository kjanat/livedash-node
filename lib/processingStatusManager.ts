import {
  PrismaClient,
  ProcessingStage,
  ProcessingStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Centralized processing status management
 */
export class ProcessingStatusManager {
  /**
   * Initialize processing status for a session with all stages set to PENDING
   */
  static async initializeSession(sessionId: string): Promise<void> {
    const stages = [
      ProcessingStage.CSV_IMPORT,
      ProcessingStage.TRANSCRIPT_FETCH,
      ProcessingStage.SESSION_CREATION,
      ProcessingStage.AI_ANALYSIS,
      ProcessingStage.QUESTION_EXTRACTION,
    ];

    // Create all processing status records for this session
    await prisma.sessionProcessingStatus.createMany({
      data: stages.map((stage) => ({
        sessionId,
        stage,
        status: ProcessingStatus.PENDING,
      })),
      skipDuplicates: true, // In case some already exist
    });
  }

  /**
   * Start a processing stage
   */
  static async startStage(
    sessionId: string,
    stage: ProcessingStage,
    metadata?: any
  ): Promise<void> {
    await prisma.sessionProcessingStatus.upsert({
      where: {
        sessionId_stage: { sessionId, stage },
      },
      update: {
        status: ProcessingStatus.IN_PROGRESS,
        startedAt: new Date(),
        errorMessage: null,
        metadata: metadata || null,
      },
      create: {
        sessionId,
        stage,
        status: ProcessingStatus.IN_PROGRESS,
        startedAt: new Date(),
        metadata: metadata || null,
      },
    });
  }

  /**
   * Complete a processing stage successfully
   */
  static async completeStage(
    sessionId: string,
    stage: ProcessingStage,
    metadata?: any
  ): Promise<void> {
    await prisma.sessionProcessingStatus.upsert({
      where: {
        sessionId_stage: { sessionId, stage },
      },
      update: {
        status: ProcessingStatus.COMPLETED,
        completedAt: new Date(),
        errorMessage: null,
        metadata: metadata || null,
      },
      create: {
        sessionId,
        stage,
        status: ProcessingStatus.COMPLETED,
        startedAt: new Date(),
        completedAt: new Date(),
        metadata: metadata || null,
      },
    });
  }

  /**
   * Mark a processing stage as failed
   */
  static async failStage(
    sessionId: string,
    stage: ProcessingStage,
    errorMessage: string,
    metadata?: any
  ): Promise<void> {
    await prisma.sessionProcessingStatus.upsert({
      where: {
        sessionId_stage: { sessionId, stage },
      },
      update: {
        status: ProcessingStatus.FAILED,
        completedAt: new Date(),
        errorMessage,
        retryCount: { increment: 1 },
        metadata: metadata || null,
      },
      create: {
        sessionId,
        stage,
        status: ProcessingStatus.FAILED,
        startedAt: new Date(),
        completedAt: new Date(),
        errorMessage,
        retryCount: 1,
        metadata: metadata || null,
      },
    });
  }

  /**
   * Skip a processing stage (e.g., no transcript URL available)
   */
  static async skipStage(
    sessionId: string,
    stage: ProcessingStage,
    reason: string
  ): Promise<void> {
    await prisma.sessionProcessingStatus.upsert({
      where: {
        sessionId_stage: { sessionId, stage },
      },
      update: {
        status: ProcessingStatus.SKIPPED,
        completedAt: new Date(),
        errorMessage: reason,
      },
      create: {
        sessionId,
        stage,
        status: ProcessingStatus.SKIPPED,
        startedAt: new Date(),
        completedAt: new Date(),
        errorMessage: reason,
      },
    });
  }

  /**
   * Get processing status for a specific session
   */
  static async getSessionStatus(sessionId: string) {
    return await prisma.sessionProcessingStatus.findMany({
      where: { sessionId },
      orderBy: { stage: "asc" },
    });
  }

  /**
   * Get sessions that need processing for a specific stage
   */
  static async getSessionsNeedingProcessing(
    stage: ProcessingStage,
    limit: number = 50
  ) {
    return await prisma.sessionProcessingStatus.findMany({
      where: {
        stage,
        status: ProcessingStatus.PENDING,
        session: {
          company: {
            status: "ACTIVE" // Only process sessions from active companies
          }
        }
      },
      include: {
        session: {
          select: {
            id: true,
            companyId: true,
            importId: true,
            startTime: true,
            endTime: true,
            fullTranscriptUrl: true,
            import: stage === ProcessingStage.TRANSCRIPT_FETCH ? {
              select: {
                id: true,
                fullTranscriptUrl: true,
                externalSessionId: true,
              }
            } : false,
            company: {
              select: {
                id: true,
                csvUsername: true,
                csvPassword: true,
              }
            },
          },
        },
      },
      take: limit,
      orderBy: { session: { createdAt: "asc" } },
    });
  }

  /**
   * Get pipeline status overview
   */
  static async getPipelineStatus() {
    // Get counts by stage and status
    const statusCounts = await prisma.sessionProcessingStatus.groupBy({
      by: ["stage", "status"],
      _count: { id: true },
    });

    // Get total sessions
    const totalSessions = await prisma.session.count();

    // Organize the data
    const pipeline: Record<string, Record<string, number>> = {};

    for (const { stage, status, _count } of statusCounts) {
      if (!pipeline[stage]) {
        pipeline[stage] = {};
      }
      pipeline[stage][status] = _count.id;
    }

    return {
      totalSessions,
      pipeline,
    };
  }

  /**
   * Get sessions with failed processing
   */
  static async getFailedSessions(stage?: ProcessingStage) {
    const where: any = {
      status: ProcessingStatus.FAILED,
    };

    if (stage) {
      where.stage = stage;
    }

    return await prisma.sessionProcessingStatus.findMany({
      where,
      select: {
        id: true,
        sessionId: true,
        stage: true,
        status: true,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
        retryCount: true,
        session: {
          select: {
            id: true,
            companyId: true,
            startTime: true,
            import: {
              select: {
                id: true,
                externalSessionId: true,
              }
            },
          },
        },
      },
      orderBy: { completedAt: "desc" },
      take: 100, // Limit failed sessions to prevent overfetching
    });
  }

  /**
   * Reset a failed stage for retry
   */
  static async resetStageForRetry(
    sessionId: string,
    stage: ProcessingStage
  ): Promise<void> {
    await prisma.sessionProcessingStatus.update({
      where: {
        sessionId_stage: { sessionId, stage },
      },
      data: {
        status: ProcessingStatus.PENDING,
        startedAt: null,
        completedAt: null,
        errorMessage: null,
      },
    });
  }

  /**
   * Check if a session has completed a specific stage
   */
  static async hasCompletedStage(
    sessionId: string,
    stage: ProcessingStage
  ): Promise<boolean> {
    const status = await prisma.sessionProcessingStatus.findUnique({
      where: {
        sessionId_stage: { sessionId, stage },
      },
    });

    return status?.status === ProcessingStatus.COMPLETED;
  }

  /**
   * Check if a session is ready for a specific stage (previous stages completed)
   */
  static async isReadyForStage(
    sessionId: string,
    stage: ProcessingStage
  ): Promise<boolean> {
    const stageOrder = [
      ProcessingStage.CSV_IMPORT,
      ProcessingStage.TRANSCRIPT_FETCH,
      ProcessingStage.SESSION_CREATION,
      ProcessingStage.AI_ANALYSIS,
      ProcessingStage.QUESTION_EXTRACTION,
    ];

    const currentStageIndex = stageOrder.indexOf(stage);
    if (currentStageIndex === 0) return true; // First stage is always ready

    // Check if all previous stages are completed
    const previousStages = stageOrder.slice(0, currentStageIndex);

    for (const prevStage of previousStages) {
      const isCompleted = await this.hasCompletedStage(sessionId, prevStage);
      if (!isCompleted) return false;
    }

    return true;
  }
}
