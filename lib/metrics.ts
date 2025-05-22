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
  const byCountry: CountryMetrics = {}; // Added for country data
  const tokensByDay: DayMetrics = {};
  const tokensCostByDay: DayMetrics = {};

  let escalated = 0,
    forwarded = 0;
  let totalSentiment = 0,
    sentimentCount = 0;
  let totalResponse = 0,
    responseCount = 0;
  let totalTokens = 0,
    totalTokensEur = 0;

  // For sentiment distribution
  let sentimentPositive = 0,
    sentimentNegative = 0,
    sentimentNeutral = 0;

  // Calculate total session duration in minutes
  let totalDuration = 0;
  let durationCount = 0;

  const wordCounts: { [key: string]: number } = {}; // For WordCloud

  sessions.forEach((s) => {
    const day = s.startTime.toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;

    if (s.category) byCategory[s.category] = (byCategory[s.category] || 0) + 1;
    if (s.language) byLanguage[s.language] = (byLanguage[s.language] || 0) + 1;
    if (s.country) byCountry[s.country] = (byCountry[s.country] || 0) + 1; // Populate byCountry

    // Process token usage by day
    if (s.tokens) {
      tokensByDay[day] = (tokensByDay[day] || 0) + s.tokens;
    }

    // Process token cost by day
    if (s.tokensEur) {
      tokensCostByDay[day] = (tokensCostByDay[day] || 0) + s.tokensEur;
    }

    if (s.endTime) {
      const duration =
        (s.endTime.getTime() - s.startTime.getTime()) / (1000 * 60); // minutes
      
      // Sanity check: Only include sessions with reasonable durations (less than 24 hours)
      const MAX_REASONABLE_DURATION = 24 * 60; // 24 hours in minutes
      if (duration > 0 && duration < MAX_REASONABLE_DURATION) {
        totalDuration += duration;
        durationCount++;
      }
    }

    if (s.escalated) escalated++;
    if (s.forwardedHr) forwarded++;

    if (s.sentiment != null) {
      totalSentiment += s.sentiment;
      sentimentCount++;

      // Classify sentiment
      if (s.sentiment > 0.3) {
        sentimentPositive++;
      } else if (s.sentiment < -0.3) {
        sentimentNegative++;
      } else {
        sentimentNeutral++;
      }
    }

    if (s.avgResponseTime != null) {
      totalResponse += s.avgResponseTime;
      responseCount++;
    }

    totalTokens += s.tokens || 0;
    totalTokensEur += s.tokensEur || 0;

    // Process transcript for WordCloud
    if (s.transcriptContent) {
      const words = s.transcriptContent.toLowerCase().match(/\b\w+\b/g); // Split into words, lowercase
      if (words) {
        words.forEach((word) => {
          const cleanedWord = word.replace(/[^a-z0-9]/gi, ""); // Remove punctuation
          if (
            cleanedWord &&
            !stopWords.has(cleanedWord) &&
            cleanedWord.length > 2
          ) {
            // Check if not a stop word and length > 2
            wordCounts[cleanedWord] = (wordCounts[cleanedWord] || 0) + 1;
          }
        });
      }
    }
  });

  // Now add sentiment alert logic:
  let belowThreshold = 0;
  const threshold = companyConfig.sentimentAlert ?? null;
  if (threshold != null) {
    for (const s of sessions) {
      if (s.sentiment != null && s.sentiment < threshold) belowThreshold++;
    }
  }

  // Calculate average sessions per day
  const dayCount = Object.keys(byDay).length;
  const avgSessionsPerDay = dayCount > 0 ? total / dayCount : 0;

  // Calculate average session length
  const avgSessionLength =
    durationCount > 0 ? totalDuration / durationCount : null;

  // Prepare wordCloudData
  const wordCloudData: WordCloudWord[] = Object.entries(wordCounts)
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 500); // Take top 500 words

  return {
    totalSessions: total,
    avgSessionsPerDay,
    avgSessionLength,
    days: byDay,
    languages: byLanguage,
    categories: byCategory, // This will be empty if we are not using categories for word cloud
    countries: byCountry, // Added countries to the result
    belowThresholdCount: belowThreshold,
    // Additional metrics not in the interface - using type assertion
    escalatedCount: escalated,
    forwardedCount: forwarded,
    avgSentiment: sentimentCount ? totalSentiment / sentimentCount : undefined,
    avgResponseTime: responseCount ? totalResponse / responseCount : undefined,
    totalTokens,
    totalTokensEur,
    sentimentThreshold: threshold,
    lastUpdated: Date.now(), // Add current timestamp

    // New metrics for enhanced dashboard
    sentimentPositiveCount: sentimentPositive,
    sentimentNeutralCount: sentimentNeutral,
    sentimentNegativeCount: sentimentNegative,
    tokensByDay,
    tokensCostByDay,
    wordCloudData, // Added word cloud data
  };
}
