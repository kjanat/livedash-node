/**
 * Enhanced Dashboard Metrics API with Performance Optimization
 *
 * This demonstrates integration of caching, deduplication, and performance monitoring
 * into existing API endpoints for significant performance improvements.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { withErrorHandling } from "@/lib/api/errors";
import { createSuccessResponse } from "@/lib/api/response";
import { caches } from "@/lib/performance/cache";
import { deduplicators } from "@/lib/performance/deduplication";

// Performance system imports
import {
  PerformanceUtils,
  performanceMonitor,
} from "@/lib/performance/monitor";
import { authOptions } from "../../../../lib/auth";
import { sessionMetrics } from "../../../../lib/metrics";
import { prisma } from "../../../../lib/prisma";
import type { ChatSession, MetricsResult } from "../../../../lib/types";

/**
 * Converts a Prisma session to ChatSession format for metrics
 */
function convertToMockChatSession(
  ps: {
    id: string;
    companyId: string;
    startTime: Date;
    endTime: Date | null;
    createdAt: Date;
    category: string | null;
    language: string | null;
    country: string | null;
    ipAddress: string | null;
    sentiment: string | null;
    messagesSent: number | null;
    avgResponseTime: number | null;
    escalated: boolean | null;
    forwardedHr: boolean | null;
    initialMsg: string | null;
    fullTranscriptUrl: string | null;
    summary: string | null;
  },
  questions: string[]
): ChatSession {
  // Convert questions to mock messages for backward compatibility
  const mockMessages = questions.map((q, index) => ({
    id: `question-${index}`,
    sessionId: ps.id,
    timestamp: ps.createdAt,
    role: "User",
    content: q,
    order: index,
    createdAt: ps.createdAt,
  }));

  return {
    id: ps.id,
    sessionId: ps.id,
    companyId: ps.companyId,
    startTime: new Date(ps.startTime),
    endTime: ps.endTime ? new Date(ps.endTime) : null,
    transcriptContent: "",
    createdAt: new Date(ps.createdAt),
    updatedAt: new Date(ps.createdAt),
    category: ps.category || undefined,
    language: ps.language || undefined,
    country: ps.country || undefined,
    ipAddress: ps.ipAddress || undefined,
    sentiment: ps.sentiment === null ? undefined : ps.sentiment,
    messagesSent: ps.messagesSent === null ? undefined : ps.messagesSent,
    avgResponseTime:
      ps.avgResponseTime === null ? undefined : ps.avgResponseTime,
    escalated: ps.escalated || false,
    forwardedHr: ps.forwardedHr || false,
    initialMsg: ps.initialMsg || undefined,
    fullTranscriptUrl: ps.fullTranscriptUrl || undefined,
    summary: ps.summary || undefined,
    messages: mockMessages, // Use questions as messages for metrics
    userId: undefined,
  };
}

interface SessionUser {
  email: string;
  name?: string;
}

interface SessionData {
  user: SessionUser;
}

interface MetricsRequestParams {
  companyId: string;
  startDate?: string;
  endDate?: string;
}

interface MetricsResponse {
  metrics: MetricsResult;
  csvUrl: string | null;
  company: {
    id: string;
    name: string;
    csvUrl: string;
    status: string;
  };
  dateRange: { minDate: string; maxDate: string } | null;
  performanceMetrics?: {
    cacheHit: boolean;
    deduplicationHit: boolean;
    executionTime: number;
    dataFreshness: string;
  };
}

/**
 * Generate a cache key for metrics based on company and date range
 */
function generateMetricsCacheKey(params: MetricsRequestParams): string {
  const { companyId, startDate, endDate } = params;
  return `metrics:${companyId}:${startDate || "all"}:${endDate || "all"}`;
}

/**
 * Fetch sessions with performance monitoring and caching
 */
