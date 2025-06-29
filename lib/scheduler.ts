// CSV import scheduler with configurable intervals
import cron from "node-cron";
import { fetchAndParseCsv } from "./csvFetcher";
import { prisma } from "./prisma";
import { getSchedulerConfig } from "./schedulerConfig";

export function startCsvImportScheduler() {
  const config = getSchedulerConfig();

  if (!config.enabled) {
    console.log("[CSV Import Scheduler] Disabled via configuration");
    return;
  }

  console.log(
    `[CSV Import Scheduler] Starting with interval: ${config.csvImport.interval}`
  );

  cron.schedule(config.csvImport.interval, async () => {
    // Process companies in batches to avoid memory issues
    const batchSize = 10;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const companies = await prisma.company.findMany({
        where: { status: "ACTIVE" }, // Only process active companies
        take: batchSize,
        skip: skip,
        orderBy: { createdAt: "asc" },
      });

      if (companies.length === 0) {
        hasMore = false;
        break;
      }

      // Process companies in parallel within batch
      await Promise.all(
        companies.map(async (company) => {
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
                    // Status tracking now handled by ProcessingStatusManager
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
                    // Status tracking now handled by ProcessingStatusManager
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
        })
      );

      skip += batchSize;

      if (companies.length < batchSize) {
        hasMore = false;
      }
    }
  });
}
