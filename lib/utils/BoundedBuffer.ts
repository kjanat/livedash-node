/**
 * Bounded buffer implementation to prevent memory leaks
 * Automatically manages size and provides efficient operations
 */

export interface BoundedBufferOptions {
  maxSize: number;
  cleanupThreshold?: number; // Start cleanup when buffer reaches this ratio (default 0.9)
  retentionTime?: number; // Time in milliseconds to retain items (default 1 hour)
}

export class BoundedBuffer<T extends { timestamp: Date }> {
  private buffer: T[] = [];
  private readonly maxSize: number;
  private readonly cleanupThreshold: number;
  private readonly retentionTime: number;
  private lastCleanup: Date = new Date();

  constructor(options: BoundedBufferOptions) {
    this.maxSize = options.maxSize;
    this.cleanupThreshold = options.cleanupThreshold ?? 0.9;
    this.retentionTime = options.retentionTime ?? 60 * 60 * 1000; // 1 hour default
  }

  /**
   * Add item to buffer with automatic cleanup
   */
  push(item: T): void {
    this.buffer.push(item);

    // Trigger cleanup if threshold reached
    if (this.buffer.length >= this.maxSize * this.cleanupThreshold) {
      this.cleanup();
    }
  }

  /**
   * Get all items in buffer
   */
  getAll(): readonly T[] {
    return [...this.buffer];
  }

  /**
   * Filter items by predicate
   */
  filter(predicate: (item: T) => boolean): T[] {
    return this.buffer.filter(predicate);
  }

  /**
   * Get items within time range
   */
  getWithinTime(timeRangeMs: number): T[] {
    const cutoff = new Date(Date.now() - timeRangeMs);
    return this.buffer.filter((item) => item.timestamp >= cutoff);
  }

  /**
   * Get buffer statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    utilizationRatio: number;
    oldestItem?: Date;
    newestItem?: Date;
  } {
    const size = this.buffer.length;
    const oldestItem = size > 0 ? this.buffer[0]?.timestamp : undefined;
    const newestItem = size > 0 ? this.buffer[size - 1]?.timestamp : undefined;

    return {
      size,
      maxSize: this.maxSize,
      utilizationRatio: size / this.maxSize,
      oldestItem,
      newestItem,
    };
  }

  /**
   * Force cleanup of old items
   */
  cleanup(): void {
    const cutoff = new Date(Date.now() - this.retentionTime);
    const initialSize = this.buffer.length;

    // Remove items older than retention time
    this.buffer = this.buffer.filter((item) => item.timestamp >= cutoff);

    // If still over limit, remove oldest items to maintain max size
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(-this.maxSize);
    }

    this.lastCleanup = new Date();

    // Log cleanup statistics (for monitoring)
    const removedItems = initialSize - this.buffer.length;
    if (removedItems > 0) {
      console.debug(
        `BoundedBuffer: Cleaned up ${removedItems} items, buffer size: ${this.buffer.length}/${this.maxSize}`
      );
    }
  }

  /**
   * Clear all items from buffer
   */
  clear(): void {
    this.buffer.length = 0;
    this.lastCleanup = new Date();
  }

  /**
   * Get current buffer size
   */
  get size(): number {
    return this.buffer.length;
  }

  /**
   * Check if buffer is approaching capacity
   */
  get isNearCapacity(): boolean {
    return this.buffer.length >= this.maxSize * this.cleanupThreshold;
  }

  /**
   * Get time since last cleanup
   */
  get timeSinceLastCleanup(): number {
    return Date.now() - this.lastCleanup.getTime();
  }
}
