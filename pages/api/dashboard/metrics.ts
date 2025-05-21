// API endpoint: return metrics for current company
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "../../../lib/prisma";
import { sessionMetrics } from "../../../lib/metrics";
import { authOptions } from "../auth/[...nextauth]";

interface SessionUser {
    email: string;
    name?: string;
}

interface SessionData {
    user: SessionUser;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await getServerSession(req, res, authOptions) as SessionData | null;
    if (!session?.user) return res.status(401).json({ error: "Not logged in" });

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { company: true }
    });

    if (!user) return res.status(401).json({ error: "No user" });

    const sessions = await prisma.session.findMany({
        where: { companyId: user.companyId }
    });

    // Pass company config to metrics
    // @ts-expect-error - Type conversion is needed between prisma session and ChatSession
    const metrics = sessionMetrics(sessions, user.company);

    res.json({
        metrics,
        csvUrl: user.company.csvUrl,
        company: user.company
    });
}
