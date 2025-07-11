// Functions to calculate metrics over sessions
import type {
  CategoryMetrics,
  ChatSession,
  CountryMetrics, // Added CountryMetrics
  DayMetrics,
  LanguageMetrics,
  MetricsResult,
  TopQuestion, // Added TopQuestion
  WordCloudWord, // Added WordCloudWord
} from "./types";

interface CompanyConfig {
  sentimentAlert?: number;
}

// Helper function to calculate trend percentages
function calculateTrendPercentage(current: number, previous: number): number {
  if (previous === 0) return 0; // Avoid division by zero
  return ((current - previous) / previous) * 100;
}

// Mock data for previous period - in a real app, this would come from database
const mockPreviousPeriodData = {
  totalSessions: 120,
  uniqueUsers: 85,
  avgSessionLength: 240, // in seconds
  avgResponseTime: 1.7, // in seconds
};

// List of common stop words - this can be expanded
const stopWords = new Set([
  "assistant",
  "user",
  // Web
  "bmp",
  "co",
  "com",
  "css",
  "gif",
  "href",
  "html",
  "http",
  "https",
  "io",
  "jpeg",
  "jpg",
  "js",
  "json",
  "net",
  "org",
  "php",
  "png",
  "svg",
  "txt",
  "www",
  "www2",
  "xml",
  // English stop words
  "a",
  "about",
  "above",
  "after",
  "again",
  "against",
  "ain",
  "all",
  "am",
  "an",
  "any",
  "are",
  "aren",
  "at",
  "be",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "by",
  "bye",
  "can",
  "could",
  "couldn",
  "d",
  "did",
  "didn",
  "do",
  "does",
  "doesn",
  "don",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "goodbye",
  "had",
  "hadn",
  "has",
  "hasn",
  "have",
  "haven",
  "he",
  "hello",
  "her",
  "here",
  "hers",
  "hi",
  "him",
  "his",
  "how",
  "i",
  "in",
  "into",
  "is",
  "isn",
  "it",
  "its",
  "just",
  "ll",
  "m",
  "ma",
  "may",
  "me",
  "might",
  "mightn",
  "mine",
  "more",
  "most",
  "must",
  "mustn",
  "my",
  "needn",
  "no",
  "nor",
  "not",
  "now",
  "o",
  "of",
  "off",
  "ok",
  "okay",
  "on",
  "once",
  "only",
  "other",
  "our",
  "ours",
  "out",
  "over",
  "own",
  "please",
  "re",
  "s",
  "same",
  "shan",
  "she",
  "should",
  "shouldn",
  "shouldve",
  "so",
  "some",
  "such",
  "t",
  "than",
  "thank",
  "thanks",
  "the",
  "their",
  "theirs",
  "them",
  "then",
  "there",
  "they",
  "through",
  "to",
  "too",
  "under",
  "up",
  "us",
  "ve",
  "very",
  "was",
  "wasn",
  "we",
  "were",
  "weren",
  "when",
  "where",
  "why",
  "will",
  "with",
  "won",
  "would",
  "wouldn",
  "y",
  "yeah",
  "yes",
  "you",
  "your",
  "yours",
  // French stop words
  "des",
  "donc",
  "et",
  "la",
  "le",
  "les",
  "mais",
  "ou",
  "un",
  "une",
  // Dutch stop words
  "aan",
  "al",
  "alhoewel",
  "als",
  "anders",
  "behalve",
  "ben",
  "ben",
  "bent",
  "bij",
  "binnen",
  "boven",
  "buiten",
  "dan",
  "dankzij",
  "dat",
  "de",
  "deze",
  "die",
  "dit",
  "dit",
  "door",
  "dus",
  "echter",
  "een",
  "elk",
  "en",
  "geen",
  "gehad",
  "geweest",
  "geworden",
  "had",
  "hadden",
  "heb",
  "hebben",
  "hebt",
  "heeft",
  "het",
  "hij",
  "hoe",
  "hoewel",
  "ieder",
  "iets",
  "ik",
  "jij",
  "jullie",
  "kan",
  "kon",
  "konden",
  "kunnen",
  "kunt",
  "maar",
  "meer",
  "meest",
  "met",
  "mits",
  "naar",
  "niet",
  "niets",
  "nog",
  "nu",
  "of",
  "om",
  "omdat",
  "ondanks",
  "onder",
  "ook",
  "over",
  "sinds",
  "sommige",
  "tegen",
  "tenzij",
  "tijdens",
  "toch",
  "tot",
  "tussen",
  "uit",
  "van",
  "veel",
  "volgens",
  "voor",
  "waar",
  "waarom",
  "wanneer",
  "want",
  "waren",
  "was",
  "wat",
  "weinig",
  "wel",
  "welke",
  "werd",
  "werden",
  "wie",
  "wij",
  "worden",
  "wordt",
  "zal",
  "zij",
  "zijn",
  "zonder",
  "zullen",
  "zult",
  // Add more domain-specific stop words if necessary
]);

