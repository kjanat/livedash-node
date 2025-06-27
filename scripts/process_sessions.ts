import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";

const prisma = new PrismaClient();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

// Define the expected response structure from OpenAI
interface OpenAIProcessedData {
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

/**
 * Fetches transcript content from a URL
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
 * Processes a session transcript using OpenAI API
 */
async function processTranscriptWithOpenAI(
  sessionId: string,
  transcript: string
): Promise<OpenAIProcessedData> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

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
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as any;
    const processedData = JSON.parse(data.choices[0].message.content);

    validateOpenAIResponse(processedData);
    return processedData;
  } catch (error) {
    console.error(`Error processing transcript with OpenAI:`, error);
    throw error;
  }
}

/**
 * Validates the OpenAI response against our expected schema
 */
function validateOpenAIResponse(data: any): asserts data is OpenAIProcessedData {
  const requiredFields = [
    "language", "messages_sent", "sentiment", "escalated", 
    "forwarded_hr", "category", "questions", "summary", "session_id"
  ];

  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (typeof data.language !== "string" || !/^[a-z]{2}$/.test(data.language)) {
    throw new Error("Invalid language format. Expected ISO 639-1 code (e.g., 'en')");
  }

  if (typeof data.messages_sent !== "number" || data.messages_sent < 0) {
    throw new Error("Invalid messages_sent. Expected non-negative number");
  }

  if (!["positive", "neutral", "negative"].includes(data.sentiment)) {
    throw new Error("Invalid sentiment. Expected 'positive', 'neutral', or 'negative'");
  }

  if (typeof data.escalated !== "boolean") {
    throw new Error("Invalid escalated. Expected boolean");
  }

  if (typeof data.forwarded_hr !== "boolean") {
    throw new Error("Invalid forwarded_hr. Expected boolean");
  }

  const validCategories = [
    "Schedule & Hours", "Leave & Vacation", "Sick Leave & Recovery",
    "Salary & Compensation", "Contract & Hours", "Onboarding", "Offboarding",
    "Workwear & Staff Pass", "Team & Contacts", "Personal Questions",
    "Access & Login", "Social questions", "Unrecognized / Other"
  ];

  if (!validCategories.includes(data.category)) {
    throw new Error(`Invalid category. Expected one of: ${validCategories.join(", ")}`);
  }

  if (!Array.isArray(data.questions)) {
    throw new Error("Invalid questions. Expected array of strings");
  }

  if (typeof data.summary !== "string" || data.summary.length < 10 || data.summary.length > 300) {
    throw new Error("Invalid summary. Expected string between 10-300 characters");
  }

  if (typeof data.session_id !== "string") {
    throw new Error("Invalid session_id. Expected string");
  }
}

/**
 * Main function to process SessionImport records that need processing
 */
async function processUnprocessedSessions() {
  console.log("Starting to process unprocessed SessionImport records...");

  // Find SessionImport records that are QUEUED and have transcript URLs
  const importsToProcess = await prisma.sessionImport.findMany({
    where: {
      status: "QUEUED",
      fullTranscriptUrl: { not: null },
    },
    include: {
      company: true,
    },
  });

  if (importsToProcess.length === 0) {
    console.log("No SessionImport records found requiring processing.");
    return;
  }

  console.log(`Found ${importsToProcess.length} SessionImport records to process.`);
  let successCount = 0;
  let errorCount = 0;

  for (const importRecord of importsToProcess) {
    if (!importRecord.fullTranscriptUrl) {
      console.warn(`SessionImport ${importRecord.id} has no transcript URL, skipping.`);
      continue;
    }

    console.log(`Processing transcript for SessionImport ${importRecord.id}...`);
    
    try {
      // Mark as processing
      await prisma.sessionImport.update({
        where: { id: importRecord.id },
        data: { status: "PROCESSING" },
      });

      // Fetch transcript content
      const transcriptContent = await fetchTranscriptContent(
        importRecord.fullTranscriptUrl,
        importRecord.company.csvUsername || undefined,
        importRecord.company.csvPassword || undefined
      );

      if (!transcriptContent) {
        throw new Error("Failed to fetch transcript content");
      }

      // Process with OpenAI
      const processedData = await processTranscriptWithOpenAI(
        importRecord.externalSessionId,
        transcriptContent
      );

      // Parse dates from raw strings
      const startTime = new Date(importRecord.startTimeRaw);
      const endTime = new Date(importRecord.endTimeRaw);

      // Create or update Session record
      const session = await prisma.session.upsert({
        where: { importId: importRecord.id },
        update: {
          startTime: isNaN(startTime.getTime()) ? new Date() : startTime,
          endTime: isNaN(endTime.getTime()) ? new Date() : endTime,
          ipAddress: importRecord.ipAddress,
          country: importRecord.countryCode,
          language: processedData.language,
          messagesSent: processedData.messages_sent,
          sentiment: { positive: 0.8, neutral: 0.0, negative: -0.8 }[processedData.sentiment] || 0,
          sentimentCategory: processedData.sentiment.toUpperCase() as "POSITIVE" | "NEUTRAL" | "NEGATIVE",
          escalated: processedData.escalated,
          forwardedHr: processedData.forwarded_hr,
          fullTranscriptUrl: importRecord.fullTranscriptUrl,
          avgResponseTime: importRecord.avgResponseTimeSeconds,
          tokens: importRecord.tokens,
          tokensEur: importRecord.tokensEur,
          category: processedData.category,
          initialMsg: importRecord.initialMessage,
          processed: true,
          questions: JSON.stringify(processedData.questions),
          summary: processedData.summary,
        },
        create: {
          companyId: importRecord.companyId,
          importId: importRecord.id,
          startTime: isNaN(startTime.getTime()) ? new Date() : startTime,
          endTime: isNaN(endTime.getTime()) ? new Date() : endTime,
          ipAddress: importRecord.ipAddress,
          country: importRecord.countryCode,
          language: processedData.language,
          messagesSent: processedData.messages_sent,
          sentiment: { positive: 0.8, neutral: 0.0, negative: -0.8 }[processedData.sentiment] || 0,
          sentimentCategory: processedData.sentiment.toUpperCase() as "POSITIVE" | "NEUTRAL" | "NEGATIVE",
          escalated: processedData.escalated,
          forwardedHr: processedData.forwarded_hr,
          fullTranscriptUrl: importRecord.fullTranscriptUrl,
          avgResponseTime: importRecord.avgResponseTimeSeconds,
          tokens: importRecord.tokens,
          tokensEur: importRecord.tokensEur,
          category: processedData.category,
          initialMsg: importRecord.initialMessage,
          processed: true,
          questions: JSON.stringify(processedData.questions),
          summary: processedData.summary,
        },
      });

      // Mark SessionImport as DONE
      await prisma.sessionImport.update({
        where: { id: importRecord.id },
        data: { 
          status: "DONE",
          processedAt: new Date(),
        },
      });

      console.log(`Successfully processed SessionImport ${importRecord.id} -> Session ${session.id}`);
      successCount++;
    } catch (error) {
      console.error(`Error processing SessionImport ${importRecord.id}:`, error);
      
      // Mark as ERROR
      await prisma.sessionImport.update({
        where: { id: importRecord.id },
        data: { 
          status: "ERROR",
          errorMsg: error instanceof Error ? error.message : String(error),
        },
      });
      
      errorCount++;
    }
  }

  console.log("SessionImport processing complete.");
  console.log(`Successfully processed: ${successCount} records.`);
  console.log(`Failed to process: ${errorCount} records.`);
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
