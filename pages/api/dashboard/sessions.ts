import { NextApiRequest, NextApiResponse } from "next";
import { getApiSession } from "../../../lib/api-auth";
import { prisma } from "../../../lib/prisma";
import {
  ChatSession,
  SessionApiResponse,
  SessionQuery,
} from "../../../lib/types";
import { Prisma } from "@prisma/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SessionApiResponse | { error: string; details?: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

    const authSession = await getApiSession(req, res);

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
    const whereClause: Prisma.SessionWhereInput = { companyId };

    // Search Term
    if (
      searchTerm &&
      typeof searchTerm === "string" &&
      searchTerm.trim() !== ""
    ) {
      const searchConditions = [
        { id: { contains: searchTerm } },
        { category: { contains: searchTerm } },
        { initialMsg: { contains: searchTerm } },
        { transcriptContent: { contains: searchTerm } },
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
      whereClause.startTime = {
        ...((whereClause.startTime as object) || {}),
        gte: new Date(startDate),
      };
    }
    if (endDate && typeof endDate === "string") {
      const inclusiveEndDate = new Date(endDate);
      inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
      whereClause.startTime = {
        ...((whereClause.startTime as object) || {}),
        lt: inclusiveEndDate,
      };
    }

    // Sorting
    const validSortKeys: { [key: string]: string } = {
      startTime: "startTime",
      category: "category",
      language: "language",
      sentiment: "sentiment",
      messagesSent: "messagesSent",
      avgResponseTime: "avgResponseTime",
    };

    let orderByCondition:
      | Prisma.SessionOrderByWithRelationInput
      | Prisma.SessionOrderByWithRelationInput[];

    const primarySortField =
      sortKey && typeof sortKey === "string" && validSortKeys[sortKey]
        ? validSortKeys[sortKey]
        : "startTime"; // Default to startTime field if sortKey is invalid/missing

    const primarySortOrder =
      sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc"; // Default to desc order

    if (primarySortField === "startTime") {
      // If sorting by startTime, it's the only sort criteria
      orderByCondition = { [primarySortField]: primarySortOrder };
    } else {
      // If sorting by another field, use startTime: "desc" as secondary sort
      orderByCondition = [
        { [primarySortField]: primarySortOrder },
        { startTime: "desc" },
      ];
    }
    // Note: If sortKey was initially undefined or invalid, primarySortField defaults to "startTime",
    // and primarySortOrder defaults to "desc". This makes orderByCondition = { startTime: "desc" },
    // which is the correct overall default sort.

    const prismaSessions = await prisma.session.findMany({
      where: whereClause,
      orderBy: orderByCondition,
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
