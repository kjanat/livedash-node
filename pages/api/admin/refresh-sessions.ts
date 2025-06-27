// API route to refresh (fetch+parse+update) session data for a company
import { NextApiRequest, NextApiResponse } from "next";
import { fetchAndParseCsv } from "../../../lib/csvFetcher";
import { prisma } from "../../../lib/prisma";

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
    const rawSessionData = await fetchAndParseCsv(
      company.csvUrl,
      company.csvUsername as string | undefined,
      company.csvPassword as string | undefined
    );

    let importedCount = 0;

    // Create SessionImport records for new data
    for (const rawSession of rawSessionData) {
      try {
        // Use upsert to handle duplicates gracefully
        await prisma.sessionImport.upsert({
          where: {
            companyId_externalSessionId: {
              companyId: company.id,
              externalSessionId: rawSession.externalSessionId,
            },
          },
          update: {
            // Update existing record with latest data
            startTimeRaw: rawSession.startTimeRaw,
            endTimeRaw: rawSession.endTimeRaw,
            ipAddress: rawSession.ipAddress,
            countryCode: rawSession.countryCode,
            language: rawSession.language,
            messagesSent: rawSession.messagesSent,
            sentimentRaw: rawSession.sentimentRaw,
            escalatedRaw: rawSession.escalatedRaw,
            forwardedHrRaw: rawSession.forwardedHrRaw,
            fullTranscriptUrl: rawSession.fullTranscriptUrl,
            avgResponseTimeSeconds: rawSession.avgResponseTimeSeconds,
            tokens: rawSession.tokens,
            tokensEur: rawSession.tokensEur,
            category: rawSession.category,
            initialMessage: rawSession.initialMessage,
            status: "QUEUED", // Reset status for reprocessing if needed
          },
          create: {
            companyId: company.id,
            externalSessionId: rawSession.externalSessionId,
            startTimeRaw: rawSession.startTimeRaw,
            endTimeRaw: rawSession.endTimeRaw,
            ipAddress: rawSession.ipAddress,
            countryCode: rawSession.countryCode,
            language: rawSession.language,
            messagesSent: rawSession.messagesSent,
            sentimentRaw: rawSession.sentimentRaw,
            escalatedRaw: rawSession.escalatedRaw,
            forwardedHrRaw: rawSession.forwardedHrRaw,
            fullTranscriptUrl: rawSession.fullTranscriptUrl,
            avgResponseTimeSeconds: rawSession.avgResponseTimeSeconds,
            tokens: rawSession.tokens,
            tokensEur: rawSession.tokensEur,
            category: rawSession.category,
            initialMessage: rawSession.initialMessage,
            status: "QUEUED",
          },
        });
        importedCount++;
      } catch (error) {
        // Log individual session import errors but continue processing
        process.stderr.write(
          `Failed to import session ${rawSession.externalSessionId}: ${error}\n`
        );
      }
    }

    res.json({ 
      ok: true, 
      imported: importedCount,
      total: rawSessionData.length,
      message: `Successfully imported ${importedCount} session records to SessionImport table`
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : "An unknown error occurred";
    res.status(500).json({ error });
  }
}
