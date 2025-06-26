// Fetches, parses, and returns chat session data for a company from a CSV URL
import fetch from "node-fetch";
import { parse } from "csv-parse/sync";
import ISO6391 from "iso-639-1";
import countries from "i18n-iso-countries";

// Register locales for i18n-iso-countries
import enLocale from "i18n-iso-countries/langs/en.json" with { type: "json" };
countries.registerLocale(enLocale);

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
  country?: string | null;
  language?: string | null;
  messagesSent: number;
  sentiment?: string | null;
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
 * Passes through country data as-is (no mapping)
 * @param countryStr Raw country string from CSV
 * @returns The country string as-is or null if empty
 */
function getCountryCode(countryStr?: string): string | null | undefined {
  if (countryStr === undefined) return undefined;
  if (countryStr === null || countryStr === "") return null;

  const normalized = countryStr.trim();
  return normalized || null;
}

/**
 * Converts language names to ISO 639-1 codes
 * @param languageStr Raw language string from CSV
 * @returns ISO 639-1 language code or null if not found
 */
function getLanguageCode(languageStr?: string): string | null | undefined {
  if (languageStr === undefined) return undefined;
  if (languageStr === null || languageStr === "") return null;

  // Clean the input
  const normalized = languageStr.trim();
  if (!normalized) return null;

  // Direct ISO code check (if already a 2-letter code)
  if (normalized.length === 2 && normalized === normalized.toLowerCase()) {
    return ISO6391.validate(normalized) ? normalized : null;
  }

  // Special case mappings
  const languageMapping: Record<string, string> = {
    english: "en",
    English: "en",
    dutch: "nl",
    Dutch: "nl",
    nederlands: "nl",
    Nederlands: "nl",
    nl: "nl",
    bosnian: "bs",
    Bosnian: "bs",
    turkish: "tr",
    Turkish: "tr",
    german: "de",
    German: "de",
    deutsch: "de",
    Deutsch: "de",
    french: "fr",
    French: "fr",
    français: "fr",
    Français: "fr",
    spanish: "es",
    Spanish: "es",
    español: "es",
    Español: "es",
    italian: "it",
    Italian: "it",
    italiano: "it",
    Italiano: "it",
    nizozemski: "nl", // "Dutch" in some Slavic languages
  };

  // Check mapping
  if (normalized in languageMapping) {
    return languageMapping[normalized];
  }

  // Try to get code using the ISO6391 library
  try {
    const code = ISO6391.getCode(normalized);
    if (code) return code;
  } catch (error) {
    process.stderr.write(
      `[CSV] Error converting language name to code: ${normalized} - ${error}\n`
    );
  }
  // If all else fails, return null
  return null;
}

/**
 * Passes through category data as-is (no mapping)
 * @param categoryStr The raw category string from CSV
 * @returns The category string as-is or null if empty
 */
function normalizeCategory(categoryStr?: string): string | null {
  if (!categoryStr) return null;

  const normalized = categoryStr.trim();
  return normalized || null;
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

/**
 * Safely parses a date string into a Date object.
 * Handles potential errors and various formats, prioritizing D-M-YYYY HH:MM:SS.
 * @param dateStr The date string to parse.
 * @returns A Date object or null if parsing fails.
 */
function safeParseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;

  // Try to parse D-M-YYYY HH:MM:SS format (with hyphens or dots)
  const dateTimeRegex =
    /^(\d{1,2})[.-](\d{1,2})[.-](\d{4}) (\d{1,2}):(\d{1,2}):(\d{1,2})$/;
  const match = dateStr.match(dateTimeRegex);

  if (match) {
    const day = match[1];
    const month = match[2];
    const year = match[3];
    const hour = match[4];
    const minute = match[5];
    const second = match[6];

    // Reformat to YYYY-MM-DDTHH:MM:SS (ISO-like, but local time)
    // Ensure month and day are two digits
    const formattedDateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}`;

    try {
      const date = new Date(formattedDateStr);
      // Basic validation: check if the constructed date is valid
      if (!isNaN(date.getTime())) {
        // console.log(`[safeParseDate] Parsed from D-M-YYYY: ${dateStr} -> ${formattedDateStr} -> ${date.toISOString()}`);
        return date;
      }
    } catch (e) {
      console.warn(
        `[safeParseDate] Error parsing reformatted string ${formattedDateStr} from ${dateStr}:`,
        e
      );
    }
  }

  // Fallback for other potential formats (e.g., direct ISO 8601) or if the primary parse failed
  try {
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      // console.log(`[safeParseDate] Parsed with fallback: ${dateStr} -> ${parsedDate.toISOString()}`);
      return parsedDate;
    }
  } catch (e) {
    console.warn(`[safeParseDate] Error parsing with fallback ${dateStr}:`, e);
  }

  console.warn(`Failed to parse date string: ${dateStr}`);
  return null;
}

export async function fetchAndParseCsv(
  url: string,
  username?: string,
  password?: string
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

  // Coerce types for relevant columns
  return records.map((r) => ({
    id: r.session_id,
    startTime: safeParseDate(r.start_time) || new Date(), // Fallback to current date if invalid
    endTime: safeParseDate(r.end_time),
    ipAddress: r.ip_address,
    country: getCountryCode(r.country),
    language: getLanguageCode(r.language),
    messagesSent: Number(r.messages_sent) || 0,
    sentiment: r.sentiment,
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
