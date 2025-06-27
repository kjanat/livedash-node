// Centralized environment variable management
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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
 * Parse integer with fallback to default value
 */
function parseIntWithDefault(
  value: string | undefined,
  defaultValue: number
): number {
  const cleaned = parseEnvValue(value);
  if (!cleaned) return defaultValue;

  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "..", ".env.local");

// Load .env.local if it exists
try {
  const envFile = readFileSync(envPath, "utf8");
  const envVars = envFile
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"));

  envVars.forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      const rawValue = valueParts.join("=");
      const cleanedValue = parseEnvValue(rawValue);
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = cleanedValue;
      }
    }
  });
} catch (error) {
  // Silently fail if .env.local doesn't exist
}

/**
 * Typed environment variables with defaults
 */
export const env = {
  // NextAuth
  NEXTAUTH_URL:
    parseEnvValue(process.env.NEXTAUTH_URL) || "http://localhost:3000",
  NEXTAUTH_SECRET: parseEnvValue(process.env.NEXTAUTH_SECRET) || "",
  NODE_ENV: parseEnvValue(process.env.NODE_ENV) || "development",

  // OpenAI
  OPENAI_API_KEY: parseEnvValue(process.env.OPENAI_API_KEY) || "",

  // Scheduler Configuration
  SCHEDULER_ENABLED: parseEnvValue(process.env.SCHEDULER_ENABLED) === "true",
  CSV_IMPORT_INTERVAL:
    parseEnvValue(process.env.CSV_IMPORT_INTERVAL) || "*/15 * * * *",
  IMPORT_PROCESSING_INTERVAL:
    parseEnvValue(process.env.IMPORT_PROCESSING_INTERVAL) || "*/5 * * * *",
  IMPORT_PROCESSING_BATCH_SIZE: parseIntWithDefault(
    process.env.IMPORT_PROCESSING_BATCH_SIZE,
    50
  ),
  SESSION_PROCESSING_INTERVAL:
    parseEnvValue(process.env.SESSION_PROCESSING_INTERVAL) || "0 * * * *",
  SESSION_PROCESSING_BATCH_SIZE: parseIntWithDefault(
    process.env.SESSION_PROCESSING_BATCH_SIZE,
    0
  ),
  SESSION_PROCESSING_CONCURRENCY: parseIntWithDefault(
    process.env.SESSION_PROCESSING_CONCURRENCY,
    5
  ),

  // Server
  PORT: parseIntWithDefault(process.env.PORT, 3000),
} as const;

/**
 * Validate required environment variables
 */
export function validateEnv(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!env.NEXTAUTH_SECRET) {
    errors.push("NEXTAUTH_SECRET is required");
  }

  if (!env.OPENAI_API_KEY && env.NODE_ENV === "production") {
    errors.push("OPENAI_API_KEY is required in production");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get scheduler configuration from environment variables
 */
export function getSchedulerConfig() {
  return {
    enabled: env.SCHEDULER_ENABLED,
    csvImport: {
      interval: env.CSV_IMPORT_INTERVAL,
    },
    importProcessing: {
      interval: env.IMPORT_PROCESSING_INTERVAL,
      batchSize: env.IMPORT_PROCESSING_BATCH_SIZE,
    },
    sessionProcessing: {
      interval: env.SESSION_PROCESSING_INTERVAL,
      batchSize: env.SESSION_PROCESSING_BATCH_SIZE,
      concurrency: env.SESSION_PROCESSING_CONCURRENCY,
    },
  };
}

/**
 * Log environment configuration (safe for production)
 */
export function logEnvConfig(): void {
  console.log("[Environment] Configuration:");
  console.log(`  NODE_ENV: ${env.NODE_ENV}`);
  console.log(`  NEXTAUTH_URL: ${env.NEXTAUTH_URL}`);
  console.log(`  SCHEDULER_ENABLED: ${env.SCHEDULER_ENABLED}`);
  console.log(`  PORT: ${env.PORT}`);

  if (env.SCHEDULER_ENABLED) {
    console.log("  Scheduler intervals:");
    console.log(`    CSV Import: ${env.CSV_IMPORT_INTERVAL}`);
    console.log(`    Import Processing: ${env.IMPORT_PROCESSING_INTERVAL}`);
    console.log(`    Session Processing: ${env.SESSION_PROCESSING_INTERVAL}`);
  }
}
