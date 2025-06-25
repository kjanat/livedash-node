// JavaScript version of csvFetcher with session storage functionality
import fetch from "node-fetch";
import { parse } from "csv-parse/sync";
import ISO6391 from "iso-639-1";
import countries from "i18n-iso-countries";
import { PrismaClient } from "@prisma/client";

// Register locales for i18n-iso-countries
import enLocale from "i18n-iso-countries/langs/en.json" with { type: "json" };
countries.registerLocale(enLocale);

const prisma = new PrismaClient();

/**
 * Converts country names to ISO 3166-1 alpha-2 codes
 * @param {string} countryStr Raw country string from CSV
 * @returns {string|null|undefined} ISO 3166-1 alpha-2 country code or null if not found
 */
function getCountryCode(countryStr) {
  if (countryStr === undefined) return undefined;
  if (countryStr === null || countryStr === "") return null;

  // Clean the input
  const normalized = countryStr.trim();
  if (!normalized) return null;

  // Direct ISO code check (if already a 2-letter code)
  if (normalized.length === 2 && normalized === normalized.toUpperCase()) {
    return countries.isValid(normalized) ? normalized : null;
  }

  // Special case for country codes used in the dataset
  const countryMapping = {
    BA: "BA", // Bosnia and Herzegovina
    NL: "NL", // Netherlands
    USA: "US", // United States
    UK: "GB", // United Kingdom
    GB: "GB", // Great Britain
    Nederland: "NL",
    Netherlands: "NL",
    Netherland: "NL",
    Holland: "NL",
    Germany: "DE",
    Deutschland: "DE",
    Belgium: "BE",
    België: "BE",
    Belgique: "BE",
    France: "FR",
    Frankreich: "FR",
    "United States": "US",
    "United States of America": "US",
    Bosnia: "BA",
    "Bosnia and Herzegovina": "BA",
    "Bosnia & Herzegovina": "BA",
  };

  // Check mapping
  if (normalized in countryMapping) {
    return countryMapping[normalized];
  }

  // Try to get the code from the country name (in English)
  try {
    const code = countries.getAlpha2Code(normalized, "en");
    if (code) return code;
  } catch (error) {
    process.stderr.write(
      `[CSV] Error converting country name to code: ${normalized} - ${error}\n`
    );
  }

  // If all else fails, return null
  return null;
}

/**
 * Converts language names to ISO 639-1 codes
 * @param {string} languageStr Raw language string from CSV
 * @returns {string|null|undefined} ISO 639-1 language code or null if not found
 */
