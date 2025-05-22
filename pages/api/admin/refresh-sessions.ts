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

/**
 * Fetches transcript content from a URL
 * @param url The URL to fetch the transcript from
 * @returns The transcript content or null if fetching fails
 */
async function fetchTranscriptContent(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            process.stderr.write(
                `Error fetching transcript: ${response.statusText}\n`
            );
            return null;
        }
        return await response.text();
    } catch (error) {
        process.stderr.write(`Failed to fetch transcript: ${error}\n`);
        return null;
    }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
        orderBy: { createdAt: "desc" },
        where: {
          /* Add session check criteria here */
        },
      });

      if (session) {
        companyId = session.companyId;
      }
    } catch (error) {
      // Log error for server-side debugging
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      // Use a server-side logging approach instead of console
      process.stderr.write(`Error fetching session: ${errorMessage}\n`);
    }
  }

  if (!companyId) {
    return res.status(400).json({ error: "Company ID is required" });
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return res.status(404).json({ error: "Company not found" });

  try {
    const sessions = await fetchAndParseCsv(
      company.csvUrl,
      company.csvUsername as string | undefined,
      company.csvPassword as string | undefined
    );

    // Replace all session rows for this company (for demo simplicity)
    await prisma.session.deleteMany({ where: { companyId: company.id } });

    for (const session of sessions) {
      const sessionData: SessionCreateData = {
        ...session,
        companyId: company.id,
        id:
          session.id ||
          session.sessionId ||
          `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        // Ensure startTime is not undefined
        startTime: session.startTime || new Date(),
      };

      // Validate dates to prevent "Invalid Date" errors
      const startTime =
        sessionData.startTime instanceof Date &&
        !isNaN(sessionData.startTime.getTime())
          ? sessionData.startTime
          : new Date();

      const endTime =
        session.endTime instanceof Date && !isNaN(session.endTime.getTime())
          ? session.endTime
          : new Date();

        // Fetch transcript content if URL is available
        let transcriptContent: string | null = null;
        if (session.fullTranscriptUrl) {
            transcriptContent = await fetchTranscriptContent(
                session.fullTranscriptUrl
            );
        }

      // Only include fields that are properly typed for Prisma
      await prisma.session.create({
        data: {
          id: sessionData.id,
          companyId: sessionData.companyId,
          startTime: startTime,
          endTime: endTime,
          ipAddress: session.ipAddress || null,
          country: session.country || null,
          language: session.language || null,
          messagesSent:
            typeof session.messagesSent === "number" ? session.messagesSent : 0,
          sentiment:
            typeof session.sentiment === "number" ? session.sentiment : null,
          escalated:
            typeof session.escalated === "boolean" ? session.escalated : null,
          forwardedHr:
            typeof session.forwardedHr === "boolean"
              ? session.forwardedHr
              : null,
          fullTranscriptUrl: session.fullTranscriptUrl || null,
              transcriptContent: transcriptContent, // Add the transcript content
          avgResponseTime:
            typeof session.avgResponseTime === "number"
              ? session.avgResponseTime
              : null,
          tokens: typeof session.tokens === "number" ? session.tokens : null,
          tokensEur:
            typeof session.tokensEur === "number" ? session.tokensEur : null,
          category: session.category || null,
          initialMsg: session.initialMsg || null,
        },
      });
    }

    res.json({ ok: true, imported: sessions.length });
  } catch (e) {
    const error = e instanceof Error ? e.message : "An unknown error occurred";
    res.status(500).json({ error });
  }
}
