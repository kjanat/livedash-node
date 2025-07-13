/**
 * OpenAI API Mock Response Templates
 *
 * Provides realistic response templates for cost-safe testing
 * and development without actual API calls.
 */

export interface MockChatCompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: "stop" | "length" | "content_filter";
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MockBatchResponse {
  id: string;
  object: "batch";
  endpoint: string;
  errors: {
    object: "list";
    data: Array<{
      code: string;
      message: string;
      param?: string;
      type: string;
    }>;
  };
  input_file_id: string;
  completion_window: string;
  status:
    | "validating"
    | "in_progress"
    | "finalizing"
    | "completed"
    | "failed"
    | "expired"
    | "cancelling"
    | "cancelled";
  output_file_id?: string;
  error_file_id?: string;
  created_at: number;
  in_progress_at?: number;
  expires_at?: number;
  finalizing_at?: number;
  completed_at?: number;
  failed_at?: number;
  expired_at?: number;
  cancelling_at?: number;
  cancelled_at?: number;
  request_counts: {
    total: number;
    completed: number;
    failed: number;
  };
  metadata?: Record<string, string>;
}

/**
 * Generate realistic session analysis response matching the expected JSON schema
 */
export function generateSessionAnalysisResponse(
  text: string,
  sessionId: string
): MockChatCompletion {
  // Extract session ID from the text if provided in system prompt
  const sessionIdMatch = text.match(/"session_id":\s*"([^"]+)"/);
  const extractedSessionId = sessionIdMatch?.[1] || sessionId;

  // Simple sentiment analysis logic
  const positiveWords = [
    "good",
    "great",
    "excellent",
    "happy",
    "satisfied",
    "wonderful",
    "amazing",
    "pleased",
    "thanks",
  ];
  const negativeWords = [
    "bad",
    "terrible",
    "awful",
    "unhappy",
    "disappointed",
    "frustrated",
    "angry",
    "upset",
    "problem",
  ];

  const words = text.toLowerCase().split(/\s+/);
  const positiveCount = words.filter((word) =>
    positiveWords.some((pos) => word.includes(pos))
  ).length;
  const negativeCount = words.filter((word) =>
    negativeWords.some((neg) => word.includes(neg))
  ).length;

  let sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  if (positiveCount > negativeCount) {
    sentiment = "POSITIVE";
  } else if (negativeCount > positiveCount) {
    sentiment = "NEGATIVE";
  } else {
    sentiment = "NEUTRAL";
  }

  // Simple category classification
  const categories: Record<string, string[]> = {
    SCHEDULE_HOURS: ["schedule", "hours", "time", "shift", "working", "clock"],
    LEAVE_VACATION: [
      "vacation",
      "leave",
      "time off",
      "holiday",
      "pto",
      "days off",
    ],
    SICK_LEAVE_RECOVERY: [
      "sick",
      "ill",
      "medical",
      "health",
      "doctor",
      "recovery",
    ],
    SALARY_COMPENSATION: [
      "salary",
      "pay",
      "compensation",
      "money",
      "wage",
      "payment",
    ],
    CONTRACT_HOURS: ["contract", "agreement", "terms", "conditions"],
    ONBOARDING: [
      "onboard",
      "new",
      "start",
      "first day",
      "welcome",
      "orientation",
    ],
    OFFBOARDING: ["leaving", "quit", "resign", "last day", "exit", "farewell"],
    WORKWEAR_STAFF_PASS: [
      "uniform",
      "clothing",
      "badge",
      "pass",
      "equipment",
      "workwear",
    ],
    TEAM_CONTACTS: ["contact", "phone", "email", "reach", "team", "colleague"],
    PERSONAL_QUESTIONS: ["personal", "family", "life", "private"],
    ACCESS_LOGIN: [
      "login",
      "password",
      "access",
      "account",
      "system",
      "username",
    ],
    SOCIAL_QUESTIONS: ["social", "chat", "friendly", "casual", "weather"],
  };

  const textLower = text.toLowerCase();
  let bestCategory: keyof typeof categories | "UNRECOGNIZED_OTHER" =
    "UNRECOGNIZED_OTHER";
  let maxMatches = 0;

  for (const [category, keywords] of Object.entries(categories)) {
    const matches = keywords.filter((keyword) =>
      textLower.includes(keyword)
    ).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestCategory = category as keyof typeof categories;
    }
  }

  // Extract questions (sentences ending with ?)
  const questions = text
    .split(/[.!]+/)
    .map((s) => s.trim())
    .filter((s) => s.endsWith("?"))
    .slice(0, 5);

  // Generate summary (first sentence or truncated text)
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  let summary = sentences[0]?.trim() || text.substring(0, 100);
  if (summary.length > 150) {
    summary = `${summary.substring(0, 147)}...`;
  }
  if (summary.length < 10) {
    summary = "User inquiry regarding company policies";
  }

  // Detect language (simple heuristic)
  const dutchWords = [
    "het",
    "de",
    "een",
    "en",
    "van",
    "is",
    "dat",
    "te",
    "met",
    "voor",
  ];
  const germanWords = [
    "der",
    "die",
    "das",
    "und",
    "ist",
    "mit",
    "zu",
    "auf",
    "für",
    "von",
  ];
  const dutchCount = dutchWords.filter((word) =>
    textLower.includes(word)
  ).length;
  const germanCount = germanWords.filter((word) =>
    textLower.includes(word)
  ).length;

  let language = "en"; // default to English
  if (dutchCount > 0 && dutchCount >= germanCount) {
    language = "nl";
  } else if (germanCount > 0) {
    language = "de";
  }

  // Check for escalation indicators
  const escalated = /escalate|supervisor|manager|boss|higher up/i.test(text);
  const forwardedHr = /hr|human resources|personnel|legal/i.test(text);

  const analysisResult = {
    language,
    sentiment,
    escalated,
    forwarded_hr: forwardedHr,
    category: bestCategory,
    questions,
    summary,
    session_id: extractedSessionId,
  };

  const jsonContent = JSON.stringify(analysisResult);
  const promptTokens = Math.ceil(text.length / 4);
  const completionTokens = Math.ceil(jsonContent.length / 4);

  return {
    id: `chatcmpl-mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "gpt-4o-mini",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: jsonContent,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

/**
 * Generate realistic category classification response
 */
export function generateCategoryResponse(text: string): MockChatCompletion {
  // Simple category classification logic
  const categories: Record<string, string[]> = {
    SCHEDULE_HOURS: ["schedule", "hours", "time", "shift", "working"],
    LEAVE_VACATION: ["vacation", "leave", "time off", "holiday", "pto"],
    SICK_LEAVE_RECOVERY: ["sick", "ill", "medical", "health", "doctor"],
    SALARY_COMPENSATION: ["salary", "pay", "compensation", "money", "wage"],
    CONTRACT_HOURS: ["contract", "agreement", "terms", "conditions"],
    ONBOARDING: ["onboard", "new", "start", "first day", "welcome"],
    OFFBOARDING: ["leaving", "quit", "resign", "last day", "exit"],
    WORKWEAR_STAFF_PASS: ["uniform", "clothing", "badge", "pass", "equipment"],
    TEAM_CONTACTS: ["contact", "phone", "email", "reach", "team"],
    PERSONAL_QUESTIONS: ["personal", "family", "life", "private"],
    ACCESS_LOGIN: ["login", "password", "access", "account", "system"],
    SOCIAL_QUESTIONS: ["social", "chat", "friendly", "casual"],
  };

  const textLower = text.toLowerCase();
  let bestCategory = "UNRECOGNIZED_OTHER";
  let maxMatches = 0;

  for (const [category, keywords] of Object.entries(categories)) {
    const matches = keywords.filter((keyword) =>
      textLower.includes(keyword)
    ).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestCategory = category;
    }
  }

  const promptTokens = Math.ceil(text.length / 4);
  const completionTokens = bestCategory.length / 4;

  return {
    id: `chatcmpl-mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "gpt-4o-mini",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: bestCategory,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

/**
 * Generate realistic summary response
 */
export function generateSummaryResponse(text: string): MockChatCompletion {
  // Simple summarization - take first sentence or truncate
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  let summary = sentences[0]?.trim() || text.substring(0, 100);

  if (summary.length > 150) {
    summary = `${summary.substring(0, 147)}...`;
  }

  const promptTokens = Math.ceil(text.length / 4);
  const completionTokens = Math.ceil(summary.length / 4);

  return {
    id: `chatcmpl-mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "gpt-4o-mini",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: summary,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

/**
 * Generate realistic sentiment analysis response
 */
export function generateSentimentResponse(text: string): MockChatCompletion {
  // Simple sentiment analysis logic
  const positiveWords = [
    "good",
    "great",
    "excellent",
    "happy",
    "satisfied",
    "wonderful",
    "amazing",
    "pleased",
    "thanks",
  ];
  const negativeWords = [
    "bad",
    "terrible",
    "awful",
    "unhappy",
    "disappointed",
    "frustrated",
    "angry",
    "upset",
    "problem",
  ];

  const words = text.toLowerCase().split(/\s+/);
  const positiveCount = words.filter((word) =>
    positiveWords.some((pos) => word.includes(pos))
  ).length;
  const negativeCount = words.filter((word) =>
    negativeWords.some((neg) => word.includes(neg))
  ).length;

  let sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  if (positiveCount > negativeCount) {
    sentiment = "POSITIVE";
  } else if (negativeCount > positiveCount) {
    sentiment = "NEGATIVE";
  } else {
    sentiment = "NEUTRAL";
  }

  const promptTokens = Math.ceil(text.length / 4);
  const completionTokens = Math.ceil(sentiment.length / 4);

  return {
    id: `chatcmpl-mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "gpt-4o-mini",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: sentiment,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

/**
 * Generate realistic question extraction response
 */
export function generateQuestionExtractionResponse(
  text: string
): MockChatCompletion {
  // Extract sentences that end with question marks
  const questions = text
    .split(/[.!]+/)
    .map((s) => s.trim())
    .filter((s) => s.endsWith("?"))
    .slice(0, 5); // Limit to 5 questions

  const result =
    questions.length > 0 ? questions.join("\n") : "No questions found.";

  const promptTokens = Math.ceil(text.length / 4);
  const completionTokens = Math.ceil(result.length / 4);

  return {
    id: `chatcmpl-mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "gpt-4o-mini",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: result,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

/**
 * Generate mock batch job response
 */
export function generateBatchResponse(
  status: MockBatchResponse["status"] = "in_progress"
): MockBatchResponse {
  const now = Math.floor(Date.now() / 1000);
  const batchId = `batch_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const result: MockBatchResponse = {
    id: batchId,
    object: "batch",
    endpoint: "/v1/chat/completions",
    errors: {
      object: "list",
      data: [],
    },
    input_file_id: `file-mock-input-${batchId}`,
    completion_window: "24h",
    status,
    created_at: now - 300, // 5 minutes ago
    expires_at: now + 86400, // 24 hours from now
    request_counts: {
      total: 100,
      completed:
        status === "completed" ? 100 : status === "in_progress" ? 75 : 0,
      failed: status === "failed" ? 25 : 0,
    },
    metadata: {
      company_id: "test-company",
      batch_type: "ai_processing",
    },
  };

  // Set optional fields based on status
  if (status === "completed") {
    result.output_file_id = `file-mock-output-${batchId}`;
    result.completed_at = now - 30;
  }

  if (status === "failed") {
    result.failed_at = now - 30;
  }

  if (status !== "validating") {
    result.in_progress_at = now - 240; // 4 minutes ago
  }

  if (status === "finalizing" || status === "completed") {
    result.finalizing_at = now - 60;
  }

  return result;
}

/**
 * Mock cost calculation for testing
 */
export function calculateMockCost(usage: {
  prompt_tokens: number;
  completion_tokens: number;
}): number {
  // Mock pricing: $0.15 per 1K prompt tokens, $0.60 per 1K completion tokens (gpt-4o-mini rates)
  const promptCost = (usage.prompt_tokens / 1000) * 0.15;
  const completionCost = (usage.completion_tokens / 1000) * 0.6;
  return promptCost + completionCost;
}

/**
 * Response templates for different AI processing types
 */
export const MOCK_RESPONSE_GENERATORS = {
  sentiment: generateSentimentResponse,
  category: generateCategoryResponse,
  summary: generateSummaryResponse,
  questions: generateQuestionExtractionResponse,
} as const;

export type MockResponseType = keyof typeof MOCK_RESPONSE_GENERATORS;
