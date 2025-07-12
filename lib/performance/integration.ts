/**
 * Performance Integration Utilities
 *
 * Provides easy-to-use helpers for integrating performance monitoring,
 * caching, and deduplication into existing services and API endpoints.
 */

import { PerformanceUtils, performanceMonitor } from "./monitor";
import { caches, CacheUtils } from "./cache";
import { deduplicators, DeduplicationUtils } from "./deduplication";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Performance integration options
 */
export interface PerformanceIntegrationOptions {
  cache?: {
    enabled: boolean;
    cacheName?: string;
    ttl?: number;
    keyGenerator?: (...args: unknown[]) => string;
  };
  deduplication?: {
    enabled: boolean;
    deduplicatorName?: string;
    ttl?: number;
    keyGenerator?: (...args: unknown[]) => string;
  };
  monitoring?: {
    enabled: boolean;
    metricName?: string;
    recordRequests?: boolean;
  };
}

/**
 * Default performance integration options
 */
const defaultOptions: PerformanceIntegrationOptions = {
  cache: {
    enabled: true,
    cacheName: "api-responses",
    ttl: 5 * 60 * 1000, // 5 minutes
  },
  deduplication: {
    enabled: true,
    deduplicatorName: "api",
    ttl: 2 * 60 * 1000, // 2 minutes
  },
  monitoring: {
    enabled: true,
    recordRequests: true,
  },
};

/**
 * Enhance a service method with performance optimizations
 */
export function enhanceServiceMethod<T extends unknown[], R>(
  methodName: string,
  originalMethod: (...args: T) => Promise<R>,
  options: PerformanceIntegrationOptions = {}
): (...args: T) => Promise<R> {
  const opts = mergeOptions(defaultOptions, options);

  return async (...args: T): Promise<R> => {
    const timer = PerformanceUtils.createTimer(`service.${methodName}`);

    try {
      // Generate cache/deduplication key
      const key = opts.cache?.keyGenerator
        ? opts.cache.keyGenerator(...args)
        : `${methodName}:${JSON.stringify(args)}`;

      let result: R;

      if (opts.cache?.enabled) {
        // Use caching
        const cache =
          caches[opts.cache.cacheName as keyof typeof caches] ||
          caches.apiResponses;
        result = await cache.getOrCompute(
          key,
          () =>
            executeWithDeduplication(methodName, originalMethod, args, opts),
          opts.cache.ttl
        );
      } else if (opts.deduplication?.enabled) {
        // Use deduplication only
        result = await executeWithDeduplication(
          methodName,
          originalMethod,
          args,
          opts
        );
      } else {
        // Direct execution with monitoring
        const { result: methodResult } = await PerformanceUtils.measureAsync(
          methodName,
          () => originalMethod(...args)
        );
        result = methodResult;
      }

      if (opts.monitoring?.recordRequests) {
        performanceMonitor.recordRequest(timer.end(), false);
      }

      return result;
    } catch (error) {
      if (opts.monitoring?.recordRequests) {
        performanceMonitor.recordRequest(timer.end(), true);
      }
      throw error;
    }
  };
}

/**
 * Execute method with deduplication
 */
async function executeWithDeduplication<T extends unknown[], R>(
  methodName: string,
  originalMethod: (...args: T) => Promise<R>,
  args: T,
  opts: PerformanceIntegrationOptions
): Promise<R> {
  if (!opts.deduplication?.enabled) {
    const { result } = await PerformanceUtils.measureAsync(methodName, () =>
      originalMethod(...args)
    );
    return result;
  }

  const deduplicator =
    deduplicators[
      opts.deduplication.deduplicatorName as keyof typeof deduplicators
    ] || deduplicators.api;

  const key = opts.deduplication.keyGenerator
    ? opts.deduplication.keyGenerator(...args)
    : `${methodName}:${JSON.stringify(args)}`;

  return deduplicator.execute(
    key,
    () =>
      PerformanceUtils.measureAsync(methodName, () =>
        originalMethod(...args)
      ).then(({ result }) => result),
    { ttl: opts.deduplication.ttl }
  );
}

/**
 * Enhance an API route handler with performance optimizations
 */
export function enhanceAPIRoute(
  originalHandler: (req: NextRequest) => Promise<NextResponse>,
  options: PerformanceIntegrationOptions & {
    routeName?: string;
  } = {}
): (req: NextRequest) => Promise<NextResponse> {
  const opts = mergeOptions(defaultOptions, options);
  const routeName = options.routeName || "api-route";

  return async (req: NextRequest): Promise<NextResponse> => {
    const timer = PerformanceUtils.createTimer(`api.${routeName}`);

    try {
      // Start monitoring if not already running
      if (opts.monitoring?.enabled) {
        try {
          performanceMonitor.start();
        } catch {
          // Monitoring may already be running
        }
      }

      let response: NextResponse;

      if (opts.cache?.enabled || opts.deduplication?.enabled) {
        // Generate cache key from request
        const url = new URL(req.url);
        const method = req.method;
        const params = url.searchParams.toString();
        const cacheKey = `${method}:${url.pathname}:${params}`;

        if (opts.cache?.enabled) {
          const cache =
            caches[opts.cache.cacheName as keyof typeof caches] ||
            caches.apiResponses;
          response = await cache.getOrCompute(
            cacheKey,
            () => originalHandler(req),
            opts.cache.ttl
          );
        } else {
          // Deduplication only
          const deduplicator =
            deduplicators[
              opts.deduplication!.deduplicatorName as keyof typeof deduplicators
            ] || deduplicators.api;

          response = await deduplicator.execute(
            cacheKey,
            () => originalHandler(req),
            { ttl: opts.deduplication!.ttl }
          );
        }
      } else {
        // Direct execution with monitoring
        const { result } = await PerformanceUtils.measureAsync(routeName, () =>
          originalHandler(req)
        );
        response = result;
      }

      if (opts.monitoring?.recordRequests) {
        performanceMonitor.recordRequest(timer.end(), false);
      }

      return response;
    } catch (error) {
      if (opts.monitoring?.recordRequests) {
        performanceMonitor.recordRequest(timer.end(), true);
      }
      throw error;
    }
  };
}

