/**
 * Performance Monitoring and Optimization System
 *
 * Provides real-time performance monitoring, bottleneck detection,
 * and automatic optimization recommendations for the application.
 */

import { PerformanceObserver, performance } from "node:perf_hooks";
import { TIME } from "../constants";
import { cacheManager } from "./cache";
import { deduplicationManager } from "./deduplication";

/**
 * Performance metrics collection
 */
export interface PerformanceMetrics {
  timestamp: number;

  // Memory metrics
  memoryUsage: {
    rss: number; // Resident Set Size
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };

  // CPU metrics
  cpuUsage: {
    user: number;
    system: number;
  };

  // Event loop metrics
  eventLoop: {
    delay: number; // Event loop lag
    utilization: number;
  };

  // Cache performance
  cacheMetrics: {
    totalCaches: number;
    totalMemoryUsage: number;
    averageHitRate: number;
    topPerformers: Array<{ name: string; hitRate: number }>;
  };

  // Deduplication performance
  deduplicationMetrics: {
    totalDeduplicators: number;
    averageHitRate: number;
    totalDeduplicatedRequests: number;
  };

  // Request metrics
  requestMetrics: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    slowRequests: number; // Requests taking > 1 second
  };

  // Custom metrics
  customMetrics: Record<string, number>;
}

/**
 * Performance alert levels
 */
export enum AlertLevel {
  INFO = "info",
  WARNING = "warning",
  CRITICAL = "critical",
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  level: AlertLevel;
  metric: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  recommendations: string[];
}

/**
 * Performance bottleneck types
 */
export enum BottleneckType {
  MEMORY = "memory",
  CPU = "cpu",
  EVENT_LOOP = "event_loop",
  CACHE_MISS = "cache_miss",
  SLOW_QUERIES = "slow_queries",
  HIGH_LATENCY = "high_latency",
}

/**
 * Bottleneck detection result
 */
export interface Bottleneck {
  type: BottleneckType;
  severity: AlertLevel;
  description: string;
  impact: number; // 0-100 scale
  recommendations: string[];
  metrics: Record<string, number>;
}

/**
 * Performance thresholds configuration
 */
export interface PerformanceThresholds {
  memory: {
    heapUsedWarning: number; // MB
    heapUsedCritical: number; // MB
    rssWarning: number; // MB
    rssCritical: number; // MB
  };
  cpu: {
    usageWarning: number; // Percentage
    usageCritical: number; // Percentage
  };
  eventLoop: {
    delayWarning: number; // Milliseconds
    delayCritical: number; // Milliseconds
    utilizationWarning: number; // Percentage
  };
  cache: {
    hitRateWarning: number; // Percentage
    memoryUsageWarning: number; // MB
  };
  response: {
    averageTimeWarning: number; // Milliseconds
    errorRateWarning: number; // Percentage
    slowRequestThreshold: number; // Milliseconds
  };
}

/**
 * Performance optimization recommendation
 */
export interface OptimizationRecommendation {
  priority: "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  implementation: string;
  estimatedImpact: number; // 0-100 scale
}

/**
 * Main performance monitor class
 */
export class PerformanceMonitor {
  private isMonitoring = false;
  private metricsHistory: PerformanceMetrics[] = [];
  private customMetrics = new Map<string, number>();
  private requestMetrics = {
    totalRequests: 0,
    totalResponseTime: 0,
    errors: 0,
    slowRequests: 0,
  };

  private readonly maxHistorySize = 100;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private perfObserver: PerformanceObserver | null = null;

  private readonly defaultThresholds: PerformanceThresholds = {
    memory: {
      heapUsedWarning: 200, // 200 MB
      heapUsedCritical: 400, // 400 MB
      rssWarning: 300, // 300 MB
      rssCritical: 600, // 600 MB
    },
    cpu: {
      usageWarning: 70, // 70%
      usageCritical: 90, // 90%
    },
    eventLoop: {
      delayWarning: 10, // 10ms
      delayCritical: 50, // 50ms
      utilizationWarning: 80, // 80%
    },
    cache: {
      hitRateWarning: 50, // 50%
      memoryUsageWarning: 100, // 100 MB
    },
    response: {
      averageTimeWarning: 1000, // 1 second
      errorRateWarning: 5, // 5%
      slowRequestThreshold: 1000, // 1 second
    },
  };

  private thresholds: PerformanceThresholds;

  constructor(thresholdsOverride: Partial<PerformanceThresholds> = {}) {
    this.thresholds = { ...this.defaultThresholds, ...thresholdsOverride };
  }

  /**
   * Start performance monitoring
   */
  start(intervalMs = 30000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Set up performance observer for timing data
    this.setupPerformanceObserver();

    // Start periodic metrics collection
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log(
      "[Performance Monitor] Started monitoring with interval:",
      intervalMs + "ms"
    );
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.perfObserver) {
      this.perfObserver.disconnect();
      this.perfObserver = null;
    }

