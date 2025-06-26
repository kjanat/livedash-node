import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";

const prisma = new PrismaClient();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

// Define the expected response structure from OpenAI
interface OpenAIProcessedData {
  language: string;
  sentiment: "positive" | "neutral" | "negative";
  escalated: boolean;
  forwarded_hr: boolean;
  category: string;
  questions: string | string[];
  summary: string;
  tokens: number;
  tokens_eur: number;
}

/**
 * Processes a session transcript using OpenAI API
 * @param sessionId The session ID
 * @param transcript The transcript content to process
 * @returns Processed data from OpenAI
 */
async function processTranscriptWithOpenAI(
  sessionId: string,
  transcript: string
): Promise<OpenAIProcessedData> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  // Create a system message with instructions
  const systemMessage = `
    You are an AI assistant tasked with analyzing chat transcripts.
    Extract the following information from the transcript:
    1. The primary language used by the user (ISO 639-1 code)
    2. Overall sentiment (positive, neutral, or negative)
    3. Whether the conversation was escalated
    4. Whether HR contact was mentioned or provided
    5. The best-fitting category for the conversation from this list:
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
    6. A single question or an array of simplified questions asked by the user formulated in English
    7. A brief summary of the conversation (10-300 characters)
    8. The number of tokens used for the API call
    9. The cost of the API call in EUR
    
    Return the data in JSON format matching this schema:
    {
      "language": "ISO 639-1 code",
      "sentiment": "positive|neutral|negative",
      "escalated": boolean,
      "forwarded_hr": boolean,
      "category": "one of the categories listed above",
      "questions": null, or array of questions,
      "summary": "brief summary",
      "tokens": number,
      "tokens_eur": number
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

    const data = (await response.json()) as any;
    const processedData = JSON.parse(data.choices[0].message.content);

    // Validate the response against our expected schema
    validateOpenAIResponse(processedData);

    return processedData;
  } catch (error) {
    console.error(`Error processing transcript with OpenAI:`, error);
    throw error;
  }
}

/**
 * Validates the OpenAI response against our expected schema
 * @param data The data to validate
 */
function validateOpenAIResponse(
  data: any
): asserts data is OpenAIProcessedData {
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
 * Main function to process unprocessed sessions
 */
async function processUnprocessedSessions() {
  console.log("Starting to process unprocessed sessions...");

  // Find sessions that have transcript content but haven't been processed
  const sessionsToProcess = await prisma.session.findMany({
    where: {
      AND: [
        { transcriptContent: { not: null } },
        { transcriptContent: { not: "" } },
        { processed: { not: true } }, // Either false or null
      ],
    },
    select: {
      id: true,
      transcriptContent: true,
    },
  });

  if (sessionsToProcess.length === 0) {
    console.log("No sessions found requiring processing.");
    return;
  }

  console.log(`Found ${sessionsToProcess.length} sessions to process.`);
  let successCount = 0;
  let errorCount = 0;

  for (const session of sessionsToProcess) {
    if (!session.transcriptContent) {
      // Should not happen due to query, but good for type safety
      console.warn(
        `Session ${session.id} has no transcript content, skipping.`
      );
      continue;
    }

    console.log(`Processing transcript for session ${session.id}...`);
    try {
      const processedData = await processTranscriptWithOpenAI(
        session.id,
        session.transcriptContent
      );

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

      console.log(`Successfully processed session ${session.id}.`);
      successCount++;
    } catch (error) {
      console.error(`Error processing session ${session.id}:`, error);
      errorCount++;
    }
  }

  console.log("Session processing complete.");
  console.log(`Successfully processed: ${successCount} sessions.`);
  console.log(`Failed to process: ${errorCount} sessions.`);
}

// Run the main function
processUnprocessedSessions()
  .catch((e) => {
    console.error("An error occurred during the script execution:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
