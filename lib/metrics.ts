// Functions to calculate metrics over sessions
import {
  ChatSession,
  DayMetrics,
  CategoryMetrics,
  LanguageMetrics,
  CountryMetrics, // Added CountryMetrics
  MetricsResult,
  WordCloudWord, // Added WordCloudWord
} from "./types";

interface CompanyConfig {
  sentimentAlert?: number;
}

// List of common stop words - this can be expanded
const stopWords = new Set([
  "assistant",
  "user",
  // Web
  "com",
  "www",
  "http",
  "https",
  "www2",
  "href",
  "html",
  "php",
  "js",
  "css",
  "xml",
  "json",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "svg",
  "org",
  "net",
  "co",
  "io",
  // English stop words
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "should",
  "can",
  "could",
  "may",
  "might",
  "must",
  "am",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "its",
  "our",
  "their",
  "mine",
  "yours",
  "hers",
  "ours",
  "theirs",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "for",
  "with",
  "about",
  "against",
  "between",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "from",
  "up",
  "down",
  "out",
  "off",
  "over",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "s",
  "t",
  "just",
  "don",
  "shouldve",
  "now",
  "d",
  "ll",
  "m",
  "o",
  "re",
  "ve",
  "y",
  "ain",
  "aren",
  "couldn",
  "didn",
  "doesn",
  "hadn",
  "hasn",
  "haven",
  "isn",
  "ma",
  "mightn",
  "mustn",
  "needn",
  "shan",
  "shouldn",
  "wasn",
  "weren",
  "won",
  "wouldn",
  "hi",
  "hello",
  "thanks",
  "thank",
  "please",
  "ok",
  "okay",
  "yes",
  "yeah",
  "bye",
  "goodbye",
  // French stop words
  "la",
  "le",
  "les",
  "un",
  "une",
  "des",
  "et",
  "ou",
  "mais",
  "donc",
  // Dutch stop words
  "dit",
  "ben",
  "de",
  "het",
  "ik",
  "jij",
  "hij",
  "zij",
  "wij",
  "jullie",
  "deze",
  "dit",
  "dat",
  "die",
  "een",
  "en",
  "of",
  "maar",
  "want",
  "omdat",
  "dus",
  "als",
  "ook",
  "dan",
  "nu",
  "nog",
  "al",
  "naar",
  "voor",
  "van",
  "door",
  "met",
  "bij",
  "tot",
  "om",
  "over",
  "tussen",
  "onder",
  "boven",
  "tegen",
  "aan",
  "uit",
  "sinds",
  "tijdens",
  "binnen",
  "buiten",
  "zonder",
  "volgens",
  "dankzij",
  "ondanks",
  "behalve",
  "mits",
  "tenzij",
  "hoewel",
  "alhoewel",
  "toch",
  "anders",
  "echter",
  "wel",
  "niet",
  "geen",
  "iets",
  "niets",
  "veel",
  "weinig",
  "meer",
  "meest",
  "elk",
  "ieder",
  "sommige",
  "hoe",
  "wat",
  "waar",
  "wie",
  "wanneer",
  "waarom",
  "welke",
  "wordt",
  "worden",
  "werd",
  "werden",
  "geworden",
  "zijn",
  "ben",
  "bent",
  "was",
  "waren",
  "geweest",
  "hebben",
  "heb",
  "hebt",
  "heeft",
  "had",
  "hadden",
  "gehad",
  "kunnen",
  "kan",
  "kunt",
  "kon",
  "konden",
  "zullen",
  "zal",
  "zult",
  // Add more domain-specific stop words if necessary
]);

export function sessionMetrics(
  sessions: ChatSession[],
  companyConfig: CompanyConfig = {}
): MetricsResult {
  const totalSessions = sessions.length; // Renamed from 'total' for clarity
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
  let alerts = 0;

  for (const session of sessions) {
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
    if (session.sentiment !== undefined && session.sentiment !== null) {
      // Example thresholds, adjust as needed
      if (session.sentiment > 0.3) sentimentPositiveCount++;
      else if (session.sentiment < -0.3) sentimentNegativeCount++;
      else sentimentNeutralCount++;
    }

    // Sentiment Alert Check
    if (
      companyConfig.sentimentAlert !== undefined &&
      session.sentiment !== undefined &&
      session.sentiment !== null &&
      session.sentiment < companyConfig.sentimentAlert
    ) {
      alerts++;
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
    processTextForWordCloud(session.transcriptContent);
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
    // Optional fields from MetricsResult that are not yet calculated can be added here or handled by the consumer
    // avgSentiment, sentimentThreshold, lastUpdated, sessionTrend, usersTrend, avgSessionTimeTrend, avgResponseTimeTrend
  };
}