/**
 * Class decorator for automatic performance enhancement
 */
export function PerformanceEnhanced(
  options: PerformanceIntegrationOptions = {}
) {
  return function <T extends new (...args: any[]) => {}>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);

        // Enhance all async methods
        const proto = Object.getPrototypeOf(this);
        const methodNames = Object.getOwnPropertyNames(proto).filter(
          (name) => name !== "constructor" && typeof proto[name] === "function"
        );

        methodNames.forEach((methodName) => {
          const originalMethod = this[methodName as keyof this];
          if (typeof originalMethod === "function") {
            (this as Record<string, unknown>)[methodName] =
              enhanceServiceMethod(
                `${constructor.name}.${methodName}`,
                originalMethod.bind(this),
                options
              );
          }
        });
      }
    };
  };
}

/**
 * Method decorator for individual method enhancement
 */
export function PerformanceOptimized(
  options: PerformanceIntegrationOptions = {}
) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== "function") {
      throw new Error("PerformanceOptimized can only be applied to methods");
    }

    descriptor.value = enhanceServiceMethod(
      `${(target as any).constructor.name}.${propertyKey}`,
      originalMethod,
      options
    );

    return descriptor;
  };
}

/**
 * Simple caching decorator
 */
export function Cached(
  cacheName: string = "default",
  ttl: number = 5 * 60 * 1000,
  keyGenerator?: (...args: unknown[]) => string
) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== "function") {
      throw new Error("Cached decorator can only be applied to methods");
    }

    descriptor.value = CacheUtils.cached(
      `${(target as any).constructor.name}.${propertyKey}`,
      originalMethod,
      {
        ttl,
        keyGenerator:
          keyGenerator ||
          ((...args) =>
            `${(target as any).constructor.name}.${propertyKey}:${JSON.stringify(args)}`),
      }
    );

    return descriptor;
  };
}

/**
 * Simple deduplication decorator
 */
export function Deduplicated(
  deduplicatorName: string = "default",
  ttl: number = 2 * 60 * 1000
) {
  return DeduplicationUtils.deduplicatedMethod(deduplicatorName, { ttl });
}

/**
 * Performance monitoring decorator
 */
export function Monitored(metricName?: string) {
  return PerformanceUtils.measured(metricName);
}

/**
 * Utility function to merge options
 */
function mergeOptions(
  defaults: PerformanceIntegrationOptions,
  overrides: PerformanceIntegrationOptions
): PerformanceIntegrationOptions {
  return {
    cache: defaults.cache && overrides.cache 
      ? { ...defaults.cache, ...overrides.cache }
      : defaults.cache || overrides.cache,
    deduplication: defaults.deduplication && overrides.deduplication
      ? { ...defaults.deduplication, ...overrides.deduplication }
      : defaults.deduplication || overrides.deduplication,
    monitoring: defaults.monitoring && overrides.monitoring
      ? { ...defaults.monitoring, ...overrides.monitoring }
      : defaults.monitoring || overrides.monitoring,
  };
}

/**
 * Create a performance-enhanced service instance
 */
export function createEnhancedService<T>(
  ServiceClass: new (...args: unknown[]) => T,
  options: PerformanceIntegrationOptions = {}
): new (...args: unknown[]) => T {
  return PerformanceEnhanced(options)(ServiceClass as never);
}

/**
 * Batch performance enhancement for multiple methods
 */
export function enhanceServiceMethods<
  T extends Record<string, (...args: unknown[]) => Promise<unknown>>,
>(service: T, options: PerformanceIntegrationOptions = {}): T {
  const enhanced = {} as T;

  for (const [methodName, method] of Object.entries(service)) {
    if (typeof method === "function") {
      enhanced[methodName as keyof T] = enhanceServiceMethod(
        methodName,
        method,
        options
      ) as T[keyof T];
    } else {
      enhanced[methodName as keyof T] = method;
    }
  }

  return enhanced;
}

/**
 * Performance integration status
 */
export function getPerformanceIntegrationStatus() {
  try {
    const metrics = performanceMonitor.getCurrentMetrics();
    return {
      monitoring: {
        active: true, // If we can get metrics, monitoring is active
        metrics,
      },
      caching: {
        stats: caches.metrics.getStats(),
        totalCaches: Object.keys(caches).length,
      },
      deduplication: {
        stats: deduplicators.api.getStats(),
        totalDeduplicators: Object.keys(deduplicators).length,
      },
    };
  } catch {
    return {
      monitoring: {
        active: false,
        metrics: null,
      },
      caching: {
        stats: caches.metrics.getStats(),
        totalCaches: Object.keys(caches).length,
      },
      deduplication: {
        stats: deduplicators.api.getStats(),
        totalDeduplicators: Object.keys(deduplicators).length,
      },
    };
  }
}

/**
 * Initialize performance systems
 */
export function initializePerformanceSystems(
  options: {
    monitoring?: boolean;
    monitoringInterval?: number;
  } = {}
) {
  if (options.monitoring !== false) {
    const interval = options.monitoringInterval || 30000;
    performanceMonitor.start(interval);
    // Performance monitoring started
  }

  // Performance systems initialized
}
