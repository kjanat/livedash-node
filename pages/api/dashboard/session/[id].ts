import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { ChatSession } from "../../../../lib/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Session ID is required" });
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
      return res.status(404).json({ error: "Session not found" });
    }

    // Map Prisma session object to ChatSession type
    const session: ChatSession = {
      // Spread prismaSession to include all its properties
      ...prismaSession,
      // Override properties that need conversion or specific mapping
      id: prismaSession.id, // ChatSession.id from Prisma.Session.id
      sessionId: prismaSession.id, // ChatSession.sessionId from Prisma.Session.id
      startTime: new Date(prismaSession.startTime),
      endTime: prismaSession.endTime ? new Date(prismaSession.endTime) : null,
      createdAt: new Date(prismaSession.createdAt),
      // Prisma.Session does not have an `updatedAt` field. We'll use `createdAt` as a fallback.
      // Or, if your business logic implies an update timestamp elsewhere, use that.
      updatedAt: new Date(prismaSession.createdAt), // Fallback to createdAt
      // Prisma.Session does not have a `userId` field.
      userId: null, // Explicitly set to null or map if available from another source
      // Ensure nullable fields from Prisma are correctly mapped to ChatSession's optional or nullable fields
      category: prismaSession.category ?? null,
      language: prismaSession.language ?? null,
      country: prismaSession.country ?? null,
      ipAddress: prismaSession.ipAddress ?? null,
      sentiment: prismaSession.sentiment ?? null,
      messagesSent: prismaSession.messagesSent ?? undefined, // Use undefined if ChatSession expects number | undefined
      avgResponseTime: prismaSession.avgResponseTime ?? null,
      escalated: prismaSession.escalated ?? undefined,
      forwardedHr: prismaSession.forwardedHr ?? undefined,
      initialMsg: prismaSession.initialMsg ?? undefined,
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

    return res.status(200).json({ session });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return res
      .status(500)
      .json({ error: "Failed to fetch session", details: errorMessage });
  }
}
