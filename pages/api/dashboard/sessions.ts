import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";
import { ChatSession } from "../../../lib/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authSession = await getServerSession(req, res, authOptions);

  if (!authSession || !authSession.user?.companyId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const companyId = authSession.user.companyId;
  const { searchTerm } = req.query;

  try {
    const whereClause: any = { companyId };

    if (
      searchTerm &&
      typeof searchTerm === "string" &&
      searchTerm.trim() !== ""
    ) {
      const searchConditions = [
        { id: { contains: searchTerm, mode: "insensitive" } },
        { category: { contains: searchTerm, mode: "insensitive" } },
        { initialMsg: { contains: searchTerm, mode: "insensitive" } },
        { transcriptContent: { contains: searchTerm, mode: "insensitive" } },
      ];
      whereClause.OR = searchConditions;
    }

    const prismaSessions = await prisma.session.findMany({
      where: whereClause,
      orderBy: {
        startTime: "desc",
      },
    });

    const sessions: ChatSession[] = prismaSessions.map((ps) => ({
      id: ps.id,
      sessionId: ps.id,
      companyId: ps.companyId,
      startTime: new Date(ps.startTime),
      endTime: ps.endTime ? new Date(ps.endTime) : null,
      createdAt: new Date(ps.createdAt),
      updatedAt: new Date(ps.createdAt),
      userId: null,
      category: ps.category ?? null,
      language: ps.language ?? null,
      country: ps.country ?? null,
      ipAddress: ps.ipAddress ?? null,
      sentiment: ps.sentiment ?? null,
      messagesSent: ps.messagesSent ?? undefined,
      avgResponseTime: ps.avgResponseTime ?? null,
      escalated: ps.escalated ?? undefined,
      forwardedHr: ps.forwardedHr ?? undefined,
      tokens: ps.tokens ?? undefined,
      tokensEur: ps.tokensEur ?? undefined,
      initialMsg: ps.initialMsg ?? undefined,
      fullTranscriptUrl: ps.fullTranscriptUrl ?? null,
      transcriptContent: ps.transcriptContent ?? null,
    }));

    return res.status(200).json({ sessions });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return res
      .status(500)
      .json({ error: "Failed to fetch sessions", details: errorMessage });
  }
}
