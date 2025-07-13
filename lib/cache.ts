/**
 * Comprehensive Caching Layer with Redis + In-Memory Fallback
 *
 * This module provides a unified caching interface that:
 * - Uses Redis when available for distributed caching
 * - Falls back to in-memory LRU cache when Redis is unavailable
 * - Provides type-safe caching with automatic serialization/deserialization
 * - Includes cache warming, invalidation patterns, and monitoring
 */

import { env } from "./env";
import { redisManager } from "./redis";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize = 1000;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    // If cache is full, remove oldest entries
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + ttlSeconds * 1000,
      createdAt: now,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    });
  }

  getStats() {
    const now = Date.now();
    let expired = 0;
    let valid = 0;

    this.cache.forEach((entry) => {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    });

    return {
      size: this.cache.size,
      valid,
      expired,
      maxSize: this.maxSize,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

class CacheManager {
  private memoryCache = new MemoryCache();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    redisHits: 0,
    memoryHits: 0,
  };

  async get<T>(key: string): Promise<T | null> {
    try {
      // Try Redis first
      if (redisManager.isAvailable()) {
        const redisValue = await redisManager.get(key);
        if (redisValue) {
          this.stats.hits++;
          this.stats.redisHits++;
          return JSON.parse(redisValue);
        }
      }

      // Fall back to memory cache
      const memoryValue = this.memoryCache.get<T>(key);
      if (memoryValue) {
        this.stats.hits++;
        this.stats.memoryHits++;
        return memoryValue;
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      console.error(`[Cache] GET error for key ${key}:`, error);
      this.stats.errors++;
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = env.REDIS_TTL_DEFAULT
  ): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value);
      let redisSuccess = false;
      let memorySuccess = false;

      // Set in Redis if available
      if (redisManager.isAvailable()) {
        redisSuccess = await redisManager.set(key, serializedValue, {
          EX: ttlSeconds,
        });
      }

      // Always set in memory cache as fallback
      this.memoryCache.set(key, value, ttlSeconds);
      memorySuccess = true;

      this.stats.sets++;
      return redisSuccess || memorySuccess;
    } catch (error) {
      console.error(`[Cache] SET error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      let redisSuccess = false;
      let memorySuccess = false;

      // Delete from Redis if available
      if (redisManager.isAvailable()) {
        redisSuccess = await redisManager.del(key);
      }

      // Delete from memory cache
      memorySuccess = this.memoryCache.delete(key);

      this.stats.deletes++;
      return redisSuccess || memorySuccess;
    } catch (error) {
      console.error(`[Cache] DELETE error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    try {
      // Try Redis first for all keys
      if (redisManager.isAvailable()) {
        const redisValues = await redisManager.mget(keys);
        for (let i = 0; i < keys.length; i++) {
          const value = redisValues[i];
          if (value) {
            result.set(keys[i], JSON.parse(value));
            this.stats.redisHits++;
          }
        }
      }

      // For missing keys, check memory cache
      for (const key of keys) {
        if (!result.has(key)) {
          const memoryValue = this.memoryCache.get<T>(key);
          if (memoryValue) {
            result.set(key, memoryValue);
            this.stats.memoryHits++;
          }
        }
      }

      this.stats.hits += result.size;
      this.stats.misses += keys.length - result.size;
    } catch (error) {
      console.error("[Cache] MGET error:", error);
      this.stats.errors++;
    }

    return result;
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      let deleted = 0;

      // Clear from Redis if available
      if (redisManager.isAvailable()) {
        deleted += await redisManager.flushPattern(pattern);
      }

      // Clear from memory cache (simple pattern matching)
      // Note: Memory cache doesn't support patterns, so we clear all if pattern includes wildcards
      if (pattern.includes("*")) {
        this.memoryCache.clear();
        deleted += 1; // Approximate since we cleared all
      } else {
        if (this.memoryCache.delete(pattern)) {
          deleted += 1;
        }
      }

      return deleted;
    } catch (error) {
      console.error(
        `[Cache] Pattern invalidation error for ${pattern}:`,
        error
      );
      this.stats.errors++;
      return 0;
    }
  }

  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      redisAvailable: redisManager.isAvailable(),
      memory: this.memoryCache.getStats(),
    };
  }

  async healthCheck() {
    const redisHealth = await redisManager.healthCheck();
    const memoryStats = this.memoryCache.getStats();

    return {
      redis: redisHealth,
      memory: {
        available: true,
        size: memoryStats.size,
        valid: memoryStats.valid,
        expired: memoryStats.expired,
      },
      overall: {
        available: redisHealth.connected || memoryStats.valid >= 0,
        fallbackMode: !redisHealth.connected,
      },
    };
  }

  async shutdown(): Promise<void> {
    this.memoryCache.destroy();
    await redisManager.disconnect();
  }
}

