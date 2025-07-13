import { EventEmitter } from "node:events";
import {
  type BaseSchedulerService,
  SchedulerStatus,
} from "./BaseSchedulerService";
import { CsvImportSchedulerService } from "./CsvImportSchedulerService";

/**
 * Scheduler manager configuration
 */
export interface SchedulerManagerConfig {
  enabled: boolean;
  autoRestart: boolean;
  healthCheckInterval: number;
  maxRestartAttempts: number;
  restartDelay: number;
}

/**
 * Scheduler registration interface
 */
export interface SchedulerRegistration {
  id: string;
  name: string;
  service: BaseSchedulerService;
  autoStart: boolean;
  critical: boolean; // If true, manager will try to restart on failure
}

/**
 * Manager health status
 */
export interface ManagerHealthStatus {
  healthy: boolean;
  totalSchedulers: number;
  runningSchedulers: number;
  errorSchedulers: number;
  schedulerStatuses: Record<
    string,
    {
      status: SchedulerStatus;
      healthy: boolean;
      lastSuccess: Date | null;
    }
  >;
}

/**
 * Scheduler Manager
 * Orchestrates multiple scheduler services for horizontal scaling
 */
export class SchedulerManager extends EventEmitter {
  private schedulers = new Map<string, SchedulerRegistration>();
  private config: SchedulerManagerConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private restartAttempts = new Map<string, number>();

