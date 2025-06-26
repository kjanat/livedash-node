// Session processing scheduler - JavaScript version
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

try {
  const envFile = readFileSync(envPath, 'utf8');
  const envVars = envFile.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  envVars.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
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

/**
 * Processes a session transcript using OpenAI API
 * @param {string} sessionId The session ID
 * @param {string} transcript The transcript content to process
 * @returns {Promise<Object>} Processed data from OpenAI
 */
async function processTranscriptWithOpenAI(sessionId, transcript) {
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

    const data = await response.json();
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
 * @param {Object} data The data to validate
 */
function validateOpenAIResponse(data) {
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
 * Process unprocessed sessions
 */
export async function processUnprocessedSessions() {
  process.stdout.write(
    "[ProcessingScheduler] Starting to process unprocessed sessions...\n"
  );

  // Find sessions that have messages but haven't been processed
  const sessionsToProcess = await prisma.session.findMany({
    where: {
      AND: [
        { messages: { some: {} } }, // Must have messages
        { 
          OR: [
            { processed: false },
            { processed: null }
          ]
        }
      ],
    },
    include: {
      messages: {
        orderBy: { order: "asc" },
      },
    },
    take: 10, // Process in batches to avoid overloading the system
  });

  // Filter to only sessions that have messages
  const sessionsWithMessages = sessionsToProcess.filter(
    (session) => session.messages.length > 0
  );

  if (sessionsWithMessages.length === 0) {
    process.stdout.write(
      "[ProcessingScheduler] No sessions found requiring processing.\n"
    );
    return;
  }

  process.stdout.write(
    `[ProcessingScheduler] Found ${sessionsWithMessages.length} sessions to process.\n`
  );
  let successCount = 0;
  let errorCount = 0;

  for (const session of sessionsWithMessages) {
    if (session.messages.length === 0) {
      process.stderr.write(
        `[ProcessingScheduler] Session ${session.id} has no messages, skipping.\n`
      );
      continue;
    }

    process.stdout.write(
      `[ProcessingScheduler] Processing messages for session ${session.id}...\n`
    );
    try {
      // Convert messages back to transcript format for OpenAI processing
      const transcript = session.messages
        .map(
          (msg) =>
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
          sentimentCategory: processedData.sentiment,
          escalated: processedData.escalated,
          forwardedHr: processedData.forwarded_hr,
          category: processedData.category,
          questions: JSON.stringify(processedData.questions),
          summary: processedData.summary,
          processed: true,
        },
      });

      process.stdout.write(
        `[ProcessingScheduler] Successfully processed session ${session.id}.\n`
      );
      successCount++;
    } catch (error) {
      process.stderr.write(
        `[ProcessingScheduler] Error processing session ${session.id}: ${error}\n`
      );
      errorCount++;
    }
  }

  process.stdout.write("[ProcessingScheduler] Session processing complete.\n");
  process.stdout.write(
    `[ProcessingScheduler] Successfully processed: ${successCount} sessions.\n`
  );
  process.stdout.write(
    `[ProcessingScheduler] Failed to process: ${errorCount} sessions.\n`
  );
}

/**
 * Start the processing scheduler
 */
export function startProcessingScheduler() {
  // Process unprocessed sessions every hour
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
}