const fetchSessionsWithCache = deduplicators.database.memoize(
  async (params: MetricsRequestParams) => {
    return PerformanceUtils.measureAsync("metrics-session-fetch", async () => {
      const whereClause: {
        companyId: string;
        startTime?: {
          gte: Date;
          lte: Date;
        };
      } = {
        companyId: params.companyId,
      };

      if (params.startDate && params.endDate) {
        whereClause.startTime = {
          gte: new Date(params.startDate),
          lte: new Date(`${params.endDate}T23:59:59.999Z`),
        };
      }

      // Fetch sessions
      const sessions = await prisma.session.findMany({
        where: whereClause,
        select: {
          id: true,
          companyId: true,
          startTime: true,
          endTime: true,
          createdAt: true,
          category: true,
          language: true,
          country: true,
          ipAddress: true,
          sentiment: true,
          messagesSent: true,
          avgResponseTime: true,
          escalated: true,
          forwardedHr: true,
          initialMsg: true,
          fullTranscriptUrl: true,
          summary: true,
        },
      });

      return sessions;
    });
  },
  {
    keyGenerator: (params: MetricsRequestParams) => JSON.stringify(params),
    ttl: 2 * 60 * 1000, // 2 minutes
  }
);

/**
 * Fetch questions for sessions with deduplication
 */
const fetchQuestionsWithDeduplication = deduplicators.database.memoize(
  async (sessionIds: string[]) => {
    return PerformanceUtils.measureAsync(
      "metrics-questions-fetch",
      async () => {
        const questions = await prisma.sessionQuestion.findMany({
          where: { sessionId: { in: sessionIds } },
          include: { question: true },
          orderBy: { order: "asc" },
        });

        return questions;
      }
    );
  },
  {
    keyGenerator: (sessionIds: string[]) =>
      `questions:${sessionIds.sort().join(",")}`,
    ttl: 5 * 60 * 1000, // 5 minutes
  }
);

/**
 * Calculate metrics with caching
 */
const calculateMetricsWithCache = async (
  chatSessions: ChatSession[],
  companyConfig: Record<string, unknown>,
  cacheKey: string
): Promise<{
  result: {
    metrics: MetricsResult;
    calculatedAt: string;
    sessionCount: number;
  };
  fromCache: boolean;
}> => {
  return caches.metrics
    .getOrCompute(
      cacheKey,
      () =>
        PerformanceUtils.measureAsync("metrics-calculation", async () => {
          const metrics = sessionMetrics(chatSessions, companyConfig);
          return {
            metrics,
            calculatedAt: new Date().toISOString(),
            sessionCount: chatSessions.length,
          };
        }).then(({ result }) => result),
      5 * 60 * 1000 // 5 minutes cache
    )
    .then((cached) => ({
      result: cached,
      fromCache: caches.metrics.has(cacheKey),
    }));
};