function getLanguageCode(languageStr) {
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
  const languageMapping = {
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
 * Normalizes category values to standard groups
 * @param {string} categoryStr The raw category string from CSV
 * @returns {string|null} A normalized category string
 */
function normalizeCategory(categoryStr) {
  if (!categoryStr) return null;

  const normalized = categoryStr.toLowerCase().trim();

  // Define category groups using keywords
  const categoryMapping = {
    Onboarding: [
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
    Greeting: [
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
    Offboarding: [
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
 * @param {string} sentimentStr The sentiment string from the CSV
 * @returns {number|null} A numeric score representing the sentiment
 */
function mapSentimentToScore(sentimentStr) {
  if (!sentimentStr) return null;

  // Convert to lowercase for case-insensitive matching
  const sentiment = sentimentStr.toLowerCase();

  // Map sentiment strings to numeric values on a scale from -1 to 2
  const sentimentMap = {
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
 * @param {string} value The string value to check
 * @returns {boolean} True if the string indicates a positive/true value
 */
function isTruthyValue(value) {
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
 * @param {string} dateStr The date string to parse.
 * @returns {Date|null} A Date object or null if parsing fails.
 */
function safeParseDate(dateStr) {
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
      return parsedDate;
    }
  } catch (e) {
    console.warn(`[safeParseDate] Error parsing with fallback ${dateStr}:`, e);
  }

  console.warn(`Failed to parse date string: ${dateStr}`);
  return null;
}

/**
 * Fetches transcript content from a URL
 * @param {string} url The URL to fetch the transcript from
 * @param {string} username Optional username for authentication
 * @param {string} password Optional password for authentication
 * @returns {Promise<string|null>} The transcript content or null if fetching fails
 */
async function fetchTranscriptContent(url, username, password) {
  try {
    const authHeader =
      username && password
        ? "Basic " + Buffer.from(`${username}:${password}`).toString("base64")
        : undefined;

    const response = await fetch(url, {
      headers: authHeader ? { Authorization: authHeader } : {},
      timeout: 10000, // 10 second timeout
    });
    
    if (!response.ok) {
      // Only log error once per batch, not for every transcript
      if (Math.random() < 0.1) { // Log ~10% of errors to avoid spam
        console.warn(`[CSV] Transcript fetch failed for ${url}: ${response.status} ${response.statusText}`);
      }
      return null;
    }
    return await response.text();
  } catch (error) {
    // Only log error once per batch, not for every transcript
    if (Math.random() < 0.1) { // Log ~10% of errors to avoid spam
      console.warn(`[CSV] Transcript fetch error for ${url}:`, error.message);
    }
    return null;
  }
}

/**
 * Fetches and parses CSV data from a URL
 * @param {string} url The CSV URL
 * @param {string} username Optional username for authentication
 * @param {string} password Optional password for authentication
 * @returns {Promise<Object[]>} Array of parsed session data
 */
export async function fetchAndParseCsv(url, username, password) {
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
  const records = parse(text, {
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

/**
 * Fetches and stores sessions for all companies
 */
export async function fetchAndStoreSessionsForAllCompanies() {
  try {
    // Get all companies
    const companies = await prisma.company.findMany();
    
    for (const company of companies) {
      if (!company.csvUrl) {
        console.log(`[Scheduler] Skipping company ${company.id} - no CSV URL configured`);
        continue;
      }

      // Skip companies with invalid/example URLs
      if (company.csvUrl.includes('example.com') || company.csvUrl === 'https://example.com/data.csv') {
        console.log(`[Scheduler] Skipping company ${company.id} - invalid/example CSV URL: ${company.csvUrl}`);
        continue;
      }

      console.log(`[Scheduler] Processing sessions for company: ${company.id}`);
      
      try {
        const sessions = await fetchAndParseCsv(
          company.csvUrl,
          company.csvUsername,
          company.csvPassword
        );

        // Only add sessions that don't already exist in the database
        let addedCount = 0;
        for (const session of sessions) {
          const sessionData = {
            ...session,
            companyId: company.id,
            id:
              session.id ||
              session.sessionId ||
              `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            // Ensure startTime is not undefined
            startTime: session.startTime || new Date(),
          };

          // Validate dates to prevent "Invalid Date" errors
          const startTime =
            sessionData.startTime instanceof Date &&
            !isNaN(sessionData.startTime.getTime())
              ? sessionData.startTime
              : new Date();

          const endTime =
            session.endTime instanceof Date && !isNaN(session.endTime.getTime())
              ? session.endTime
              : new Date();

          // Fetch transcript content if URL is available
          let transcriptContent = null;
          if (session.fullTranscriptUrl) {
            transcriptContent = await fetchTranscriptContent(
              session.fullTranscriptUrl,
              company.csvUsername,
              company.csvPassword
            );
          }

          // Check if the session already exists
          const existingSession = await prisma.session.findUnique({
            where: { id: sessionData.id },
          });

          if (existingSession) {
            // Skip this session as it already exists
            continue;
          }

          // Only include fields that are properly typed for Prisma
          await prisma.session.create({
            data: {
              id: sessionData.id,
              companyId: sessionData.companyId,
              startTime: startTime,
              endTime: endTime,
              ipAddress: session.ipAddress || null,
              country: session.country || null,
              language: session.language || null,
              messagesSent:
                typeof session.messagesSent === "number" ? session.messagesSent : 0,
              sentiment:
                typeof session.sentiment === "number" ? session.sentiment : null,
              escalated:
                typeof session.escalated === "boolean" ? session.escalated : null,
              forwardedHr:
                typeof session.forwardedHr === "boolean"
                  ? session.forwardedHr
                  : null,
              fullTranscriptUrl: session.fullTranscriptUrl || null,
              transcriptContent: transcriptContent, // Add the transcript content
              avgResponseTime:
                typeof session.avgResponseTime === "number"
                  ? session.avgResponseTime
                  : null,
              tokens: typeof session.tokens === "number" ? session.tokens : null,
              tokensEur:
                typeof session.tokensEur === "number" ? session.tokensEur : null,
              category: session.category || null,
              initialMsg: session.initialMsg || null,
            },
          });
          
          addedCount++;
        }

        console.log(`[Scheduler] Added ${addedCount} new sessions for company ${company.id}`);
      } catch (error) {
        console.error(`[Scheduler] Error processing company ${company.id}:`, error);
      }
    }
  } catch (error) {
    console.error("[Scheduler] Error fetching companies:", error);
    throw error;
  }
}
