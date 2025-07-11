import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { sessionMetrics } from "../../../../lib/metrics";
import { prisma } from "../../../../lib/prisma";
import type { ChatSession } from "../../../../lib/types";

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
    escalated: boolean;
    forwardedHr: boolean;
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

export async function GET(request: NextRequest) {
  const session = (await getServerSession(authOptions)) as SessionData | null;
  if (!session?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
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
  });

  if (!user) {
    return NextResponse.json({ error: "No user" }, { status: 401 });
  }

  // Get date range from query parameters
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  // Build where clause with optional date filtering
  const whereClause: {
    companyId: string;
    startTime?: {
      gte: Date;
      lte: Date;
    };
  } = {
    companyId: user.companyId,
  };

  if (startDate && endDate) {
    whereClause.startTime = {
      gte: new Date(startDate),
      lte: new Date(`${endDate}T23:59:59.999Z`), // Include full end date
    };
  }

  // Fetch sessions without messages first for better performance
  const prismaSessions = await prisma.session.findMany({
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

  // Batch fetch questions for all sessions at once if needed for metrics
  const sessionIds = prismaSessions.map((s) => s.id);
  const sessionQuestions = await prisma.sessionQuestion.findMany({
    where: { sessionId: { in: sessionIds } },
    include: { question: true },
    orderBy: { order: "asc" },
  });

  // Group questions by session
  const questionsBySession = sessionQuestions.reduce(
    (acc, sq) => {
      if (!acc[sq.sessionId]) acc[sq.sessionId] = [];
      acc[sq.sessionId].push(sq.question.content);
      return acc;
    },
    {} as Record<string, string[]>
  );

  // Convert Prisma sessions to ChatSession[] type for sessionMetrics
  const chatSessions: ChatSession[] = prismaSessions.map((ps) => {
    const questions = questionsBySession[ps.id] || [];
    return convertToMockChatSession(ps, questions);
  });

  // Pass company config to metrics
  const companyConfigForMetrics = {
    // Add company-specific configuration here in the future
  };

  const metrics = sessionMetrics(chatSessions, companyConfigForMetrics);

  // Calculate date range from sessions
  let dateRange: { minDate: string; maxDate: string } | null = null;
  if (prismaSessions.length > 0) {
    const dates = prismaSessions
      .map((s) => new Date(s.startTime))
      .sort((a, b) => a.getTime() - b.getTime());
    dateRange = {
      minDate: dates[0].toISOString().split("T")[0], // First session date
      maxDate: dates[dates.length - 1].toISOString().split("T")[0], // Last session date
    };
  }

  return NextResponse.json({
    metrics,
    csvUrl: user.company.csvUrl,
    company: user.company,
    dateRange,
  });
}
