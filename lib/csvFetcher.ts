// Fetches, parses, and returns chat session data for a company from a CSV URL
import fetch from "node-fetch";
import { parse } from "csv-parse/sync";

// This type is used internally for parsing the CSV records
interface CSVRecord {
  session_id: string;
  start_time: string;
  end_time?: string;
  ip_address?: string;
  country?: string;
  language?: string;
  messages_sent?: string;
  sentiment?: string;
  escalated?: string;
  forwarded_hr?: string;
  full_transcript_url?: string;
  avg_response_time?: string;
  tokens?: string;
  tokens_eur?: string;
  category?: string;
  initial_msg?: string;
  [key: string]: string | undefined;
}

interface SessionData {
  id: string;
  sessionId: string;
  startTime: Date;
  endTime: Date | null;
  ipAddress?: string;
  country?: string;
  language?: string | null;
  messagesSent: number;
  sentiment: number | null;
  escalated: boolean;
  forwardedHr: boolean;
  fullTranscriptUrl?: string | null;
  avgResponseTime: number | null;
  tokens: number;
  tokensEur: number;
  category?: string | null;
  initialMsg?: string;
}

/**
 * Normalizes language values to a standard set
 * @param languageStr The raw language string from CSV
 * @returns A normalized language string
 */
function normalizeLanguage(languageStr?: string): string | null {
  if (!languageStr) return null;

  const normalized = languageStr.toLowerCase().trim();

  // Map of language variations to standard names
  const languageMap: Record<string, string> = {
    // English variations
    english: "English",
    en: "English",
    eng: "English",

    // Dutch variations
    dutch: "Dutch",
    nederlands: "Dutch",
    nl: "Dutch",
    nederland: "Dutch",
    netherland: "Dutch",
    netherlands: "Dutch",
    hollands: "Dutch",
    niederländisch: "Dutch",
    nizozemski: "Dutch",

    // Other languages that might appear
    bosnian: "Bosnian",
    bs: "Bosnian",
    turkish: "Turkish",
    tr: "Turkish",
    turks: "Turkish",
    german: "German",
    de: "German",
    duits: "German",
    french: "French",
    fr: "French",
    frans: "French",
    spanish: "Spanish",
    es: "Spanish",
    spaans: "Spanish",
  };

  return languageMap[normalized] || "Other";
}

/**
 * Normalizes category values to standard groups
 * @param categoryStr The raw category string from CSV
 * @returns A normalized category string
 */
function normalizeCategory(categoryStr?: string): string | null {
  if (!categoryStr) return null;

  const normalized = categoryStr.toLowerCase().trim();

  // Define category groups using keywords
  const categoryMapping: Record<string, string[]> = {
    "Onboarding": [
      "onboarding",
      "start",
      "begin",
      "new",
      "orientation",
      "welcome",
      "intro",
      "getting started",
      "documents",
      "documenten",
      "first day",
      "eerste dag",
    ],
    "General Information": [
      "general",
      "algemeen",
      "info",
      "information",
      "informatie",
      "question",
      "vraag",
      "inquiry",
      "chat",
      "conversation",
      "gesprek",
      "talk",
    ],
    "Greeting": [
      "greeting",
      "greet",
      "hello",
      "hi",
      "hey",
      "welcome",
      "hallo",
      "hoi",
      "greetings",
    ],
    "HR & Payroll": [
      "salary",
      "salaris",
      "pay",
      "payroll",
      "loon",
      "loonstrook",
      "hr",
      "human resources",
      "benefits",
      "vacation",
      "leave",
      "verlof",
      "maaltijdvergoeding",
      "vergoeding",
    ],
    "Schedules & Hours": [
      "schedule",
      "hours",
      "tijd",
      "time",
      "roster",
      "rooster",
      "planning",
      "shift",
      "dienst",
      "working hours",
      "werktijden",
      "openingstijden",
    ],
    "Role & Responsibilities": [
      "role",
      "job",
      "function",
      "functie",
      "task",
      "taak",
      "responsibilities",
      "leidinggevende",
      "manager",
      "teamleider",
      "supervisor",
      "team",
      "lead",
    ],
    "Technical Support": [
      "technical",
      "tech",
      "support",
      "laptop",
      "computer",
      "system",
      "systeem",
      "it",
      "software",
      "hardware",
    ],
    "Offboarding": [
      "offboarding",
      "leave",
      "exit",
      "quit",
      "resign",
      "resignation",
      "ontslag",
      "vertrek",
      "afsluiting",
    ],
  };

  // Try to match the category using keywords
  for (const [category, keywords] of Object.entries(categoryMapping)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }

  // If no match, return "Other"
  return "Other";
}