/**
 * Enhanced GET endpoint with performance optimizations
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const requestTimer = PerformanceUtils.createTimer("metrics-request-total");
  let cacheHit = false;
  let deduplicationHit = false;

  try {
    // Authentication with performance monitoring
    const { result: session } = await PerformanceUtils.measureAsync(
      "metrics-auth-check",
      async () => (await getServerSession(authOptions)) as SessionData | null
    );

    if (!session?.user) {
      performanceMonitor.recordRequest(requestTimer.end(), true);
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    // User lookup with caching
    const user = await caches.sessions.getOrCompute(
      `user:${session.user.email}`,
      async () => {
        const { result } = await PerformanceUtils.measureAsync(
          "metrics-user-lookup",
          async () =>
            prisma.user.findUnique({
              where: { email: session.user.email },
              select: {
                id: true,
                companyId: true,
                company: {
                  select: {
                    id: true,
                    name: true,
                    csvUrl: true,
                    status: true,
                  },
                },
              },
            })
        );
        return result;
      },
      15 * 60 * 1000 // 15 minutes
    );

    if (!user) {
      performanceMonitor.recordRequest(requestTimer.end(), true);
      return NextResponse.json({ error: "No user" }, { status: 401 });
    }

    // Extract request parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const params: MetricsRequestParams = {
      companyId: user.companyId,
      startDate,
      endDate,
    };

    const cacheKey = generateMetricsCacheKey(params);

    // Try to get complete cached response first
    const cachedResponse = await caches.apiResponses.get(
      `full-metrics:${cacheKey}`
    );
    if (cachedResponse) {
      cacheHit = true;
      const duration = requestTimer.end();
      performanceMonitor.recordRequest(duration, false);

      return NextResponse.json(
        createSuccessResponse({
          ...cachedResponse,
          performanceMetrics: {
            cacheHit: true,
            deduplicationHit: false,
            executionTime: duration,
            dataFreshness: "cached",
          },
        })
      );
    }

    // Fetch sessions with deduplication and monitoring
    const sessionResult = await fetchSessionsWithCache(params);
    const prismaSessions = sessionResult.result;

    // Track if this was a deduplication hit
    deduplicationHit = deduplicators.database.getStats().hitRate > 0;

    // Fetch questions with deduplication
    const sessionIds = prismaSessions.map((s) => s.id);
    const questionsResult = await fetchQuestionsWithDeduplication(sessionIds);
    const sessionQuestions = questionsResult.result;

    // Group questions by session with performance monitoring
    const { result: questionsBySession } = await PerformanceUtils.measureAsync(
      "metrics-questions-grouping",
      async () => {
        return sessionQuestions.reduce(
          (acc, sq) => {
            if (!acc[sq.sessionId]) acc[sq.sessionId] = [];
            acc[sq.sessionId].push(sq.question.content);
            return acc;
          },
          {} as Record<string, string[]>
        );
      }
    );

    // Convert to ChatSession format with monitoring
    const { result: chatSessions } = await PerformanceUtils.measureAsync(
      "metrics-session-conversion",
      async () => {
        return prismaSessions.map((ps) => {
          const questions = questionsBySession[ps.id] || [];
          return convertToMockChatSession(ps, questions);
        });
      }
    );

    // Calculate metrics with caching
    const companyConfigForMetrics = {};
    const { result: metricsData, fromCache: metricsFromCache } =
      await calculateMetricsWithCache(
        chatSessions,
        companyConfigForMetrics,
        `calc:${cacheKey}`
      );

    // Calculate date range with monitoring
    const { result: dateRange } = await PerformanceUtils.measureAsync(
      "metrics-date-range-calc",
      async () => {
        if (prismaSessions.length === 0) return null;

        const dates = prismaSessions
          .map((s) => new Date(s.startTime))
          .sort((a: Date, b: Date) => a.getTime() - b.getTime());

        return {
          minDate: dates[0].toISOString().split("T")[0],
          maxDate: dates[dates.length - 1].toISOString().split("T")[0],
        };
      }
    );

    const responseData: MetricsResponse = {
      metrics: metricsData.metrics,
      csvUrl: user.company.csvUrl,
      company: user.company,
      dateRange,
      performanceMetrics: {
        cacheHit: metricsFromCache,
        deduplicationHit,
        executionTime: 0, // Will be set below
        dataFreshness: metricsFromCache ? "cached" : "fresh",
      },
    };

    // Cache the complete response for faster subsequent requests
    await caches.apiResponses.set(
      `full-metrics:${cacheKey}`,
      responseData,
      2 * 60 * 1000 // 2 minutes
    );

    const duration = requestTimer.end();
    responseData.performanceMetrics!.executionTime = duration;

    performanceMonitor.recordRequest(duration, false);

    return NextResponse.json(createSuccessResponse(responseData));
  } catch (error) {
    const duration = requestTimer.end();
    performanceMonitor.recordRequest(duration, true);
    throw error; // Re-throw for error handler
  }
});

// Export enhanced endpoint as default
export { GET as default };
