/**
 * High-Performance Caching System
 *
 * Provides multi-layer caching with automatic invalidation, memory optimization,
 * and performance monitoring for non-database operations.
 */

import { LRUCache } from "lru-cache";
import { TIME } from "../constants";

/**
 * Cache configuration options
 */
export interface CacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  maxAge?: number; // Alias for ttl
  allowStale?: boolean;
  updateAgeOnGet?: boolean;
  updateAgeOnHas?: boolean;
}

/**
 * Cache entry metadata
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
  lastAccessed: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  maxSize: number;
  hitRate: number;
  memoryUsage: number;
}

/**
 * High-performance memory cache with advanced features
 */
export class PerformanceCache<K extends {} = string, V = any> {
  private cache: LRUCache<K, CacheEntry<V>>;
  private stats: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
  };
  private readonly name: string;

  constructor(name: string, options: CacheOptions = {}) {
    this.name = name;
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };

    this.cache = new LRUCache<K, CacheEntry<V>>({
      max: options.maxSize || 1000,
      ttl: options.ttl || options.maxAge || 5 * TIME.MINUTE,
      allowStale: options.allowStale || false,
      updateAgeOnGet: options.updateAgeOnGet ?? true,
      updateAgeOnHas: options.updateAgeOnHas ?? false,
    });
  }

  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (entry) {
      entry.hits++;
      entry.lastAccessed = Date.now();
      this.stats.hits++;
      return entry.value;
    }

    this.stats.misses++;
    return undefined;
  }

  /**
   * Set value in cache
   */
  set(key: K, value: V, ttl?: number): void {
    const entry: CacheEntry<V> = {
      value,
      timestamp: Date.now(),
      hits: 0,
      lastAccessed: Date.now(),
    };

    if (ttl) {
      this.cache.set(key, entry, { ttl });
    } else {
      this.cache.set(key, entry);
    }

    this.stats.sets++;
  }

  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete key from cache
   */
  delete(key: K): boolean {
    const result = this.cache.delete(key);
    if (result) {
      this.stats.deletes++;
    }
    return result;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalAccess = this.stats.hits + this.stats.misses;
    const hitRate = totalAccess > 0 ? this.stats.hits / totalAccess : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.cache.max,
      hitRate,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Get cached value or compute and cache if missing
   */
  async getOrCompute<T extends V>(
    key: K,
    computeFn: () => Promise<T> | T,
    ttl?: number
  ): Promise<T> {
    const cached = this.get(key) as T;
    if (cached !== undefined) {
      return cached;
    }

    const computed = await computeFn();
    this.set(key, computed, ttl);
    return computed;
  }

  /**
   * Memoize a function with caching
   */
  memoize<Args extends any[], Return extends V>(
    fn: (...args: Args) => Promise<Return> | Return,
    keyGenerator?: (...args: Args) => K,
    ttl?: number
  ) {
    return async (...args: Args): Promise<Return> => {
      const key = keyGenerator
        ? keyGenerator(...args)
        : (JSON.stringify(args) as unknown as K);
      return this.getOrCompute(key, () => fn(...args), ttl);
    };
  }

  /**
   * Estimate memory usage of cache
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    this.cache.forEach((entry, key) => {
      // Rough estimation of memory usage
      totalSize += JSON.stringify(key).length * 2; // UTF-16 encoding
      totalSize += JSON.stringify(entry.value).length * 2;
      totalSize += 64; // Overhead for entry metadata
    });

    return totalSize;
  }

  /**
   * Get cache name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Export cache data for debugging
   */
  dump(): Array<{ key: K; value: V; metadata: Omit<CacheEntry<V>, "value"> }> {
    const result: Array<{
      key: K;
      value: V;
      metadata: Omit<CacheEntry<V>, "value">;
    }> = [];

    this.cache.forEach((entry, key) => {
      result.push({
        key,
        value: entry.value,
        metadata: {
          timestamp: entry.timestamp,
          hits: entry.hits,
          lastAccessed: entry.lastAccessed,
        },
      });
    });

    return result;
  }
}

