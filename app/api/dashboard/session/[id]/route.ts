import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import type { ChatSession } from "../../../../../lib/types";

/**
 * Maps Prisma session object to ChatSession type
 */
function mapPrismaSessionToChatSession(prismaSession: {
  id: string;
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
  messages: Array<{
    id: string;
    sessionId: string;
    timestamp: Date | null;
    role: string;
    content: string;
    order: number;
    createdAt: Date;
  }>;
}): ChatSession {
  return {
    // Spread prismaSession to include all its properties
    ...prismaSession,
    // Override properties that need conversion or specific mapping
    id: prismaSession.id, // ChatSession.id from Prisma.Session.id
    sessionId: prismaSession.id, // ChatSession.sessionId from Prisma.Session.id
    startTime: new Date(prismaSession.startTime),
    endTime: prismaSession.endTime ? new Date(prismaSession.endTime) : null,
    createdAt: new Date(prismaSession.createdAt),
    // Prisma.Session does not have an `updatedAt` field. We'll use `createdAt` as a fallback.
    updatedAt: new Date(prismaSession.createdAt), // Fallback to createdAt
    // Prisma.Session does not have a `userId` field.
    userId: null, // Explicitly set to null or map if available from another source
    // Ensure nullable fields from Prisma are correctly mapped to ChatSession's optional or nullable fields
    category: prismaSession.category ?? null,
    language: prismaSession.language ?? null,
    country: prismaSession.country ?? null,
    ipAddress: prismaSession.ipAddress ?? null,
    sentiment: prismaSession.sentiment ?? null,
    messagesSent: prismaSession.messagesSent ?? null, // Maintain consistency with other nullable fields
    avgResponseTime: prismaSession.avgResponseTime ?? null,
    escalated: prismaSession.escalated,
    forwardedHr: prismaSession.forwardedHr,
    initialMsg: prismaSession.initialMsg ?? null,
    fullTranscriptUrl: prismaSession.fullTranscriptUrl ?? null,
    summary: prismaSession.summary ?? null, // New field
    transcriptContent: null, // Not available in Session model
    messages:
      prismaSession.messages?.map((msg) => ({
        id: msg.id,
        sessionId: msg.sessionId,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        role: msg.role,
        content: msg.content,
        order: msg.order,
        createdAt: new Date(msg.createdAt),
      })) ?? [], // New field - parsed messages
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Session ID is required" },
      { status: 400 }
    );
  }

  try {
    const prismaSession = await prisma.session.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!prismaSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Map Prisma session object to ChatSession type
    const session: ChatSession = mapPrismaSessionToChatSession(prismaSession);

    return NextResponse.json({ session });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to fetch session", details: errorMessage },
      { status: 500 }
    );
  }
}
