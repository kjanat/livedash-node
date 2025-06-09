/**
 * Fetches transcript content from a URL with optional authentication
 * @param url The URL to fetch the transcript from
 * @param username Optional username for Basic Auth
 * @param password Optional password for Basic Auth
 * @returns The transcript content or null if fetching fails
 */
export async function fetchTranscriptContent(
  url: string,
  username?: string,
  password?: string
): Promise<string | null> {
  try {
    const authHeader =
      username && password
        ? "Basic " + Buffer.from(`${username}:${password}`).toString("base64")
        : undefined;

    const response = await fetch(url, {
      headers: authHeader ? { Authorization: authHeader } : {},
    });

    if (!response.ok) {
      process.stderr.write(`Error fetching transcript from ${url}: ${response.statusText}\n`);
      return null;
    }
    return await response.text();
  } catch (error) {
    process.stderr.write(`Failed to fetch transcript: ${error}\n`);
    return null;
  }
}
