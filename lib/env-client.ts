/**
 * Client-safe environment variables
 * This module only includes environment variables that are safe to use in the browser
 * and does not have any Node.js dependencies
 */

/**
 * Parse environment variable value by removing quotes, comments, and trimming whitespace
 */
function parseEnvValue(value: string | undefined): string {
  if (!value) return "";

  // Trim whitespace
  let cleaned = value.trim();

  // Remove inline comments (everything after #)
  const commentIndex = cleaned.indexOf("#");
  if (commentIndex !== -1) {
    cleaned = cleaned.substring(0, commentIndex).trim();
  }

  // Remove surrounding quotes (both single and double)
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }

  return cleaned;
}

/**
 * Client-safe environment variables (browser-safe subset)
 */
export const clientEnv = {
  NODE_ENV: parseEnvValue(process.env.NODE_ENV) || "development",
  NEXTAUTH_URL:
    parseEnvValue(process.env.NEXTAUTH_URL) || "http://localhost:3000",

  // CSRF Protection - fallback to a default value that will work in client
  CSRF_SECRET:
    parseEnvValue(process.env.CSRF_SECRET) ||
    parseEnvValue(process.env.NEXTAUTH_SECRET) ||
    "fallback-csrf-secret",
} as const;

/**
 * Check if we're in development mode
 */
export const isDevelopment = clientEnv.NODE_ENV === "development";

/**
 * Check if we're in production mode
 */
export const isProduction = clientEnv.NODE_ENV === "production";
