// Shared rate limiting utility to prevent code duplication

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  maxEntries?: number;
  cleanupIntervalMs?: number;
}

export interface RateLimitAttempt {
  count: number;
  resetTime: number;
}

export class InMemoryRateLimiter {
  private attempts = new Map<string, RateLimitAttempt>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private config: RateLimitConfig) {
    const cleanupMs = config.cleanupIntervalMs || 5 * 60 * 1000; // 5 minutes default

    // Clean up expired entries periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupMs);
  }

  /**
   * Check if a key (e.g., IP address) is rate limited
   */
  checkRateLimit(key: string): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const attempt = this.attempts.get(key);

    if (!attempt || now > attempt.resetTime) {
      // No previous attempt or window expired - allow and start new window
      this.attempts.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return { allowed: true };
    }

    if (attempt.count >= this.config.maxAttempts) {
      // Rate limit exceeded
      return { allowed: false, resetTime: attempt.resetTime };
    }

    // Increment counter
    attempt.count++;
    return { allowed: true };
  }

  /**
   * Clean up expired entries and prevent unbounded growth
   */
  private cleanup(): void {
    const now = Date.now();
    const maxEntries = this.config.maxEntries || 10000;

    // Remove expired entries
    for (const [key, attempt] of Array.from(this.attempts.entries())) {
      if (now > attempt.resetTime) {
        this.attempts.delete(key);
      }
    }

    // If still too many entries, remove oldest half
    if (this.attempts.size > maxEntries) {
      const entries = Array.from(this.attempts.entries());
      entries.sort((a, b) => a[1].resetTime - b[1].resetTime);

      const toRemove = Math.floor(entries.length / 2);
      for (let i = 0; i < toRemove; i++) {
        this.attempts.delete(entries[i][0]);
      }
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

/**
 * Extract client IP address from request headers
 */
export function extractClientIP(request: Request): string {
  // Check multiple possible headers in order of preference
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the first IP from comma-separated list
    return forwarded.split(",")[0].trim();
  }

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-client-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
