// node-cron job to auto-refresh session data every 15 mins
import cron from "node-cron";
import { prisma } from "./prisma";
import { fetchAndParseCsv } from "./csvFetcher";

export function startScheduler() {
  cron.schedule("*/15 * * * *", async () => {
    const companies = await prisma.company.findMany();
    for (const company of companies) {
      try {
        const rawSessionData = await fetchAndParseCsv(
          company.csvUrl,
          company.csvUsername as string | undefined,
          company.csvPassword as string | undefined
        );

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
          } catch (error) {
            // Log individual session import errors but continue processing
            process.stderr.write(
              `[Scheduler] Failed to import session ${rawSession.externalSessionId} for company ${company.name}: ${error}\n`
            );
          }
        }

        process.stdout.write(
          `[Scheduler] Imported ${rawSessionData.length} session records for company: ${company.name}\n`
        );
      } catch (e) {
        process.stderr.write(
          `[Scheduler] Failed to fetch CSV for company: ${company.name} - ${e}\n`
        );
      }
    }
  });
}
