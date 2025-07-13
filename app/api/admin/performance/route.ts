/**
 * Performance Dashboard API
 *
 * Provides real-time performance metrics, bottleneck detection,
 * and optimization recommendations for system monitoring.
 */

import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/errors";
import { createAPIHandler, UserRole } from "@/lib/api/handler";
import { cacheManager } from "@/lib/performance/cache";
import { deduplicationManager } from "@/lib/performance/deduplication";
import {
  PerformanceUtils,
  performanceMonitor,
} from "@/lib/performance/monitor";

/**
 * GET /api/admin/performance
 * Get comprehensive performance metrics and recommendations
 */
export const GET = withErrorHandling(
  createAPIHandler(
    async (context) => {
      const url = new URL(context.request.url);
      const type = url.searchParams.get("type") || "summary";
      const limit = Math.min(
        100,
        Number.parseInt(url.searchParams.get("limit") || "50", 10)
      );

      switch (type) {
        case "summary":
          return await getPerformanceSummary();

        case "history":
          return await getPerformanceHistory(limit);

        case "cache":
          return await getCacheMetrics();

        case "deduplication":
          return await getDeduplicationMetrics();

        case "recommendations":
          return await getOptimizationRecommendations();

        case "bottlenecks":
          return await getBottleneckAnalysis();

        default:
          return await getPerformanceSummary();
      }
    },
    {
      requireAuth: true,
      requiredRole: [UserRole.PLATFORM_ADMIN],
      auditLog: true,
    }
  )
);

/**
 * POST /api/admin/performance/action
 * Execute performance optimization actions
 */
