import { type NextRequest, NextResponse } from "next/server";
import { fetchAndParseCsv } from "../../../../lib/csvFetcher";
import { processQueuedImports } from "../../../../lib/importProcessor";
import { prisma } from "../../../../lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Check if company is active and can process data
    if (company.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error: `Data processing is disabled for ${company.status.toLowerCase()} companies`,
          companyStatus: company.status,
        },
        { status: 403 }
      );
    }

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
        importedCount++;
      } catch (error) {
        // Log individual session import errors but continue processing
        process.stderr.write(
          `Failed to import session ${rawSession.externalSessionId}: ${error}\n`
        );
      }
    }

    // Immediately process the queued imports to create Session records
    console.log("[Refresh API] Processing queued imports...");
    await processQueuedImports(100); // Process up to 100 imports immediately

    // Count how many sessions were created
    const sessionCount = await prisma.session.count({
      where: { companyId: company.id },
    });

    return NextResponse.json({
      ok: true,
      imported: importedCount,
      total: rawSessionData.length,
      sessions: sessionCount,
      message: `Successfully imported ${importedCount} records and processed them into sessions. Total sessions: ${sessionCount}`,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : "An unknown error occurred";
    return NextResponse.json({ error }, { status: 500 });
  }
}
