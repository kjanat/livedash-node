import type { Prisma, SessionCategory } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import type { ChatSession } from "../../../../lib/types";

/**
 * Build where clause for session filtering
 */
function buildWhereClause(
  companyId: string,
  searchParams: URLSearchParams
): Prisma.SessionWhereInput {
  const whereClause: Prisma.SessionWhereInput = { companyId };

  const searchTerm = searchParams.get("searchTerm");
  const category = searchParams.get("category");
  const language = searchParams.get("language");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  // Search Term
  if (searchTerm && searchTerm.trim() !== "") {
    const searchConditions = [
      { id: { contains: searchTerm } },
      { initialMsg: { contains: searchTerm } },
      { summary: { contains: searchTerm } },
    ];
    whereClause.OR = searchConditions;
  }

  // Category Filter
  if (category && category.trim() !== "") {
    whereClause.category = category as SessionCategory;
  }

  // Language Filter
  if (language && language.trim() !== "") {
    whereClause.language = language;
  }

  // Date Range Filter
  if (startDate) {
    whereClause.startTime = {
      ...((whereClause.startTime as object) || {}),
      gte: new Date(startDate),
    };
  }
  if (endDate) {
    const inclusiveEndDate = new Date(endDate);
    inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
    whereClause.startTime = {
      ...((whereClause.startTime as object) || {}),
      lt: inclusiveEndDate,
    };
  }

  return whereClause;
}

/**
 * Build order by clause for session sorting
 */
function buildOrderByClause(
  searchParams: URLSearchParams
):
  | Prisma.SessionOrderByWithRelationInput
  | Prisma.SessionOrderByWithRelationInput[] {
  const sortKey = searchParams.get("sortKey");
  const sortOrder = searchParams.get("sortOrder");

  const validSortKeys: { [key: string]: string } = {
    startTime: "startTime",
    category: "category",
    language: "language",
    sentiment: "sentiment",
    messagesSent: "messagesSent",
    avgResponseTime: "avgResponseTime",
  };

  const primarySortField =
    sortKey && validSortKeys[sortKey] ? validSortKeys[sortKey] : "startTime";
  const primarySortOrder =
    sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc";

  if (primarySortField === "startTime") {
    return { [primarySortField]: primarySortOrder };
  }

  return [{ [primarySortField]: primarySortOrder }, { startTime: "desc" }];
}

/**
 * Convert Prisma session to ChatSession format
 */
function convertPrismaSessionToChatSession(ps: {
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
}): ChatSession {
  return {
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
    initialMsg: ps.initialMsg ?? undefined,
    fullTranscriptUrl: ps.fullTranscriptUrl ?? null,
    transcriptContent: null,
  };
}

export async function GET(request: NextRequest) {
  const authSession = await getServerSession(authOptions);

  if (!authSession || !authSession.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = authSession.user.companyId;
  const { searchParams } = new URL(request.url);

  const queryPage = searchParams.get("page");
  const queryPageSize = searchParams.get("pageSize");
  const page = Number(queryPage) || 1;
  const pageSize = Number(queryPageSize) || 10;

  try {
    const whereClause = buildWhereClause(companyId, searchParams);
    const orderByCondition = buildOrderByClause(searchParams);

    const prismaSessions = await prisma.session.findMany({
      where: whereClause,
      orderBy: orderByCondition,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalSessions = await prisma.session.count({ where: whereClause });

    const sessions: ChatSession[] = prismaSessions.map(
      convertPrismaSessionToChatSession
    );

    return NextResponse.json({ sessions, totalSessions });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to fetch sessions", details: errorMessage },
      { status: 500 }
    );
  }
}