/**
 * Extract unique user identifiers from session data
 */
function extractUniqueUsers(
  session: ChatSession,
  uniqueUserIds: Set<string>
): void {
  let identifierAdded = false;
  if (session.ipAddress && session.ipAddress.trim() !== "") {
    uniqueUserIds.add(session.ipAddress.trim());
    identifierAdded = true;
  }
  // Fallback to sessionId only if ipAddress was not usable and sessionId is valid
  if (
    !identifierAdded &&
    session.sessionId &&
    session.sessionId.trim() !== ""
  ) {
    uniqueUserIds.add(session.sessionId.trim());
  }
}

/**
 * Validate and convert timestamps to milliseconds
 */
function validateTimestamps(
  session: ChatSession,
  startTimeMs: number,
  endTimeMs: number
): boolean {
  if (Number.isNaN(startTimeMs)) {
    console.warn(
      `[metrics] Invalid startTime for session ${session.id || session.sessionId}: ${session.startTime}`
    );
    return false;
  }
  if (Number.isNaN(endTimeMs)) {
    console.warn(
      `[metrics] Invalid endTime for session ${session.id || session.sessionId}: ${session.endTime}`
    );
    return false;
  }
  return true;
}

/**
 * Log duration warnings for edge cases
 */
function logDurationWarnings(
  session: ChatSession,
  timeDifference: number,
  duration: number
): void {
  if (timeDifference < 0) {
    console.warn(
      `[metrics] endTime (${session.endTime}) was before startTime (${session.startTime}) for session ${session.id || session.sessionId}. Using absolute difference as duration (${(duration / 1000).toFixed(2)} seconds).`
    );
  }
}

/**
 * Calculate session duration and update totals
 */
function processSessionDuration(
  session: ChatSession,
  totals: { totalSessionDuration: number; validSessionsForDuration: number }
): void {
  if (!session.startTime || !session.endTime) {
    if (!session.startTime) {
      console.warn(
        `[metrics] Missing startTime for session ${session.id || session.sessionId}`
      );
    }
    if (!session.endTime) {
      console.log(
        `[metrics] Missing endTime for session ${session.id || session.sessionId} - likely ongoing or data issue.`
      );
    }
    return;
  }

  const startTimeMs = new Date(session.startTime).getTime();
  const endTimeMs = new Date(session.endTime).getTime();

  if (!validateTimestamps(session, startTimeMs, endTimeMs)) {
    return;
  }

  const timeDifference = endTimeMs - startTimeMs;
  const duration = Math.abs(timeDifference);

  totals.totalSessionDuration += duration;
  totals.validSessionsForDuration++;

  logDurationWarnings(session, timeDifference, duration);
}

/**
 * Update sentiment counters based on session sentiment
 */
function processSentiment(
  session: ChatSession,
  sentimentCounts: {
    sentimentPositiveCount: number;
    sentimentNeutralCount: number;
    sentimentNegativeCount: number;
  }
): void {
  if (session.sentiment !== undefined && session.sentiment !== null) {
    if (session.sentiment === "POSITIVE")
      sentimentCounts.sentimentPositiveCount++;
    else if (session.sentiment === "NEGATIVE")
      sentimentCounts.sentimentNegativeCount++;
    else if (session.sentiment === "NEUTRAL")
      sentimentCounts.sentimentNeutralCount++;
  }
}

/**
 * Update category-based metrics
 */
function updateCategoryMetrics(
  session: ChatSession,
  metrics: {
    byDay: DayMetrics;
    byCategory: CategoryMetrics;
    byLanguage: LanguageMetrics;
    byCountry: CountryMetrics;
  }
): void {
  // Daily metrics
  const day = new Date(session.startTime).toISOString().split("T")[0];
  metrics.byDay[day] = (metrics.byDay[day] || 0) + 1;

  // Category metrics
  if (session.category) {
    metrics.byCategory[session.category] =
      (metrics.byCategory[session.category] || 0) + 1;
  }

  // Language metrics
  if (session.language) {
    metrics.byLanguage[session.language] =
      (metrics.byLanguage[session.language] || 0) + 1;
  }

  // Country metrics
  if (session.country) {
    metrics.byCountry[session.country] =
      (metrics.byCountry[session.country] || 0) + 1;
  }
}

/**
 * Extract questions from session messages and initial message
 */
