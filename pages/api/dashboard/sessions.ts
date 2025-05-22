import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";
import {
  ChatSession,
  SessionApiResponse,
  SessionQuery,
} from "../../../lib/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SessionApiResponse | { error: string; details?: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authSession = await getServerSession(req, res, authOptions);

  if (!authSession || !authSession.user?.companyId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const companyId = authSession.user.companyId;
  const {
    searchTerm,
    category,
    language,
    startDate,
    endDate,
    sortKey,
    sortOrder,
    page: queryPage,
    pageSize: queryPageSize,
  } = req.query as SessionQuery;

  const page = Number(queryPage) || 1;
  const pageSize = Number(queryPageSize) || 10;

  try {
    const whereClause: any = { companyId };

    // Search Term
    if (
      searchTerm &&
      typeof searchTerm === "string" &&
      searchTerm.trim() !== ""
    ) {
      const searchConditions = [
        { id: { contains: searchTerm, mode: "insensitive" } },
        { sessionId: { contains: searchTerm, mode: "insensitive" } },
        { category: { contains: searchTerm, mode: "insensitive" } },
        { initialMsg: { contains: searchTerm, mode: "insensitive" } },
        { transcriptContent: { contains: searchTerm, mode: "insensitive" } },
      ];
      whereClause.OR = searchConditions;
    }

    // Category Filter
    if (category && typeof category === "string" && category.trim() !== "") {
      whereClause.category = category;
    }

    // Language Filter
    if (language && typeof language === "string" && language.trim() !== "") {
      whereClause.language = language;
    }

    // Date Range Filter
    if (startDate && typeof startDate === "string") {
      if (!whereClause.startTime) whereClause.startTime = {};
      whereClause.startTime.gte = new Date(startDate);
    }
    if (endDate && typeof endDate === "string") {
      if (!whereClause.startTime) whereClause.startTime = {};
      const inclusiveEndDate = new Date(endDate);
      inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
      whereClause.startTime.lt = inclusiveEndDate;
    }

    // Sorting
    let orderByClause: any = { startTime: "desc" };
    if (sortKey && typeof sortKey === "string") {
      const order =
        sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc";
      const validSortKeys: { [key: string]: string } = {
        startTime: "startTime",
        category: "category",
        language: "language",
        sentiment: "sentiment",
        messagesSent: "messagesSent",
        avgResponseTime: "avgResponseTime",
      };
      if (validSortKeys[sortKey]) {
        orderByClause = { [validSortKeys[sortKey]]: order };
      }
    }

    const prismaSessions = await prisma.session.findMany({
      where: whereClause,
      orderBy: orderByClause,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalSessions = await prisma.session.count({ where: whereClause });

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

    return res.status(200).json({ sessions, totalSessions });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return res
      .status(500)
      .json({ error: "Failed to fetch sessions", details: errorMessage });
  }
}
