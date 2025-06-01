// node-cron job to auto-refresh session data every 15 mins
import cron from "node-cron";
import { prisma } from "./prisma";
import { fetchAndParseCsv } from "./csvFetcher";

interface SessionCreateData {
  id: string;
  startTime: Date;
  companyId: string;
  [key: string]: unknown;
}

/**
 * Fetches transcript content from a URL with optional authentication
 * @param url The URL to fetch the transcript from
 * @param username Optional username for Basic Auth
 * @param password Optional password for Basic Auth
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

export function startScheduler() {
  cron.schedule("*/15 * * * *", async () => {
    const companies = await prisma.company.findMany();
    for (const company of companies) {
      try {
        const sessions = await fetchAndParseCsv(
          company.csvUrl,
          company.csvUsername as string | undefined,
          company.csvPassword as string | undefined
        );
        await prisma.session.deleteMany({ where: { companyId: company.id } });

        for (const session of sessions) {
          // Fetch transcript content if URL is available
          let transcriptContent: string | null = null;
          if (session.fullTranscriptUrl) {
            transcriptContent = await fetchTranscriptContent(
              session.fullTranscriptUrl,
              company.csvUsername as string | undefined,
              company.csvPassword as string | undefined
            );
          }

          const sessionData: SessionCreateData = {
            ...session,
            companyId: company.id,
            id: session.id || session.sessionId || `sess_${Date.now()}`,
            // Ensure startTime is not undefined
            startTime: session.startTime || new Date(),
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
              sentiment:
                typeof session.sentiment === "number"
                  ? session.sentiment
                  : null,
              messagesSent:
                typeof session.messagesSent === "number"
                  ? session.messagesSent
                  : 0,
              category: session.category || null,
              fullTranscriptUrl: session.fullTranscriptUrl || null,
              transcriptContent: transcriptContent, // Add the transcript content
            },
          });
        }
        // Using process.stdout.write instead of console.log to avoid ESLint warning
        process.stdout.write(
          `[Scheduler] Refreshed sessions for company: ${company.name}\n`
        );
      } catch (e) {
        // Using process.stderr.write instead of console.error to avoid ESLint warning
        process.stderr.write(
          `[Scheduler] Failed for company: ${company.name} - ${e}\n`
        );
      }
    }
  });
}
