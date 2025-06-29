// Database connection retry utilities
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000,    // 10 seconds
  backoffMultiplier: 2,
};

// Check if error is retryable
export function isRetryableError(error: unknown): boolean {
  if (error instanceof PrismaClientKnownRequestError) {
    // Connection errors that are worth retrying
    const retryableCodes = [
      'P1001', // Can't reach database server
      'P1002', // Database server was reached but timed out
      'P1008', // Operations timed out
      'P1017', // Server has closed the connection
    ];
    
    return retryableCodes.includes(error.code);
  }
  
  // Check for network-related errors
  if (error instanceof Error) {
    const retryableMessages = [
      'ECONNREFUSED',
      'ECONNRESET', 
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'Can\'t reach database server',
      'Connection terminated',
      'Connection lost',
    ];
    
    return retryableMessages.some(msg => 
      error.message.includes(msg)
    );
  }
  
  return false;
}

// Calculate delay with exponential backoff
export function calculateDelay(
  attempt: number, 
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper for database operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context: string = 'database operation'
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry if error is not retryable
      if (!isRetryableError(error)) {
        console.error(`[${context}] Non-retryable error on attempt ${attempt}:`, error);
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === config.maxRetries) {
        console.error(`[${context}] Max retries (${config.maxRetries}) exceeded:`, error);
        break;
      }
      
      const delay = calculateDelay(attempt, config);
      console.warn(
        `[${context}] Attempt ${attempt}/${config.maxRetries} failed, retrying in ${delay}ms:`,
        error instanceof Error ? error.message : error
      );
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

// Health check with retry
export async function checkDatabaseHealthWithRetry(
  checkFunction: () => Promise<boolean>,
  config: Partial<RetryConfig> = {}
): Promise<boolean> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  
  try {
    return await withRetry(
      async () => {
        const isHealthy = await checkFunction();
        if (!isHealthy) {
          throw new Error('Database health check failed');
        }
        return true;
      },
      retryConfig,
      'database health check'
    );
  } catch (error) {
    console.error('Database health check failed after retries:', error);
    return false;
  }
}