// API route to refresh (fetch+parse+update) session data for a company
import { NextApiRequest, NextApiResponse } from "next";
import { fetchAndParseCsv } from "../../../lib/csvFetcher";
import { prisma } from "../../../lib/prisma";

interface SessionCreateData {
    id: string;
    startTime: Date;
    companyId: string;
    sessionId?: string;
    [key: string]: unknown;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Check if this is a POST request
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // Get companyId from body or query
    let { companyId } = req.body;

    if (!companyId) {
        // Try to get user from prisma based on session cookie
        try {
            const session = await prisma.session.findFirst({
                orderBy: { createdAt: 'desc' },
                where: { /* Add session check criteria here */ }
            });

            if (session) {
                companyId = session.companyId;
            }
        } catch (error) {
            console.error("Error fetching session:", error);
        }
    }

    if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ error: "Company not found" });

    try {
        const sessions = await fetchAndParseCsv(company.csvUrl, company.csvUsername as string | undefined, company.csvPassword as string | undefined);

        // Replace all session rows for this company (for demo simplicity)
        await prisma.session.deleteMany({ where: { companyId: company.id } });
        
        for (const session of sessions) {
            const sessionData: SessionCreateData = {
                ...session,
                companyId: company.id,
                id: session.id || session.sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                // Ensure startTime is not undefined
                startTime: session.startTime || new Date()
            };
            
            // Only include fields that are properly typed for Prisma
            await prisma.session.create({
                data: {
                    id: sessionData.id,
                    companyId: sessionData.companyId,
                    startTime: sessionData.startTime,
                    // endTime is required in the schema, so use startTime if not available
                    endTime: session.endTime || new Date(),
                    ipAddress: session.ipAddress || null,
                    country: session.country || null,
                    language: session.language || null,
                    sentiment: typeof session.sentiment === 'number' ? session.sentiment : null,
                    messagesSent: typeof session.messagesSent === 'number' ? session.messagesSent : 0,
                    category: session.category || null
                }
            });
        }
        
        res.json({ ok: true, imported: sessions.length });
    } catch (e) {
        const error = e instanceof Error ? e.message : 'An unknown error occurred';
        res.status(500).json({ error });
    }
}
