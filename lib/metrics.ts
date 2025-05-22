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
  const total = sessions.length;
  const byDay: DayMetrics = {};
  const byCategory: CategoryMetrics = {};
  const byLanguage: LanguageMetrics = {};
  const byCountry: CountryMetrics = {};
  const tokensByDay: DayMetrics = {};
  const tokensCostByDay: DayMetrics = {};

  let escalated = 0,
    forwarded = 0;
  let totalSentiment = 0,
    sentimentCount = 0;
  let totalResponseTimeCurrent = 0, // Renamed to avoid conflict
    responseCountCurrent = 0; // Renamed to avoid conflict
  let totalTokens = 0,
    totalTokensEur = 0;

  let sentimentPositive = 0,
    sentimentNegative = 0,
    sentimentNeutral = 0;

  let totalDurationCurrent = 0, // Renamed to avoid conflict
    durationCountCurrent = 0; // Renamed to avoid conflict

  const wordCounts: { [key: string]: number } = {};
  const uniqueUserIdsCurrent = new Set<string>();

  let minDateCurrentPeriod = new Date();
  if (sessions.length > 0) {
    minDateCurrentPeriod = new Date(
      Math.min(...sessions.map((s) => s.startTime.getTime()))
    );
  }

  const prevPeriodEndDate = new Date(minDateCurrentPeriod);
  prevPeriodEndDate.setDate(prevPeriodEndDate.getDate() - 1);
  const prevPeriodStartDate = new Date(prevPeriodEndDate);
  prevPeriodStartDate.setDate(prevPeriodStartDate.getDate() - 6); // 7-day previous period

  let prevPeriodSessionsCount = 0;
  const prevPeriodUniqueUserIds = new Set<string>();
  let prevPeriodTotalDuration = 0;
  let prevPeriodDurationCount = 0;
  let prevPeriodTotalResponseTime = 0;
  let prevPeriodResponseCount = 0;

  sessions.forEach((s) => {
    const sessionDate = s.startTime;
    const day = sessionDate.toISOString().slice(0, 10);

    // Aggregate current period data
    byDay[day] = (byDay[day] || 0) + 1;
    if (s.userId) {
      uniqueUserIdsCurrent.add(s.userId);
    }

    if (s.category) byCategory[s.category] = (byCategory[s.category] || 0) + 1;
    if (s.language) byLanguage[s.language] = (byLanguage[s.language] || 0) + 1;
    if (s.country) byCountry[s.country] = (byCountry[s.country] || 0) + 1;

    if (s.tokens) {
      tokensByDay[day] = (tokensByDay[day] || 0) + s.tokens;
    }
    if (s.tokensEur) {
      tokensCostByDay[day] = (tokensCostByDay[day] || 0) + s.tokensEur;
    }

    if (s.endTime) {
      const duration =
        (s.endTime.getTime() - sessionDate.getTime()) / (1000 * 60); // minutes
      const MAX_REASONABLE_DURATION = 24 * 60;
      if (duration > 0 && duration < MAX_REASONABLE_DURATION) {
        totalDurationCurrent += duration;
        durationCountCurrent++;
      }
    }

    if (s.escalated) escalated++;
    if (s.forwardedHr) forwarded++;

    if (s.sentiment != null) {
      totalSentiment += s.sentiment;
      sentimentCount++;
      if (s.sentiment > 0.3) sentimentPositive++;
      else if (s.sentiment < -0.3) sentimentNegative++;
      else sentimentNeutral++;
    }

    if (s.avgResponseTime != null) {
      totalResponseTimeCurrent += s.avgResponseTime;
      responseCountCurrent++;
    }

    totalTokens += s.tokens || 0;
    totalTokensEur += s.tokensEur || 0;

    if (s.transcriptContent) {
      const words = s.transcriptContent.toLowerCase().match(/\b\w+\b/g);
      if (words) {
        words.forEach((word) => {
          const cleanedWord = word.replace(/[^a-z0-9]/gi, "");
          if (
            cleanedWord &&
            !stopWords.has(cleanedWord) &&
            cleanedWord.length > 2
          ) {
            wordCounts[cleanedWord] = (wordCounts[cleanedWord] || 0) + 1;
          }
        });
      }
    }

    // Aggregate previous period data (if session falls within the previous period range)
    if (
      sessionDate >= prevPeriodStartDate &&
      sessionDate <= prevPeriodEndDate
    ) {
      prevPeriodSessionsCount++;
      if (s.userId) {
        prevPeriodUniqueUserIds.add(s.userId);
      }
      if (s.endTime) {
        const duration =
          (s.endTime.getTime() - sessionDate.getTime()) / (1000 * 60);
        const MAX_REASONABLE_DURATION = 24 * 60;
        if (duration > 0 && duration < MAX_REASONABLE_DURATION) {
          prevPeriodTotalDuration += duration;
          prevPeriodDurationCount++;
        }
      }
      if (s.avgResponseTime != null) {
        prevPeriodTotalResponseTime += s.avgResponseTime;
        prevPeriodResponseCount++;
      }
    }
  });

  const calculateTrend = (current: number, previous: number): number => {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    const trend = ((current - previous) / previous) * 100;
    return parseFloat(trend.toFixed(1));
  };

  const sessionTrend = calculateTrend(total, prevPeriodSessionsCount);
  const usersTrend = calculateTrend(
    uniqueUserIdsCurrent.size,
    prevPeriodUniqueUserIds.size
  );

  const avgSessionLengthCurrent =
    durationCountCurrent > 0 ? totalDurationCurrent / durationCountCurrent : 0;
  const avgSessionLengthPrevious =
    prevPeriodDurationCount > 0
      ? prevPeriodTotalDuration / prevPeriodDurationCount
      : 0;
  const avgSessionTimeTrend = calculateTrend(
    avgSessionLengthCurrent,
    avgSessionLengthPrevious
  );

  const avgResponseTimeCurrentPeriod =
    responseCountCurrent > 0
      ? totalResponseTimeCurrent / responseCountCurrent
      : 0;
  const avgResponseTimePreviousPeriod =
    prevPeriodResponseCount > 0
      ? prevPeriodTotalResponseTime / prevPeriodResponseCount
      : 0;
  const avgResponseTimeTrend = calculateTrend(
    avgResponseTimeCurrentPeriod,
    avgResponseTimePreviousPeriod
  );

  let belowThreshold = 0;
  const threshold = companyConfig.sentimentAlert ?? null;
  if (threshold != null) {
    for (const s of sessions) {
      if (s.sentiment != null && s.sentiment < threshold) belowThreshold++;
    }
  }

  const dayCount = Object.keys(byDay).length;
  const avgSessionsPerDay = dayCount > 0 ? total / dayCount : 0;

  const wordCloudData: WordCloudWord[] = Object.entries(wordCounts)
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 500);

  return {
    totalSessions: total,
    avgSessionsPerDay: parseFloat(avgSessionsPerDay.toFixed(1)),
    avgSessionLength: parseFloat(avgSessionLengthCurrent.toFixed(1)),
    days: byDay,
    languages: byLanguage,
    categories: byCategory,
    countries: byCountry,
    belowThresholdCount: belowThreshold,
    escalatedCount: escalated,
    forwardedCount: forwarded,
    avgSentiment: sentimentCount
      ? parseFloat((totalSentiment / sentimentCount).toFixed(2))
      : undefined,
    avgResponseTime: parseFloat(avgResponseTimeCurrentPeriod.toFixed(2)),
    totalTokens,
    totalTokensEur,
    sentimentThreshold: threshold,
    lastUpdated: Date.now(),
    sentimentPositiveCount: sentimentPositive,
    sentimentNeutralCount: sentimentNeutral,
    sentimentNegativeCount: sentimentNegative,
    tokensByDay,
    tokensCostByDay,
    wordCloudData,
    uniqueUsers: uniqueUserIdsCurrent.size,
    sessionTrend,
    usersTrend,
    avgSessionTimeTrend,
    avgResponseTimeTrend,
  };
}
