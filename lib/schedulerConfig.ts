// Legacy scheduler configuration - now uses centralized env management
// This file is kept for backward compatibility but delegates to lib/env.ts

import { getSchedulerConfig as getEnvSchedulerConfig, logEnvConfig } from "./env";

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
 * @deprecated Use getSchedulerConfig from lib/env.ts instead
 */
export function getSchedulerConfig(): SchedulerConfig {
  const config = getEnvSchedulerConfig();
  
  return {
    enabled: config.enabled,
    csvImport: {
      interval: config.csvImport.interval,
    },
    sessionProcessing: {
      interval: config.sessionProcessing.interval,
      batchSize: config.sessionProcessing.batchSize,
      concurrency: config.sessionProcessing.concurrency,
    },
  };
}

/**
 * Log scheduler configuration
 * @deprecated Use logEnvConfig from lib/env.ts instead
 */
export function logSchedulerConfig(config: SchedulerConfig): void {
  logEnvConfig();
}
