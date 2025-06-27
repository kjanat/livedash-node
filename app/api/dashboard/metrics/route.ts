import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "../../../../lib/prisma";
import { sessionMetrics } from "../../../../lib/metrics";
import { authOptions } from "../../auth/[...nextauth]/route";
import { ChatSession } from "../../../../lib/types";

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
    include: { company: true },
  });

  if (!user) {
    return NextResponse.json({ error: "No user" }, { status: 401 });
  }

  // Get date range from query parameters
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  // Build where clause with optional date filtering
  const whereClause: any = {
    companyId: user.companyId,
  };

  if (startDate && endDate) {
    whereClause.startTime = {
      gte: new Date(startDate),
      lte: new Date(endDate + "T23:59:59.999Z"), // Include full end date
    };
  }

  const prismaSessions = await prisma.session.findMany({
    where: whereClause,
    include: {
      messages: true, // Include messages for question extraction
    },
  });

  // Convert Prisma sessions to ChatSession[] type for sessionMetrics
  const chatSessions: ChatSession[] = prismaSessions.map((ps) => ({
    id: ps.id, // Map Prisma's id to ChatSession.id
    sessionId: ps.id, // Map Prisma's id to ChatSession.sessionId
    companyId: ps.companyId,
    startTime: new Date(ps.startTime), // Ensure startTime is a Date object
    endTime: ps.endTime ? new Date(ps.endTime) : null, // Ensure endTime is a Date object or null
    transcriptContent: "", // Session model doesn't have transcriptContent field
    createdAt: new Date(ps.createdAt), // Map Prisma's createdAt
    updatedAt: new Date(ps.createdAt), // Use createdAt for updatedAt as Session model doesn't have updatedAt
    category: ps.category || undefined,
    language: ps.language || undefined,
    country: ps.country || undefined,
    ipAddress: ps.ipAddress || undefined,
    sentiment: ps.sentiment === null ? undefined : ps.sentiment,
    messagesSent: ps.messagesSent === null ? undefined : ps.messagesSent, // Handle null messagesSent
    avgResponseTime:
      ps.avgResponseTime === null ? undefined : ps.avgResponseTime,
    escalated: ps.escalated || false,
    forwardedHr: ps.forwardedHr || false,
    initialMsg: ps.initialMsg || undefined,
    fullTranscriptUrl: ps.fullTranscriptUrl || undefined,
    summary: ps.summary || undefined, // Include summary field
    messages: ps.messages || [], // Include messages for question extraction
    // userId is missing in Prisma Session model, assuming it's not strictly needed for metrics or can be null
    userId: undefined, // Or some other default/mapping if available
  }));

  // Pass company config to metrics
  const companyConfigForMetrics = {
    sentimentAlert:
      user.company.sentimentAlert === null
        ? undefined
        : user.company.sentimentAlert,
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
