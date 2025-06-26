// API route to refresh (fetch+parse+update) session data for a company
import { NextApiRequest, NextApiResponse } from "next";
import { fetchAndParseCsv } from "../../../lib/csvFetcher";
import { prisma } from "../../../lib/prisma";
import { processUnprocessedSessions } from "../../../lib/processingSchedulerNoCron";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Triggers the complete workflow: fetch transcripts + process all sessions
 */
async function triggerCompleteWorkflow(): Promise<{ message: string }> {
  try {
    // Step 1: Fetch missing transcripts
    const sessionsWithoutMessages = await prisma.session.count({
      where: {
        messages: { none: {} },
        fullTranscriptUrl: { not: null }
      }
    });

    if (sessionsWithoutMessages > 0) {
      console.log(`[Complete Workflow] Fetching transcripts for ${sessionsWithoutMessages} sessions`);

      // Get sessions that have fullTranscriptUrl but no messages
      const sessionsToProcess = await prisma.session.findMany({
        where: {
          AND: [
            { fullTranscriptUrl: { not: null } },
            { messages: { none: {} } },
          ],
        },
        include: {
          company: true,
        },
        take: 20, // Process in batches
      });

      for (const session of sessionsToProcess) {
        try {
          if (!session.fullTranscriptUrl) continue;

          // Fetch transcript content
          const transcriptContent = await fetchTranscriptContent(
            session.fullTranscriptUrl,
            session.company.csvUsername || undefined,
            session.company.csvPassword || undefined
          );

          if (!transcriptContent) {
            console.log(`No transcript content for session ${session.id}`);
            continue;
          }

          // Parse transcript into messages
          const lines = transcriptContent.split("\n").filter((line) => line.trim());
          const messages: Array<{
            sessionId: string;
            role: string;
            content: string;
            timestamp: Date;
            order: number;
          }> = [];
          let messageOrder = 0;
          const currentTimestamp = new Date();

          for (const line of lines) {
            // Try format: [DD-MM-YYYY HH:MM:SS] Role: Content
            const timestampMatch = line.match(/^\[([^\]]+)\]\s*([^:]+):\s*(.+)$/);

            if (timestampMatch) {
              const [, timestamp, role, content] = timestampMatch;
              const dateMatch = timestamp.match(/^(\d{1,2})-(\d{1,2})-(\d{4}) (\d{1,2}):(\d{1,2}):(\d{1,2})$/);
              let parsedTimestamp = new Date();

              if (dateMatch) {
                const [, day, month, year, hour, minute, second] = dateMatch;
                parsedTimestamp = new Date(
                  parseInt(year),
                  parseInt(month) - 1,
                  parseInt(day),
                  parseInt(hour),
                  parseInt(minute),
                  parseInt(second)
                );
              }

              messages.push({
                sessionId: session.id,
                role: role.trim().toLowerCase(),
                content: content.trim(),
                timestamp: parsedTimestamp,
                order: messageOrder++,
              });
            }
          }

          if (messages.length > 0) {
            // Save messages to database
            await prisma.message.createMany({
              data: messages as any, // Type assertion needed due to Prisma types
            });
            console.log(`Added ${messages.length} messages for session ${session.id}`);
          }
        } catch (error) {
          console.error(`Error processing session ${session.id}:`, error);
        }
      }
    }

    // Step 2: Process all unprocessed sessions
    const unprocessedWithMessages = await prisma.session.count({
      where: {
        processed: false,
        messages: { some: {} }
      }
    });

    if (unprocessedWithMessages > 0) {
      console.log(`[Complete Workflow] Processing ${unprocessedWithMessages} sessions`);
      await processUnprocessedSessions();
    }

    return { message: `Complete workflow finished successfully` };
  } catch (error) {
    console.error('[Complete Workflow] Error:', error);
    throw error;
  }
}

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
 * @param username Optional username for authentication
 * @param password Optional password for authentication
 * @returns The transcript content or null if fetching fails
 */
async function fetchTranscriptContent(
  url: string,
  username?: string,
  password?: string
): Promise<string | null> {
  try {
    const authHeader =
      username && password
        ? "Basic " + Buffer.from(`${username}:${password}`).toString("base64")
        : undefined;

    const response = await fetch(url, {
      headers: authHeader ? { Authorization: authHeader } : {},
    });

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

    // Only add sessions that don't already exist in the database
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

      // Note: transcriptContent field was removed from schema
      // Transcript content can be fetched on-demand from fullTranscriptUrl

      // Check if the session already exists
      const existingSession = await prisma.session.findUnique({
        where: { id: sessionData.id },
      });

      if (existingSession) {
        // Skip this session as it already exists
        continue;
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

    // After importing sessions, automatically trigger complete workflow (fetch transcripts + process)
    // This runs in the background without blocking the response
    triggerCompleteWorkflow()
      .then((result) => {
        console.log(`[Refresh Sessions] Complete workflow finished: ${result.message}`);
      })
      .catch((error) => {
        console.error(`[Refresh Sessions] Complete workflow failed:`, error);
      });

    res.json({
      ok: true,
      imported: sessions.length,
      message: "Sessions imported and complete processing workflow started automatically"
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : "An unknown error occurred";
    res.status(500).json({ error });
  }
}