/**
 * Cache manager for handling multiple cache instances
 */
class CacheManager {
  private caches = new Map<string, PerformanceCache>();
  private defaultOptions: CacheOptions = {
    maxSize: 1000,
    ttl: 5 * TIME.MINUTE,
    allowStale: false,
  };

  /**
   * Create or get a named cache instance
   */
  getCache<K extends {} = string, V = any>(
    name: string,
    options: CacheOptions = {}
  ): PerformanceCache<K, V> {
    if (!this.caches.has(name)) {
      const mergedOptions = { ...this.defaultOptions, ...options };
      this.caches.set(name, new PerformanceCache(name, mergedOptions));
    }

    return this.caches.get(name) as unknown as PerformanceCache<K, V>;
  }

  /**
   * Get all cache statistics
   */
  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};

    this.caches.forEach((cache, name) => {
      stats[name] = cache.getStats();
    });

    return stats;
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.caches.forEach((cache) => cache.clear());
  }

  /**
   * Remove a cache instance
   */
  removeCache(name: string): boolean {
    const cache = this.caches.get(name);
    if (cache) {
      cache.clear();
      return this.caches.delete(name);
    }
    return false;
  }

  /**
   * Get total memory usage across all caches
   */
  getTotalMemoryUsage(): number {
    let total = 0;
    this.caches.forEach((cache) => {
      total += cache.getStats().memoryUsage;
    });
    return total;
  }

  /**
   * Monitor cache performance
   */
  getPerformanceReport(): {
    totalCaches: number;
    totalMemoryUsage: number;
    averageHitRate: number;
    topPerformers: Array<{
      name: string;
      hitRate: number;
      memoryUsage: number;
    }>;
    recommendations: string[];
  } {
    const allStats = this.getAllStats();
    const cacheNames = Object.keys(allStats);

    const totalMemoryUsage = this.getTotalMemoryUsage();
    const averageHitRate =
      cacheNames.length > 0
        ? cacheNames.reduce((sum, name) => sum + allStats[name].hitRate, 0) /
          cacheNames.length
        : 0;

    const topPerformers = cacheNames
      .map((name) => ({
        name,
        hitRate: allStats[name].hitRate,
        memoryUsage: allStats[name].memoryUsage,
      }))
      .sort((a, b) => b.hitRate - a.hitRate)
      .slice(0, 5);

    const recommendations: string[] = [];

    // Generate recommendations
    if (averageHitRate < 0.5) {
      recommendations.push(
        "Consider adjusting cache TTL or improving cache key strategies"
      );
    }

    if (totalMemoryUsage > 100 * 1024 * 1024) {
      // 100MB
      recommendations.push(
        "High memory usage detected. Consider reducing cache sizes or TTL"
      );
    }

    cacheNames.forEach((name) => {
      const stats = allStats[name];
      if (stats.hitRate < 0.3) {
        recommendations.push(
          `Cache '${name}' has low hit rate (${(stats.hitRate * 100).toFixed(1)}%)`
        );
      }
    });

    return {
      totalCaches: cacheNames.length,
      totalMemoryUsage,
      averageHitRate,
      topPerformers,
      recommendations,
    };
  }
}

/**
 * Global cache manager instance
 */
export const cacheManager = new CacheManager();

/**
 * Predefined cache instances for common use cases
 */
export const caches = {
  // API response caching
  apiResponses: cacheManager.getCache("api-responses", {
    maxSize: 500,
    ttl: 2 * TIME.MINUTE,
  }),

  // User session data
  sessions: cacheManager.getCache("user-sessions", {
    maxSize: 200,
    ttl: 15 * TIME.MINUTE,
  }),

  // Dashboard metrics
  metrics: cacheManager.getCache("dashboard-metrics", {
    maxSize: 100,
    ttl: 5 * TIME.MINUTE,
  }),

  // Configuration data
  config: cacheManager.getCache("configuration", {
    maxSize: 50,
    ttl: 30 * TIME.MINUTE,
  }),

  // File processing results
  fileProcessing: cacheManager.getCache("file-processing", {
    maxSize: 100,
    ttl: 10 * TIME.MINUTE,
  }),

  // AI processing results
  aiResults: cacheManager.getCache("ai-results", {
    maxSize: 300,
    ttl: 60 * TIME.MINUTE,
  }),
};

