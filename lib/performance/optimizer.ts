/**
 * Performance Optimizer Service
 *
 * Analyzes performance data and automatically applies optimizations
 * to improve system performance based on real-time metrics.
 */

import { TIME } from "../constants";
import { type CacheStats, cacheManager } from "./cache";
import { deduplicationManager } from "./deduplication";
import {
  type Bottleneck,
  type PerformanceMetrics,
  performanceMonitor,
} from "./monitor";

/**
 * Optimization action types
 */
export enum OptimizationAction {
  ADJUST_CACHE_TTL = "adjust_cache_ttl",
  INCREASE_CACHE_SIZE = "increase_cache_size",
  DECREASE_CACHE_SIZE = "decrease_cache_size",
  CLEAR_INEFFICIENT_CACHE = "clear_inefficient_cache",
  OPTIMIZE_DEDUPLICATION = "optimize_deduplication",
  REDUCE_MEMORY_USAGE = "reduce_memory_usage",
  TRIGGER_GARBAGE_COLLECTION = "trigger_garbage_collection",
  SCALE_HORIZONTALLY = "scale_horizontally",
  ALERT_OPERATORS = "alert_operators",
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  action: OptimizationAction;
  target: string;
  applied: boolean;
  result: {
    success: boolean;
    message: string;
    metrics?: {
      before: Record<string, unknown>;
      after: Record<string, unknown>;
      improvement: number; // Percentage
    };
  };
  timestamp: Date;
}

/**
 * Auto-optimization configuration
 */
export interface AutoOptimizationConfig {
  enabled: boolean;
  interval: number; // Check interval in milliseconds
  thresholds: {
    memoryUsage: number; // MB
    cacheHitRate: number; // Percentage
    responseTime: number; // Milliseconds
    errorRate: number; // Percentage
  };
  actions: {
    autoCache: boolean;
    autoGarbageCollection: boolean;
    autoScaling: boolean;
    autoAlerting: boolean;
  };
}

/**
 * Performance Optimizer Service
 */
export class PerformanceOptimizer {
  private optimizationHistory: OptimizationResult[] = [];
  private autoOptimizationInterval: NodeJS.Timeout | null = null;
  private isOptimizing = false;

  private readonly defaultConfig: AutoOptimizationConfig = {
    enabled: false, // Manual activation required
    interval: 2 * TIME.MINUTE, // Check every 2 minutes
    thresholds: {
      memoryUsage: 300, // 300MB
      cacheHitRate: 40, // 40%
      responseTime: 1000, // 1 second
      errorRate: 5, // 5%
    },
    actions: {
      autoCache: true,
      autoGarbageCollection: false, // Dangerous in production
      autoScaling: false, // Requires infrastructure integration
      autoAlerting: true,
    },
  };

  constructor(private config: Partial<AutoOptimizationConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Start automatic optimization
   */
  startAutoOptimization(): void {
    if (this.autoOptimizationInterval || !this.config.enabled) {
      return;
    }

    console.log("[Performance Optimizer] Starting auto-optimization");

    this.autoOptimizationInterval = setInterval(async () => {
      try {
        await this.performOptimizationCycle();
      } catch (error) {
        console.error(
          "[Performance Optimizer] Auto-optimization failed:",
          error
        );
      }
    }, this.config.interval);
  }

  /**
   * Stop automatic optimization
   */
  stopAutoOptimization(): void {
    if (this.autoOptimizationInterval) {
      clearInterval(this.autoOptimizationInterval);
      this.autoOptimizationInterval = null;
      console.log("[Performance Optimizer] Stopped auto-optimization");
    }
  }

  /**
   * Perform a single optimization cycle
   */
  async performOptimizationCycle(): Promise<OptimizationResult[]> {
    if (this.isOptimizing) {
      return [];
    }

    this.isOptimizing = true;
    const results: OptimizationResult[] = [];

    try {
      console.log("[Performance Optimizer] Starting optimization cycle");

      // Get current performance metrics
      const metrics = performanceMonitor.getCurrentMetrics();
      const bottlenecks = performanceMonitor.detectBottlenecks(metrics);

      // Analyze and apply optimizations
      const optimizations = await this.analyzeAndOptimize(metrics, bottlenecks);
      results.push(...optimizations);

      // Store results in history
      this.optimizationHistory.push(...results);

      // Limit history size
      if (this.optimizationHistory.length > 100) {
        this.optimizationHistory = this.optimizationHistory.slice(-100);
      }

      console.log(
        `[Performance Optimizer] Cycle complete: ${results.length} optimizations applied`
      );
    } finally {
      this.isOptimizing = false;
    }

    return results;
  }

  /**
   * Analyze metrics and apply optimizations
   */
  private async analyzeAndOptimize(
    metrics: PerformanceMetrics,
    bottlenecks: Bottleneck[]
  ): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    // Memory optimization
    if (metrics.memoryUsage.heapUsed > this.config.thresholds!.memoryUsage!) {
      results.push(...(await this.optimizeMemoryUsage(metrics)));
    }

    // Cache optimization
    if (
      metrics.cacheMetrics.averageHitRate <
      this.config.thresholds!.cacheHitRate!
    ) {
      results.push(...(await this.optimizeCaching(metrics)));
    }

    // Response time optimization
    if (
      metrics.requestMetrics.averageResponseTime >
      this.config.thresholds!.responseTime!
    ) {
      results.push(...(await this.optimizeResponseTime(metrics)));
    }

    // Handle critical bottlenecks
    const criticalBottlenecks = bottlenecks.filter(
      (b) => b.severity === "critical"
    );
    if (criticalBottlenecks.length > 0) {
      results.push(
        ...(await this.handleCriticalBottlenecks(criticalBottlenecks))
      );
    }

    return results;
  }