    console.log("[Performance Monitor] Stopped monitoring");
  }

  /**
   * Record a custom metric
   */
  recordMetric(name: string, value: number): void {
    this.customMetrics.set(name, value);
  }

  /**
   * Record request metrics
   */
  recordRequest(responseTime: number, isError = false): void {
    this.requestMetrics.totalRequests++;
    this.requestMetrics.totalResponseTime += responseTime;

    if (isError) {
      this.requestMetrics.errors++;
    }

    if (responseTime > this.thresholds.response.slowRequestThreshold) {
      this.requestMetrics.slowRequests++;
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Calculate event loop metrics
    const start = performance.now();
    setImmediate(() => {
      const eventLoopDelay = performance.now() - start;

      // Event loop utilization (approximated)
      const eventLoopUtilization = Math.min(
        100,
        (eventLoopDelay / 16.67) * 100
      ); // 16.67ms = 60fps
    });

    // Get cache metrics
    const cacheReport = cacheManager.getPerformanceReport();

    // Get deduplication metrics
    const deduplicationStats = deduplicationManager.getAllStats();
    const deduplicationHitRates = Object.values(deduplicationStats).map(
      (s) => s.hitRate
    );
    const averageDeduplicationHitRate =
      deduplicationHitRates.length > 0
        ? deduplicationHitRates.reduce((sum, rate) => sum + rate, 0) /
          deduplicationHitRates.length
        : 0;

    const totalDeduplicatedRequests = Object.values(deduplicationStats).reduce(
      (sum, stats) => sum + stats.deduplicatedRequests,
      0
    );

    // Calculate request metrics
    const averageResponseTime =
      this.requestMetrics.totalRequests > 0
        ? this.requestMetrics.totalResponseTime /
          this.requestMetrics.totalRequests
        : 0;

    const errorRate =
      this.requestMetrics.totalRequests > 0
        ? (this.requestMetrics.errors / this.requestMetrics.totalRequests) * 100
        : 0;

    return {
      timestamp: Date.now(),
      memoryUsage: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // Convert to MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024),
      },
      cpuUsage: {
        user: cpuUsage.user / 1000, // Convert to milliseconds
        system: cpuUsage.system / 1000,
      },
      eventLoop: {
        delay: 0, // Will be updated asynchronously
        utilization: 0, // Will be updated asynchronously
      },
      cacheMetrics: {
        totalCaches: cacheReport.totalCaches,
        totalMemoryUsage: Math.round(
          cacheReport.totalMemoryUsage / 1024 / 1024
        ), // MB
        averageHitRate: cacheReport.averageHitRate * 100, // Percentage
        topPerformers: cacheReport.topPerformers.slice(0, 3),
      },
      deduplicationMetrics: {
        totalDeduplicators: Object.keys(deduplicationStats).length,
        averageHitRate: averageDeduplicationHitRate * 100, // Percentage
        totalDeduplicatedRequests,
      },
      requestMetrics: {
        totalRequests: this.requestMetrics.totalRequests,
        averageResponseTime,
        errorRate,
        slowRequests: this.requestMetrics.slowRequests,
      },
      customMetrics: Object.fromEntries(this.customMetrics),
    };
  }

  /**
   * Detect performance bottlenecks
   */
  detectBottlenecks(metrics?: PerformanceMetrics): Bottleneck[] {
    const currentMetrics = metrics || this.getCurrentMetrics();
    const bottlenecks: Bottleneck[] = [];

    // Memory bottlenecks
    if (
      currentMetrics.memoryUsage.heapUsed >
      this.thresholds.memory.heapUsedCritical
    ) {
      bottlenecks.push({
        type: BottleneckType.MEMORY,
        severity: AlertLevel.CRITICAL,
        description: `Heap memory usage is critically high: ${currentMetrics.memoryUsage.heapUsed}MB`,
        impact: 90,
        recommendations: [
          "Investigate memory leaks in application code",
          "Implement object pooling for frequently created objects",
          "Reduce cache sizes or TTL values",
          "Consider increasing available memory or horizontal scaling",
        ],
        metrics: { heapUsed: currentMetrics.memoryUsage.heapUsed },
      });
    } else if (
      currentMetrics.memoryUsage.heapUsed >
      this.thresholds.memory.heapUsedWarning
    ) {
      bottlenecks.push({
        type: BottleneckType.MEMORY,
        severity: AlertLevel.WARNING,
        description: `Heap memory usage is high: ${currentMetrics.memoryUsage.heapUsed}MB`,
        impact: 60,
        recommendations: [
          "Monitor memory usage trends",
          "Review cache configurations for optimization opportunities",
          "Implement garbage collection optimization",
        ],
        metrics: { heapUsed: currentMetrics.memoryUsage.heapUsed },
      });
    }

    // Event loop bottlenecks
    if (
      currentMetrics.eventLoop.delay > this.thresholds.eventLoop.delayCritical
    ) {
      bottlenecks.push({
        type: BottleneckType.EVENT_LOOP,
        severity: AlertLevel.CRITICAL,
        description: `Event loop delay is critically high: ${currentMetrics.eventLoop.delay}ms`,
        impact: 95,
        recommendations: [
          "Identify and optimize CPU-intensive synchronous operations",
          "Move heavy computations to worker threads",
          "Implement request queuing and rate limiting",
          "Profile application to find blocking operations",
        ],
        metrics: { eventLoopDelay: currentMetrics.eventLoop.delay },
      });
    }

    // Cache performance bottlenecks
    if (
      currentMetrics.cacheMetrics.averageHitRate <
      this.thresholds.cache.hitRateWarning
    ) {
      bottlenecks.push({
        type: BottleneckType.CACHE_MISS,
        severity: AlertLevel.WARNING,
        description: `Cache hit rate is low: ${currentMetrics.cacheMetrics.averageHitRate.toFixed(1)}%`,
        impact: 40,
        recommendations: [
          "Review cache key strategies and TTL configurations",
          "Implement cache warming for frequently accessed data",
          "Analyze cache access patterns to optimize cache sizes",
          "Consider implementing cache hierarchies",
        ],
        metrics: { hitRate: currentMetrics.cacheMetrics.averageHitRate },
      });
    }

    // Response time bottlenecks
    if (
      currentMetrics.requestMetrics.averageResponseTime >
      this.thresholds.response.averageTimeWarning
    ) {
      bottlenecks.push({
        type: BottleneckType.HIGH_LATENCY,
        severity: AlertLevel.WARNING,
        description: `Average response time is high: ${currentMetrics.requestMetrics.averageResponseTime.toFixed(0)}ms`,
        impact: 70,
        recommendations: [
          "Implement request caching for expensive operations",
          "Optimize database queries and add missing indexes",
          "Enable response compression",
          "Consider implementing CDN for static assets",
        ],
        metrics: {
          averageResponseTime:
            currentMetrics.requestMetrics.averageResponseTime,
        },
      });
    }

    return bottlenecks;
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(
    metrics?: PerformanceMetrics
  ): OptimizationRecommendation[] {
    const currentMetrics = metrics || this.getCurrentMetrics();
    const recommendations: OptimizationRecommendation[] = [];

    // Memory optimization recommendations
    if (currentMetrics.memoryUsage.heapUsed > 100) {
      // 100MB
      recommendations.push({
        priority: "high",
        category: "Memory",
        title: "Implement Memory Optimization",
        description:
          "High memory usage detected. Consider implementing memory optimization strategies.",
        implementation:
          "Review object lifecycle, implement object pooling, optimize cache configurations",
        estimatedImpact: 75,
      });
    }

    // Cache optimization recommendations
    if (currentMetrics.cacheMetrics.averageHitRate < 70) {
      recommendations.push({
        priority: "medium",
        category: "Caching",
        title: "Improve Cache Performance",
        description:
          "Cache hit rate is below optimal. Implement cache optimization strategies.",
        implementation:
          "Adjust TTL values, implement cache warming, optimize cache key strategies",
        estimatedImpact: 60,
      });
    }

    // Response time optimization
    if (currentMetrics.requestMetrics.averageResponseTime > 500) {
      recommendations.push({
        priority: "high",
        category: "Performance",
        title: "Reduce Response Times",
        description:
          "Average response time exceeds target. Implement performance optimizations.",
        implementation:
          "Add response caching, optimize database queries, implement request deduplication",
        estimatedImpact: 80,
      });
    }

    // Deduplication optimization
    if (currentMetrics.deduplicationMetrics.averageHitRate < 30) {
      recommendations.push({
        priority: "low",
        category: "Optimization",
        title: "Improve Request Deduplication",
        description:
          "Low deduplication hit rate suggests opportunities for optimization.",
        implementation:
          "Review deduplication key strategies, increase TTL for stable operations",
        estimatedImpact: 40,
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Get performance history
   */
  getHistory(limit?: number): PerformanceMetrics[] {
    return limit ? this.metricsHistory.slice(-limit) : [...this.metricsHistory];
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    currentMetrics: PerformanceMetrics;
    bottlenecks: Bottleneck[];
    recommendations: OptimizationRecommendation[];
    trends: {
      memoryTrend: "increasing" | "decreasing" | "stable";
      responseTrend: "improving" | "degrading" | "stable";
      cacheTrend: "improving" | "degrading" | "stable";
    };
  } {
    const currentMetrics = this.getCurrentMetrics();
    const bottlenecks = this.detectBottlenecks(currentMetrics);
    const recommendations = this.generateRecommendations(currentMetrics);

    // Calculate trends
    const trends = this.calculateTrends();

    return {
      currentMetrics,
      bottlenecks,
      recommendations,
      trends,
    };
  }

  /**
   * Set up performance observer for timing data
   */
  private setupPerformanceObserver(): void {
    try {
      this.perfObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === "measure") {
            this.recordMetric(`timing.${entry.name}`, entry.duration);
          }
        });
      });

      this.perfObserver.observe({ entryTypes: ["measure"] });
    } catch (error) {
      console.warn(
        "[Performance Monitor] Failed to setup performance observer:",
        error
      );
    }
  }

  /**
   * Collect and store metrics
   */
  private collectMetrics(): void {
    try {
      const metrics = this.getCurrentMetrics();

      // Add to history
      this.metricsHistory.push(metrics);

      // Limit history size
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }

      // Check for bottlenecks and log warnings
      const bottlenecks = this.detectBottlenecks(metrics);
      bottlenecks.forEach((bottleneck) => {
        if (bottleneck.severity === AlertLevel.CRITICAL) {
          console.error(
            `[Performance Monitor] CRITICAL: ${bottleneck.description}`
          );
        } else if (bottleneck.severity === AlertLevel.WARNING) {
          console.warn(
            `[Performance Monitor] WARNING: ${bottleneck.description}`
          );
        }
      });
    } catch (error) {
      console.error("[Performance Monitor] Failed to collect metrics:", error);
    }
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(): {
    memoryTrend: "increasing" | "decreasing" | "stable";
    responseTrend: "improving" | "degrading" | "stable";
    cacheTrend: "improving" | "degrading" | "stable";
  } {
    if (this.metricsHistory.length < 5) {
      return {
        memoryTrend: "stable",
        responseTrend: "stable",
        cacheTrend: "stable",
      };
    }

    const recent = this.metricsHistory.slice(-5);
    const older = this.metricsHistory.slice(-10, -5);

    if (older.length === 0) {
      return {
        memoryTrend: "stable",
        responseTrend: "stable",
        cacheTrend: "stable",
      };
    }

    // Calculate averages
    const recentMemory =
      recent.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) /
      recent.length;
    const olderMemory =
      older.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) / older.length;

    const recentResponse =
      recent.reduce((sum, m) => sum + m.requestMetrics.averageResponseTime, 0) /
      recent.length;
    const olderResponse =
      older.reduce((sum, m) => sum + m.requestMetrics.averageResponseTime, 0) /
      older.length;

    const recentCache =
      recent.reduce((sum, m) => sum + m.cacheMetrics.averageHitRate, 0) /
      recent.length;
    const olderCache =
      older.reduce((sum, m) => sum + m.cacheMetrics.averageHitRate, 0) /
      older.length;

    return {
      memoryTrend:
        recentMemory > olderMemory * 1.1
          ? "increasing"
          : recentMemory < olderMemory * 0.9
            ? "decreasing"
            : "stable",
      responseTrend:
        recentResponse < olderResponse * 0.9
          ? "improving"
          : recentResponse > olderResponse * 1.1
            ? "degrading"
            : "stable",
      cacheTrend:
        recentCache > olderCache * 1.1
          ? "improving"
          : recentCache < olderCache * 0.9
            ? "degrading"
            : "stable",
    };
  }
}