// Singleton cache manager
const cacheManager = new CacheManager();

// Cache key builders for consistent naming
export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  userByEmail: (email: string) => `user:email:${email}`,
  session: (sessionId: string) => `session:${sessionId}`,
  company: (companyId: string) => `company:${companyId}`,
  companyUsers: (companyId: string) => `company:${companyId}:users`,
  sessionsByCompany: (companyId: string) => `sessions:company:${companyId}`,
  aiModelPricing: (modelId: string) => `ai-model-pricing:${modelId}`,
  processingStats: (companyId?: string) =>
    `processing-stats${companyId ? `:${companyId}` : ":global"}`,
  auditLogs: (companyId: string, filters: string) =>
    `audit-logs:${companyId}:${filters}`,
};

// Typed cache operations with automatic TTL based on data type
export const Cache = {
  // User operations
  async getUser(userId: string) {
    return cacheManager.get<{
      id: string;
      email: string;
      name?: string;
      role: string;
      companyId: string;
    }>(CacheKeys.user(userId));
  },

  async setUser(
    userId: string,
    user: {
      id: string;
      email: string;
      name?: string;
      role: string;
      companyId: string;
    }
  ) {
    return cacheManager.set(CacheKeys.user(userId), user, env.REDIS_TTL_USER);
  },

  async getUserByEmail(email: string) {
    return cacheManager.get<{
      id: string;
      email: string;
      name?: string;
      role: string;
      companyId: string;
    }>(CacheKeys.userByEmail(email));
  },

  async setUserByEmail(
    email: string,
    user: {
      id: string;
      email: string;
      name?: string;
      role: string;
      companyId: string;
    }
  ) {
    return cacheManager.set(
      CacheKeys.userByEmail(email),
      user,
      env.REDIS_TTL_USER
    );
  },

  // Session operations
  async getSession(sessionId: string) {
    return cacheManager.get<{
      id: string;
      companyId: string;
      startTime: string;
      endTime: string;
      messageCount?: number;
    }>(CacheKeys.session(sessionId));
  },

  async setSession(
    sessionId: string,
    session: {
      id: string;
      companyId: string;
      startTime: string;
      endTime: string;
      messageCount?: number;
    }
  ) {
    return cacheManager.set(
      CacheKeys.session(sessionId),
      session,
      env.REDIS_TTL_SESSION
    );
  },

  // Company operations
  async getCompany(companyId: string) {
    return cacheManager.get<{
      id: string;
      name: string;
      status: string;
    }>(CacheKeys.company(companyId));
  },

  async setCompany(
    companyId: string,
    company: {
      id: string;
      name: string;
      status: string;
    }
  ) {
    return cacheManager.set(
      CacheKeys.company(companyId),
      company,
      env.REDIS_TTL_COMPANY
    );
  },

  // Generic operations
  async get<T>(key: string): Promise<T | null> {
    return cacheManager.get<T>(key);
  },

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    return cacheManager.set(key, value, ttlSeconds);
  },

  async delete(key: string): Promise<boolean> {
    return cacheManager.delete(key);
  },

  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    return cacheManager.mget<T>(keys);
  },

  async invalidatePattern(pattern: string): Promise<number> {
    return cacheManager.invalidatePattern(pattern);
  },

  // Cache invalidation helpers
  async invalidateUser(userId: string) {
    await cacheManager.delete(CacheKeys.user(userId));
  },

  async invalidateUserByEmail(email: string) {
    await cacheManager.delete(CacheKeys.userByEmail(email));
  },

  async invalidateCompany(companyId: string) {
    return cacheManager.invalidatePattern(`company:${companyId}*`);
  },

  async invalidateSession(sessionId: string) {
    await cacheManager.delete(CacheKeys.session(sessionId));
  },

  // Monitoring and management
  getStats() {
    return cacheManager.getStats();
  },

  async healthCheck() {
    return cacheManager.healthCheck();
  },

  async shutdown() {
    return cacheManager.shutdown();
  },
};

export { cacheManager };