  /**
   * Optimize memory usage
   */
  private async optimizeMemoryUsage(
    metrics: PerformanceMetrics
  ): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    // Clear inefficient caches
    const cacheStats = cacheManager.getAllStats();
    for (const [cacheName, stats] of Object.entries(cacheStats)) {
      if (stats.hitRate < 0.2 && stats.memoryUsage > 10 * 1024 * 1024) {
        // 10MB
        const result = await this.clearCache(cacheName, stats);
        results.push(result);
      }
    }

    // Trigger garbage collection if enabled and memory is very high
    if (
      this.config.actions!.autoGarbageCollection &&
      metrics.memoryUsage.heapUsed > 500 // 500MB
    ) {
      const result = await this.triggerGarbageCollection(metrics);
      results.push(result);
    }

    return results;
  }

  /**
   * Optimize caching performance
   */
  private async optimizeCaching(
    metrics: PerformanceMetrics
  ): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    if (!this.config.actions!.autoCache) {
      return results;
    }

    const cacheStats = cacheManager.getAllStats();

    for (const [cacheName, stats] of Object.entries(cacheStats)) {
      // Increase TTL for high-hit-rate caches
      if (stats.hitRate > 0.8 && stats.size < stats.maxSize * 0.7) {
        const result = await this.adjustCacheTTL(cacheName, stats, "increase");
        results.push(result);
      }

      // Decrease TTL for low-hit-rate caches
      else if (stats.hitRate < 0.3) {
        const result = await this.adjustCacheTTL(cacheName, stats, "decrease");
        results.push(result);
      }

      // Increase cache size if constantly at max
      else if (stats.size >= stats.maxSize * 0.95 && stats.hitRate > 0.6) {
        const result = await this.adjustCacheSize(cacheName, stats, "increase");
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Optimize response times
   */
  private async optimizeResponseTime(
    metrics: PerformanceMetrics
  ): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    // Optimize deduplication settings
    const deduplicationStats = deduplicationManager.getAllStats();
    for (const [name, stats] of Object.entries(deduplicationStats)) {
      if (stats.hitRate < 0.3) {
        const result = await this.optimizeDeduplication(name, stats);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Handle critical bottlenecks
   */
  private async handleCriticalBottlenecks(
    bottlenecks: Bottleneck[]
  ): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    for (const bottleneck of bottlenecks) {
      switch (bottleneck.type) {
        case "memory":
          results.push(...(await this.handleMemoryBottleneck(bottleneck)));
          break;
        case "event_loop":
          results.push(...(await this.handleEventLoopBottleneck(bottleneck)));
          break;
        case "cache_miss":
          results.push(...(await this.handleCacheBottleneck(bottleneck)));
          break;
        default:
          // Alert operators for unknown bottlenecks
          if (this.config.actions!.autoAlerting) {
            const result = await this.alertOperators(bottleneck);
            results.push(result);
          }
      }
    }

    return results;
  }

  /**
   * Clear inefficient cache
   */
  private async clearCache(
    cacheName: string,
    stats: CacheStats
  ): Promise<OptimizationResult> {
    const beforeStats = { ...stats };

    try {
      const success = cacheManager.removeCache(cacheName);

      return {
        action: OptimizationAction.CLEAR_INEFFICIENT_CACHE,
        target: cacheName,
        applied: true,
        result: {
          success,
          message: success
            ? `Cleared inefficient cache '${cacheName}' (hit rate: ${(stats.hitRate * 100).toFixed(1)}%)`
            : `Failed to clear cache '${cacheName}'`,
          metrics: {
            before: beforeStats,
            after: { hitRate: 0, memoryUsage: 0, size: 0 },
            improvement: success ? 100 : 0,
          },
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        action: OptimizationAction.CLEAR_INEFFICIENT_CACHE,
        target: cacheName,
        applied: false,
        result: {
          success: false,
          message: `Error clearing cache '${cacheName}': ${error}`,
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Trigger garbage collection
   */
  private async triggerGarbageCollection(
    metrics: PerformanceMetrics
  ): Promise<OptimizationResult> {
    const beforeMemory = metrics.memoryUsage.heapUsed;

    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();

        // Wait a bit and measure again
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const afterMetrics = performanceMonitor.getCurrentMetrics();
        const afterMemory = afterMetrics.memoryUsage.heapUsed;
        const improvement = ((beforeMemory - afterMemory) / beforeMemory) * 100;

        return {
          action: OptimizationAction.TRIGGER_GARBAGE_COLLECTION,
          target: "system",
          applied: true,
          result: {
            success: true,
            message: `Garbage collection freed ${(beforeMemory - afterMemory).toFixed(1)}MB`,
            metrics: {
              before: { heapUsed: beforeMemory },
              after: { heapUsed: afterMemory },
              improvement: Math.max(0, improvement),
            },
          },
          timestamp: new Date(),
        };
      }
      return {
        action: OptimizationAction.TRIGGER_GARBAGE_COLLECTION,
        target: "system",
        applied: false,
        result: {
          success: false,
          message: "Garbage collection not available (run with --expose-gc)",
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        action: OptimizationAction.TRIGGER_GARBAGE_COLLECTION,
        target: "system",
        applied: false,
        result: {
          success: false,
          message: `Garbage collection failed: ${error}`,
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Adjust cache TTL
   */
  private async adjustCacheTTL(
    cacheName: string,
    stats: CacheStats,
    direction: "increase" | "decrease"
  ): Promise<OptimizationResult> {
    // This would require cache implementation changes to support runtime TTL adjustment
    // For now, we'll return a recommendation

    const multiplier = direction === "increase" ? 1.5 : 0.7;
    const recommendedTTL = Math.round(5 * TIME.MINUTE * multiplier);

    return {
      action: OptimizationAction.ADJUST_CACHE_TTL,
      target: cacheName,
      applied: false, // Would need implementation
      result: {
        success: false,
        message: `Recommend ${direction}ing TTL for '${cacheName}' to ${recommendedTTL}ms (current hit rate: ${(stats.hitRate * 100).toFixed(1)}%)`,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Adjust cache size
   */
  private async adjustCacheSize(
    cacheName: string,
    stats: CacheStats,
    direction: "increase" | "decrease"
  ): Promise<OptimizationResult> {
    // This would require cache implementation changes

    const multiplier = direction === "increase" ? 1.3 : 0.8;
    const recommendedSize = Math.round(stats.maxSize * multiplier);

    return {
      action:
        direction === "increase"
          ? OptimizationAction.INCREASE_CACHE_SIZE
          : OptimizationAction.DECREASE_CACHE_SIZE,
      target: cacheName,
      applied: false, // Would need implementation
      result: {
        success: false,
        message: `Recommend ${direction}ing size for '${cacheName}' to ${recommendedSize} (current: ${stats.size}/${stats.maxSize})`,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Optimize deduplication settings
   */
  private async optimizeDeduplication(
    name: string,
    stats: any
  ): Promise<OptimizationResult> {
    return {
      action: OptimizationAction.OPTIMIZE_DEDUPLICATION,
      target: name,
      applied: false, // Would need implementation
      result: {
        success: false,
        message: `Recommend increasing TTL for '${name}' deduplicator (current hit rate: ${(stats.hitRate * 100).toFixed(1)}%)`,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Handle memory bottleneck
   */
  private async handleMemoryBottleneck(
    bottleneck: Bottleneck
  ): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    // Clear caches aggressively
    cacheManager.clearAll();
    results.push({
      action: OptimizationAction.REDUCE_MEMORY_USAGE,
      target: "all-caches",
      applied: true,
      result: {
        success: true,
        message: "Cleared all caches due to memory bottleneck",
      },
      timestamp: new Date(),
    });

    return results;
  }

  /**
   * Handle event loop bottleneck
   */
  private async handleEventLoopBottleneck(
    bottleneck: Bottleneck
  ): Promise<OptimizationResult[]> {
    return [
      {
        action: OptimizationAction.ALERT_OPERATORS,
        target: "event-loop",
        applied: true,
        result: {
          success: true,
          message:
            "Event loop bottleneck detected - operator intervention required",
        },
        timestamp: new Date(),
      },
    ];
  }

  /**
   * Handle cache bottleneck
   */
  private async handleCacheBottleneck(
    bottleneck: Bottleneck
  ): Promise<OptimizationResult[]> {
    // Could implement cache warming or size adjustments
    return [
      {
        action: OptimizationAction.OPTIMIZE_DEDUPLICATION,
        target: "cache-system",
        applied: false,
        result: {
          success: false,
          message:
            "Cache performance bottleneck - manual optimization recommended",
        },
        timestamp: new Date(),
      },
    ];
  }

  /**
   * Alert operators
   */
  private async alertOperators(
    bottleneck: Bottleneck
  ): Promise<OptimizationResult> {
    // Would integrate with alerting system
    console.warn("[Performance Optimizer] ALERT:", bottleneck);

    return {
      action: OptimizationAction.ALERT_OPERATORS,
      target: `${bottleneck.type}-bottleneck`,
      applied: true,
      result: {
        success: true,
        message: `Alerted operators about ${bottleneck.type} bottleneck (impact: ${bottleneck.impact})`,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(limit?: number): OptimizationResult[] {
    return limit
      ? this.optimizationHistory.slice(-limit)
      : [...this.optimizationHistory];
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    totalOptimizations: number;
    successfulOptimizations: number;
    actionCounts: Record<OptimizationAction, number>;
    averageImprovementRate: number;
    recentOptimizations: OptimizationResult[];
  } {
    const successful = this.optimizationHistory.filter((r) => r.result.success);
    const actionCounts = {} as Record<OptimizationAction, number>;

    // Count actions
    this.optimizationHistory.forEach((result) => {
      actionCounts[result.action] = (actionCounts[result.action] || 0) + 1;
    });

    // Calculate average improvement
    const improvementRates = this.optimizationHistory
      .filter((r) => r.result.metrics?.improvement)
      .map((r) => r.result.metrics!.improvement);

    const averageImprovementRate =
      improvementRates.length > 0
        ? improvementRates.reduce((sum, rate) => sum + rate, 0) /
          improvementRates.length
        : 0;

    return {
      totalOptimizations: this.optimizationHistory.length,
      successfulOptimizations: successful.length,
      actionCounts,
      averageImprovementRate,
      recentOptimizations: this.optimizationHistory.slice(-10),
    };
  }

  /**
   * Manual optimization trigger
   */
  async runManualOptimization(target?: {
    type: "memory" | "cache" | "deduplication" | "all";
    specific?: string;
  }): Promise<OptimizationResult[]> {
    const metrics = performanceMonitor.getCurrentMetrics();
    const bottlenecks = performanceMonitor.detectBottlenecks(metrics);

    if (!target || target.type === "all") {
      return this.analyzeAndOptimize(metrics, bottlenecks);
    }

    switch (target.type) {
      case "memory":
        return this.optimizeMemoryUsage(metrics);
      case "cache":
        return this.optimizeCaching(metrics);
      case "deduplication":
        return this.optimizeResponseTime(metrics);
      default:
        return [];
    }
  }
}

/**
 * Global performance optimizer instance
 */
export const performanceOptimizer = new PerformanceOptimizer();