/**
 * High-level caching decorators and utilities
 */
export class CacheUtils {
  /**
   * Cache the result of an async function
   */
  static cached<T extends any[], R>(
    cacheName: string,
    fn: (...args: T) => Promise<R>,
    options: CacheOptions & {
      keyGenerator?: (...args: T) => string;
    } = {}
  ) {
    const cache = cacheManager.getCache(cacheName, options);
    return cache.memoize(fn, options.keyGenerator, options.ttl);
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  static invalidatePattern(cacheName: string, pattern: RegExp): number {
    const cache = cacheManager.getCache(cacheName);
    const entries = cache.dump();
    let invalidated = 0;

    entries.forEach(({ key }) => {
      if (pattern.test(String(key))) {
        cache.delete(key);
        invalidated++;
      }
    });

    return invalidated;
  }

  /**
   * Warm up cache with precomputed values
   */
  static warmUp<K extends {}, V>(
    cacheName: string,
    data: Array<{ key: K; value: V; ttl?: number }>
  ): void {
    const cache = cacheManager.getCache<K, V>(cacheName);

    data.forEach(({ key, value, ttl }) => {
      cache.set(key, value, ttl);
    });
  }

  /**
   * Create a cache-aside pattern helper
   */
  static createCacheAside<K extends {}, V>(
    cacheName: string,
    loader: (key: K) => Promise<V>,
    options: CacheOptions = {}
  ) {
    const cache = cacheManager.getCache<K, V>(cacheName, options);

    return {
      async get(key: K): Promise<V> {
        return cache.getOrCompute(key, () => loader(key), options.ttl);
      },

      set(key: K, value: V, ttl?: number): void {
        cache.set(key, value, ttl);
      },

      invalidate(key: K): boolean {
        return cache.delete(key);
      },

      getStats: () => cache.getStats(),
    };
  }
}

/**
 * Performance monitoring for cache operations
 */
export class CacheMonitor {
  private static intervals = new Map<string, NodeJS.Timeout>();

  /**
   * Start monitoring cache performance
   */
  static startMonitoring(intervalMs = 30000): void {
    if (CacheMonitor.intervals.has("performance-monitor")) {
      return; // Already monitoring
    }

    const interval = setInterval(() => {
      const report = cacheManager.getPerformanceReport();

      console.log("[Cache Monitor] Performance Report:", {
        timestamp: new Date().toISOString(),
        totalCaches: report.totalCaches,
        totalMemoryUsage: `${(report.totalMemoryUsage / 1024 / 1024).toFixed(2)}MB`,
        averageHitRate: `${(report.averageHitRate * 100).toFixed(1)}%`,
        topPerformers: report.topPerformers.slice(0, 3),
        recommendations: report.recommendations,
      });

      // Alert on performance issues
      if (report.averageHitRate < 0.4) {
        console.warn("[Cache Monitor] WARNING: Low average hit rate detected");
      }

      if (report.totalMemoryUsage > 200 * 1024 * 1024) {
        // 200MB
        console.warn("[Cache Monitor] WARNING: High memory usage detected");
      }
    }, intervalMs);

    CacheMonitor.intervals.set("performance-monitor", interval);
  }

  /**
   * Stop monitoring
   */
  static stopMonitoring(): void {
    const interval = CacheMonitor.intervals.get("performance-monitor");
    if (interval) {
      clearInterval(interval);
      CacheMonitor.intervals.delete("performance-monitor");
    }
  }

  /**
   * Get current performance snapshot
   */
  static getSnapshot() {
    return cacheManager.getPerformanceReport();
  }
}
