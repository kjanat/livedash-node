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
        });

        if (!prismaSession) {
            return res.status(404).json({ error: "Session not found" });
        }

        // Map Prisma session object to ChatSession type
        const session: ChatSession = {
            ...prismaSession,
            sessionId: prismaSession.id, // Assuming ChatSession's sessionId is Prisma's id
            startTime: new Date(prismaSession.startTime),
            endTime: prismaSession.endTime ? new Date(prismaSession.endTime) : null,
            createdAt: new Date(prismaSession.createdAt),
            updatedAt: new Date(prismaSession.updatedAt),
            userId: prismaSession.userId === undefined ? null : prismaSession.userId,
            category: prismaSession.category === undefined ? null : prismaSession.category,
            language: prismaSession.language === undefined ? null : prismaSession.language,
            country: prismaSession.country === undefined ? null : prismaSession.country,
            ipAddress: prismaSession.ipAddress === undefined ? null : prismaSession.ipAddress,
            sentiment: prismaSession.sentiment === undefined ? null : prismaSession.sentiment,
            messagesSent: prismaSession.messagesSent === undefined ? undefined : prismaSession.messagesSent,
            avgResponseTime: prismaSession.avgResponseTime === undefined ? null : prismaSession.avgResponseTime,
            escalated: prismaSession.escalated === undefined ? undefined : prismaSession.escalated,
            forwardedHr: prismaSession.forwardedHr === undefined ? undefined : prismaSession.forwardedHr,
            tokens: prismaSession.tokens === undefined ? undefined : prismaSession.tokens,
            tokensEur: prismaSession.tokensEur === undefined ? undefined : prismaSession.tokensEur,
            initialMsg: prismaSession.initialMsg === undefined ? null : prismaSession.initialMsg,
            fullTranscriptUrl: prismaSession.fullTranscriptUrl === undefined ? null : prismaSession.fullTranscriptUrl,
            transcriptContent: prismaSession.transcriptContent === undefined ? null : prismaSession.transcriptContent,
        };

        return res.status(200).json({ session });
    } catch (error) {
        console.error(`Failed to fetch session ${id}:`, error);
        const errorMessage =
            error instanceof Error ? error.message : "An unknown error occurred";
        return res
            .status(500)
            .json({ error: "Failed to fetch session", details: errorMessage });
    }
}
