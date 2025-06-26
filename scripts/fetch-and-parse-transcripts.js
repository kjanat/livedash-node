// Script to fetch transcripts and parse them into messages
// Usage: node scripts/fetch-and-parse-transcripts.js

import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";

const prisma = new PrismaClient();

/**
 * Fetches transcript content from a URL
 */
async function fetchTranscriptContent(url, username, password) {
  try {
    const authHeader =
      username && password
        ? "Basic " + Buffer.from(`${username}:${password}`).toString("base64")
        : undefined;

    const response = await fetch(url, {
      headers: authHeader ? { Authorization: authHeader } : {},
      timeout: 10000,
    });

    if (!response.ok) {
      console.log(
        `❌ Failed to fetch ${url}: ${response.status} ${response.statusText}`
      );
      return null;
    }
    return await response.text();
  } catch (error) {
    console.log(`❌ Error fetching ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Parses transcript content into messages
 */
function parseTranscriptToMessages(transcript, sessionId) {
  if (!transcript || transcript.trim() === "") {
    return [];
  }

  const lines = transcript.split("\n").filter((line) => line.trim());
  const messages = [];
  let messageOrder = 0;
  let currentTimestamp = new Date();

  for (const line of lines) {
    // Try format 1: [DD-MM-YYYY HH:MM:SS] Role: Content
    const timestampMatch = line.match(/^\[([^\]]+)\]\s*([^:]+):\s*(.+)$/);

    if (timestampMatch) {
      const [, timestamp, role, content] = timestampMatch;

      // Parse timestamp (DD-MM-YYYY HH:MM:SS)
      const dateMatch = timestamp.match(
        /^(\d{1,2})-(\d{1,2})-(\d{4}) (\d{1,2}):(\d{1,2}):(\d{1,2})$/
      );
      let parsedTimestamp = new Date();

      if (dateMatch) {
        const [, day, month, year, hour, minute, second] = dateMatch;
        parsedTimestamp = new Date(
          parseInt(year),
          parseInt(month) - 1, // Month is 0-indexed
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        );
      }

      messages.push({
        sessionId,
        role: role.trim().toLowerCase(),
        content: content.trim(),
        timestamp: parsedTimestamp,
        order: messageOrder++,
      });
      continue;
    }

    // Try format 2: Role: Content (simple format)
    const simpleMatch = line.match(/^([^:]+):\s*(.+)$/);

    if (simpleMatch) {
      const [, role, content] = simpleMatch;

      // Use incremental timestamps (add 1 minute per message)
      currentTimestamp = new Date(currentTimestamp.getTime() + 60000);

      messages.push({
        sessionId,
        role: role.trim().toLowerCase(),
        content: content.trim(),
        timestamp: new Date(currentTimestamp),
        order: messageOrder++,
      });
    }
  }

  return messages;
}

/**
 * Process sessions without messages
 */
async function fetchAndParseTranscripts() {
  try {
    console.log("🔍 Finding sessions without messages...\n");

    // Get sessions that have fullTranscriptUrl but no messages
    const sessionsWithoutMessages = await prisma.session.findMany({
      where: {
        AND: [
          { fullTranscriptUrl: { not: null } },
          { messages: { none: {} } }, // No messages
        ],
      },
      include: {
        company: true,
      },
      take: 20, // Process 20 at a time to avoid overwhelming
    });

    if (sessionsWithoutMessages.length === 0) {
      console.log(
        "✅ All sessions with transcript URLs already have messages!"
      );
      return;
    }

    console.log(
      `📥 Found ${sessionsWithoutMessages.length} sessions to process\n`
    );

    let successCount = 0;
    let errorCount = 0;

    for (const session of sessionsWithoutMessages) {
      console.log(`📄 Processing session ${session.id.substring(0, 8)}...`);

      try {
        // Fetch transcript content
        const transcriptContent = await fetchTranscriptContent(
          session.fullTranscriptUrl,
          session.company.csvUsername,
          session.company.csvPassword
        );

        if (!transcriptContent) {
          console.log(`   ⚠️  No transcript content available`);
          errorCount++;
          continue;
        }

        // Parse transcript into messages
        const messages = parseTranscriptToMessages(
          transcriptContent,
          session.id
        );

        if (messages.length === 0) {
          console.log(`   ⚠️  No messages found in transcript`);
          errorCount++;
          continue;
        }

        // Save messages to database
        await prisma.message.createMany({
          data: messages,
        });

        console.log(`   ✅ Added ${messages.length} messages`);
        successCount++;
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`   ✅ Successfully processed: ${successCount} sessions`);
    console.log(`   ❌ Failed to process: ${errorCount} sessions`);
    console.log(
      `\n💡 Now you can run the processing scheduler to analyze these sessions!`
    );
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fetchAndParseTranscripts();
