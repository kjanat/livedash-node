// Functions to calculate metrics over sessions
import {
  ChatSession,
  DayMetrics,
  CategoryMetrics,
  LanguageMetrics,
  CountryMetrics, // Added CountryMetrics
  MetricsResult,
  WordCloudWord, // Added WordCloudWord
  TopQuestion, // Added TopQuestion
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

export function sessionMetrics(
  sessions: ChatSession[],
  companyConfig: CompanyConfig = {}
): MetricsResult {
  // Filter out invalid data sessions for analytics
  const validSessions = sessions.filter(session => {
    // Include sessions that are either:
    // 1. Not processed yet (validData field doesn't exist or is undefined)
    // 2. Processed and marked as valid (validData === true)
    return session.validData !== false;
  });

  const totalSessions = validSessions.length; // Only count valid sessions
  const totalRawSessions = sessions.length; // Keep track of all sessions for debugging
  const byDay: DayMetrics = {};
  const byCategory: CategoryMetrics = {};
  const byLanguage: LanguageMetrics = {};
  const byCountry: CountryMetrics = {};
  const tokensByDay: DayMetrics = {};
  const tokensCostByDay: DayMetrics = {};

  let escalatedCount = 0; // Renamed from 'escalated' to match MetricsResult
  let forwardedHrCount = 0; // Renamed from 'forwarded' to match MetricsResult

  // Variables for calculations
  const uniqueUserIds = new Set<string>();
  let totalSessionDuration = 0;
  let validSessionsForDuration = 0;
  let totalResponseTime = 0;
  let validSessionsForResponseTime = 0;
  let sentimentPositiveCount = 0;
  let sentimentNeutralCount = 0;
  let sentimentNegativeCount = 0;
  let totalTokens = 0;
  let totalTokensEur = 0;
  const wordCounts: { [key: string]: number } = {};
  const alerts = 0;

  // New metrics variables
  const hourlySessionCounts: { [hour: string]: number } = {};
  let resolvedChatsCount = 0;
  const questionCounts: { [question: string]: number } = {};

  for (const session of sessions) {
    // Track hourly usage for peak time calculation
    if (session.startTime) {
      const hour = new Date(session.startTime).getHours();
      const hourKey = `${hour.toString().padStart(2, "0")}:00`;
      hourlySessionCounts[hourKey] = (hourlySessionCounts[hourKey] || 0) + 1;
    }

    // Count resolved chats (sessions that have ended and are not escalated)
    if (session.endTime && !session.escalated) {
      resolvedChatsCount++;
    }
    // Unique Users: Prefer non-empty ipAddress, fallback to non-empty sessionId
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

    // Avg. Session Time
    if (session.startTime && session.endTime) {
      const startTimeMs = new Date(session.startTime).getTime();
      const endTimeMs = new Date(session.endTime).getTime();

      if (isNaN(startTimeMs)) {
        console.warn(
          `[metrics] Invalid startTime for session ${session.id || session.sessionId}: ${session.startTime}`
        );
      }
      if (isNaN(endTimeMs)) {
        console.warn(
          `[metrics] Invalid endTime for session ${session.id || session.sessionId}: ${session.endTime}`
        );
      }

      if (!isNaN(startTimeMs) && !isNaN(endTimeMs)) {
        const timeDifference = endTimeMs - startTimeMs; // Calculate the signed delta
        // Use the absolute difference for duration, ensuring it's not negative.
        // If times are identical, duration will be 0.
        // If endTime is before startTime, this still yields a positive duration representing the magnitude of the difference.
        const duration = Math.abs(timeDifference);
        // console.log(
        //   `[metrics] duration is ${duration} for session ${session.id || session.sessionId}`
        // );

        totalSessionDuration += duration; // Add this duration

        if (timeDifference < 0) {
          // Log a specific warning if the original endTime was before startTime
          console.warn(
            `[metrics] endTime (${session.endTime}) was before startTime (${session.startTime}) for session ${session.id || session.sessionId}. Using absolute difference as duration (${(duration / 1000).toFixed(2)} seconds).`
          );
        } else if (timeDifference === 0) {
          // // Optionally, log if times are identical, though this might be verbose if common
          // console.log(
          //   `[metrics] startTime and endTime are identical for session ${session.id || session.sessionId}. Duration is 0.`
          // );
        }
        // If timeDifference > 0, it's a normal positive duration, no special logging needed here for that case.

        validSessionsForDuration++; // Count this session for averaging
      }
    } else {
      if (!session.startTime) {
        console.warn(
          `[metrics] Missing startTime for session ${session.id || session.sessionId}`
        );
      }
      if (!session.endTime) {
        // This is a common case for ongoing sessions, might not always be an error
        console.log(
          `[metrics] Missing endTime for session ${session.id || session.sessionId} - likely ongoing or data issue.`
        );
      }
    }

    // Avg. Response Time
    if (
      session.avgResponseTime !== undefined &&
      session.avgResponseTime !== null &&
      session.avgResponseTime >= 0
    ) {
      totalResponseTime += session.avgResponseTime;
      validSessionsForResponseTime++;
    }

    // Escalated and Forwarded
    if (session.escalated) escalatedCount++;
    if (session.forwardedHr) forwardedHrCount++;

    // Sentiment
    if (session.sentiment === "positive") {
      sentimentPositiveCount++;
    } else if (session.sentiment === "neutral") {
      sentimentNeutralCount++;
    } else if (session.sentiment === "negative") {
      sentimentNegativeCount++;
    }



    // Tokens
    if (session.tokens !== undefined && session.tokens !== null) {
      totalTokens += session.tokens;
    }
    if (session.tokensEur !== undefined && session.tokensEur !== null) {
      totalTokensEur += session.tokensEur;
    }

    // Daily metrics
    const day = new Date(session.startTime).toISOString().split("T")[0];
    byDay[day] = (byDay[day] || 0) + 1; // Sessions per day
    if (session.tokens !== undefined && session.tokens !== null) {
      tokensByDay[day] = (tokensByDay[day] || 0) + session.tokens;
    }
    if (session.tokensEur !== undefined && session.tokensEur !== null) {
      tokensCostByDay[day] = (tokensCostByDay[day] || 0) + session.tokensEur;
    }

    // Category metrics
    if (session.category) {
      byCategory[session.category] = (byCategory[session.category] || 0) + 1;
    }

    // Language metrics
    if (session.language) {
      byLanguage[session.language] = (byLanguage[session.language] || 0) + 1;
    }

    // Country metrics
    if (session.country) {
      byCountry[session.country] = (byCountry[session.country] || 0) + 1;
    }

    // Extract questions from session
    const extractQuestions = () => {
      // 1. Extract from questions JSON field
      if (session.questions) {
        try {
          const questionsArray = JSON.parse(session.questions);
          if (Array.isArray(questionsArray)) {
            questionsArray.forEach((question: string) => {
              if (question && question.trim().length > 0) {
                const cleanQuestion = question.trim();
                questionCounts[cleanQuestion] =
                  (questionCounts[cleanQuestion] || 0) + 1;
              }
            });
          }
        } catch (error) {
          console.warn(
            `[metrics] Failed to parse questions JSON for session ${session.id}: ${error}`
          );
        }
      }

      // 2. Extract questions from user messages (if available)
      if (session.messages) {
        session.messages
          .filter((msg) => msg.role === "User")
          .forEach((msg) => {
            const content = msg.content.trim();
            // Simple heuristic: if message ends with ? or contains question words, treat as question
            if (
              content.endsWith("?") ||
              /\b(what|when|where|why|how|who|which|can|could|would|will|is|are|do|does|did)\b/i.test(
                content
              )
            ) {
              questionCounts[content] = (questionCounts[content] || 0) + 1;
            }
          });
      }

      // 3. Extract questions from initial message as fallback
      if (session.initialMsg) {
        const content = session.initialMsg.trim();
        if (
          content.endsWith("?") ||
          /\b(what|when|where|why|how|who|which|can|could|would|will|is|are|do|does|did)\b/i.test(
            content
          )
        ) {
          questionCounts[content] = (questionCounts[content] || 0) + 1;
        }
      }
    };

    extractQuestions();

    // Word Cloud Data (from initial message and transcript content)
    const processTextForWordCloud = (text: string | undefined | null) => {
      if (!text) return;
      const words = text
        .toLowerCase()
        .replace(/[^\w\s'-]/gi, "")
        .split(/\s+/); // Keep apostrophes and hyphens
      for (const word of words) {
        const cleanedWord = word.replace(/^['-]|['-]$/g, ""); // Remove leading/trailing apostrophes/hyphens
        if (
          cleanedWord &&
          !stopWords.has(cleanedWord) &&
          cleanedWord.length > 2
        ) {
          wordCounts[cleanedWord] = (wordCounts[cleanedWord] || 0) + 1;
        }
      }
    };
    processTextForWordCloud(session.initialMsg);
    // Note: transcriptContent is not available in ChatSession type
    // Could be added later if transcript parsing is implemented
  }

  const uniqueUsers = uniqueUserIds.size;
  const avgSessionLength =
    validSessionsForDuration > 0
      ? totalSessionDuration / validSessionsForDuration / 1000 // Convert ms to minutes
      : 0;
  const avgResponseTime =
    validSessionsForResponseTime > 0
      ? totalResponseTime / validSessionsForResponseTime
      : 0; // in seconds

  const wordCloudData: WordCloudWord[] = Object.entries(wordCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 50) // Top 50 words
    .map(([text, value]) => ({ text, value }));

  // Calculate avgSessionsPerDay
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

  // Calculate new metrics

  // 1. Average Daily Costs (euros)
  const avgDailyCosts =
    numDaysWithSessions > 0 ? totalTokensEur / numDaysWithSessions : 0;

  // 2. Peak Usage Time
  let peakUsageTime = "N/A";
  if (Object.keys(hourlySessionCounts).length > 0) {
    const peakHour = Object.entries(hourlySessionCounts).sort(
      ([, a], [, b]) => b - a
    )[0][0];
    const peakHourNum = parseInt(peakHour.split(":")[0]);
    const endHour = (peakHourNum + 1) % 24;
    peakUsageTime = `${peakHour}-${endHour.toString().padStart(2, "0")}:00`;
  }

  // 3. Resolved Chats Percentage
  const resolvedChatsPercentage =
    totalSessions > 0 ? (resolvedChatsCount / totalSessions) * 100 : 0;

  // 4. Top 5 Asked Questions
  const topQuestions: TopQuestion[] = Object.entries(questionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5) // Top 5 questions
    .map(([question, count]) => ({ question, count }));

  // console.log("Debug metrics calculation:", {
  //   totalSessionDuration,
  //   validSessionsForDuration,
  //   calculatedAvgSessionLength: avgSessionLength,
  // });

  return {
    totalSessions,
    uniqueUsers,
    avgSessionLength, // Corrected to match MetricsResult interface
    avgResponseTime, // Corrected to match MetricsResult interface
    escalatedCount,
    forwardedCount: forwardedHrCount, // Corrected to match MetricsResult interface (forwardedCount)
    sentimentPositiveCount,
    sentimentNeutralCount,
    sentimentNegativeCount,
    days: byDay, // Corrected to match MetricsResult interface (days)
    categories: byCategory, // Corrected to match MetricsResult interface (categories)
    languages: byLanguage, // Corrected to match MetricsResult interface (languages)
    countries: byCountry, // Corrected to match MetricsResult interface (countries)
    tokensByDay,
    tokensCostByDay,
    totalTokens,
    totalTokensEur,
    wordCloudData,
    belowThresholdCount: alerts, // Corrected to match MetricsResult interface (belowThresholdCount)
    avgSessionsPerDay, // Added to satisfy MetricsResult interface
    // Map trend values to the expected property names in MetricsResult
    sessionTrend: totalSessionsTrend,
    usersTrend: uniqueUsersTrend,
    avgSessionTimeTrend: avgSessionLengthTrend,
    // For response time, a negative trend is actually positive (faster responses are better)
    avgResponseTimeTrend: -avgResponseTimeTrend, // Invert as lower response time is better
    // Additional fields
    sentimentThreshold: companyConfig.sentimentAlert,
    lastUpdated: Date.now(),
    totalSessionDuration,
    validSessionsForDuration,

    // New metrics
    avgDailyCosts,
    peakUsageTime,
    resolvedChatsPercentage,
    topQuestions,
  };
}
