// Transcript fetching utility
import fetch from "node-fetch";

export interface TranscriptFetchResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Helper function to prepare request headers
 */
function prepareRequestHeaders(
  username?: string,
  password?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "LiveDash-Transcript-Fetcher/1.0",
  };

  if (username && password) {
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
    headers.Authorization = authHeader;
  }

  return headers;
}

/**
 * Helper function to handle network errors
 */
function handleNetworkError(error: unknown): TranscriptFetchResult {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes("ENOTFOUND")) {
    return { success: false, error: "Domain not found" };
  }

  if (errorMessage.includes("ECONNREFUSED")) {
    return { success: false, error: "Connection refused" };
  }

  if (errorMessage.includes("timeout")) {
    return { success: false, error: "Request timeout" };
  }

  return { success: false, error: errorMessage };
}

/**
 * Fetch transcript content from a URL
 * @param url The transcript URL
 * @param username Optional username for authentication
 * @param password Optional password for authentication
 * @returns Promise with fetch result
 */
export async function fetchTranscriptContent(
  url: string,
  username?: string,
  password?: string
): Promise<TranscriptFetchResult> {
  try {
    if (!url || !url.trim()) {
      return { success: false, error: "No transcript URL provided" };
    }

    const headers = prepareRequestHeaders(username, password);

    // Fetch the transcript with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const content = await response.text();

    if (!content || content.trim().length === 0) {
      return { success: false, error: "Empty transcript content" };
    }

    return { success: true, content: content.trim() };
  } catch (error) {
    return handleNetworkError(error);
  }
}

/**
 * Validate if a URL looks like a valid transcript URL
 * @param url The URL to validate
 * @returns boolean indicating if URL appears valid
 */
export function isValidTranscriptUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Extract session ID from transcript content if possible
 * This is a helper function that can be enhanced based on transcript format
 * @param content The transcript content
 * @returns Extracted session ID or null
 */
export function extractSessionIdFromTranscript(content: string): string | null {
  if (!content) return null;

  // Look for common session ID patterns
  const patterns = [
    /session[_-]?id[:\s]*([a-zA-Z0-9-]+)/i,
    /id[:\s]*([a-zA-Z0-9-]{8,})/i,
    /^([a-zA-Z0-9-]{8,})/m, // First line might be session ID
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}