/**
 * Global performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * Performance monitoring utilities
 */
export class PerformanceUtils {
  /**
   * Measure execution time of a function
   */
  static async measureAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    performanceMonitor.recordMetric(`execution.${name}`, duration);

    return { result, duration };
  }

  /**
   * Measure execution time of a synchronous function
   */
  static measure<T>(
    name: string,
    fn: () => T
  ): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    performanceMonitor.recordMetric(`execution.${name}`, duration);

    return { result, duration };
  }

  /**
   * Create a performance timer
   */
  static createTimer(name: string) {
    const start = performance.now();

    return {
      end: () => {
        const duration = performance.now() - start;
        performanceMonitor.recordMetric(`timer.${name}`, duration);
        return duration;
      },
    };
  }

  /**
   * Decorator for measuring method performance
   */
  static measured(name?: string) {
    return (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) => {
      const originalMethod = descriptor.value;
      const metricName = name || `${target.constructor.name}.${propertyKey}`;

      if (typeof originalMethod !== "function") {
        throw new Error("Measured decorator can only be applied to methods");
      }

      descriptor.value = async function (...args: unknown[]) {
        const { result, duration } = await PerformanceUtils.measureAsync(
          metricName,
          () => originalMethod.apply(this, args)
        );
        return result;
      };

      return descriptor;
    };
  }
}
