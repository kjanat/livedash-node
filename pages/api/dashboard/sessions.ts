import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { ChatSession } from "../../../lib/types";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { searchTerm } = req.query;

    try {
        let prismaSessions;

        if (searchTerm && typeof searchTerm === "string" && searchTerm.trim() !== "") {
            const searchConditions = [
                { id: { contains: searchTerm, mode: "insensitive" } },
                { category: { contains: searchTerm, mode: "insensitive" } },
                { initialMsg: { contains: searchTerm, mode: "insensitive" } },
                { transcriptContent: { contains: searchTerm, mode: "insensitive" } },
            ];

            prismaSessions = await prisma.session.findMany({
                where: {
                    OR: searchConditions,
                },
                orderBy: {
                    startTime: "desc",
                },
            });
        } else {
            prismaSessions = await prisma.session.findMany({
                orderBy: {
                    startTime: "desc",
                },
            });
        }

        const sessions: ChatSession[] = prismaSessions.map(ps => ({
            ...ps,
            sessionId: ps.id,
            startTime: new Date(ps.startTime),
            endTime: ps.endTime ? new Date(ps.endTime) : null,
            createdAt: new Date(ps.createdAt),
            updatedAt: new Date(ps.updatedAt),
            userId: ps.userId === undefined ? null : ps.userId,
            category: ps.category === undefined ? null : ps.category,
            language: ps.language === undefined ? null : ps.language,
            country: ps.country === undefined ? null : ps.country,
            ipAddress: ps.ipAddress === undefined ? null : ps.ipAddress,
            sentiment: ps.sentiment === undefined ? null : ps.sentiment,
            messagesSent: ps.messagesSent === undefined ? undefined : ps.messagesSent,
            avgResponseTime: ps.avgResponseTime === undefined ? null : ps.avgResponseTime,
            escalated: ps.escalated === undefined ? undefined : ps.escalated,
            forwardedHr: ps.forwardedHr === undefined ? undefined : ps.forwardedHr,
            tokens: ps.tokens === undefined ? undefined : ps.tokens,
            tokensEur: ps.tokensEur === undefined ? undefined : ps.tokensEur,
            initialMsg: ps.initialMsg === undefined ? null : ps.initialMsg,
            fullTranscriptUrl: ps.fullTranscriptUrl === undefined ? null : ps.fullTranscriptUrl,
            transcriptContent: ps.transcriptContent === undefined ? null : ps.transcriptContent,
        }));

        return res.status(200).json({ sessions });
    } catch (error) {
        console.error("Failed to fetch sessions:", error);
        const errorMessage =
            error instanceof Error ? error.message : "An unknown error occurred";
        return res.status(500).json({ error: "Failed to fetch sessions", details: errorMessage });
    }
}
