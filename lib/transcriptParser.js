// Transcript parser utility - converts raw transcript text to structured messages
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Parses chat log string to JSON format with individual messages
 * @param {string} logString - Raw transcript content
 * @returns {Object} Parsed data with messages array and metadata
 */
export function parseChatLogToJSON(logString) {
  // Convert to string if it's not already
  const stringData =
    typeof logString === "string" ? logString : String(logString);

  // Split by lines and filter out empty lines
  const lines = stringData.split("\n").filter((line) => line.trim() !== "");

  const messages = [];
  let currentMessage = null;

  for (const line of lines) {
    // Check if line starts with a timestamp pattern [DD.MM.YYYY HH:MM:SS]
    const timestampMatch = line.match(
      /^\[(\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2})\] (.+?): (.*)$/
    );

    if (timestampMatch) {
      // If we have a previous message, push it to the array
      if (currentMessage) {
        messages.push(currentMessage);
      }

      // Parse the timestamp
      const [, timestamp, sender, content] = timestampMatch;

      // Convert DD.MM.YYYY HH:MM:SS to ISO format
      const [datePart, timePart] = timestamp.split(" ");
      const [day, month, year] = datePart.split(".");
      const [hour, minute, second] = timePart.split(":");

      const dateObject = new Date(year, month - 1, day, hour, minute, second);

      // Create new message object
      currentMessage = {
        timestamp: dateObject.toISOString(),
        role: sender,
        content: content,
      };
    } else if (currentMessage) {
      // This is a continuation of the previous message (multiline)
      currentMessage.content += "\n" + line;
    }
  }

  // Don't forget the last message
  if (currentMessage) {
    messages.push(currentMessage);
  }

  return {
    messages: messages.sort((a, b) => {
      // First sort by timestamp (ascending)
      const timeComparison = new Date(a.timestamp) - new Date(b.timestamp);
      if (timeComparison !== 0) {
        return timeComparison;
      }

      // If timestamps are equal, sort by role (descending)
      // This puts "User" before "Assistant" when timestamps are the same
      return b.role.localeCompare(a.role);
    }),
    totalMessages: messages.length,
  };
}

/**
 * Stores parsed messages in the database for a session
 * @param {string} sessionId - The session ID
 * @param {Array} messages - Array of parsed message objects
 */
export async function storeMessagesForSession(sessionId, messages) {
  try {
    // First, delete any existing messages for this session
    await prisma.message.deleteMany({
      where: { sessionId },
    });

    // Then insert the new messages
    const messageData = messages.map((message, index) => ({
      sessionId,
      timestamp: new Date(message.timestamp),
      role: message.role,
      content: message.content,
      order: index,
    }));

    if (messageData.length > 0) {
      await prisma.message.createMany({
        data: messageData,
      });

      // Extract actual end time from the latest message
      const latestMessage = messages.reduce((latest, current) => {
        return new Date(current.timestamp) > new Date(latest.timestamp)
          ? current
          : latest;
      });

      // Update the session's endTime with the actual conversation end time
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          endTime: new Date(latestMessage.timestamp),
        },
      });

      process.stdout.write(
        `[TranscriptParser] Updated session ${sessionId} endTime to ${latestMessage.timestamp}\n`
      );
    }

    process.stdout.write(
      `[TranscriptParser] Stored ${messageData.length} messages for session ${sessionId}\n`
    );
    return messageData.length;
  } catch (error) {
    process.stderr.write(
      `[TranscriptParser] Error storing messages for session ${sessionId}: ${error}\n`
    );
    throw error;
  }
}

/**
 * Processes and stores transcript for a single session
 * @param {string} sessionId - The session ID
 * @param {string} transcriptContent - Raw transcript content
 * @returns {Promise<Object>} Processing result with message count
 */
export async function processTranscriptForSession(
  sessionId,
  transcriptContent
) {
  if (!transcriptContent || transcriptContent.trim() === "") {
    throw new Error("No transcript content provided");
  }

  try {
    // Parse the transcript
    const parsed = parseChatLogToJSON(transcriptContent);

    // Store messages in database
    const messageCount = await storeMessagesForSession(
      sessionId,
      parsed.messages
    );

    return {
      sessionId,
      messageCount,
      totalMessages: parsed.totalMessages,
      success: true,
    };
  } catch (error) {
    process.stderr.write(
      `[TranscriptParser] Error processing transcript for session ${sessionId}: ${error}\n`
    );
    throw error;
  }
}

/**
 * Processes transcripts for all sessions that have transcript content but no parsed messages
 */
export async function processAllUnparsedTranscripts() {
  process.stdout.write(
    "[TranscriptParser] Starting to process unparsed transcripts...\n"
  );

  try {
    // Find sessions with transcript content but no messages
    const sessionsToProcess = await prisma.session.findMany({
      where: {
        AND: [
          { transcriptContent: { not: null } },
          { transcriptContent: { not: "" } },
        ],
      },
      include: {
        messages: true,
      },
    });

    // Filter to only sessions without messages
    const unparsedSessions = sessionsToProcess.filter(
      (session) => session.messages.length === 0
    );

    if (unparsedSessions.length === 0) {
      process.stdout.write(
        "[TranscriptParser] No unparsed transcripts found.\n"
      );
      return { processed: 0, errors: 0 };
    }

    process.stdout.write(
      `[TranscriptParser] Found ${unparsedSessions.length} sessions with unparsed transcripts.\n`
    );

    let successCount = 0;
    let errorCount = 0;

    for (const session of unparsedSessions) {
      try {
        const result = await processTranscriptForSession(
          session.id,
          session.transcriptContent
        );
        process.stdout.write(
          `[TranscriptParser] Processed session ${session.id}: ${result.messageCount} messages\n`
        );
        successCount++;
      } catch (error) {
        process.stderr.write(
          `[TranscriptParser] Failed to process session ${session.id}: ${error}\n`
        );
        errorCount++;
      }
    }

    process.stdout.write(
      `[TranscriptParser] Completed processing. Success: ${successCount}, Errors: ${errorCount}\n`
    );
    return { processed: successCount, errors: errorCount };
  } catch (error) {
    process.stderr.write(
      `[TranscriptParser] Error in processAllUnparsedTranscripts: ${error}\n`
    );
    throw error;
  }
}

/**
 * Gets parsed messages for a session
 * @param {string} sessionId - The session ID
 * @returns {Promise<Array>} Array of message objects
 */
export async function getMessagesForSession(sessionId) {
  try {
    const messages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { order: "asc" },
    });

    return messages;
  } catch (error) {
    process.stderr.write(
      `[TranscriptParser] Error getting messages for session ${sessionId}: ${error}\n`
    );
    throw error;
  }
}
