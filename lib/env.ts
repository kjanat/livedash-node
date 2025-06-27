// Centralized environment variable management
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

// Load .env.local if it exists
try {
  const envFile = readFileSync(envPath, 'utf8');
  const envVars = envFile.split('\n').filter(line => line.trim() && !line.startsWith('#'));

  envVars.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
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
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || '',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  // Scheduler Configuration
  SCHEDULER_ENABLED: process.env.SCHEDULER_ENABLED === 'true',
  CSV_IMPORT_INTERVAL: process.env.CSV_IMPORT_INTERVAL || '*/15 * * * *',
  IMPORT_PROCESSING_INTERVAL: process.env.IMPORT_PROCESSING_INTERVAL || '*/5 * * * *',
  IMPORT_PROCESSING_BATCH_SIZE: parseInt(process.env.IMPORT_PROCESSING_BATCH_SIZE || '50', 10),
  SESSION_PROCESSING_INTERVAL: process.env.SESSION_PROCESSING_INTERVAL || '0 * * * *',
  SESSION_PROCESSING_BATCH_SIZE: parseInt(process.env.SESSION_PROCESSING_BATCH_SIZE || '0', 10),
  SESSION_PROCESSING_CONCURRENCY: parseInt(process.env.SESSION_PROCESSING_CONCURRENCY || '5', 10),

  // Server
  PORT: parseInt(process.env.PORT || '3000', 10),
} as const;

/**
 * Validate required environment variables
 */
export function validateEnv(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!env.NEXTAUTH_SECRET) {
    errors.push('NEXTAUTH_SECRET is required');
  }

  if (!env.OPENAI_API_KEY && env.NODE_ENV === 'production') {
    errors.push('OPENAI_API_KEY is required in production');
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
  console.log('[Environment] Configuration:');
  console.log(`  NODE_ENV: ${env.NODE_ENV}`);
  console.log(`  NEXTAUTH_URL: ${env.NEXTAUTH_URL}`);
  console.log(`  SCHEDULER_ENABLED: ${env.SCHEDULER_ENABLED}`);
  console.log(`  PORT: ${env.PORT}`);
  
  if (env.SCHEDULER_ENABLED) {
    console.log('  Scheduler intervals:');
    console.log(`    CSV Import: ${env.CSV_IMPORT_INTERVAL}`);
    console.log(`    Import Processing: ${env.IMPORT_PROCESSING_INTERVAL}`);
    console.log(`    Session Processing: ${env.SESSION_PROCESSING_INTERVAL}`);
  }
}
