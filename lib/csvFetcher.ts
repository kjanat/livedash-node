// Simplified CSV fetcher - fetches and parses CSV data without any processing
// Maps directly to SessionImport table fields
import fetch from "node-fetch";
import { parse } from "csv-parse/sync";

// Raw CSV data interface matching SessionImport schema
interface RawSessionImport {
  externalSessionId: string;
  startTimeRaw: string;
  endTimeRaw: string;
  ipAddress: string | null;
  countryCode: string | null;
  language: string | null;
  messagesSent: number | null;
  sentimentRaw: string | null;
  escalatedRaw: string | null;
  forwardedHrRaw: string | null;
  fullTranscriptUrl: string | null;
  avgResponseTimeSeconds: number | null;
  tokens: number | null;
  tokensEur: number | null;
  category: string | null;
  initialMessage: string | null;
}

/**
 * Fetches and parses CSV data from a URL without any processing
 * Maps CSV columns by position to SessionImport fields
 * @param url The CSV URL
 * @param username Optional username for authentication
 * @param password Optional password for authentication
 * @returns Array of raw session import data
 */
export async function fetchAndParseCsv(
  url: string,
  username?: string,
  password?: string
): Promise<RawSessionImport[]> {
  const authHeader =
    username && password
      ? "Basic " + Buffer.from(`${username}:${password}`).toString("base64")
      : undefined;

  const res = await fetch(url, {
    headers: authHeader ? { Authorization: authHeader } : {},
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch CSV: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();

  // Parse CSV without headers, using positional column mapping
  const records: string[][] = parse(text, {
    delimiter: ",",
    from_line: 1, // Start from first line (no headers)
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });

  // Map CSV columns by position to SessionImport fields
  return records.map((row) => ({
    externalSessionId: row[0] || "",
    startTimeRaw: row[1] || "",
    endTimeRaw: row[2] || "",
    ipAddress: row[3] || null,
    countryCode: row[4] || null,
    language: row[5] || null,
    messagesSent: row[6] ? parseInt(row[6], 10) || null : null,
    sentimentRaw: row[7] || null,
    escalatedRaw: row[8] || null,
    forwardedHrRaw: row[9] || null,
    fullTranscriptUrl: row[10] || null,
    avgResponseTimeSeconds: row[11] ? parseFloat(row[11]) || null : null,
    tokens: row[12] ? parseInt(row[12], 10) || null : null,
    tokensEur: row[13] ? parseFloat(row[13]) || null : null,
    category: row[14] || null,
    initialMessage: row[15] || null,
  }));
}