/**
 * Converts sentiment string values to numeric scores
 * @param sentimentStr The sentiment string from the CSV
 * @returns A numeric score representing the sentiment
 */
function mapSentimentToScore(sentimentStr?: string): number | null {
  if (!sentimentStr) return null;

  // Convert to lowercase for case-insensitive matching
  const sentiment = sentimentStr.toLowerCase();

  // Map sentiment strings to numeric values on a scale from -1 to 2
  const sentimentMap: Record<string, number> = {
    happy: 1.0,
    excited: 1.5,
    positive: 0.8,
    neutral: 0.0,
    playful: 0.7,
    negative: -0.8,
    angry: -1.0,
    sad: -0.7,
    frustrated: -0.9,
    positief: 0.8, // Dutch
    neutraal: 0.0, // Dutch
    negatief: -0.8, // Dutch
    positivo: 0.8, // Spanish/Italian
    neutro: 0.0, // Spanish/Italian
    negativo: -0.8, // Spanish/Italian
    yes: 0.5, // For any "yes" sentiment
    no: -0.5, // For any "no" sentiment
  };

  return sentimentMap[sentiment] !== undefined
    ? sentimentMap[sentiment]
    : isNaN(parseFloat(sentiment))
      ? null
      : parseFloat(sentiment);
}

/**
 * Checks if a string value should be considered as boolean true
 * @param value The string value to check
 * @returns True if the string indicates a positive/true value
 */
function isTruthyValue(value?: string): boolean {
  if (!value) return false;

  const truthyValues = [
    "1",
    "true",
    "yes",
    "y",
    "ja",
    "si",
    "oui",
    "да",
    "да",
    "はい",
  ];

  return truthyValues.includes(value.toLowerCase());
}

export async function fetchAndParseCsv(
  url: string,
  username?: string,
  password?: string,
): Promise<Partial<SessionData>[]> {
  const authHeader =
    username && password
      ? "Basic " + Buffer.from(`${username}:${password}`).toString("base64")
      : undefined;

  const res = await fetch(url, {
    headers: authHeader ? { Authorization: authHeader } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch CSV: " + res.statusText);

  const text = await res.text();

  // Parse without expecting headers, using known order
  const records: CSVRecord[] = parse(text, {
    delimiter: ",",
    columns: [
      "session_id",
      "start_time",
      "end_time",
      "ip_address",
      "country",
      "language",
      "messages_sent",
      "sentiment",
      "escalated",
      "forwarded_hr",
      "full_transcript_url",
      "avg_response_time",
      "tokens",
      "tokens_eur",
      "category",
      "initial_msg",
    ],
    from_line: 1,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });

  // Helper function to safely parse dates
  function safeParseDate(dateStr?: string): Date | null {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) ? date : null;
  }

  // Coerce types for relevant columns
  return records.map((r) => ({
    id: r.session_id,
    startTime: safeParseDate(r.start_time) || new Date(), // Fallback to current date if invalid
    endTime: safeParseDate(r.end_time),
    ipAddress: r.ip_address,
    country: r.country,
    language: normalizeLanguage(r.language),
    messagesSent: Number(r.messages_sent) || 0,
    sentiment: mapSentimentToScore(r.sentiment),
    escalated: isTruthyValue(r.escalated),
    forwardedHr: isTruthyValue(r.forwarded_hr),
    fullTranscriptUrl: r.full_transcript_url,
    avgResponseTime: r.avg_response_time
      ? parseFloat(r.avg_response_time)
      : null,
    tokens: Number(r.tokens) || 0,
    tokensEur: r.tokens_eur ? parseFloat(r.tokens_eur) : 0,
    category: normalizeCategory(r.category),
    initialMsg: r.initial_msg,
  }));
}