function extractQuestions(
  session: ChatSession,
  questionCounts: { [question: string]: number }
): void {
  const isQuestion = (content: string): boolean => {
    return (
      content.endsWith("?") ||
      /\b(what|when|where|why|how|who|which|can|could|would|will|is|are|do|does|did)\b/i.test(
        content
      )
    );
  };

  // Extract questions from user messages
  if (session.messages) {
    session.messages
      .filter((msg) => msg.role === "User")
      .forEach((msg) => {
        const content = msg.content.trim();
        if (isQuestion(content)) {
          questionCounts[content] = (questionCounts[content] || 0) + 1;
        }
      });
  }

  // Extract questions from initial message as fallback
  if (session.initialMsg) {
    const content = session.initialMsg.trim();
    if (isQuestion(content)) {
      questionCounts[content] = (questionCounts[content] || 0) + 1;
    }
  }
}

/**
 * Process text for word cloud generation
 */
function processTextForWordCloud(
  text: string | undefined | null,
  wordCounts: { [key: string]: number }
): void {
  if (!text) return;

  const words = text
    .toLowerCase()
    .replace(/[^\w\s'-]/gi, "")
    .split(/\s+/);

  for (const word of words) {
    const cleanedWord = word.replace(/^['-]|['-]$/g, "");
    if (cleanedWord && !stopWords.has(cleanedWord) && cleanedWord.length > 2) {
      wordCounts[cleanedWord] = (wordCounts[cleanedWord] || 0) + 1;
    }
  }
}

/**
 * Calculate peak usage time from hourly session counts
 */
function calculatePeakUsageTime(hourlySessionCounts: {
  [hour: string]: number;
}): string {
  if (Object.keys(hourlySessionCounts).length === 0) {
    return "N/A";
  }

  const peakHour = Object.entries(hourlySessionCounts).sort(
    ([, a], [, b]) => b - a
  )[0][0];
  const peakHourNum = Number.parseInt(peakHour.split(":")[0]);
  const endHour = (peakHourNum + 1) % 24;
  return `${peakHour}-${endHour.toString().padStart(2, "0")}:00`;
}

/**
 * Calculate top questions from question counts
 */
function calculateTopQuestions(questionCounts: {
  [question: string]: number;
}): TopQuestion[] {
  return Object.entries(questionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([question, count]) => ({ question, count }));
}

/**
 * Process a single session and update all metrics
 */
function processSession(
  session: ChatSession,
  companyConfig: CompanyConfig,
  metrics: {
    uniqueUserIds: Set<string>;
    sessionDurationTotals: {
      totalSessionDuration: number;
      validSessionsForDuration: number;
    };
    sentimentCounts: {
      sentimentPositiveCount: number;
      sentimentNeutralCount: number;
      sentimentNegativeCount: number;
    };
    categoryMetrics: {
      byDay: DayMetrics;
      byCategory: CategoryMetrics;
      byLanguage: LanguageMetrics;
      byCountry: CountryMetrics;
    };
    hourlySessionCounts: { [hour: string]: number };
    questionCounts: { [question: string]: number };
    wordCounts: { [key: string]: number };
    counters: {
      escalatedCount: number;
      forwardedHrCount: number;
      totalResponseTime: number;
      validSessionsForResponseTime: number;
      alerts: number;
      resolvedChatsCount: number;
    };
  }
): void {
  // Track hourly usage
  if (session.startTime) {
    const hour = new Date(session.startTime).getHours();
    const hourKey = `${hour.toString().padStart(2, "0")}:00`;
    metrics.hourlySessionCounts[hourKey] =
      (metrics.hourlySessionCounts[hourKey] || 0) + 1;
  }

  // Count resolved chats
  if (session.endTime && !session.escalated) {
    metrics.counters.resolvedChatsCount++;
  }

  // Extract unique users
  extractUniqueUsers(session, metrics.uniqueUserIds);

  // Process session duration
  processSessionDuration(session, metrics.sessionDurationTotals);

  // Process response time
  if (
    session.avgResponseTime !== undefined &&
    session.avgResponseTime !== null &&
    session.avgResponseTime >= 0
  ) {
    metrics.counters.totalResponseTime += session.avgResponseTime;
    metrics.counters.validSessionsForResponseTime++;
  }

  // Count escalated and forwarded
  if (session.escalated) metrics.counters.escalatedCount++;
  if (session.forwardedHr) metrics.counters.forwardedHrCount++;

  // Process sentiment
  processSentiment(session, metrics.sentimentCounts);

  // Check sentiment alerts
  if (
    companyConfig.sentimentAlert !== undefined &&
    session.sentiment === "NEGATIVE"
  ) {
    metrics.counters.alerts++;
  }

  // Update category metrics
  updateCategoryMetrics(session, metrics.categoryMetrics);

  // Extract questions
  extractQuestions(session, metrics.questionCounts);

  // Process text for word cloud
  processTextForWordCloud(session.initialMsg, metrics.wordCounts);
}

/**
 * Main function to calculate session metrics with reduced complexity
 */
export function sessionMetrics(
  sessions: ChatSession[],
  companyConfig: CompanyConfig = {}
): MetricsResult {
  const totalSessions = sessions.length;
  const byDay: DayMetrics = {};
  const byCategory: CategoryMetrics = {};
  const byLanguage: LanguageMetrics = {};
  const byCountry: CountryMetrics = {};
  const tokensByDay: DayMetrics = {};
  const tokensCostByDay: DayMetrics = {};

  // Initialize all metrics in a structured way
  const metrics = {
    uniqueUserIds: new Set<string>(),
    sessionDurationTotals: {
      totalSessionDuration: 0,
      validSessionsForDuration: 0,
    },
    sentimentCounts: {
      sentimentPositiveCount: 0,
      sentimentNeutralCount: 0,
      sentimentNegativeCount: 0,
    },
    categoryMetrics: { byDay, byCategory, byLanguage, byCountry },
    hourlySessionCounts: {} as { [hour: string]: number },
    questionCounts: {} as { [question: string]: number },
    wordCounts: {} as { [key: string]: number },
    counters: {
      escalatedCount: 0,
      forwardedHrCount: 0,
      totalResponseTime: 0,
      validSessionsForResponseTime: 0,
      alerts: 0,
      resolvedChatsCount: 0,
    },
  };

  // Process each session
  for (const session of sessions) {
    processSession(session, companyConfig, metrics);
  }

  // Calculate derived metrics
  const uniqueUsers = metrics.uniqueUserIds.size;
  const avgSessionLength =
    metrics.sessionDurationTotals.validSessionsForDuration > 0
      ? metrics.sessionDurationTotals.totalSessionDuration /
        metrics.sessionDurationTotals.validSessionsForDuration /
        1000
      : 0;
  const avgResponseTime =
    metrics.counters.validSessionsForResponseTime > 0
      ? metrics.counters.totalResponseTime /
        metrics.counters.validSessionsForResponseTime
      : 0;

  const wordCloudData: WordCloudWord[] = Object.entries(metrics.wordCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 50)
    .map(([text, value]) => ({ text, value }));

  const numDaysWithSessions = Object.keys(byDay).length;
  const avgSessionsPerDay =
    numDaysWithSessions > 0 ? totalSessions / numDaysWithSessions : 0;

  // Calculate trends
  const totalSessionsTrend = calculateTrendPercentage(
    totalSessions,
    mockPreviousPeriodData.totalSessions
  );
  const uniqueUsersTrend = calculateTrendPercentage(
    uniqueUsers,
    mockPreviousPeriodData.uniqueUsers
  );
  const avgSessionLengthTrend = calculateTrendPercentage(
    avgSessionLength,
    mockPreviousPeriodData.avgSessionLength
  );
  const avgResponseTimeTrend = calculateTrendPercentage(
    avgResponseTime,
    mockPreviousPeriodData.avgResponseTime
  );

  // Calculate additional metrics
  const totalTokens = 0;
  const totalTokensEur = 0;
  const avgDailyCosts =
    numDaysWithSessions > 0 ? totalTokensEur / numDaysWithSessions : 0;
  const peakUsageTime = calculatePeakUsageTime(metrics.hourlySessionCounts);
  const resolvedChatsPercentage =
    totalSessions > 0
      ? (metrics.counters.resolvedChatsCount / totalSessions) * 100
      : 0;
  const topQuestions = calculateTopQuestions(metrics.questionCounts);

  return {
    totalSessions,
    uniqueUsers,
    avgSessionLength,
    avgResponseTime,
    escalatedCount: metrics.counters.escalatedCount,
    forwardedCount: metrics.counters.forwardedHrCount,
    sentimentPositiveCount: metrics.sentimentCounts.sentimentPositiveCount,
    sentimentNeutralCount: metrics.sentimentCounts.sentimentNeutralCount,
    sentimentNegativeCount: metrics.sentimentCounts.sentimentNegativeCount,
    days: byDay,
    categories: byCategory,
    languages: byLanguage,
    countries: byCountry,
    tokensByDay,
    tokensCostByDay,
    totalTokens,
    totalTokensEur,
    wordCloudData,
    belowThresholdCount: metrics.counters.alerts,
    avgSessionsPerDay,
    sessionTrend: totalSessionsTrend,
    usersTrend: uniqueUsersTrend,
    avgSessionTimeTrend: avgSessionLengthTrend,
    avgResponseTimeTrend: -avgResponseTimeTrend,
    sentimentThreshold: companyConfig.sentimentAlert,
    lastUpdated: Date.now(),
    totalSessionDuration: metrics.sessionDurationTotals.totalSessionDuration,
    validSessionsForDuration:
      metrics.sessionDurationTotals.validSessionsForDuration,
    avgDailyCosts,
    peakUsageTime,
    resolvedChatsPercentage,
    topQuestions,
  };
}
