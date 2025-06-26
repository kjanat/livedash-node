// Session processing scheduler - TypeScript version
// Note: Disabled due to Next.js compatibility issues
// import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { VALID_CATEGORIES, ValidCategory, SentimentCategory } from "./types";

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "..", ".env.local");

try {
  const envFile = readFileSync(envPath, "utf8");
  const envVars = envFile
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"));

  envVars.forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      const value = valueParts.join("=").trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
} catch (error) {
  // Silently fail if .env.local doesn't exist
}

const prisma = new PrismaClient();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface ProcessedData {
  language: string;
  sentiment: "positive" | "neutral" | "negative";
  escalated: boolean;
  forwarded_hr: boolean;
  category: ValidCategory;
  questions: string | string[];
  summary: string;
  tokens: number;
  tokens_eur: number;
}

interface ProcessingResult {
  sessionId: string;
  success: boolean;
  error?: string;
}

/**
 * Processes a session transcript using OpenAI API
 */
async function processTranscriptWithOpenAI(
  sessionId: string,
  transcript: string
): Promise<ProcessedData> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  // Create a system message with instructions
  const systemMessage = `
System: You are a JSON-generating assistant. Your task is to analyze raw chat transcripts between a user and an assistant and return structured data.

⚠️ IMPORTANT:
- You must return a **single, valid JSON object**.
- Do **not** include markdown formatting, code fences, explanations, or comments.
- The JSON must match the exact structure and constraints described below.

Here is the schema you must follow:

{{
"language": "ISO 639-1 code, e.g., 'en', 'nl'",
"sentiment": "'positive', 'neutral', or 'negative'",
"escalated": "bool: true if the assistant connected or referred to a human agent, otherwise false",
"forwarded_hr": "bool: true if HR contact info was given, otherwise false",
"category": "one of: 'Schedule & Hours', 'Leave & Vacation', 'Sick Leave & Recovery', 'Salary & Compensation', 'Contract & Hours', 'Onboarding', 'Offboarding', 'Workwear & Staff Pass', 'Team & Contacts', 'Personal Questions', 'Access & Login', 'Social questions', 'Unrecognized / Other'",
"questions": "a single question or an array of simplified questions asked by the user formulated in English, try to make a question out of messages",
"summary": "Brief summary (1–2 sentences) of the conversation",
"tokens": "integer, number of tokens used for the API call",
"tokens_eur": "float, cost of the API call in EUR",
}}

You must format your output as a JSON value that adheres to a given "JSON Schema" instance.

"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.

For example, the example "JSON Schema" instance {"properties": {"foo": {"description": "a list of test words", "type": "array", "items": {"type": "string"}}}}, "required": ["foo"]}}
would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.
Thus, the object {"foo": ["bar", "baz"]} is a well-formatted instance of this example "JSON Schema". The object {"properties": {"foo": ["bar", "baz"]}} is not well-formatted.

Your output will be parsed and type-checked according to the provided schema instance, so make sure all fields in your output match the schema exactly and there are no trailing commas!

Here is the JSON Schema instance your output must adhere to. Include the enclosing markdown codeblock:

{{"type":"object","properties":{"language":{"type":"string","pattern":"^[a-z]{2}$","description":"ISO 639-1 code for the user's primary language"},"sentiment":{"type":"string","enum":["positive","neutral","negative"],"description":"Overall tone of the user during the conversation"},"escalated":{"type":"boolean","description":"Whether the assistant indicated it could not help"},"forwarded_hr":{"type":"boolean","description":"Whether HR contact was mentioned or provided"},"category":{"type":"string","enum":["Schedule & Hours","Leave & Vacation","Sick Leave & Recovery","Salary & Compensation","Contract & Hours","Onboarding","Offboarding","Workwear & Staff Pass","Team & Contacts","Personal Questions","Access & Login","Social questions","Unrecognized / Other"],"description":"Best-fitting topic category for the conversation"},"questions":{"oneOf":[{"type":"string"},{"type":"array","items":{"type":"string"}}],"description":"A single question or a list of paraphrased questions asked by the user in English"},"summary":{"type":"string","minLength":10,"maxLength":300,"description":"Brief summary of the conversation"},"tokens":{"type":"integer","description":"Number of tokens used for the API call"},"tokens_eur":{"type":"number","description":"Cost of the API call in EUR"}},"required":["language","sentiment","escalated","forwarded_hr","category","questions","summary","tokens","tokens_eur"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}
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
    "sentiment",
    "escalated",
    "forwarded_hr",
    "category",
    "questions",
    "summary",
    "tokens",
    "tokens_eur",
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

  if (!VALID_CATEGORIES.includes(data.category)) {
    throw new Error(
      `Invalid category. Expected one of: ${VALID_CATEGORIES.join(", ")}`
    );
  }

  if (typeof data.questions !== "string" && !Array.isArray(data.questions)) {
    throw new Error("Invalid questions. Expected string or array of strings");
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

  if (typeof data.tokens !== "number" || data.tokens < 0) {
    throw new Error("Invalid tokens. Expected non-negative number");
  }

  if (typeof data.tokens_eur !== "number" || data.tokens_eur < 0) {
    throw new Error("Invalid tokens_eur. Expected non-negative number");
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

  // Check for minimum data quality requirements
  const userMessages = session.messages.filter((msg: any) =>
    msg.role.toLowerCase() === 'user' || msg.role.toLowerCase() === 'human'
  );

  if (userMessages.length === 0) {
    // Mark as invalid data - no user interaction
    await prisma.session.update({
      where: { id: session.id },
      data: {
        processed: true,
        summary: "No user messages found - marked as invalid data",
      },
    });

    return {
      sessionId: session.id,
      success: true,
      error: "No user messages - marked as invalid data",
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

    // Check if the processed data indicates low quality (empty questions, very short summary, etc.)
    const hasValidQuestions =
      processedData.questions &&
      (Array.isArray(processedData.questions)
        ? processedData.questions.length > 0
        : typeof processedData.questions === "string");
    const hasValidSummary = processedData.summary && processedData.summary.length >= 10;
    const isValidData = hasValidQuestions && hasValidSummary;

    // Update the session with processed data
    await prisma.session.update({
      where: { id: session.id },
      data: {
        language: processedData.language,
        sentiment: processedData.sentiment,
        escalated: processedData.escalated,
        forwardedHr: processedData.forwarded_hr,
        category: processedData.category,
        questions: processedData.questions,
        summary: processedData.summary,
        tokens: {
          increment: processedData.tokens,
        },
        tokensEur: {
          increment: processedData.tokens_eur,
        },
        processed: true,
      },
    });

    if (!isValidData) {
      process.stdout.write(
        `[ProcessingScheduler] ⚠️ Session ${session.id} marked as invalid data (empty questions or short summary)\n`
      );
    }

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
async function processSessionsInParallel(
  sessions: any[],
  maxConcurrency: number = 5
): Promise<ProcessingResult[]> {
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
      const completedIndex = executing.findIndex((p) => p === promise);
      if (completedIndex !== -1) {
        executing.splice(completedIndex, 1);
      }
    }
  }

  return Promise.all(results);
}

/**
 * Process unprocessed sessions in batches until completion
 */
export async function processUnprocessedSessions(
  batchSize: number = 10,
  maxConcurrency: number = 5
): Promise<{ totalProcessed: number; totalFailed: number; totalTime: number }> {
  process.stdout.write(
    "[ProcessingScheduler] Starting complete processing of all unprocessed sessions...\n"
  );

  let totalProcessed = 0;
  let totalFailed = 0;
  const overallStartTime = Date.now();
  let batchNumber = 1;

  while (true) {
    // Find sessions that have messages but haven't been processed
    const sessionsToProcess = await prisma.session.findMany({
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
      take: batchSize,
    });

    // Filter to only sessions that have messages
    const sessionsWithMessages = sessionsToProcess.filter(
      (session: any) => session.messages && session.messages.length > 0
    );

    if (sessionsWithMessages.length === 0) {
      process.stdout.write(
        "[ProcessingScheduler] ✅ All sessions with messages have been processed!\n"
      );
      break;
    }

    process.stdout.write(
      `[ProcessingScheduler] 📦 Batch ${batchNumber}: Processing ${sessionsWithMessages.length} sessions (max concurrency: ${maxConcurrency})...\n`
    );

    const batchStartTime = Date.now();
    const results = await processSessionsInParallel(
      sessionsWithMessages,
      maxConcurrency
    );
    const batchEndTime = Date.now();

    const batchSuccessCount = results.filter((r) => r.success).length;
    const batchErrorCount = results.filter((r) => !r.success).length;

    totalProcessed += batchSuccessCount;
    totalFailed += batchErrorCount;

    process.stdout.write(
      `[ProcessingScheduler] 📦 Batch ${batchNumber} complete: ${batchSuccessCount} success, ${batchErrorCount} failed (${((batchEndTime - batchStartTime) / 1000).toFixed(2)}s)\n`
    );

    batchNumber++;

    // Small delay between batches to prevent overwhelming the system
    if (sessionsWithMessages.length === batchSize) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const overallEndTime = Date.now();
  const totalTime = (overallEndTime - overallStartTime) / 1000;

  process.stdout.write("[ProcessingScheduler] 🎉 Complete processing finished!\n");
  process.stdout.write(
    `[ProcessingScheduler] 📊 Total results: ${totalProcessed} processed, ${totalFailed} failed\n`
  );
  process.stdout.write(
    `[ProcessingScheduler] ⏱️ Total processing time: ${totalTime.toFixed(2)}s\n`
  );

  return { totalProcessed, totalFailed, totalTime };
}

/**
 * Start the processing scheduler
 */
export function startProcessingScheduler(): void {
  // Note: Scheduler disabled due to Next.js compatibility issues
  // Use manual triggers via API endpoints instead
  console.log("Processing scheduler disabled - using manual triggers via API endpoints");

  // Original cron-based implementation commented out due to Next.js compatibility issues
  // The functionality is now available via the /api/admin/trigger-processing endpoint
  /*
  cron.schedule("0 * * * *", async () => {
    try {
      await processUnprocessedSessions();
    } catch (error) {
      process.stderr.write(
        `[ProcessingScheduler] Error in scheduler: ${error}\n`
      );
    }
  });

  process.stdout.write(
    "[ProcessingScheduler] Started processing scheduler (runs hourly).\n"
  );
  */
}
