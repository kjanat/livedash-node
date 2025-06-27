// Session processing scheduler with configurable intervals and batch sizes
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";
import { getSchedulerConfig } from "./schedulerConfig";

const prisma = new PrismaClient();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface ProcessedData {
  language: string;
  messages_sent: number;
  sentiment: "positive" | "neutral" | "negative";
  escalated: boolean;
  forwarded_hr: boolean;
  category: string;
  questions: string[];
  summary: string;
  session_id: string;
}

interface ProcessingResult {
  sessionId: string;
  success: boolean;
  error?: string;
}

/**
 * Processes a session transcript using OpenAI API
 */
async function processTranscriptWithOpenAI(sessionId: string, transcript: string): Promise<ProcessedData> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  // Create a system message with instructions
  const systemMessage = `
    You are an AI assistant tasked with analyzing chat transcripts.
    Extract the following information from the transcript:
    1. The primary language used by the user (ISO 639-1 code)
    2. Number of messages sent by the user
    3. Overall sentiment (positive, neutral, or negative)
    4. Whether the conversation was escalated
    5. Whether HR contact was mentioned or provided
    6. The best-fitting category for the conversation from this list:
       - Schedule & Hours
       - Leave & Vacation
       - Sick Leave & Recovery
       - Salary & Compensation
       - Contract & Hours
       - Onboarding
       - Offboarding
       - Workwear & Staff Pass
       - Team & Contacts
       - Personal Questions
       - Access & Login
       - Social questions
       - Unrecognized / Other
    7. Up to 5 paraphrased questions asked by the user (in English)
    8. A brief summary of the conversation (10-300 characters)
    
    Return the data in JSON format matching this schema:
    {
      "language": "ISO 639-1 code",
      "messages_sent": number,
      "sentiment": "positive|neutral|negative",
      "escalated": boolean,
      "forwarded_hr": boolean,
      "category": "one of the categories listed above",
      "questions": ["question 1", "question 2", ...],
      "summary": "brief summary",
      "session_id": "${sessionId}"
    }
  `;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: systemMessage,
          },
          {
            role: "user",
            content: transcript,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data: any = await response.json();
    const processedData = JSON.parse(data.choices[0].message.content);

    // Validate the response against our expected schema
    validateOpenAIResponse(processedData);

    return processedData;
  } catch (error) {
    process.stderr.write(`Error processing transcript with OpenAI: ${error}\n`);
    throw error;
  }
}

/**
 * Validates the OpenAI response against our expected schema
 */
function validateOpenAIResponse(data: any): void {
  // Check required fields
  const requiredFields = [
    "language",
    "messages_sent",
    "sentiment",
    "escalated",
    "forwarded_hr",
    "category",
    "questions",
    "summary",
    "session_id",
  ];

  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate field types
  if (typeof data.language !== "string" || !/^[a-z]{2}$/.test(data.language)) {
    throw new Error(
      "Invalid language format. Expected ISO 639-1 code (e.g., 'en')"
    );
  }

  if (typeof data.messages_sent !== "number" || data.messages_sent < 0) {
    throw new Error("Invalid messages_sent. Expected non-negative number");
  }

  if (!["positive", "neutral", "negative"].includes(data.sentiment)) {
    throw new Error(
      "Invalid sentiment. Expected 'positive', 'neutral', or 'negative'"
    );
  }

  if (typeof data.escalated !== "boolean") {
    throw new Error("Invalid escalated. Expected boolean");
  }

  if (typeof data.forwarded_hr !== "boolean") {
    throw new Error("Invalid forwarded_hr. Expected boolean");
  }

  const validCategories = [
    "Schedule & Hours",
    "Leave & Vacation",
    "Sick Leave & Recovery",
    "Salary & Compensation",
    "Contract & Hours",
    "Onboarding",
    "Offboarding",
    "Workwear & Staff Pass",
    "Team & Contacts",
    "Personal Questions",
    "Access & Login",
    "Social questions",
    "Unrecognized / Other",
  ];

  if (!validCategories.includes(data.category)) {
    throw new Error(
      `Invalid category. Expected one of: ${validCategories.join(", ")}`
    );
  }

  if (!Array.isArray(data.questions)) {
    throw new Error("Invalid questions. Expected array of strings");
  }

  if (
    typeof data.summary !== "string" ||
    data.summary.length < 10 ||
    data.summary.length > 300
  ) {
    throw new Error(
      "Invalid summary. Expected string between 10-300 characters"
    );
  }

  if (typeof data.session_id !== "string") {
    throw new Error("Invalid session_id. Expected string");
  }
}

/**
 * Process a single session
 */
