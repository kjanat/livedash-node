// Transcript parsing utility for converting raw transcript content into structured messages
import { prisma } from "./prisma";

export interface ParsedMessage {
  sessionId: string;
  timestamp: Date;
  role: string;
  content: string;
  order: number;
}

export interface TranscriptParseResult {
  success: boolean;
  messages?: ParsedMessage[];
  error?: string;
}

/**
 * Parse European date format (DD.MM.YYYY HH:mm:ss) to Date object
 */
function parseEuropeanDate(dateStr: string): Date {
  const match = dateStr.match(
    /(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})/
  );
  if (!match) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  const [, day, month, year, hour, minute, second] = match;
  return new Date(
    Number.parseInt(year, 10),
    Number.parseInt(month, 10) - 1, // JavaScript months are 0-indexed
    Number.parseInt(day, 10),
    Number.parseInt(hour, 10),
    Number.parseInt(minute, 10),
    Number.parseInt(second, 10)
  );
}

/**
 * Parse a single line for timestamp and role pattern
 */
function parseTimestampRoleLine(line: string): {
  type: "timestamp-role";
  timestamp: string;
  role: string;
  content: string;
} | null {
  const timestampRoleMatch = line.match(
    /^\[(\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2})\]\s+(User|Assistant|System|user|assistant|system):\s*(.*)$/i
  );

  if (timestampRoleMatch) {
    return {
      type: "timestamp-role",
      timestamp: timestampRoleMatch[1],
      role:
        timestampRoleMatch[2].charAt(0).toUpperCase() +
        timestampRoleMatch[2].slice(1).toLowerCase(),
      content: timestampRoleMatch[3] || "",
    };
  }
  return null;
}

/**
 * Parse a single line for role pattern only
 */
function parseRoleLine(line: string): {
  type: "role";
  role: string;
  content: string;
} | null {
  const roleMatch = line.match(
    /^(User|Assistant|System|user|assistant|system):\s*(.*)$/i
  );

  if (roleMatch) {
    return {
      type: "role",
      role:
        roleMatch[1].charAt(0).toUpperCase() +
        roleMatch[1].slice(1).toLowerCase(),
      content: roleMatch[2] || "",
    };
  }
  return null;
}

/**
 * Save current message to messages array
 */
function saveCurrentMessage(
  currentMessage: { role: string; content: string; timestamp?: string } | null,
  messages: ParsedMessage[],
  order: number
): number {
  if (currentMessage) {
    messages.push({
      sessionId: "", // Will be set by caller
      timestamp: new Date(), // Will be calculated later
      role: currentMessage.role,
      content: currentMessage.content.trim(),
      order,
    });
    return order + 1;
  }
  return order;
}

/**
 * Calculate timestamp for a message using distributed timing
 */
function calculateDistributedTimestamp(
  startTime: Date,
  endTime: Date,
  index: number,
  totalMessages: number
): Date {
  const sessionDurationMs = endTime.getTime() - startTime.getTime();
  const messageInterval =
    totalMessages > 1 ? sessionDurationMs / (totalMessages - 1) : 0;
  return new Date(startTime.getTime() + index * messageInterval);
}

/**
 * Process timestamp calculations for all messages
 */
function processMessageTimestamps(
  messages: ParsedMessage[],
  startTime: Date,
  endTime: Date
): void {
  interface MessageWithTimestamp extends Omit<ParsedMessage, "timestamp"> {
    timestamp: Date | string;
  }

  const hasTimestamps = messages.some(
    (msg) => (msg as MessageWithTimestamp).timestamp
  );

  if (hasTimestamps) {
    // Use parsed timestamps from the transcript
    messages.forEach((message, index) => {
      const msgWithTimestamp = message as MessageWithTimestamp;
      if (
        msgWithTimestamp.timestamp &&
        typeof msgWithTimestamp.timestamp === "string"
      ) {
        try {
          message.timestamp = parseEuropeanDate(msgWithTimestamp.timestamp);
        } catch {
          // Fallback to distributed timestamp if parsing fails
          message.timestamp = calculateDistributedTimestamp(
            startTime,
            endTime,
            index,
            messages.length
          );
        }
      } else {
        // Fallback to distributed timestamp
        message.timestamp = calculateDistributedTimestamp(
          startTime,
          endTime,
          index,
          messages.length
        );
      }
    });
  } else {
    // Distribute messages across session duration
    messages.forEach((message, index) => {
      message.timestamp = calculateDistributedTimestamp(
        startTime,
        endTime,
        index,
        messages.length
      );
    });
  }
}

/**
 * Parse raw transcript content into structured messages
 * @param content Raw transcript content
 * @param startTime Session start time
 * @param endTime Session end time
 * @returns Parsed messages with timestamps
 */
