import { ProcessingStage, ProcessingStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

// Type-safe metadata interfaces
interface ProcessingMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

interface WhereClause {
  status: ProcessingStatus;
  stage?: ProcessingStage;
}

export class ProcessingStatusManager {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || prisma;
  }

  /**
   * Initialize processing status for a session with all stages set to PENDING
   */
  async initializeSession(sessionId: string): Promise<void> {
    const stages = [
      ProcessingStage.CSV_IMPORT,
      ProcessingStage.TRANSCRIPT_FETCH,
      ProcessingStage.SESSION_CREATION,
      ProcessingStage.AI_ANALYSIS,
      ProcessingStage.QUESTION_EXTRACTION,
    ];

    // Create all processing status records for this session
    await this.prisma.sessionProcessingStatus.createMany({
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
  async startStage(
    sessionId: string,
    stage: ProcessingStage,
    metadata?: ProcessingMetadata
  ): Promise<void> {
    await this.prisma.sessionProcessingStatus.upsert({
      where: {
        sessionId_stage: { sessionId, stage },
      },
      update: {
        status: ProcessingStatus.IN_PROGRESS,
        startedAt: new Date(),
        errorMessage: null,
        metadata: metadata || undefined,
      },
      create: {
        sessionId,
        stage,
        status: ProcessingStatus.IN_PROGRESS,
        startedAt: new Date(),
        metadata: metadata || undefined,
      },
    });
  }

  /**
   * Complete a processing stage successfully
   */
  async completeStage(
    sessionId: string,
    stage: ProcessingStage,
    metadata?: ProcessingMetadata
  ): Promise<void> {
    await this.prisma.sessionProcessingStatus.upsert({
      where: {
        sessionId_stage: { sessionId, stage },
      },
      update: {
        status: ProcessingStatus.COMPLETED,
        completedAt: new Date(),
        errorMessage: null,
        metadata: metadata || undefined,
      },
      create: {
        sessionId,
        stage,
        status: ProcessingStatus.COMPLETED,
        startedAt: new Date(),
        completedAt: new Date(),
        metadata: metadata || undefined,
      },
    });
  }

  /**
   * Mark a processing stage as failed
   */
  async failStage(
    sessionId: string,
    stage: ProcessingStage,
    errorMessage: string,
    metadata?: ProcessingMetadata
  ): Promise<void> {
    await this.prisma.sessionProcessingStatus.upsert({
      where: {
        sessionId_stage: { sessionId, stage },
      },
      update: {
        status: ProcessingStatus.FAILED,
        completedAt: new Date(),
        errorMessage,
        retryCount: { increment: 1 },
        metadata: metadata || undefined,
      },
      create: {
        sessionId,
        stage,
        status: ProcessingStatus.FAILED,
        startedAt: new Date(),
        completedAt: new Date(),
        errorMessage,
        retryCount: 1,
        metadata: metadata || undefined,
      },
    });
  }

  /**
   * Skip a processing stage (e.g., no transcript URL available)
   */
  async skipStage(
    sessionId: string,
    stage: ProcessingStage,
    reason: string
  ): Promise<void> {
    await this.prisma.sessionProcessingStatus.upsert({
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
  async getSessionStatus(sessionId: string) {
    return await this.prisma.sessionProcessingStatus.findMany({
      where: { sessionId },
      orderBy: { stage: "asc" },
    });
  }

  /**
   * Get sessions that need processing for a specific stage
   */
  async getSessionsNeedingProcessing(
    stage: ProcessingStage,
    limit = 50
  ) {
    return await this.prisma.sessionProcessingStatus.findMany({
      where: {
        stage,
        status: ProcessingStatus.PENDING,
        session: {
          company: {
            status: "ACTIVE", // Only process sessions from active companies
          },
        },
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
            import:
              stage === ProcessingStage.TRANSCRIPT_FETCH
                ? {
                    select: {
                      id: true,
                      fullTranscriptUrl: true,
                      externalSessionId: true,
                    },
                  }
                : false,
            company: {
              select: {
                id: true,
                csvUsername: true,
                csvPassword: true,
              },
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
  async getPipelineStatus() {
    // Get counts by stage and status
    const statusCounts = await this.prisma.sessionProcessingStatus.groupBy({
      by: ["stage", "status"],
      _count: { id: true },
    });

    // Get total sessions
    const totalSessions = await this.prisma.session.count();

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
  async getFailedSessions(stage?: ProcessingStage) {
    const where: WhereClause = {
      status: ProcessingStatus.FAILED,
    };

    if (stage) {
      where.stage = stage;
    }

    return await this.prisma.sessionProcessingStatus.findMany({
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
              },
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
  async resetStageForRetry(
    sessionId: string,
    stage: ProcessingStage
  ): Promise<void> {
    await this.prisma.sessionProcessingStatus.update({
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
  async hasCompletedStage(
    sessionId: string,
    stage: ProcessingStage
  ): Promise<boolean> {
    const status = await this.prisma.sessionProcessingStatus.findUnique({
      where: {
        sessionId_stage: { sessionId, stage },
      },
    });

    return status?.status === ProcessingStatus.COMPLETED;
  }

  /**
   * Check if a session is ready for a specific stage (previous stages completed)
   */
  async isReadyForStage(
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

// Export a singleton instance for backward compatibility
export const processingStatusManager = new ProcessingStatusManager();

// Also export the individual functions for backward compatibility
export const initializeSession = (sessionId: string) => processingStatusManager.initializeSession(sessionId);
export const startStage = (sessionId: string, stage: ProcessingStage, metadata?: ProcessingMetadata) =>
  processingStatusManager.startStage(sessionId, stage, metadata);
export const completeStage = (sessionId: string, stage: ProcessingStage, metadata?: ProcessingMetadata) =>
  processingStatusManager.completeStage(sessionId, stage, metadata);
export const failStage = (sessionId: string, stage: ProcessingStage, errorMessage: string, metadata?: ProcessingMetadata) =>
  processingStatusManager.failStage(sessionId, stage, errorMessage, metadata);
export const skipStage = (sessionId: string, stage: ProcessingStage, reason: string) =>
  processingStatusManager.skipStage(sessionId, stage, reason);
export const getSessionStatus = (sessionId: string) => processingStatusManager.getSessionStatus(sessionId);
export const getSessionsNeedingProcessing = (stage: ProcessingStage, limit?: number) =>
  processingStatusManager.getSessionsNeedingProcessing(stage, limit);
export const getPipelineStatus = () => processingStatusManager.getPipelineStatus();
export const getFailedSessions = (stage?: ProcessingStage) => processingStatusManager.getFailedSessions(stage);
export const resetStageForRetry = (sessionId: string, stage: ProcessingStage) =>
  processingStatusManager.resetStageForRetry(sessionId, stage);
export const hasCompletedStage = (sessionId: string, stage: ProcessingStage) =>
  processingStatusManager.hasCompletedStage(sessionId, stage);
export const isReadyForStage = (sessionId: string, stage: ProcessingStage) =>
  processingStatusManager.isReadyForStage(sessionId, stage);