/**
 * Dashboard tRPC Router
 *
 * Handles dashboard data operations:
 * - Session management and filtering
 * - Analytics and metrics
 * - Overview statistics
 * - Question management
 */

import { router, companyProcedure } from "@/lib/trpc";
import { TRPCError } from "@trpc/server";
import { sessionFilterSchema, metricsQuerySchema } from "@/lib/validation";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const dashboardRouter = router({
  /**
   * Get paginated sessions with filtering
   */
  getSessions: companyProcedure
    .input(sessionFilterSchema)
    .query(async ({ input, ctx }) => {
      const {
        search,
        sentiment,
        category,
        language,
        startDate,
        endDate,
        sortKey,
        sortOrder,
        page,
        limit,
      } = input;

      // Build where clause
      const where: Prisma.SessionWhereInput = {
        companyId: ctx.company.id,
      };

      if (search) {
        where.OR = [
          { summary: { contains: search, mode: "insensitive" } },
          { id: { contains: search, mode: "insensitive" } },
        ];
      }

      if (sentiment) {
        where.sentiment = sentiment;
      }

      if (category) {
        where.category = category;
      }

      if (language) {
        where.language = language;
      }

      if (startDate || endDate) {
        where.startTime = {};
        if (startDate) {
          where.startTime.gte = new Date(startDate);
        }
        if (endDate) {
          where.startTime.lte = new Date(endDate);
        }
      }

      // Get total count
      const totalCount = await ctx.prisma.session.count({ where });

      // Get paginated sessions
      const sessions = await ctx.prisma.session.findMany({
        where,
        include: {
          import: {
            select: {
              externalSessionId: true,
            },
          },
          messages: {
            select: {
              id: true,
              sessionId: true,
              role: true,
              content: true,
              order: true,
              timestamp: true,
              createdAt: true,
            },
            orderBy: { order: "asc" },
          },
          sessionQuestions: {
            include: {
              question: {
                select: {
                  content: true,
                },
              },
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { [sortKey]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        sessions: sessions.map((session) => ({
          id: session.id,
          sessionId: session.import?.externalSessionId || session.id,
          companyId: session.companyId,
          userId: (session as any).userId || null,
          category: session.category,
          language: session.language,
          country: session.country,
          ipAddress: session.ipAddress,
          sentiment: session.sentiment,
          messagesSent: session.messagesSent ?? undefined,
          startTime: session.startTime,
          endTime: session.endTime,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          avgResponseTime: session.avgResponseTime,
          escalated: session.escalated ?? undefined,
          forwardedHr: session.forwardedHr ?? undefined,
          initialMsg: session.initialMsg ?? undefined,
          fullTranscriptUrl: session.fullTranscriptUrl ?? undefined,
          summary: session.summary ?? undefined,
          messages: session.messages,
          transcriptContent: null,
          questions: session.sessionQuestions.map((sq) => sq.question.content),
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    }),

  /**
   * Get session by ID
   */
  getSessionById: companyProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input, ctx }) => {
      const session = await ctx.prisma.session.findFirst({
        where: {
          id: input.sessionId,
          companyId: ctx.company.id,
        },
        include: {
          import: {
            select: {
              externalSessionId: true,
            },
          },
          messages: {
            select: {
              id: true,
              sessionId: true,
              role: true,
              content: true,
              order: true,
              timestamp: true,
              createdAt: true,
            },
            orderBy: { order: "asc" },
          },
          sessionQuestions: {
            include: {
              question: {
                select: {
                  content: true,
                },
              },
            },
            orderBy: { order: "asc" },
          },
        },
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      return {
        id: session.id,
        sessionId: session.import?.externalSessionId || session.id,
        companyId: session.companyId,
        userId: (session as any).userId || null,
        category: session.category,
        language: session.language,
        country: session.country,
        ipAddress: session.ipAddress,
        sentiment: session.sentiment,
        messagesSent: session.messagesSent ?? undefined,
        startTime: session.startTime,
        endTime: session.endTime,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        avgResponseTime: session.avgResponseTime,
        escalated: session.escalated ?? undefined,
        forwardedHr: session.forwardedHr ?? undefined,
        initialMsg: session.initialMsg ?? undefined,
        fullTranscriptUrl: session.fullTranscriptUrl ?? undefined,
        summary: session.summary ?? undefined,
        messages: session.messages,
        transcriptContent: null,
        questions: session.sessionQuestions.map((sq) => sq.question.content),
      };
    }),

  /**
   * Get dashboard overview statistics
   */
  getOverview: companyProcedure
    .input(
      z.object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { startDate, endDate } = input;

      const dateFilter: Prisma.SessionWhereInput = {
        companyId: ctx.company.id,
      };

      if (startDate || endDate) {
        dateFilter.startTime = {};
        if (startDate) {
          dateFilter.startTime.gte = new Date(startDate);
        }
        if (endDate) {
          dateFilter.startTime.lte = new Date(endDate);
        }
      }

      // Get basic counts
      const [
        totalSessions,
        avgMessagesSent,
        sentimentDistribution,
        categoryDistribution,
      ] = await Promise.all([
        // Total sessions
        ctx.prisma.session.count({ where: dateFilter }),

        // Average messages sent
        ctx.prisma.session.aggregate({
          where: dateFilter,
          _avg: { messagesSent: true },
        }),

        // Sentiment distribution
        ctx.prisma.session.groupBy({
          by: ["sentiment"],
          where: dateFilter,
          _count: true,
        }),

        // Category distribution
        ctx.prisma.session.groupBy({
          by: ["category"],
          where: dateFilter,
          _count: true,
        }),
      ]);

      return {
        totalSessions,
        avgMessagesSent: avgMessagesSent._avg.messagesSent || 0,
        sentimentDistribution: sentimentDistribution.map((item) => ({
          sentiment: item.sentiment,
          count: item._count,
        })),
        categoryDistribution: categoryDistribution.map((item) => ({
          category: item.category,
          count: item._count,
        })),
      };
    }),

  /**
   * Get top questions
   */
  getTopQuestions: companyProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(10),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { limit, startDate, endDate } = input;

      const dateFilter: Prisma.SessionWhereInput = {
        companyId: ctx.company.id,
      };

      if (startDate || endDate) {
        dateFilter.startTime = {};
        if (startDate) {
          dateFilter.startTime.gte = new Date(startDate);
        }
        if (endDate) {
          dateFilter.startTime.lte = new Date(endDate);
        }
      }

      const topQuestions = await ctx.prisma.question.findMany({
        select: {
          content: true,
          _count: {
            select: {
              sessionQuestions: {
                where: {
                  session: dateFilter,
                },
              },
            },
          },
        },
        orderBy: {
          sessionQuestions: {
            _count: "desc",
          },
        },
        take: limit,
      });

      return topQuestions.map((question) => ({
        question: question.content,
        count: question._count.sessionQuestions,
      }));
    }),

  /**
   * Get geographic distribution of sessions
   */
  getGeographicDistribution: companyProcedure
    .input(
      z.object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { startDate, endDate } = input;

      const dateFilter: Prisma.SessionWhereInput = {
        companyId: ctx.company.id,
      };

      if (startDate || endDate) {
        dateFilter.startTime = {};
        if (startDate) {
          dateFilter.startTime.gte = new Date(startDate);
        }
        if (endDate) {
          dateFilter.startTime.lte = new Date(endDate);
        }
      }

      const geoDistribution = await ctx.prisma.session.groupBy({
        by: ["language"],
        where: dateFilter,
        _count: true,
      });

      // Map language codes to country data (simplified mapping)
      const languageToCountry: Record<
        string,
        { name: string; lat: number; lng: number }
      > = {
        en: { name: "United Kingdom", lat: 55.3781, lng: -3.436 },
        de: { name: "Germany", lat: 51.1657, lng: 10.4515 },
        fr: { name: "France", lat: 46.2276, lng: 2.2137 },
        es: { name: "Spain", lat: 40.4637, lng: -3.7492 },
        nl: { name: "Netherlands", lat: 52.1326, lng: 5.2913 },
        it: { name: "Italy", lat: 41.8719, lng: 12.5674 },
      };

      return geoDistribution.map((item) => ({
        language: item.language,
        count: item._count,
        country: (item.language ? languageToCountry[item.language] : null) || {
          name: "Unknown",
          lat: 0,
          lng: 0,
        },
      }));
    }),

  /**
   * Get AI processing metrics
   */
  getAIMetrics: companyProcedure
    .input(metricsQuerySchema)
    .query(async ({ input, ctx }) => {
      const { startDate, endDate } = input;

      const dateFilter: Prisma.AIProcessingRequestWhereInput = {
        session: {
          companyId: ctx.company.id,
        },
      };

      if (startDate || endDate) {
        dateFilter.requestedAt = {};
        if (startDate) {
          dateFilter.requestedAt.gte = new Date(startDate);
        }
        if (endDate) {
          dateFilter.requestedAt.lte = new Date(endDate);
        }
      }

      const [totalCosts, requestStats] = await Promise.all([
        // Total AI costs
        ctx.prisma.aIProcessingRequest.aggregate({
          where: dateFilter,
          _sum: {
            totalCostEur: true,
            promptTokens: true,
            completionTokens: true,
          },
          _count: true,
        }),

        // Success/failure stats
        ctx.prisma.aIProcessingRequest.groupBy({
          by: ["success"],
          where: dateFilter,
          _count: true,
        }),
      ]);

      return {
        totalCostEur: totalCosts._sum.totalCostEur || 0,
        totalRequests: totalCosts._count,
        totalTokens:
          (totalCosts._sum.promptTokens || 0) +
          (totalCosts._sum.completionTokens || 0),
        successRate: requestStats.reduce(
          (acc, stat) => {
            if (stat.success) {
              acc.successful = stat._count;
            } else {
              acc.failed = stat._count;
            }
            return acc;
          },
          { successful: 0, failed: 0 }
        ),
      };
    }),

  /**
   * Refresh sessions (trigger reprocessing)
   */
  refreshSessions: companyProcedure.mutation(async ({ ctx }) => {
    // This would trigger the processing pipeline
    // For now, just return a success message

    const pendingSessions = await ctx.prisma.session.count({
      where: {
        companyId: ctx.company.id,
        sentiment: null, // Sessions that haven't been processed
      },
    });

    return {
      message: `Found ${pendingSessions} sessions that need processing`,
      pendingSessions,
    };
  }),
});