export function parseTranscriptToMessages(
  content: string,
  startTime: Date,
  endTime: Date
): TranscriptParseResult {
  try {
    if (!content || !content.trim()) {
      return {
        success: false,
        error: "Empty transcript content",
      };
    }

    const messages: ParsedMessage[] = [];
    const lines = content.split("\n");
    let currentMessage: {
      role: string;
      content: string;
      timestamp?: string;
    } | null = null;
    let order = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) {
        continue;
      }

      // Try parsing timestamp + role pattern first
      const timestampRoleResult = parseTimestampRoleLine(trimmedLine);
      if (timestampRoleResult) {
        // Save previous message if exists
        order = saveCurrentMessage(currentMessage, messages, order);

        // Start new message with timestamp
        currentMessage = {
          role: timestampRoleResult.role,
          content: timestampRoleResult.content,
          timestamp: timestampRoleResult.timestamp,
        };
        continue;
      }

      // Try parsing role-only pattern
      const roleResult = parseRoleLine(trimmedLine);
      if (roleResult) {
        // Save previous message if exists
        order = saveCurrentMessage(currentMessage, messages, order);

        // Start new message without timestamp
        currentMessage = {
          role: roleResult.role,
          content: roleResult.content,
        };
        continue;
      }

      // Continue previous message (multi-line) or skip orphaned content
      if (currentMessage) {
        currentMessage.content += `\n${trimmedLine}`;
      }
    }

    // Save the last message
    saveCurrentMessage(currentMessage, messages, order);

    if (messages.length === 0) {
      return {
        success: false,
        error: "No messages found in transcript",
      };
    }

    // Calculate timestamps for all messages
    processMessageTimestamps(messages, startTime, endTime);

    return {
      success: true,
      messages,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Store parsed messages in the database for a session
 * @param sessionId The session ID
 * @param messages Array of parsed messages
 */
export async function storeMessagesForSession(
  sessionId: string,
  messages: ParsedMessage[]
): Promise<void> {
  // Delete existing messages for this session (in case of re-processing)
  await prisma.message.deleteMany({
    where: { sessionId },
  });

  // Create new messages
  const messagesWithSessionId = messages.map((msg) => ({
    ...msg,
    sessionId,
  }));

  await prisma.message.createMany({
    data: messagesWithSessionId,
  });
}

/**
 * Process transcript for a single session
 * @param sessionId The session ID to process
 */
export async function processSessionTranscript(
  sessionId: string
): Promise<void> {
  // Get the session and its import data
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      import: true,
    },
  });

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (!session.import) {
    throw new Error(`No import data found for session: ${sessionId}`);
  }

  if (!session.import.rawTranscriptContent) {
    throw new Error(`No transcript content found for session: ${sessionId}`);
  }

  // Parse the start and end times
  const startTime = parseEuropeanDate(session.import.startTimeRaw);
  const endTime = parseEuropeanDate(session.import.endTimeRaw);

  // Parse the transcript
  const parseResult = parseTranscriptToMessages(
    session.import.rawTranscriptContent,
    startTime,
    endTime
  );

  if (!parseResult.success) {
    throw new Error(`Failed to parse transcript: ${parseResult.error}`);
  }

  // Store the messages
  if (parseResult.messages) {
    await storeMessagesForSession(sessionId, parseResult.messages);
  }

  console.log(
    `✅ Processed ${parseResult.messages?.length} messages for session ${sessionId}`
  );
}

/**
 * Process all sessions that have transcript content but no messages
 */
export async function processAllUnparsedTranscripts(): Promise<void> {
  console.log("🔍 Finding sessions with unparsed transcripts...");

  // Find sessions that have transcript content but no messages
  const sessionsToProcess = await prisma.session.findMany({
    where: {
      import: {
        rawTranscriptContent: {
          not: null,
        },
      },
      messages: {
        none: {},
      },
    },
    include: {
      import: true,
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });

  console.log(`📋 Found ${sessionsToProcess.length} sessions to process`);

  let processed = 0;
  let errors = 0;

  for (const session of sessionsToProcess) {
    try {
      await processSessionTranscript(session.id);
      processed++;
    } catch (error) {
      console.error(`❌ Error processing session ${session.id}:`, error);
      errors++;
    }
  }

  console.log("\n📊 Processing complete:");
  console.log(`  ✅ Successfully processed: ${processed} sessions`);
  console.log(`  ❌ Errors: ${errors} sessions`);
  console.log(`  📝 Total messages created: ${await getTotalMessageCount()}`);
}

/**
 * Get total count of messages in the database
 */
export async function getTotalMessageCount(): Promise<number> {
  const result = await prisma.message.count();
  return result;
}

/**
 * Get messages for a specific session
 * @param sessionId The session ID
 * @returns Array of messages ordered by order field
 */
export async function getMessagesForSession(sessionId: string) {
  return await prisma.message.findMany({
    where: { sessionId },
    orderBy: { order: "asc" },
  });
}

/**
 * Get parsing statistics
 */
export async function getParsingStats() {
  const totalSessions = await prisma.session.count();
  const sessionsWithTranscripts = await prisma.session.count({
    where: {
      import: {
        rawTranscriptContent: {
          not: null,
        },
      },
    },
  });
  const sessionsWithMessages = await prisma.session.count({
    where: {
      messages: {
        some: {},
      },
    },
  });
  const totalMessages = await getTotalMessageCount();

  return {
    totalSessions,
    sessionsWithTranscripts,
    sessionsWithMessages,
    unparsedSessions: sessionsWithTranscripts - sessionsWithMessages,
    totalMessages,
  };
}