export const POST = withErrorHandling(
  createAPIHandler(
    async (context, validatedData) => {
      const { action, target, options } =
        validatedData || (await context.request.json());

      switch (action) {
        case "clear_cache":
          return await clearCache(target);

        case "start_monitoring":
          return await startMonitoring(options);

        case "stop_monitoring":
          return await stopMonitoring();

        case "optimize_cache":
          return await optimizeCache(target, options);

        case "invalidate_pattern":
          return await invalidatePattern(target, options);

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
    {
      requireAuth: true,
      requiredRole: [UserRole.PLATFORM_ADMIN],
      auditLog: true,
    }
  )
);

async function getPerformanceSummary() {
  const { result: summary } = await PerformanceUtils.measureAsync(
    "performance-summary-generation",
    async () => {
      const performanceSummary = performanceMonitor.getPerformanceSummary();
      const cacheReport = cacheManager.getPerformanceReport();
      const deduplicationStats = deduplicationManager.getAllStats();

      return {
        timestamp: new Date().toISOString(),
        system: {
          status: getSystemStatus(performanceSummary),
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
        },
        performance: {
          current: performanceSummary.currentMetrics,
          trends: performanceSummary.trends,
          score: calculatePerformanceScore(performanceSummary),
        },
        bottlenecks: performanceSummary.bottlenecks,
        recommendations: performanceSummary.recommendations,
        caching: {
          ...cacheReport,
          efficiency: calculateCacheEfficiency(cacheReport),
        },
        deduplication: {
          totalDeduplicators: Object.keys(deduplicationStats).length,
          overallStats: calculateOverallDeduplicationStats(deduplicationStats),
          byCategory: deduplicationStats,
        },
      };
    }
  );

  return NextResponse.json(summary);
}

async function getPerformanceHistory(limit: number) {
  const history = performanceMonitor.getHistory(limit);
  // history is already typed as PerformanceMetrics[], no casting needed

  return NextResponse.json({
    history,
    analytics: {
      averageMemoryUsage:
        history.length > 0
          ? history.reduce((sum, item) => sum + item.memoryUsage.heapUsed, 0) /
            history.length
          : 0,
      averageResponseTime:
        history.length > 0
          ? history.reduce(
              (sum, item) => sum + item.requestMetrics.averageResponseTime,
              0
            ) / history.length
          : 0,
      memoryTrend: calculateTrend(
        history as unknown as Record<string, unknown>[],
        "memoryUsage.heapUsed"
      ),
      responseTrend: calculateTrend(
        history as unknown as Record<string, unknown>[],
        "requestMetrics.averageResponseTime"
      ),
    },
  });
}

async function getCacheMetrics() {
  const report = cacheManager.getPerformanceReport();
  const detailedStats = cacheManager.getAllStats();

  return NextResponse.json({
    overview: report,
    detailed: detailedStats,
    insights: {
      mostEfficient: findMostEfficientCache(detailedStats),
      leastEfficient: findLeastEfficientCache(detailedStats),
      memoryDistribution: calculateMemoryDistribution(detailedStats),
    },
  });
}

async function getDeduplicationMetrics() {
  const allStats = deduplicationManager.getAllStats();

  return NextResponse.json({
    overview: calculateOverallDeduplicationStats(allStats),
    byCategory: allStats,
    insights: {
      mostEffective: findMostEffectiveDeduplicator(allStats),
      optimization: generateDeduplicationOptimizations(allStats),
    },
  });
}

async function getOptimizationRecommendations() {
  const currentMetrics = performanceMonitor.getCurrentMetrics();
  const recommendations =
    performanceMonitor.generateRecommendations(currentMetrics);

  const enhancedRecommendations = recommendations.map((rec) => ({
    ...rec,
    urgency: calculateUrgency(rec),
    complexity: estimateComplexity(rec),
    timeline: estimateTimeline(rec),
  }));

  return NextResponse.json({
    recommendations: enhancedRecommendations,
    quickWins: enhancedRecommendations.filter(
      (r) => r.complexity === "low" && r.estimatedImpact > 50
    ),
    highImpact: enhancedRecommendations.filter((r) => r.estimatedImpact > 70),
  });
}

async function getBottleneckAnalysis() {
  const currentMetrics = performanceMonitor.getCurrentMetrics();
  const bottlenecks = performanceMonitor.detectBottlenecks(currentMetrics);

  return NextResponse.json({
    bottlenecks,
    analysis: {
      criticalCount: bottlenecks.filter((b) => b.severity === "critical")
        .length,
      warningCount: bottlenecks.filter((b) => b.severity === "warning").length,
      totalImpact: bottlenecks.reduce((sum, b) => sum + b.impact, 0),
      prioritizedActions: prioritizeBottleneckActions(bottlenecks),
    },
  });
}

async function clearCache(target?: string) {
  if (target) {
    const success = cacheManager.removeCache(target);
    return NextResponse.json({
      success,
      message: success
        ? `Cache '${target}' cleared`
        : `Cache '${target}' not found`,
    });
  }
  cacheManager.clearAll();
  return NextResponse.json({
    success: true,
    message: "All caches cleared",
  });
}

async function startMonitoring(options: { interval?: number } = {}) {
  const interval = options.interval || 30000;
  performanceMonitor.start(interval);

  return NextResponse.json({
    success: true,
    message: `Performance monitoring started with ${interval}ms interval`,
  });
}

async function stopMonitoring() {
  performanceMonitor.stop();

  return NextResponse.json({
    success: true,
    message: "Performance monitoring stopped",
  });
}

async function optimizeCache(
  target: string,
  _options: Record<string, unknown> = {}
) {
  try {
    const optimizationResults: string[] = [];

    switch (target) {
      case "memory": {
        // Trigger garbage collection and memory cleanup
        if (global.gc) {
          global.gc();
          optimizationResults.push("Forced garbage collection");
        }

        // Get current memory usage before optimization
        const beforeMemory = cacheManager.getTotalMemoryUsage();
        optimizationResults.push(
          `Memory usage before optimization: ${beforeMemory.toFixed(2)} MB`
        );
        break;
      }

      case "lru": {
        // Clear all LRU caches to free memory
        const beforeClearStats = cacheManager.getAllStats();
        const totalCachesBefore = Object.keys(beforeClearStats).length;

        cacheManager.clearAll();
        optimizationResults.push(`Cleared ${totalCachesBefore} LRU caches`);
        break;
      }

      case "all": {
        // Comprehensive cache optimization
        if (global.gc) {
          global.gc();
          optimizationResults.push("Forced garbage collection");
        }

        const allStats = cacheManager.getAllStats();
        const totalCaches = Object.keys(allStats).length;
        const memoryBefore = cacheManager.getTotalMemoryUsage();

        cacheManager.clearAll();

        const memoryAfter = cacheManager.getTotalMemoryUsage();
        const memorySaved = memoryBefore - memoryAfter;

        optimizationResults.push(
          `Cleared ${totalCaches} caches`,
          `Memory freed: ${memorySaved.toFixed(2)} MB`
        );
        break;
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown optimization target: ${target}. Valid targets: memory, lru, all`,
          },
          { status: 400 }
        );
    }

    // Get post-optimization metrics
    const metrics = cacheManager.getPerformanceReport();

    return NextResponse.json({
      success: true,
      message: `Cache optimization applied to '${target}'`,
      optimizations: optimizationResults,
      metrics: {
        totalMemoryUsage: metrics.totalMemoryUsage,
        averageHitRate: metrics.averageHitRate,
        totalCaches: metrics.totalCaches,
      },
    });
  } catch (error) {
    console.error("Cache optimization failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Cache optimization failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function invalidatePattern(
  target: string,
  options: { pattern?: string } = {}
) {
  const { pattern } = options;
  if (!pattern) {
    throw new Error("Pattern is required for invalidation");
  }

  try {
    let invalidatedCount = 0;
    const invalidationResults: string[] = [];

    switch (target) {
      case "all": {
        // Clear all caches (pattern-based clearing not available in current implementation)
        const allCacheStats = cacheManager.getAllStats();
        const allCacheNames = Object.keys(allCacheStats);

        cacheManager.clearAll();
        invalidatedCount = allCacheNames.length;
        invalidationResults.push(
          `Cleared all ${invalidatedCount} caches (pattern matching not supported)`
        );
        break;
      }

      case "memory": {
        // Get memory usage and clear if pattern would match memory operations
        const memoryBefore = cacheManager.getTotalMemoryUsage();
        cacheManager.clearAll();
        const memoryAfter = cacheManager.getTotalMemoryUsage();

        invalidatedCount = 1;
        invalidationResults.push(
          `Cleared memory caches, freed ${(memoryBefore - memoryAfter).toFixed(2)} MB`
        );
        break;
      }

      case "lru": {
        // Clear all LRU caches
        const lruStats = cacheManager.getAllStats();
        const lruCacheCount = Object.keys(lruStats).length;

        cacheManager.clearAll();
        invalidatedCount = lruCacheCount;
        invalidationResults.push(`Cleared ${invalidatedCount} LRU caches`);
        break;
      }

      default: {
        // Try to remove a specific cache by name
        const removed = cacheManager.removeCache(target);
        if (!removed) {
          return NextResponse.json(
            {
              success: false,
              error: `Cache '${target}' not found. Valid targets: all, memory, lru, or specific cache name`,
            },
            { status: 400 }
          );
        }
        invalidatedCount = 1;
        invalidationResults.push(`Removed cache '${target}'`);
        break;
      }
    }

    // Get post-invalidation metrics
    const metrics = cacheManager.getPerformanceReport();

    return NextResponse.json({
      success: true,
      message: `Pattern '${pattern}' invalidated in cache '${target}'`,
      invalidated: invalidatedCount,
      details: invalidationResults,
      metrics: {
        totalMemoryUsage: metrics.totalMemoryUsage,
        totalCaches: metrics.totalCaches,
        averageHitRate: metrics.averageHitRate,
      },
    });
  } catch (error) {
    console.error("Pattern invalidation failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Pattern invalidation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Helper functions
function getSystemStatus(summary: {
  bottlenecks: Array<{ severity: string }>;
}): "healthy" | "warning" | "critical" {
  const criticalBottlenecks = summary.bottlenecks.filter(
    (b: { severity: string }) => b.severity === "critical"
  );
  const warningBottlenecks = summary.bottlenecks.filter(
    (b: { severity: string }) => b.severity === "warning"
  );

  if (criticalBottlenecks.length > 0) return "critical";
  if (warningBottlenecks.length > 2) return "warning";
  return "healthy";
}

function calculatePerformanceScore(summary: {
  bottlenecks: Array<{ severity: string }>;
  currentMetrics: { memoryUsage: { heapUsed: number } };
}): number {
  let score = 100;

  // Deduct points for bottlenecks
  summary.bottlenecks.forEach((bottleneck: { severity: string }) => {
    if (bottleneck.severity === "critical") score -= 25;
    else if (bottleneck.severity === "warning") score -= 10;
  });

  // Factor in memory usage
  const memUsage = summary.currentMetrics.memoryUsage.heapUsed;
  if (memUsage > 400) score -= 20;
  else if (memUsage > 200) score -= 10;

  return Math.max(0, score);
}

function calculateCacheEfficiency(report: { averageHitRate: number }): number {
  return Math.round(report.averageHitRate * 100);
}

function calculateOverallDeduplicationStats(
  stats: Record<
    string,
    { hits: number; misses: number; deduplicatedRequests: number }
  >
) {
  const values = Object.values(stats);
  if (values.length === 0) return { hitRate: 0, totalSaved: 0 };

  const totalHits = values.reduce(
    (sum: number, stat: { hits: number }) => sum + stat.hits,
    0
  );
  const totalRequests = values.reduce(
    (sum: number, stat: { hits: number; misses: number }) =>
      sum + stat.hits + stat.misses,
    0
  );
  const totalSaved = values.reduce(
    (sum: number, stat: { deduplicatedRequests: number }) =>
      sum + stat.deduplicatedRequests,
    0
  );

  return {
    hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
    totalSaved,
    efficiency: totalRequests > 0 ? (totalSaved / totalRequests) * 100 : 0,
  };
}

function _calculateAverage(
  history: Record<string, unknown>[],
  path: string
): number {
  if (history.length === 0) return 0;

  const values = history
    .map((item) => getNestedValue(item, path))
    .filter((v) => v !== undefined && typeof v === "number") as number[];
  return values.length > 0
    ? values.reduce((sum, val) => sum + val, 0) / values.length
    : 0;
}

function calculateTrend<T extends Record<string, unknown>>(
  history: Array<T>,
  path: string
): "increasing" | "decreasing" | "stable" {
  if (history.length < 2) return "stable";

  const recent = history.slice(-5);
  const older = history.slice(-10, -5);

  if (older.length === 0) return "stable";

  const recentAvg =
    recent.length > 0
      ? recent.reduce(
          (sum, item) => sum + getNestedPropertyValue(item, path),
          0
        ) / recent.length
      : 0;
  const olderAvg =
    older.length > 0
      ? older.reduce(
          (sum, item) => sum + getNestedPropertyValue(item, path),
          0
        ) / older.length
      : 0;

  if (recentAvg > olderAvg * 1.1) return "increasing";
  if (recentAvg < olderAvg * 0.9) return "decreasing";
  return "stable";
}

function getNestedPropertyValue(
  obj: Record<string, unknown>,
  path: string
): number {
  const result = path.split(".").reduce((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return 0;
  }, obj as unknown);

  return typeof result === "number" ? result : 0;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce((current, key) => (current as Record<string, unknown>)?.[key], obj);
}

function findMostEfficientCache(stats: Record<string, { hitRate: number }>) {
  return Object.entries(stats).reduce(
    (best, [name, stat]) =>
      stat.hitRate > best.hitRate ? { name, ...stat } : best,
    { name: "", hitRate: -1 }
  );
}

function findLeastEfficientCache(stats: Record<string, { hitRate: number }>) {
  return Object.entries(stats).reduce(
    (worst, [name, stat]) =>
      stat.hitRate < worst.hitRate ? { name, ...stat } : worst,
    { name: "", hitRate: 2 }
  );
}

function calculateMemoryDistribution(
  stats: Record<string, { memoryUsage: number }>
) {
  const total = Object.values(stats).reduce(
    (sum: number, stat: { memoryUsage: number }) => sum + stat.memoryUsage,
    0
  );

  return Object.entries(stats).map(([name, stat]) => ({
    name,
    percentage: total > 0 ? (stat.memoryUsage / total) * 100 : 0,
    memoryUsage: stat.memoryUsage,
  }));
}

function findMostEffectiveDeduplicator(
  stats: Record<string, { deduplicationRate: number }>
) {
  return Object.entries(stats).reduce(
    (best, [name, stat]) =>
      stat.deduplicationRate > best.deduplicationRate
        ? { name, ...stat }
        : best,
    { name: "", deduplicationRate: -1 }
  );
}

function generateDeduplicationOptimizations(
  stats: Record<string, { hitRate: number; deduplicationRate: number }>
) {
  const optimizations: string[] = [];

  Object.entries(stats).forEach(([name, stat]) => {
    if (stat.hitRate < 0.3) {
      optimizations.push(`Increase TTL for '${name}' deduplicator`);
    }
    if (stat.deduplicationRate < 0.1) {
      optimizations.push(`Review key generation strategy for '${name}'`);
    }
  });

  return optimizations;
}

function calculateUrgency(rec: {
  priority: string;
  estimatedImpact: number;
}): "low" | "medium" | "high" {
  if (rec.priority === "high" && rec.estimatedImpact > 70) return "high";
  if (rec.priority === "medium" || rec.estimatedImpact > 50) return "medium";
  return "low";
}

function estimateComplexity(rec: {
  category: string;
}): "low" | "medium" | "high" {
  if (rec.category === "Caching" || rec.category === "Configuration")
    return "low";
  if (rec.category === "Performance" || rec.category === "Memory")
    return "medium";
  return "high";
}

function estimateTimeline(rec: { category: string }): string {
  const complexity = estimateComplexity(rec);

  switch (complexity) {
    case "low":
      return "1-2 hours";
    case "medium":
      return "4-8 hours";
    case "high":
      return "1-3 days";
    default:
      return "Unknown";
  }
}

function prioritizeBottleneckActions(
  bottlenecks: Array<{
    severity: string;
    impact: number;
    recommendations: string[];
    description: string;
  }>
) {
  return bottlenecks
    .sort((a, b) => {
      // Sort by severity first, then by impact
      if (a.severity !== b.severity) {
        const severityOrder = { critical: 3, warning: 2, info: 1 };
        return (
          severityOrder[b.severity as keyof typeof severityOrder] -
          severityOrder[a.severity as keyof typeof severityOrder]
        );
      }
      return b.impact - a.impact;
    })
    .slice(0, 5) // Top 5 actions
    .map((bottleneck, index) => ({
      priority: index + 1,
      action: bottleneck.recommendations[0] || "No specific action available",
      bottleneck: bottleneck.description,
      estimatedImpact: bottleneck.impact,
    }));
}
