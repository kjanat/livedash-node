// API endpoint: return metrics for current company
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "../../../lib/prisma";
import { sessionMetrics } from "../../../lib/metrics";
import { authOptions } from "../auth/[...nextauth]";
import { ChatSession } from "../../../lib/types"; // Import ChatSession

interface SessionUser {
  email: string;
  name?: string;
}

interface SessionData {
  user: SessionUser;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = (await getServerSession(
    req,
    res,
    authOptions
  )) as SessionData | null;
  if (!session?.user) return res.status(401).json({ error: "Not logged in" });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { company: true },
  });

  if (!user) return res.status(401).json({ error: "No user" });

  const prismaSessions = await prisma.session.findMany({
    where: { companyId: user.companyId },
  });

  // Convert Prisma sessions to ChatSession[] type for sessionMetrics
  const chatSessions: ChatSession[] = prismaSessions.map((ps) => ({
    id: ps.id, // Map Prisma's id to ChatSession.id
    sessionId: ps.id, // Map Prisma's id to ChatSession.sessionId
    companyId: ps.companyId,
    startTime: new Date(ps.startTime), // Ensure startTime is a Date object
    endTime: ps.endTime ? new Date(ps.endTime) : null, // Ensure endTime is a Date object or null
    transcriptContent: ps.transcriptContent || "", // Ensure transcriptContent is a string
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
    tokens: ps.tokens === null ? undefined : ps.tokens,
    tokensEur: ps.tokensEur === null ? undefined : ps.tokensEur,
    escalated: ps.escalated || false,
    forwardedHr: ps.forwardedHr || false,
    initialMsg: ps.initialMsg || undefined,
    fullTranscriptUrl: ps.fullTranscriptUrl || undefined,
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

  res.json({
    metrics,
    csvUrl: user.company.csvUrl,
    company: user.company,
  });
}
