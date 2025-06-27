import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";

const prisma = new PrismaClient();

/**
 * Fetches transcript content from a URL with optional authentication
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
      console.warn(`Failed to fetch transcript from ${url}: ${response.statusText}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.warn(`Error fetching transcript from ${url}:`, error);
    return null;
  }
}

/**
 * Parse transcript content into individual messages
 */
function parseTranscriptToMessages(transcriptContent: string): Array<{
  timestamp: Date | null;
  role: string;
  content: string;
  order: number;
}> {
  const lines = transcriptContent.split('\n').filter(line => line.trim());
  const messages: Array<{
    timestamp: Date | null;
    role: string;
    content: string;
    order: number;
  }> = [];

  let order = 0;

  for (const line of lines) {
    // Try to parse lines in format: [timestamp] role: content
    const match = line.match(/^\[([^\]]+)\]\s*([^:]+):\s*(.+)$/);
    
    if (match) {
      const [, timestampStr, role, content] = match;
      
      // Try to parse the timestamp
      let timestamp: Date | null = null;
      try {
        timestamp = new Date(timestampStr);
        if (isNaN(timestamp.getTime())) {
          timestamp = null;
        }
      } catch {
        timestamp = null;
      }

      messages.push({
        timestamp,
        role: role.trim(),
        content: content.trim(),
        order: order++,
      });
    } else {
      // If line doesn't match expected format, treat as content continuation
      if (messages.length > 0) {
        messages[messages.length - 1].content += '\n' + line;
      } else {
        // First line doesn't match format, create a generic message
        messages.push({
          timestamp: null,
          role: 'unknown',
          content: line,
          order: order++,
        });
      }
    }
  }

  return messages;
}

/**
 * Main function to fetch transcripts for sessions that don't have messages yet
 */
async function fetchTranscriptsForSessions() {
  console.log("Starting to fetch transcripts for sessions without messages...");

  // Find sessions that have transcript URLs but no messages
  const sessionsNeedingTranscripts = await prisma.session.findMany({
    where: {
      AND: [
        { fullTranscriptUrl: { not: null } },
        { messages: { none: {} } }, // No messages yet
      ],
    },
    include: {
      company: true,
      messages: true,
    },
  });

  if (sessionsNeedingTranscripts.length === 0) {
    console.log("No sessions found that need transcript fetching.");
    return;
  }

  console.log(`Found ${sessionsNeedingTranscripts.length} sessions that need transcript fetching.`);
  let successCount = 0;
  let errorCount = 0;

  for (const session of sessionsNeedingTranscripts) {
    if (!session.fullTranscriptUrl) {
      console.warn(`Session ${session.id} has no transcript URL, skipping.`);
      continue;
    }

    console.log(`Fetching transcript for session ${session.id}...`);
    
    try {
      // Fetch transcript content
      const transcriptContent = await fetchTranscriptContent(
        session.fullTranscriptUrl,
        session.company.csvUsername || undefined,
        session.company.csvPassword || undefined
      );

      if (!transcriptContent) {
        throw new Error("Failed to fetch transcript content");
      }

      // Parse transcript into messages
      const messages = parseTranscriptToMessages(transcriptContent);

      if (messages.length === 0) {
        throw new Error("No messages found in transcript");
      }

      // Create messages in database
      await prisma.message.createMany({
        data: messages.map(msg => ({
          sessionId: session.id,
          timestamp: msg.timestamp,
          role: msg.role,
          content: msg.content,
          order: msg.order,
        })),
      });

      console.log(`Successfully fetched transcript for session ${session.id} (${messages.length} messages)`);
      successCount++;
    } catch (error) {
      console.error(`Error fetching transcript for session ${session.id}:`, error);
      errorCount++;
    }
  }

  console.log("Transcript fetching complete.");
  console.log(`Successfully fetched: ${successCount} transcripts.`);
  console.log(`Failed to fetch: ${errorCount} transcripts.`);
}

// Run the main function
fetchTranscriptsForSessions()
  .catch((e) => {
    console.error("An error occurred during the script execution:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
