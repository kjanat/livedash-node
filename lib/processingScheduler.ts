// Enhanced session processing scheduler with AI cost tracking and question management

import {
  PrismaClient,
  ProcessingStage,
  type SentimentCategory,
  type SessionCategory,
} from "@prisma/client";
import cron from "node-cron";
import fetch from "node-fetch";
import { ProcessingStatusManager } from "./processingStatusManager";
import { getSchedulerConfig } from "./schedulerConfig";

const prisma = new PrismaClient();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

const USD_TO_EUR_RATE = 0.85; // Update periodically or fetch from API

/**
 * Get company's default AI model
 */
async function getCompanyAIModel(companyId: string): Promise<string> {
  const companyModel = await prisma.companyAIModel.findFirst({
    where: {
      companyId,
      isDefault: true,
    },
    include: {
      aiModel: true,
    },
  });

  return companyModel?.aiModel.name || DEFAULT_MODEL;
}

/**
 * Get current pricing for an AI model
 */
async function getCurrentModelPricing(modelName: string): Promise<{
  promptTokenCost: number;
  completionTokenCost: number;
} | null> {
  const model = await prisma.aIModel.findUnique({
    where: { name: modelName },
    include: {
      pricing: {
        where: {
          effectiveFrom: { lte: new Date() },
          OR: [
            { effectiveUntil: null },
            { effectiveUntil: { gte: new Date() } },
          ],
        },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
    },
  });

  if (!model || model.pricing.length === 0) {
    return null;
  }

  const pricing = model.pricing[0];
  return {
    promptTokenCost: pricing.promptTokenCost,
    completionTokenCost: pricing.completionTokenCost,
  };
}

interface ProcessedData {
  language: string;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  escalated: boolean;
  forwarded_hr: boolean;
  category:
    | "SCHEDULE_HOURS"
    | "LEAVE_VACATION"
    | "SICK_LEAVE_RECOVERY"
    | "SALARY_COMPENSATION"
    | "CONTRACT_HOURS"
    | "ONBOARDING"
    | "OFFBOARDING"
    | "WORKWEAR_STAFF_PASS"
    | "TEAM_CONTACTS"
    | "PERSONAL_QUESTIONS"
    | "ACCESS_LOGIN"
    | "SOCIAL_QUESTIONS"
    | "UNRECOGNIZED_OTHER";
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
 * Record AI processing request with detailed token tracking
 */
async function recordAIProcessingRequest(
  sessionId: string,
  openaiResponse: any,
  processingType: string = "session_analysis"
): Promise<void> {
  const usage = openaiResponse.usage;
  const model = openaiResponse.model;

  // Get current pricing from database
  const pricing = await getCurrentModelPricing(model);

  // Fallback pricing if not found in database
  const fallbackPricing = {
    promptTokenCost: 0.00001, // $10.00 per 1M tokens (gpt-4-turbo rate)
    completionTokenCost: 0.00003, // $30.00 per 1M tokens
  };

  const finalPricing = pricing || fallbackPricing;

  const promptCost = usage.prompt_tokens * finalPricing.promptTokenCost;
  const completionCost =
    usage.completion_tokens * finalPricing.completionTokenCost;
  const totalCostUsd = promptCost + completionCost;
  const totalCostEur = totalCostUsd * USD_TO_EUR_RATE;

  await prisma.aIProcessingRequest.create({
    data: {
      sessionId,
      openaiRequestId: openaiResponse.id,
      model: openaiResponse.model,
      serviceTier: openaiResponse.service_tier,
      systemFingerprint: openaiResponse.system_fingerprint,

      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,

      // Detailed breakdown
      cachedTokens: usage.prompt_tokens_details?.cached_tokens || null,
      audioTokensPrompt: usage.prompt_tokens_details?.audio_tokens || null,
      reasoningTokens:
        usage.completion_tokens_details?.reasoning_tokens || null,
      audioTokensCompletion:
        usage.completion_tokens_details?.audio_tokens || null,
      acceptedPredictionTokens:
        usage.completion_tokens_details?.accepted_prediction_tokens || null,
      rejectedPredictionTokens:
        usage.completion_tokens_details?.rejected_prediction_tokens || null,

      promptTokenCost: finalPricing.promptTokenCost,
      completionTokenCost: finalPricing.completionTokenCost,
      totalCostEur,

      processingType,
      success: true,
      completedAt: new Date(),
    },
  });
}

/**
 * Record failed AI processing request
 */
async function recordFailedAIProcessingRequest(
  sessionId: string,
  processingType: string,
  errorMessage: string
): Promise<void> {
  await prisma.aIProcessingRequest.create({
    data: {
      sessionId,
      model: "unknown",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      promptTokenCost: 0,
      completionTokenCost: 0,
      totalCostEur: 0,
      processingType,
      success: false,
      errorMessage,
      completedAt: new Date(),
    },
  });
}

/**
 * Process questions into separate Question and SessionQuestion tables
 */
async function processQuestions(
  sessionId: string,
  questions: string[]
): Promise<void> {
  // Clear existing questions for this session
  await prisma.sessionQuestion.deleteMany({
    where: { sessionId },
  });

  // Filter and prepare unique questions
  const uniqueQuestions = [...new Set(questions.filter((q) => q.trim()))];
  if (uniqueQuestions.length === 0) return;

  // Batch create questions (skip duplicates)
  await prisma.question.createMany({
    data: uniqueQuestions.map((content) => ({ content: content.trim() })),
    skipDuplicates: true,
  });

  // Fetch all question IDs in one query
  const existingQuestions = await prisma.question.findMany({
    where: { content: { in: uniqueQuestions.map((q) => q.trim()) } },
    select: { id: true, content: true },
  });

  // Create a map for quick lookup
  const questionMap = new Map(existingQuestions.map((q) => [q.content, q.id]));

  // Prepare session questions data
  const sessionQuestionsData = questions
    .map((questionText, index) => {
      const trimmed = questionText.trim();
      if (!trimmed) return null;

      const questionId = questionMap.get(trimmed);
      if (!questionId) return null;

      return {
        sessionId,
        questionId,
        order: index,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // Batch create session questions
  if (sessionQuestionsData.length > 0) {
    await prisma.sessionQuestion.createMany({
      data: sessionQuestionsData,
    });
  }
}

/**
 * Calculate messagesSent from actual Message records
 */
async function calculateMessagesSent(sessionId: string): Promise<number> {
  const userMessageCount = await prisma.message.count({
    where: {
      sessionId,
      role: { in: ["user", "User"] }, // Handle both cases
    },
  });
  return userMessageCount;
}

/**
 * Calculate endTime from latest Message timestamp
 */
async function calculateEndTime(
  sessionId: string,
  fallbackEndTime: Date
): Promise<Date> {
  const latestMessage = await prisma.message.findFirst({
    where: { sessionId },
    orderBy: { timestamp: "desc" },
  });

  return latestMessage?.timestamp || fallbackEndTime;
}

/**
 * Processes a session transcript using OpenAI API
 */
async function processTranscriptWithOpenAI(
  sessionId: string,
  transcript: string,
  companyId: string
): Promise<ProcessedData> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  // Get company's AI model
  const aiModel = await getCompanyAIModel(companyId);

  // Updated system message with exact enum values
  const systemMessage = `
    You are an AI assistant tasked with analyzing chat transcripts.
    Extract the following information from the transcript and return it in EXACT JSON format:
    
    {
      "language": "ISO 639-1 code (e.g., 'en', 'nl', 'de')",
      "sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
      "escalated": boolean,
      "forwarded_hr": boolean,
      "category": "SCHEDULE_HOURS|LEAVE_VACATION|SICK_LEAVE_RECOVERY|SALARY_COMPENSATION|CONTRACT_HOURS|ONBOARDING|OFFBOARDING|WORKWEAR_STAFF_PASS|TEAM_CONTACTS|PERSONAL_QUESTIONS|ACCESS_LOGIN|SOCIAL_QUESTIONS|UNRECOGNIZED_OTHER",
      "questions": ["question 1", "question 2", ...],
      "summary": "brief summary (10-300 chars)",
      "session_id": "${sessionId}"
    }
    
    Rules:
    - language: Primary language used by the user (ISO 639-1 code)
    - sentiment: Overall emotional tone of the conversation
    - escalated: Was the issue escalated to a supervisor/manager?
    - forwarded_hr: Was HR contact mentioned or provided?
    - category: Best fitting category for the main topic (use exact enum values above)
    - questions: Up to 5 paraphrased user questions (in English)
    - summary: Brief conversation summary (10-300 characters)
    
    IMPORTANT: Use EXACT enum values as specified above.
  `;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: aiModel, // Use company's configured AI model
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

    const openaiResponse: any = await response.json();

    // Record the AI processing request for cost tracking
    await recordAIProcessingRequest(
      sessionId,
      openaiResponse,
      "session_analysis"
    );

    const processedData = JSON.parse(openaiResponse.choices[0].message.content);

    // Validate the response against our expected schema
    validateOpenAIResponse(processedData);

    return processedData;
  } catch (error) {
    // Record failed request
    await recordFailedAIProcessingRequest(
      sessionId,
      "session_analysis",
      error instanceof Error ? error.message : String(error)
    );

    process.stderr.write(`Error processing transcript with OpenAI: ${error}\n`);
    throw error;
  }
}

/**
 * Validates the OpenAI response against our expected schema
 */
function validateOpenAIResponse(data: any): void {
  const requiredFields = [
    "language",
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

  // Validate field types and values
  if (typeof data.language !== "string" || !/^[a-z]{2}$/.test(data.language)) {
    throw new Error(
      "Invalid language format. Expected ISO 639-1 code (e.g., 'en')"
    );
  }

  if (!["POSITIVE", "NEUTRAL", "NEGATIVE"].includes(data.sentiment)) {
    throw new Error(
      "Invalid sentiment. Expected 'POSITIVE', 'NEUTRAL', or 'NEGATIVE'"
    );
  }

  if (typeof data.escalated !== "boolean") {
    throw new Error("Invalid escalated. Expected boolean");
  }

  if (typeof data.forwarded_hr !== "boolean") {
    throw new Error("Invalid forwarded_hr. Expected boolean");
  }

  const validCategories = [
    "SCHEDULE_HOURS",
    "LEAVE_VACATION",
    "SICK_LEAVE_RECOVERY",
    "SALARY_COMPENSATION",
    "CONTRACT_HOURS",
    "ONBOARDING",
    "OFFBOARDING",
    "WORKWEAR_STAFF_PASS",
    "TEAM_CONTACTS",
    "PERSONAL_QUESTIONS",
    "ACCESS_LOGIN",
    "SOCIAL_QUESTIONS",
    "UNRECOGNIZED_OTHER",
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
    // Mark AI analysis as started
    await ProcessingStatusManager.startStage(
      session.id,
      ProcessingStage.AI_ANALYSIS
    );

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
      transcript,
      session.companyId
    );

    // Calculate messagesSent from actual Message records
    const messagesSent = await calculateMessagesSent(session.id);

    // Calculate endTime from latest Message timestamp
    const calculatedEndTime = await calculateEndTime(
      session.id,
      session.endTime
    );

    // Update the session with processed data
    await prisma.session.update({
      where: { id: session.id },
      data: {
        language: processedData.language,
        messagesSent: messagesSent, // Calculated from Messages, not AI
        endTime: calculatedEndTime, // Use calculated endTime if different
        sentiment: processedData.sentiment as SentimentCategory,
        escalated: processedData.escalated,
        forwardedHr: processedData.forwarded_hr,
        category: processedData.category as SessionCategory,
        summary: processedData.summary,
      },
    });

    // Mark AI analysis as completed
    await ProcessingStatusManager.completeStage(
      session.id,
      ProcessingStage.AI_ANALYSIS,
      {
        language: processedData.language,
        sentiment: processedData.sentiment,
        category: processedData.category,
        questionsCount: processedData.questions.length,
      }
    );

    // Start question extraction stage
    await ProcessingStatusManager.startStage(
      session.id,
      ProcessingStage.QUESTION_EXTRACTION
    );

    // Process questions into separate tables
    await processQuestions(session.id, processedData.questions);

    // Mark question extraction as completed
    await ProcessingStatusManager.completeStage(
      session.id,
      ProcessingStage.QUESTION_EXTRACTION,
      {
        questionsProcessed: processedData.questions.length,
      }
    );

    return {
      sessionId: session.id,
      success: true,
    };
  } catch (error) {
    // Mark AI analysis as failed
    await ProcessingStatusManager.failStage(
      session.id,
      ProcessingStage.AI_ANALYSIS,
      error instanceof Error ? error.message : String(error)
    );

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
 * Process unprocessed sessions using the new processing status system
 */
export async function processUnprocessedSessions(
  batchSize: number | null = null,
  maxConcurrency: number = 5
): Promise<void> {
  process.stdout.write(
    "[ProcessingScheduler] Starting to process sessions needing AI analysis...\n"
  );

  // Get sessions that need AI processing using the new status system
  const sessionsNeedingAI =
    await ProcessingStatusManager.getSessionsNeedingProcessing(
      ProcessingStage.AI_ANALYSIS,
      batchSize || 50
    );

  if (sessionsNeedingAI.length === 0) {
    process.stdout.write(
      "[ProcessingScheduler] No sessions found requiring AI processing.\n"
    );
    return;
  }

  // Get session IDs that need processing
  const sessionIds = sessionsNeedingAI.map(
    (statusRecord) => statusRecord.sessionId
  );

  // Fetch full session data with messages
  const sessionsToProcess = await prisma.session.findMany({
    where: {
      id: { in: sessionIds },
    },
    include: {
      messages: {
        orderBy: { order: "asc" },
      },
    },
  });

  // Filter to only sessions that have messages
  const sessionsWithMessages = sessionsToProcess.filter(
    (session: any) => session.messages && session.messages.length > 0
  );

  if (sessionsWithMessages.length === 0) {
    process.stdout.write(
      "[ProcessingScheduler] No sessions with messages found requiring processing.\n"
    );
    return;
  }

  process.stdout.write(
    `[ProcessingScheduler] Found ${sessionsWithMessages.length} sessions to process (max concurrency: ${maxConcurrency}).\n`
  );

  const startTime = Date.now();
  const results = await processSessionsInParallel(
    sessionsWithMessages,
    maxConcurrency
  );
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
 * Get total AI processing costs for reporting
 */
export async function getAIProcessingCosts(): Promise<{
  totalCostEur: number;
  totalTokens: number;
  requestCount: number;
  successfulRequests: number;
  failedRequests: number;
}> {
  const result = await prisma.aIProcessingRequest.aggregate({
    _sum: {
      totalCostEur: true,
      totalTokens: true,
    },
    _count: {
      id: true,
    },
  });

  const successfulRequests = await prisma.aIProcessingRequest.count({
    where: { success: true },
  });

  const failedRequests = await prisma.aIProcessingRequest.count({
    where: { success: false },
  });

  return {
    totalCostEur: result._sum.totalCostEur || 0,
    totalTokens: result._sum.totalTokens || 0,
    requestCount: result._count.id || 0,
    successfulRequests,
    failedRequests,
  };
}

/**
 * Start the processing scheduler with configurable settings
 */
export function startProcessingScheduler(): void {
  const config = getSchedulerConfig();

  if (!config.enabled) {
    console.log("[Processing Scheduler] Disabled via configuration");
    return;
  }

  console.log(
    `[Processing Scheduler] Starting with interval: ${config.sessionProcessing.interval}`
  );
  console.log(
    `[Processing Scheduler] Batch size: ${config.sessionProcessing.batchSize === 0 ? "unlimited" : config.sessionProcessing.batchSize}`
  );
  console.log(
    `[Processing Scheduler] Concurrency: ${config.sessionProcessing.concurrency}`
  );

  cron.schedule(config.sessionProcessing.interval, async () => {
    try {
      await processUnprocessedSessions(
        config.sessionProcessing.batchSize === 0
          ? null
          : config.sessionProcessing.batchSize,
        config.sessionProcessing.concurrency
      );
    } catch (error) {
      process.stderr.write(
        `[ProcessingScheduler] Error in scheduler: ${error}\n`
      );
    }
  });
}
