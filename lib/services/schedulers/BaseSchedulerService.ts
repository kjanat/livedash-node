import { EventEmitter } from "node:events";
import * as cron from "node-cron";

/**
 * Scheduler status enumeration
 */
export enum SchedulerStatus {
  STOPPED = "STOPPED",
  STARTING = "STARTING",
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  ERROR = "ERROR",
}

/**
 * Scheduler configuration interface
 */
export interface SchedulerConfig {
  enabled: boolean;
  interval: string;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

/**
 * Scheduler metrics interface
 */
export interface SchedulerMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  averageRunTime: number;
  currentStatus: SchedulerStatus;
}

/**
 * Base abstract scheduler service class
 * Provides common functionality for all schedulers
 */
export abstract class BaseSchedulerService extends EventEmitter {
  protected cronJob?: cron.ScheduledTask;
  protected config: SchedulerConfig;
  protected status: SchedulerStatus = SchedulerStatus.STOPPED;
  protected metrics: SchedulerMetrics;
  protected isRunning = false;

  constructor(
    protected name: string,
    config: Partial<SchedulerConfig> = {}
  ) {
    super();

    this.config = {
      enabled: true,
      interval: "*/5 * * * *", // Default: every 5 minutes
      maxRetries: 3,
      retryDelay: 5000,
      timeout: 30000,
      ...config,
    };

    this.metrics = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastRunAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      averageRunTime: 0,
      currentStatus: this.status,
    };
  }

  /**
   * Abstract method that subclasses must implement
   * Contains the actual scheduler logic
   */
  protected abstract executeTask(): Promise<void>;

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log(`[${this.name}] Scheduler disabled via configuration`);
      return;
    }

    if (this.status === SchedulerStatus.RUNNING) {
      console.warn(`[${this.name}] Scheduler is already running`);
      return;
    }

    try {
      this.status = SchedulerStatus.STARTING;
      this.emit("statusChange", this.status);

      console.log(
        `[${this.name}] Starting scheduler with interval: ${this.config.interval}`
      );

      this.cronJob = cron.schedule(
        this.config.interval,
        () => this.runWithErrorHandling(),
        {
          scheduled: false, // Don't start immediately
          timezone: "UTC",
        } as any
      );

      this.cronJob.start();
      this.status = SchedulerStatus.RUNNING;
      this.metrics.currentStatus = this.status;
      this.emit("statusChange", this.status);
      this.emit("started");

      console.log(`[${this.name}] Scheduler started successfully`);
    } catch (error) {
      this.status = SchedulerStatus.ERROR;
      this.metrics.currentStatus = this.status;
      this.emit("statusChange", this.status);
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (this.status === SchedulerStatus.STOPPED) {
      console.warn(`[${this.name}] Scheduler is already stopped`);
      return;
    }

    try {
      console.log(`[${this.name}] Stopping scheduler...`);

      if (this.cronJob) {
        this.cronJob.stop();
        this.cronJob.destroy();
        this.cronJob = undefined;
      }

      // Wait for current execution to finish if running
      while (this.isRunning) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      this.status = SchedulerStatus.STOPPED;
      this.metrics.currentStatus = this.status;
      this.emit("statusChange", this.status);
      this.emit("stopped");

      console.log(`[${this.name}] Scheduler stopped successfully`);
    } catch (error) {
      this.status = SchedulerStatus.ERROR;
      this.metrics.currentStatus = this.status;
      this.emit("statusChange", this.status);
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Pause the scheduler
   */
  pause(): void {
    if (this.cronJob && this.status === SchedulerStatus.RUNNING) {
      this.cronJob.stop();
      this.status = SchedulerStatus.PAUSED;
      this.metrics.currentStatus = this.status;
      this.emit("statusChange", this.status);
      this.emit("paused");
      console.log(`[${this.name}] Scheduler paused`);
    }
  }

  /**
   * Resume the scheduler
   */
  resume(): void {
    if (this.cronJob && this.status === SchedulerStatus.PAUSED) {
      this.cronJob.start();
      this.status = SchedulerStatus.RUNNING;
      this.metrics.currentStatus = this.status;
      this.emit("statusChange", this.status);
      this.emit("resumed");
      console.log(`[${this.name}] Scheduler resumed`);
    }
  }

  /**
   * Get current scheduler status
   */
  getStatus(): SchedulerStatus {
    return this.status;
  }

  /**
   * Get scheduler metrics
   */
  getMetrics(): SchedulerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get scheduler configuration
   */
  getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    const wasRunning = this.status === SchedulerStatus.RUNNING;

    if (wasRunning) {
      this.pause();
    }

    this.config = { ...this.config, ...newConfig };

    if (wasRunning && newConfig.interval) {
      // Recreate cron job with new interval
      if (this.cronJob) {
        this.cronJob.destroy();
      }

      this.cronJob = cron.schedule(
        this.config.interval,
        () => this.runWithErrorHandling(),
        {
          scheduled: false,
          timezone: "UTC",
        } as any
      );
    }

    if (wasRunning) {
      this.resume();
    }

    this.emit("configUpdated", this.config);
  }

  /**
   * Manual trigger of the scheduler task
   */
  async trigger(): Promise<void> {
    if (this.isRunning) {
      throw new Error(`[${this.name}] Task is already running`);
    }

    await this.runWithErrorHandling();
  }

  /**
   * Get health status for load balancer/orchestrator
   */
  getHealthStatus(): {
    healthy: boolean;
    status: SchedulerStatus;
    lastSuccess: Date | null;
    consecutiveFailures: number;
  } {
    const consecutiveFailures = this.calculateConsecutiveFailures();
    const healthy =
      this.status === SchedulerStatus.RUNNING &&
      consecutiveFailures < this.config.maxRetries &&
      (!this.metrics.lastErrorAt ||
        !this.metrics.lastSuccessAt ||
        this.metrics.lastSuccessAt > this.metrics.lastErrorAt);

    return {
      healthy,
      status: this.status,
      lastSuccess: this.metrics.lastSuccessAt,
      consecutiveFailures,
    };
  }

  /**
   * Run the task with error handling and metrics collection
   */
  private async runWithErrorHandling(): Promise<void> {
    if (this.isRunning) {
      console.warn(
        `[${this.name}] Previous task still running, skipping this iteration`
      );
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.metrics.totalRuns++;
      this.metrics.lastRunAt = new Date();
      this.emit("taskStarted");

      // Set timeout for task execution
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Task timeout")),
          this.config.timeout
        );
      });

      await Promise.race([this.executeTask(), timeoutPromise]);

      const duration = Date.now() - startTime;
      this.updateRunTimeMetrics(duration);

      this.metrics.successfulRuns++;
      this.metrics.lastSuccessAt = new Date();
      this.emit("taskCompleted", { duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.failedRuns++;
      this.metrics.lastErrorAt = new Date();

      console.error(`[${this.name}] Task failed:`, error);
      this.emit("taskFailed", { error, duration });

      // Check if we should retry
      const consecutiveFailures = this.calculateConsecutiveFailures();
      if (consecutiveFailures >= this.config.maxRetries) {
        this.status = SchedulerStatus.ERROR;
        this.metrics.currentStatus = this.status;
        this.emit("statusChange", this.status);
        console.error(
          `[${this.name}] Max retries exceeded, scheduler marked as ERROR`
        );
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Update average run time metrics
   */
  private updateRunTimeMetrics(duration: number): void {
    if (this.metrics.averageRunTime === 0) {
      this.metrics.averageRunTime = duration;
    } else {
      // Calculate running average
      this.metrics.averageRunTime =
        (this.metrics.averageRunTime + duration) / 2;
    }
  }

  /**
   * Calculate consecutive failures for health monitoring
   */
  private calculateConsecutiveFailures(): number {
    // This is a simplified version - in production you might want to track
    // a rolling window of recent execution results
    if (!this.metrics.lastSuccessAt || !this.metrics.lastErrorAt) {
      return this.metrics.failedRuns;
    }

    return this.metrics.lastErrorAt > this.metrics.lastSuccessAt
      ? this.metrics.failedRuns - this.metrics.successfulRuns
      : 0;
  }
}
