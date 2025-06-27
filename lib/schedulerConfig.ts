// Unified scheduler configuration
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

export interface SchedulerConfig {
  enabled: boolean;
  csvImport: {
    interval: string;
  };
  sessionProcessing: {
    interval: string;
    batchSize: number; // 0 = unlimited
    concurrency: number;
  };
}

/**
 * Get scheduler configuration from environment variables
 */
export function getSchedulerConfig(): SchedulerConfig {
  const enabled = process.env.SCHEDULER_ENABLED === 'true';
  
  // Default values
  const defaults = {
    csvImportInterval: '*/15 * * * *', // Every 15 minutes
    sessionProcessingInterval: '0 * * * *', // Every hour
    sessionProcessingBatchSize: 0, // Unlimited
    sessionProcessingConcurrency: 5,
  };

  return {
    enabled,
    csvImport: {
      interval: process.env.CSV_IMPORT_INTERVAL || defaults.csvImportInterval,
    },
    sessionProcessing: {
      interval: process.env.SESSION_PROCESSING_INTERVAL || defaults.sessionProcessingInterval,
      batchSize: parseInt(process.env.SESSION_PROCESSING_BATCH_SIZE || '0', 10) || defaults.sessionProcessingBatchSize,
      concurrency: parseInt(process.env.SESSION_PROCESSING_CONCURRENCY || '5', 10) || defaults.sessionProcessingConcurrency,
    },
  };
}

/**
 * Log scheduler configuration
 */
export function logSchedulerConfig(config: SchedulerConfig): void {
  if (!config.enabled) {
    console.log('[Scheduler] Schedulers are DISABLED (SCHEDULER_ENABLED=false)');
    return;
  }

  console.log('[Scheduler] Configuration:');
  console.log(`  CSV Import: ${config.csvImport.interval}`);
  console.log(`  Session Processing: ${config.sessionProcessing.interval}`);
  console.log(`  Batch Size: ${config.sessionProcessing.batchSize === 0 ? 'unlimited' : config.sessionProcessing.batchSize}`);
  console.log(`  Concurrency: ${config.sessionProcessing.concurrency}`);
}
