import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting to fetch missing transcripts...");

  const sessionsToUpdate = await prisma.session.findMany({
    where: {
      AND: [
        { fullTranscriptUrl: { not: null } },
        { fullTranscriptUrl: { not: "" } }, // Ensure URL is not an empty string
        { transcriptContent: null },
      ],
    },
    select: {
      id: true,
      fullTranscriptUrl: true,
      companyId: true,
    },
  });

  if (sessionsToUpdate.length === 0) {
    console.log("No sessions found requiring transcript fetching.");
    return;
  }

  console.log(`Found ${sessionsToUpdate.length} sessions to update.`);
  let successCount = 0;
  let errorCount = 0;

  // Group sessions by company to fetch credentials once per company
  const sessionsByCompany = new Map<string, typeof sessionsToUpdate>();
  for (const session of sessionsToUpdate) {
    if (!sessionsByCompany.has(session.companyId)) {
      sessionsByCompany.set(session.companyId, []);
    }
    sessionsByCompany.get(session.companyId)!.push(session);
  }

  for (const [companyId, companySessions] of Array.from(
    sessionsByCompany.entries()
  )) {
    // Fetch company credentials once per company
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        csvUsername: true,
        csvPassword: true,
        name: true,
      },
    });

    if (!company) {
      console.warn(`Company ${companyId} not found, skipping sessions.`);
      errorCount += companySessions.length;
      continue;
    }

    console.log(
      `Processing ${companySessions.length} sessions for company: ${company.name}`
    );

    for (const session of companySessions) {
      if (!session.fullTranscriptUrl) {
        // Should not happen due to query, but good for type safety
        console.warn(
          `Session ${session.id} has no fullTranscriptUrl, skipping.`
        );
        continue;
      }

      console.log(
        `Fetching transcript for session ${session.id} from ${session.fullTranscriptUrl}...`
      );
      try {
        // Prepare authentication if credentials are available
        const authHeader =
          company.csvUsername && company.csvPassword
            ? "Basic " +
              Buffer.from(
                `${company.csvUsername}:${company.csvPassword}`
              ).toString("base64")
            : undefined;

        const response = await fetch(session.fullTranscriptUrl, {
          headers: authHeader ? { Authorization: authHeader } : {},
        });

        if (!response.ok) {
          console.error(
            `Failed to fetch transcript for session ${session.id}: ${response.status} ${response.statusText}`
          );
          const errorBody = await response.text();
          console.error(`Error details: ${errorBody.substring(0, 500)}`); // Log first 500 chars of error
          errorCount++;
          continue;
        }

        const transcriptText = await response.text();

        if (transcriptText.trim() === "") {
          console.warn(
            `Fetched empty transcript for session ${session.id}. Storing as empty string.`
          );
        }

        await prisma.session.update({
          where: { id: session.id },
          data: { transcriptContent: transcriptText },
        });
        console.log(
          `Successfully fetched and stored transcript for session ${session.id}.`
        );
        successCount++;
      } catch (error) {
        console.error(`Error processing session ${session.id}:`, error);
        errorCount++;
      }
    }
  }

  console.log("Transcript fetching complete.");
  console.log(`Successfully updated: ${successCount} sessions.`);
  console.log(`Failed to update: ${errorCount} sessions.`);
}

main()
  .catch((e) => {
    console.error("An error occurred during the script execution:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
