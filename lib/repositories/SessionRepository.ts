import type { Prisma, Session } from "@prisma/client";
import { prisma } from "../prisma";
import {
  type BaseRepository,
  type CountOptions,
  type CreateInput,
  type FindManyOptions,
  NotFoundError,
  RepositoryError,
  type UpdateInput,
} from "./BaseRepository";

/**
 * Session with included relations
 */
export type SessionWithRelations = Session & {
  messages?: Array<{
    id: string;
    sessionId: string;
    timestamp: Date | null;
    role: string;
    content: string;
    order: number;
    createdAt: Date;
  }>;
  company?: {
    id: string;
    name: string;
  };
  sessionImport?: {
    id: string;
    status: string;
  };
};

/**
 * Session repository implementing database operations
 */
export class SessionRepository implements BaseRepository<Session> {
  /**
   * Find session by ID with optional relations
   */
  async findById(
    id: string,
    include?: { messages?: boolean; company?: boolean; sessionImport?: boolean }
  ): Promise<SessionWithRelations | null> {
    try {
      return await prisma.session.findUnique({
        where: { id },
        include: {
          messages: include?.messages
            ? { orderBy: { order: "asc" } }
            : undefined,
          company: include?.company
            ? { select: { id: true, name: true } }
            : undefined,
          import: include?.sessionImport
            ? { select: { id: true, externalSessionId: true } }
            : undefined,
        },
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to find session ${id}`,
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Find sessions by company ID
   */
  async findByCompanyId(
    companyId: string,
    options?: Omit<FindManyOptions<Session>, "where">
  ): Promise<Session[]> {
    try {
      return await prisma.session.findMany({
        where: { companyId },
        orderBy: options?.orderBy as Prisma.SessionOrderByWithRelationInput,
        skip: options?.skip,
        take: options?.take,
        include: options?.include as Prisma.SessionInclude,
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to find sessions for company ${companyId}`,
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Find sessions by date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    companyId?: string
  ): Promise<Session[]> {
    try {
      return await prisma.session.findMany({
        where: {
          startTime: {
            gte: startDate,
            lte: endDate,
          },
          ...(companyId && { companyId }),
        },
        orderBy: { startTime: "desc" },
      });
    } catch (error) {
      throw new RepositoryError(
        "Failed to find sessions by date range",
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Find many sessions with filters
   */
  async findMany(options?: FindManyOptions<Session>): Promise<Session[]> {
    try {
      return await prisma.session.findMany({
        where: options?.where as Prisma.SessionWhereInput,
        orderBy: options?.orderBy as Prisma.SessionOrderByWithRelationInput,
        skip: options?.skip,
        take: options?.take,
        include: options?.include as Prisma.SessionInclude,
      });
    } catch (error) {
      throw new RepositoryError(
        "Failed to find sessions",
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Create a new session
   */
  async create(data: CreateInput<Session>): Promise<Session> {
    try {
      return await prisma.session.create({
        data: data as unknown as Prisma.SessionCreateInput,
      });
    } catch (error) {
      throw new RepositoryError(
        "Failed to create session",
        "CREATE_ERROR",
        error as Error
      );
    }
  }

  /**
   * Update session by ID
   */
  async update(
    id: string,
    data: UpdateInput<Session>
  ): Promise<Session | null> {
    try {
      const session = await this.findById(id);
      if (!session) {
        throw new NotFoundError("Session", id);
      }

      return await prisma.session.update({
        where: { id },
        data: data as Prisma.SessionUpdateInput,
      });
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new RepositoryError(
        `Failed to update session ${id}`,
        "UPDATE_ERROR",
        error as Error
      );
    }
  }

  /**
   * Delete session by ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      const session = await this.findById(id);
      if (!session) {
        throw new NotFoundError("Session", id);
      }

      await prisma.session.delete({ where: { id } });
      return true;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new RepositoryError(
        `Failed to delete session ${id}`,
        "DELETE_ERROR",
        error as Error
      );
    }
  }

  /**
   * Count sessions with optional filters
   */
  async count(options?: CountOptions<Session>): Promise<number> {
    try {
      return await prisma.session.count({
        where: options?.where as Prisma.SessionWhereInput,
      });
    } catch (error) {
      throw new RepositoryError(
        "Failed to count sessions",
        "COUNT_ERROR",
        error as Error
      );
    }
  }

  /**
   * Get session metrics for a company
   */
  async getSessionMetrics(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSessions: number;
    avgSessionLength: number | null;
    sentimentDistribution: Record<string, number>;
    categoryDistribution: Record<string, number>;
  }> {
    try {
      const sessions = await this.findByDateRange(
        startDate,
        endDate,
        companyId
      );

      const totalSessions = sessions.length;
      const avgSessionLength =
        sessions.length > 0
          ? sessions
              .filter((s) => s.endTime)
              .reduce((sum, s) => {
                const duration = s.endTime
                  ? (s.endTime.getTime() - s.startTime.getTime()) / 1000
                  : 0;
                return sum + duration;
              }, 0) / sessions.filter((s) => s.endTime).length
          : null;

      const sentimentDistribution = sessions.reduce(
        (acc, session) => {
          const sentiment = session.sentiment || "unknown";
          acc[sentiment] = (acc[sentiment] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const categoryDistribution = sessions.reduce(
        (acc, session) => {
          const category = session.category || "uncategorized";
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalSessions,
        avgSessionLength,
        sentimentDistribution,
        categoryDistribution,
      };
    } catch (error) {
      throw new RepositoryError(
        "Failed to get session metrics",
        "METRICS_ERROR",
        error as Error
      );
    }
  }

  /**
   * Find sessions needing AI processing
   */
  async findPendingAIProcessing(limit = 100): Promise<Session[]> {
    try {
      return await prisma.session.findMany({
        where: {
          OR: [{ sentiment: null }, { category: null }, { summary: null }],
        },
        take: limit,
        orderBy: { createdAt: "asc" },
      });
    } catch (error) {
      throw new RepositoryError(
        "Failed to find sessions pending AI processing",
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Bulk update sessions
   */
  async bulkUpdate(
    where: Prisma.SessionWhereInput,
    data: Prisma.SessionUpdateInput
  ): Promise<number> {
    try {
      const result = await prisma.session.updateMany({
        where,
        data,
      });
      return result.count;
    } catch (error) {
      throw new RepositoryError(
        "Failed to bulk update sessions",
        "BULK_UPDATE_ERROR",
        error as Error
      );
    }
  }
}
