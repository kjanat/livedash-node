import { SessionCategory, type Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import type { ChatSession } from "../../../../lib/types";

export async function GET(request: NextRequest) {
  const authSession = await getServerSession(authOptions);

  if (!authSession || !authSession.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = authSession.user.companyId;
  const { searchParams } = new URL(request.url);

  const searchTerm = searchParams.get("searchTerm");
  const category = searchParams.get("category");
  const language = searchParams.get("language");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const sortKey = searchParams.get("sortKey");
  const sortOrder = searchParams.get("sortOrder");
  const queryPage = searchParams.get("page");
  const queryPageSize = searchParams.get("pageSize");

  const page = Number(queryPage) || 1;
  const pageSize = Number(queryPageSize) || 10;

  try {
    const whereClause: Prisma.SessionWhereInput = { companyId };

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
      // Cast to SessionCategory enum if it's a valid value
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
      sortKey && validSortKeys[sortKey] ? validSortKeys[sortKey] : "startTime"; // Default to startTime field if sortKey is invalid/missing

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
      initialMsg: ps.initialMsg ?? undefined,
      fullTranscriptUrl: ps.fullTranscriptUrl ?? null,
      transcriptContent: null, // Transcript content is now fetched from fullTranscriptUrl when needed
    }));

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