  constructor(config: Partial<SchedulerManagerConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      autoRestart: true,
      healthCheckInterval: 30000, // 30 seconds
      maxRestartAttempts: 3,
      restartDelay: 5000, // 5 seconds
      ...config,
    };
  }

  /**
   * Register a scheduler service
   */
  registerScheduler(registration: SchedulerRegistration): void {
    if (this.schedulers.has(registration.id)) {
      throw new Error(
        `Scheduler with ID ${registration.id} is already registered`
      );
    }

    // Set up event listeners for the scheduler
    this.setupSchedulerEventListeners(registration);

    this.schedulers.set(registration.id, registration);
    this.restartAttempts.set(registration.id, 0);

    console.log(
      `[Scheduler Manager] Registered scheduler: ${registration.name}`
    );
    this.emit("schedulerRegistered", registration);
  }

  /**
   * Unregister a scheduler service
   */
  async unregisterScheduler(schedulerId: string): Promise<void> {
    const registration = this.schedulers.get(schedulerId);
    if (!registration) {
      throw new Error(`Scheduler with ID ${schedulerId} is not registered`);
    }

    // Stop the scheduler if running
    if (registration.service.getStatus() === SchedulerStatus.RUNNING) {
      await registration.service.stop();
    }

    // Remove event listeners
    registration.service.removeAllListeners();

    this.schedulers.delete(schedulerId);
    this.restartAttempts.delete(schedulerId);

    console.log(
      `[Scheduler Manager] Unregistered scheduler: ${registration.name}`
    );
    this.emit("schedulerUnregistered", registration);
  }

  /**
   * Start all registered schedulers
   */
  async startAll(): Promise<void> {
    if (!this.config.enabled) {
      console.log("[Scheduler Manager] Disabled via configuration");
      return;
    }

    console.log("[Scheduler Manager] Starting all schedulers...");

    const startPromises = Array.from(this.schedulers.values())
      .filter((reg) => reg.autoStart)
      .map(async (registration) => {
        try {
          await registration.service.start();
          console.log(`[Scheduler Manager] Started: ${registration.name}`);
        } catch (error) {
          console.error(
            `[Scheduler Manager] Failed to start ${registration.name}:`,
            error
          );
          this.emit("schedulerStartFailed", { registration, error });
        }
      });

    await Promise.allSettled(startPromises);

    // Start health monitoring
    this.startHealthMonitoring();

    console.log("[Scheduler Manager] All schedulers started");
    this.emit("allSchedulersStarted");
  }

  /**
   * Stop all registered schedulers
   */
  async stopAll(): Promise<void> {
    console.log("[Scheduler Manager] Stopping all schedulers...");

    // Stop health monitoring
    this.stopHealthMonitoring();

    const stopPromises = Array.from(this.schedulers.values()).map(
      async (registration) => {
        try {
          await registration.service.stop();
          console.log(`[Scheduler Manager] Stopped: ${registration.name}`);
        } catch (error) {
          console.error(
            `[Scheduler Manager] Failed to stop ${registration.name}:`,
            error
          );
        }
      }
    );

    await Promise.allSettled(stopPromises);

    console.log("[Scheduler Manager] All schedulers stopped");
    this.emit("allSchedulersStopped");
  }

  /**
   * Start a specific scheduler
   */
  async startScheduler(schedulerId: string): Promise<void> {
    const registration = this.schedulers.get(schedulerId);
    if (!registration) {
      throw new Error(`Scheduler with ID ${schedulerId} is not registered`);
    }

    await registration.service.start();
    this.emit("schedulerStarted", registration);
  }

  /**
   * Stop a specific scheduler
   */
  async stopScheduler(schedulerId: string): Promise<void> {
    const registration = this.schedulers.get(schedulerId);
    if (!registration) {
      throw new Error(`Scheduler with ID ${schedulerId} is not registered`);
    }

    await registration.service.stop();
    this.emit("schedulerStopped", registration);
  }

  /**
   * Get health status of all schedulers
   */
  getHealthStatus(): ManagerHealthStatus {
    const schedulerStatuses: Record<
      string,
      {
        status: SchedulerStatus;
        healthy: boolean;
        lastSuccess: Date | null;
      }
    > = {};

    let runningCount = 0;
    let errorCount = 0;

    for (const [id, registration] of Array.from(this.schedulers.entries())) {
      const health = registration.service.getHealthStatus();
      const status = registration.service.getStatus();

      schedulerStatuses[id] = {
        status,
        healthy: health.healthy,
        lastSuccess: health.lastSuccess,
      };

      if (status === SchedulerStatus.RUNNING) runningCount++;
      if (status === SchedulerStatus.ERROR) errorCount++;
    }

    const totalSchedulers = this.schedulers.size;
    const healthy = errorCount === 0 && runningCount > 0;

    return {
      healthy,
      totalSchedulers,
      runningSchedulers: runningCount,
      errorSchedulers: errorCount,
      schedulerStatuses,
    };
  }

  /**
   * Get all registered schedulers
   */
  getSchedulers(): Array<{
    id: string;
    name: string;
    status: SchedulerStatus;
    metrics: any;
  }> {
    return Array.from(this.schedulers.entries()).map(([id, registration]) => ({
      id,
      name: registration.name,
      status: registration.service.getStatus(),
      metrics: registration.service.getMetrics(),
    }));
  }

  /**
   * Get a specific scheduler
   */
  getScheduler(schedulerId: string): BaseSchedulerService | null {
    const registration = this.schedulers.get(schedulerId);
    return registration ? registration.service : null;
  }

  /**
   * Trigger manual execution of a specific scheduler
   */
  async triggerScheduler(schedulerId: string): Promise<void> {
    const registration = this.schedulers.get(schedulerId);
    if (!registration) {
      throw new Error(`Scheduler with ID ${schedulerId} is not registered`);
    }

    await registration.service.trigger();
    this.emit("schedulerTriggered", registration);
  }

  /**
   * Setup event listeners for a scheduler
   */
  private setupSchedulerEventListeners(
    registration: SchedulerRegistration
  ): void {
    const { service } = registration;

    service.on("statusChange", (status: SchedulerStatus) => {
      this.emit("schedulerStatusChanged", { registration, status });

      // Handle automatic restart for critical schedulers
      if (
        status === SchedulerStatus.ERROR &&
        registration.critical &&
        this.config.autoRestart
      ) {
        this.handleSchedulerFailure(registration);
      }
    });

    service.on("taskCompleted", (data) => {
      this.emit("schedulerTaskCompleted", { registration, data });
      // Reset restart attempts on successful completion
      this.restartAttempts.set(registration.id, 0);
    });

    service.on("taskFailed", (data) => {
      this.emit("schedulerTaskFailed", { registration, data });
    });

    service.on("error", (error) => {
      this.emit("schedulerError", { registration, error });
    });
  }

  /**
   * Handle scheduler failure with automatic restart
   */
  private async handleSchedulerFailure(
    registration: SchedulerRegistration
  ): Promise<void> {
    const attempts = this.restartAttempts.get(registration.id) || 0;

    if (attempts >= this.config.maxRestartAttempts) {
      console.error(
        `[Scheduler Manager] Max restart attempts exceeded for ${registration.name}`
      );
      this.emit("schedulerRestartFailed", registration);
      return;
    }

    console.log(
      `[Scheduler Manager] Attempting to restart ${registration.name} (attempt ${attempts + 1})`
    );

    // Wait before restart
    await new Promise((resolve) =>
      setTimeout(resolve, this.config.restartDelay)
    );

    try {
      await registration.service.stop();
      await registration.service.start();

      console.log(
        `[Scheduler Manager] Successfully restarted ${registration.name}`
      );
      this.emit("schedulerRestarted", registration);
    } catch (error) {
      console.error(
        `[Scheduler Manager] Failed to restart ${registration.name}:`,
        error
      );
      this.restartAttempts.set(registration.id, attempts + 1);
      this.emit("schedulerRestartError", { registration, error });
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setInterval(() => {
      const health = this.getHealthStatus();
      this.emit("healthCheck", health);

      if (!health.healthy) {
        console.warn("[Scheduler Manager] Health check failed:", health);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Create and register default schedulers
   */
  static createDefaultSchedulers(): SchedulerManager {
    const manager = new SchedulerManager();

    // Register CSV Import Scheduler
    manager.registerScheduler({
      id: "csv-import",
      name: "CSV Import Scheduler",
      service: new CsvImportSchedulerService({
        interval: "*/10 * * * *", // Every 10 minutes
      }),
      autoStart: true,
      critical: true,
    });

    // Additional schedulers would be registered here
    // manager.registerScheduler({
    //   id: "processing",
    //   name: "Session Processing Scheduler",
    //   service: new SessionProcessingSchedulerService(),
    //   autoStart: true,
    //   critical: true,
    // });

    return manager;
  }
}
