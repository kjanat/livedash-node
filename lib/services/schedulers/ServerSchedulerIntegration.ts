import { getSchedulerConfig } from "../../env";
import { CsvImportSchedulerService } from "./CsvImportSchedulerService";
import { SchedulerManager } from "./SchedulerManager";

/**
 * Server-side scheduler integration
 * Manages all schedulers for the application server
 */
export class ServerSchedulerIntegration {
  private static instance: ServerSchedulerIntegration;
  private manager: SchedulerManager;
  private isInitialized = false;

  private constructor() {
    this.manager = new SchedulerManager({
      enabled: true,
      autoRestart: true,
      healthCheckInterval: 30000,
      maxRestartAttempts: 3,
      restartDelay: 5000,
    });

    this.setupManagerEventListeners();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ServerSchedulerIntegration {
    if (!ServerSchedulerIntegration.instance) {
      ServerSchedulerIntegration.instance = new ServerSchedulerIntegration();
    }
    return ServerSchedulerIntegration.instance;
  }

  /**
   * Initialize schedulers based on environment configuration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn("[Server Scheduler Integration] Already initialized");
      return;
    }

    const config = getSchedulerConfig();

    if (!config.enabled) {
      console.log(
        "[Server Scheduler Integration] Schedulers disabled via configuration"
      );
      return;
    }

    try {
      console.log("[Server Scheduler Integration] Initializing schedulers...");

      // Register CSV Import Scheduler
      this.manager.registerScheduler({
        id: "csv-import",
        name: "CSV Import Scheduler",
        service: new CsvImportSchedulerService({
          enabled: config.csvImport.enabled,
          interval: config.csvImport.interval,
          timeout: 300000, // 5 minutes
          batchSize: 10,
          maxConcurrentImports: 5,
        }),
        autoStart: true,
        critical: true,
      });

      // TODO: Add other schedulers when they are converted
      // this.manager.registerScheduler({
      //   id: "import-processing",
      //   name: "Import Processing Scheduler",
      //   service: new ImportProcessingSchedulerService({
      //     enabled: config.importProcessing.enabled,
      //     interval: config.importProcessing.interval,
      //   }),
      //   autoStart: true,
      //   critical: true,
      // });

      // this.manager.registerScheduler({
      //   id: "session-processing",
      //   name: "Session Processing Scheduler",
      //   service: new SessionProcessingSchedulerService({
      //     enabled: config.sessionProcessing.enabled,
      //     interval: config.sessionProcessing.interval,
      //   }),
      //   autoStart: true,
      //   critical: true,
      // });

      // this.manager.registerScheduler({
      //   id: "batch-processing",
      //   name: "Batch Processing Scheduler",
      //   service: new BatchProcessingSchedulerService({
      //     enabled: config.batchProcessing.enabled,
      //     interval: config.batchProcessing.interval,
      //   }),
      //   autoStart: true,
      //   critical: true,
      // });

      // Start all registered schedulers
      await this.manager.startAll();

      this.isInitialized = true;
      console.log(
        "[Server Scheduler Integration] All schedulers initialized successfully"
      );
    } catch (error) {
      console.error(
        "[Server Scheduler Integration] Failed to initialize schedulers:",
        error
      );
      throw error;
    }
  }

  /**
   * Shutdown all schedulers
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      console.warn("[Server Scheduler Integration] Not initialized");
      return;
    }

    try {
      console.log("[Server Scheduler Integration] Shutting down schedulers...");
      await this.manager.stopAll();
      this.isInitialized = false;
      console.log("[Server Scheduler Integration] All schedulers stopped");
    } catch (error) {
      console.error(
        "[Server Scheduler Integration] Error during shutdown:",
        error
      );
      throw error;
    }
  }

  /**
   * Get scheduler manager for external access
   */
  getManager(): SchedulerManager {
    return this.manager;
  }

  /**
   * Get health status of all schedulers
   */
  getHealthStatus() {
    return this.manager.getHealthStatus();
  }

  /**
   * Get list of all schedulers with their status
   */
  getSchedulersList() {
    return this.manager.getSchedulers();
  }

  /**
   * Trigger manual execution of a specific scheduler
   */
  async triggerScheduler(schedulerId: string): Promise<void> {
    return this.manager.triggerScheduler(schedulerId);
  }

  /**
   * Start a specific scheduler
   */
  async startScheduler(schedulerId: string): Promise<void> {
    return this.manager.startScheduler(schedulerId);
  }

  /**
   * Stop a specific scheduler
   */
  async stopScheduler(schedulerId: string): Promise<void> {
    return this.manager.stopScheduler(schedulerId);
  }

  /**
   * Setup event listeners for the manager
   */
  private setupManagerEventListeners(): void {
    this.manager.on("schedulerStatusChanged", ({ registration, status }) => {
      console.log(
        `[Server Scheduler Integration] ${registration.name} status changed to: ${status}`
      );
    });

    this.manager.on("schedulerTaskCompleted", ({ registration, data }) => {
      console.log(
        `[Server Scheduler Integration] ${registration.name} task completed in ${data.duration}ms`
      );
    });

    this.manager.on("schedulerTaskFailed", ({ registration, data }) => {
      console.error(
        `[Server Scheduler Integration] ${registration.name} task failed:`,
        data.error
      );
    });

    this.manager.on("schedulerRestarted", (registration) => {
      console.log(
        `[Server Scheduler Integration] Successfully restarted: ${registration.name}`
      );
    });

    this.manager.on("schedulerRestartFailed", (registration) => {
      console.error(
        `[Server Scheduler Integration] Failed to restart: ${registration.name}`
      );
    });

    this.manager.on("healthCheck", (health) => {
      if (!health.healthy) {
        console.warn("[Server Scheduler Integration] Health check failed:", {
          totalSchedulers: health.totalSchedulers,
          runningSchedulers: health.runningSchedulers,
          errorSchedulers: health.errorSchedulers,
        });
      }
    });
  }

  /**
   * Handle graceful shutdown
   */
  async handleGracefulShutdown(): Promise<void> {
    console.log(
      "[Server Scheduler Integration] Received shutdown signal, stopping schedulers..."
    );

    try {
      await this.shutdown();
      console.log("[Server Scheduler Integration] Graceful shutdown completed");
    } catch (error) {
      console.error(
        "[Server Scheduler Integration] Error during graceful shutdown:",
        error
      );
      process.exit(1);
    }
  }
}

/**
 * Convenience function to get the scheduler integration instance
 */
export const getSchedulerIntegration = () =>
  ServerSchedulerIntegration.getInstance();

/**
 * Initialize schedulers for server startup
 */
export const initializeSchedulers = async (): Promise<void> => {
  const integration = getSchedulerIntegration();
  await integration.initialize();
};

/**
 * Shutdown schedulers for server shutdown
 */
export const shutdownSchedulers = async (): Promise<void> => {
  const integration = getSchedulerIntegration();
  await integration.shutdown();
};