async function processSingleSession(session: any): Promise<ProcessingResult> {
  if (session.messages.length === 0) {
    return {
      sessionId: session.id,
      success: false,
      error: "Session has no messages",
    };
  }

  try {
    // Convert messages back to transcript format for OpenAI processing
    const transcript = session.messages
      .map(
        (msg: any) =>
          `[${new Date(msg.timestamp)
            .toLocaleString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
            .replace(",", "")}] ${msg.role}: ${msg.content}`
      )
      .join("\n");

    const processedData = await processTranscriptWithOpenAI(
      session.id,
      transcript
    );

    // Map sentiment string to float value for compatibility with existing data
    const sentimentMap = {
      positive: 0.8,
      neutral: 0.0,
      negative: -0.8,
    };

    // Update the session with processed data
    await prisma.session.update({
      where: { id: session.id },
      data: {
        language: processedData.language,
        messagesSent: processedData.messages_sent,
        sentiment: sentimentMap[processedData.sentiment] || 0,
        sentimentCategory: processedData.sentiment.toUpperCase() as "POSITIVE" | "NEUTRAL" | "NEGATIVE",
        escalated: processedData.escalated,
        forwardedHr: processedData.forwarded_hr,
        category: processedData.category,
        questions: JSON.stringify(processedData.questions),
        summary: processedData.summary,
        processed: true,
      },
    });

    return {
      sessionId: session.id,
      success: true,
    };
  } catch (error) {
    return {
      sessionId: session.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process sessions in parallel with concurrency limit
 */
async function processSessionsInParallel(sessions: any[], maxConcurrency: number = 5): Promise<ProcessingResult[]> {
  const results: Promise<ProcessingResult>[] = [];
  const executing: Promise<ProcessingResult>[] = [];

  for (const session of sessions) {
    const promise = processSingleSession(session).then((result) => {
      process.stdout.write(
        result.success
          ? `[ProcessingScheduler] ✓ Successfully processed session ${result.sessionId}\n`
          : `[ProcessingScheduler] ✗ Failed to process session ${result.sessionId}: ${result.error}\n`
      );
      return result;
    });

    results.push(promise);
    executing.push(promise);

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
      const completedIndex = executing.findIndex(p => p === promise);
      if (completedIndex !== -1) {
        executing.splice(completedIndex, 1);
      }
    }
  }

  return Promise.all(results);
}

/**
 * Process unprocessed sessions
 */
export async function processUnprocessedSessions(batchSize: number | null = null, maxConcurrency: number = 5): Promise<void> {
  process.stdout.write(
    "[ProcessingScheduler] Starting to process unprocessed sessions...\n"
  );

  // Find sessions that have messages but haven't been processed
  const queryOptions: any = {
    where: {
      AND: [
        { messages: { some: {} } }, // Must have messages
        { processed: false }, // Only unprocessed sessions
      ],
    },
    include: {
      messages: {
        orderBy: { order: "asc" },
      },
    },
  };

  // Add batch size limit if specified
  if (batchSize && batchSize > 0) {
    queryOptions.take = batchSize;
  }

  const sessionsToProcess = await prisma.session.findMany(queryOptions);

  // Filter to only sessions that have messages
  const sessionsWithMessages = sessionsToProcess.filter(
    (session: any) => session.messages && session.messages.length > 0
  );

  if (sessionsWithMessages.length === 0) {
    process.stdout.write(
      "[ProcessingScheduler] No sessions found requiring processing.\n"
    );
    return;
  }

  process.stdout.write(
    `[ProcessingScheduler] Found ${sessionsWithMessages.length} sessions to process (max concurrency: ${maxConcurrency}).\n`
  );

  const startTime = Date.now();
  const results = await processSessionsInParallel(sessionsWithMessages, maxConcurrency);
  const endTime = Date.now();

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  process.stdout.write("[ProcessingScheduler] Session processing complete.\n");
  process.stdout.write(
    `[ProcessingScheduler] Successfully processed: ${successCount} sessions.\n`
  );
  process.stdout.write(
    `[ProcessingScheduler] Failed to process: ${errorCount} sessions.\n`
  );
  process.stdout.write(
    `[ProcessingScheduler] Total processing time: ${((endTime - startTime) / 1000).toFixed(2)}s\n`
  );
}

/**
 * Start the processing scheduler with configurable settings
 */
export function startProcessingScheduler(): void {
  const config = getSchedulerConfig();
  
  if (!config.enabled) {
    console.log('[Processing Scheduler] Disabled via configuration');
    return;
  }

  console.log(`[Processing Scheduler] Starting with interval: ${config.sessionProcessing.interval}`);
  console.log(`[Processing Scheduler] Batch size: ${config.sessionProcessing.batchSize === 0 ? 'unlimited' : config.sessionProcessing.batchSize}`);
  console.log(`[Processing Scheduler] Concurrency: ${config.sessionProcessing.concurrency}`);

  cron.schedule(config.sessionProcessing.interval, async () => {
    try {
      await processUnprocessedSessions(
        config.sessionProcessing.batchSize === 0 ? null : config.sessionProcessing.batchSize,
        config.sessionProcessing.concurrency
      );
    } catch (error) {
      process.stderr.write(
        `[ProcessingScheduler] Error in scheduler: ${error}\n`
      );
    }
  });
}
