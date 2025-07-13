/**
 * Request Deduplication System
 *
 * Prevents duplicate concurrent requests and optimizes resource usage
 * by sharing results between identical operations.
 */

import { TIME } from "../constants";

/**
 * Deduplication options
 */
export interface DeduplicationOptions {
  ttl?: number; // How long to keep results cached
  maxPending?: number; // Maximum pending requests per key
  keyGenerator?: (...args: unknown[]) => string;
  timeout?: number; // Request timeout
}

/**
 * Pending request metadata
 */
interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  resolvers: Array<{
    resolve: (value: T) => void;
    reject: (error: Error) => void;
  }>;
  timeout?: NodeJS.Timeout;
}

/**
 * Request deduplication manager
 */
export class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest<any>>();
  private results = new Map<
    string,
    { value: any; timestamp: number; ttl: number }
  >();
  private cleanupInterval: NodeJS.Timeout;
  private stats = {
    hits: 0,
    misses: 0,
    deduplicatedRequests: 0,
    timeouts: 0,
    errors: 0,
  };

  constructor(
    private defaultOptions: DeduplicationOptions = {
      ttl: 5 * TIME.MINUTE,
      maxPending: 10,
      timeout: 30 * TIME.SECOND,
    }
  ) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, TIME.MINUTE);
  }

  /**
   * Execute a function with deduplication
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    options: DeduplicationOptions = {}
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };

    // Check if we have a cached result
    const cached = this.getCachedResult<T>(key);
    if (cached !== null) {
      this.stats.hits++;
      return cached;
    }

    // Check if there's already a pending request
    const pending = this.pendingRequests.get(key);
    if (pending) {
      // Join the existing request
      this.stats.deduplicatedRequests++;
      return this.joinPendingRequest<T>(key, pending);
    }

    // Create new request
    this.stats.misses++;
    return this.createNewRequest(key, fn, opts);
  }

  /**
   * Memoize a function with deduplication
   */
  memoize<Args extends readonly unknown[], Return>(
    fn: (...args: Args) => Promise<Return>,
    options: DeduplicationOptions = {}
  ) {
    return (...args: Args): Promise<Return> => {
      const key = options.keyGenerator
        ? options.keyGenerator(...args)
        : this.generateKey(...args);

      return this.execute(key, () => fn(...args), options);
    };
  }

  /**
   * Get cached result if available and not expired
   */
  private getCachedResult<T>(key: string): T | null {
    const cached = this.results.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.results.delete(key);
      return null;
    }

    return cached.value;
  }

  /**
   * Join an existing pending request
   */
  private async joinPendingRequest<T>(
    key: string,
    pending: PendingRequest<T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Check if we've reached the max pending limit
      if (pending.resolvers.length >= (this.defaultOptions.maxPending || 10)) {
        reject(new Error(`Too many pending requests for key: ${key}`));
        return;
      }

      pending.resolvers.push({ resolve, reject });
    });
  }

  /**
   * Create a new request
   */
  private async createNewRequest<T>(
    key: string,
    fn: () => Promise<T>,
    options: DeduplicationOptions
  ): Promise<T> {
    const resolvers: Array<{
      resolve: (value: T) => void;
      reject: (error: Error) => void;
    }> = [];

    // Create the main promise
    const promise = new Promise<T>((resolve, reject) => {
      resolvers.push({ resolve, reject });

      // Execute the async function
      fn()
        .then((result) => {
          // Cache the result
          if (options.ttl && options.ttl > 0) {
            this.results.set(key, {
              value: result,
              timestamp: Date.now(),
              ttl: options.ttl,
            });
          }

          // Resolve all waiting promises
          resolvers.forEach(({ resolve: res }) => res(result));
        })
        .catch((error) => {
          this.stats.errors++;

          // Reject all waiting promises
          const errorToReject =
            error instanceof Error ? error : new Error(String(error));
          resolvers.forEach(({ reject: rej }) => rej(errorToReject));
        })
        .finally(() => {
          // Clean up pending request
          this.pendingRequests.delete(key);
        });
    });

    // Set up timeout if specified
    let timeout: NodeJS.Timeout | undefined;
    if (options.timeout) {
      timeout = setTimeout(() => {
        this.stats.timeouts++;
        const timeoutError = new Error(`Request timeout for key: ${key}`);
        resolvers.forEach(({ reject }) => reject(timeoutError));
        this.pendingRequests.delete(key);
      }, options.timeout);
    }

    // Store pending request
    const pendingRequest: PendingRequest<T> = {
      promise,
      timestamp: Date.now(),
      resolvers,
      timeout,
    };

    this.pendingRequests.set(key, pendingRequest);

    return promise;
  }

  /**
   * Generate a key from function arguments
   */
  private generateKey(...args: unknown[]): string {
    try {
      return JSON.stringify(args);
    } catch {
      // Fallback for non-serializable arguments
      return args.map((arg) => String(arg)).join("|");
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    // Clean up expired results
    for (const [key, cached] of Array.from(this.results.entries())) {
      if (now - cached.timestamp > cached.ttl) {
        this.results.delete(key);
      }
    }

    // Clean up stale pending requests (older than 5 minutes)
    for (const [key, pending] of Array.from(this.pendingRequests.entries())) {
      if (now - pending.timestamp > 5 * TIME.MINUTE) {
        if (pending.timeout) {
          clearTimeout(pending.timeout);
        }
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Clear all cached results
   */
  clear(): void {
    this.results.clear();

    // Cancel all pending requests
    for (const [key, pending] of Array.from(this.pendingRequests.entries())) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      const error = new Error(
        `Request cancelled during clear operation: ${key}`
      );
      pending.resolvers.forEach(({ reject }) => reject(error));
    }

    this.pendingRequests.clear();
  }

  /**
   * Invalidate specific key
   */
  invalidate(key: string): boolean {
    const hadCached = this.results.delete(key);

    // Cancel pending request if exists
    const pending = this.pendingRequests.get(key);
    if (pending) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      const error = new Error(`Request invalidated: ${key}`);
      pending.resolvers.forEach(({ reject }) => reject(error));
      this.pendingRequests.delete(key);
      return true;
    }

    return hadCached;
  }

  /**
   * Get statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      pendingCount: this.pendingRequests.size,
      cachedCount: this.results.size,
      deduplicationRate:
        totalRequests > 0 ? this.stats.deduplicatedRequests / totalRequests : 0,
    };
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      pendingKeys: Array.from(this.pendingRequests.keys()),
      cachedKeys: Array.from(this.results.keys()),
      stats: this.getStats(),
    };
  }

  /**
   * Destroy the deduplicator
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

/**
 * Global deduplicator instances for different use cases
 */
class DeduplicationManager {
  private deduplicators = new Map<string, RequestDeduplicator>();

  /**
   * Get or create a deduplicator for a specific context
   */
  getDeduplicator(
    name: string,
    options?: DeduplicationOptions
  ): RequestDeduplicator {
    if (!this.deduplicators.has(name)) {
      this.deduplicators.set(name, new RequestDeduplicator(options));
    }
    return this.deduplicators.get(name)!;
  }

  /**
   * Get all deduplicator statistics
   */
  getAllStats(): Record<string, ReturnType<RequestDeduplicator["getStats"]>> {
    const stats: Record<
      string,
      ReturnType<RequestDeduplicator["getStats"]>
    > = {};

    for (const [name, deduplicator] of Array.from(
      this.deduplicators.entries()
    )) {
      stats[name] = deduplicator.getStats();
    }

    return stats;
  }

  /**
   * Clear all deduplicators
   */
  clearAll(): void {
    for (const deduplicator of Array.from(this.deduplicators.values())) {
      deduplicator.clear();
    }
  }

  /**
   * Destroy all deduplicators
   */
  destroyAll(): void {
    for (const deduplicator of Array.from(this.deduplicators.values())) {
      deduplicator.destroy();
    }
    this.deduplicators.clear();
  }
}

export const deduplicationManager = new DeduplicationManager();

/**
 * Predefined deduplicators for common use cases
 */
export const deduplicators = {
  // API requests
  api: deduplicationManager.getDeduplicator("api", {
    ttl: 2 * TIME.MINUTE,
    maxPending: 20,
    timeout: 30 * TIME.SECOND,
  }),

  // Database queries
  database: deduplicationManager.getDeduplicator("database", {
    ttl: 5 * TIME.MINUTE,
    maxPending: 15,
    timeout: 60 * TIME.SECOND,
  }),

  // AI processing
  ai: deduplicationManager.getDeduplicator("ai", {
    ttl: 30 * TIME.MINUTE,
    maxPending: 5,
    timeout: 5 * TIME.MINUTE,
  }),

  // File operations
  files: deduplicationManager.getDeduplicator("files", {
    ttl: 10 * TIME.MINUTE,
    maxPending: 10,
    timeout: 2 * TIME.MINUTE,
  }),

  // Metrics calculations
  metrics: deduplicationManager.getDeduplicator("metrics", {
    ttl: 1 * TIME.MINUTE,
    maxPending: 30,
    timeout: 45 * TIME.SECOND,
  }),
};

/**
 * Utility decorators and functions
 */
export class DeduplicationUtils {
  /**
   * Create a deduplicated version of an async function
   */
  static deduplicate<T extends readonly unknown[], R>(
    fn: (...args: T) => Promise<R>,
    deduplicatorName = "default",
    options: DeduplicationOptions = {}
  ) {
    const deduplicator = deduplicationManager.getDeduplicator(
      deduplicatorName,
      options
    );
    return deduplicator.memoize(fn, options);
  }

  /**
   * Create a decorator for class methods
   */
  static deduplicatedMethod(
    deduplicatorName = "default",
    options: DeduplicationOptions = {}
  ) {
    return (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) => {
      const originalMethod = descriptor.value;

      if (typeof originalMethod !== "function") {
        throw new Error(
          "Deduplicated decorator can only be applied to methods"
        );
      }

      const deduplicator = deduplicationManager.getDeduplicator(
        deduplicatorName,
        options
      );

      descriptor.value = function (...args: unknown[]) {
        const key = `${target.constructor.name}.${propertyKey}:${JSON.stringify(args)}`;
        return deduplicator.execute(
          key,
          () => originalMethod.apply(this, args),
          options
        );
      };

      return descriptor;
    };
  }

  /**
   * Batch multiple requests with deduplication
   */
  static async batch<T>(
    requests: Array<{
      key: string;
      fn: () => Promise<T>;
      options?: DeduplicationOptions;
    }>,
    deduplicatorName = "batch"
  ): Promise<T[]> {
    const deduplicator = deduplicationManager.getDeduplicator(deduplicatorName);

    const promises = requests.map(({ key, fn, options }) =>
      deduplicator.execute(key, fn, options)
    );

    return Promise.all(promises);
  }

  /**
   * Create a request queue with automatic deduplication
   */
  static createQueue<T>(
    deduplicatorName: string,
    options: DeduplicationOptions & {
      concurrency?: number;
    } = {}
  ) {
    const deduplicator = deduplicationManager.getDeduplicator(
      deduplicatorName,
      options
    );
    const queue: Array<() => Promise<void>> = [];
    const { concurrency = 5 } = options;
    let running = 0;

    const processQueue = async (): Promise<void> => {
      if (running >= concurrency || queue.length === 0) {
        return;
      }

      running++;
      const task = queue.shift();

      if (task) {
        try {
          await task();
        } catch (error) {
          console.error("Queue task failed:", error);
        } finally {
          running--;
          // Process next item
          setImmediate(processQueue);
        }
      }
    };

    return {
      add: (key: string, fn: () => Promise<T>): Promise<T> => {
        return new Promise((resolve, reject) => {
          queue.push(async () => {
            try {
              const result = await deduplicator.execute(key, fn, options);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          });

          // Start processing if not at capacity
          setImmediate(processQueue);
        });
      },

      getStats: () => ({
        queueLength: queue.length,
        running,
        concurrency,
        deduplicatorStats: deduplicator.getStats(),
      }),
    };
  }
}
