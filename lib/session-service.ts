import { prisma } from "./prisma";
import { fetchAndParseCsv } from "./csvFetcher";
import { triggerCompleteWorkflow } from "./workflow";

interface SessionCreateData {
  id: string;
  startTime: Date;
  companyId: string;
  sessionId?: string;
  [key: string]: unknown;
}

export async function processSessions(company: any) {
  const sessions = await fetchAndParseCsv(
    company.csvUrl,
    company.csvUsername as string | undefined,
    company.csvPassword as string | undefined
  );

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

  return sessions.length;
}
