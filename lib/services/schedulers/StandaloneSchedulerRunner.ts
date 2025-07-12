#!/usr/bin/env node

/**
 * Standalone Scheduler Runner
 * Runs individual schedulers as separate processes for horizontal scaling
 *
 * Usage:
 *   npx tsx lib/services/schedulers/StandaloneSchedulerRunner.ts --scheduler=csv-import
 *   npx tsx lib/services/schedulers/StandaloneSchedulerRunner.ts --scheduler=session-processing
 */

import { Command } from "commander";
import { validateEnv } from "../../env";
import {
  type BaseSchedulerService,
  SchedulerStatus,
} from "./BaseSchedulerService";
import { CsvImportSchedulerService } from "./CsvImportSchedulerService";

interface SchedulerFactory {
  [key: string]: () => BaseSchedulerService;
}

/**
 * Available schedulers for standalone execution
 */
const AVAILABLE_SCHEDULERS: SchedulerFactory = {
  "csv-import": () =>
    new CsvImportSchedulerService({
      interval: process.env.CSV_IMPORT_INTERVAL || "*/10 * * * *",
      timeout: Number.parseInt(process.env.CSV_IMPORT_TIMEOUT || "300000"),
      batchSize: Number.parseInt(process.env.CSV_IMPORT_BATCH_SIZE || "10"),
      maxConcurrentImports: Number.parseInt(
        process.env.CSV_IMPORT_MAX_CONCURRENT || "5"
      ),
    }),

  // Additional schedulers would be added here:
  // "import-processing": () => new ImportProcessingSchedulerService({
  //   interval: process.env.IMPORT_PROCESSING_INTERVAL || "*/2 * * * *",
  // }),
  // "session-processing": () => new SessionProcessingSchedulerService({
  //   interval: process.env.SESSION_PROCESSING_INTERVAL || "*/5 * * * *",
  // }),
  // "batch-processing": () => new BatchProcessingSchedulerService({
  //   interval: process.env.BATCH_PROCESSING_INTERVAL || "*/5 * * * *",
  // }),
};

/**
 * Standalone Scheduler Runner Class
 */
class StandaloneSchedulerRunner {
  private scheduler?: BaseSchedulerService;
  private isShuttingDown = false;

  constructor(private schedulerName: string) {}

  /**
   * Run the specified scheduler
   */
  async run(): Promise<void> {
    try {
      // Validate environment
      const envValidation = validateEnv();
      if (!envValidation.valid) {
        console.error(
          "[Standalone Scheduler] Environment validation errors:",
          envValidation.errors
        );
        process.exit(1);
      }

      // Create scheduler instance
      const factory = AVAILABLE_SCHEDULERS[this.schedulerName];
      if (!factory) {
        console.error(
          `[Standalone Scheduler] Unknown scheduler: ${this.schedulerName}`
        );
        console.error(
          `Available schedulers: ${Object.keys(AVAILABLE_SCHEDULERS).join(", ")}`
        );
        process.exit(1);
      }

      this.scheduler = factory();

      // Setup event listeners
      this.setupEventListeners();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      console.log(`[Standalone Scheduler] Starting ${this.schedulerName}...`);

      // Start the scheduler
      await this.scheduler.start();

      console.log(`[Standalone Scheduler] ${this.schedulerName} is running`);

      // Keep the process alive
      this.keepAlive();
    } catch (error) {
      console.error(
        `[Standalone Scheduler] Failed to start ${this.schedulerName}:`,
        error
      );
      process.exit(1);
    }
  }

  /**
   * Setup event listeners for the scheduler
   */
  private setupEventListeners(): void {
    if (!this.scheduler) return;

    this.scheduler.on("statusChange", (status: SchedulerStatus) => {
      console.log(`[Standalone Scheduler] Status changed to: ${status}`);

      if (status === SchedulerStatus.ERROR && !this.isShuttingDown) {
        console.error(
          "[Standalone Scheduler] Scheduler entered ERROR state, exiting..."
        );
        process.exit(1);
      }
    });

    this.scheduler.on("taskCompleted", (data) => {
      console.log(
        `[Standalone Scheduler] Task completed in ${data.duration}ms`
      );
    });

    this.scheduler.on("taskFailed", (data) => {
      console.error(
        "[Standalone Scheduler] Task failed:",
        data.error?.message || data.error
      );
    });

    this.scheduler.on("started", () => {
      console.log(
        `[Standalone Scheduler] ${this.schedulerName} started successfully`
      );
    });

    this.scheduler.on("stopped", () => {
      console.log(`[Standalone Scheduler] ${this.schedulerName} stopped`);
    });

    // Setup health reporting
    setInterval(() => {
      if (this.scheduler && !this.isShuttingDown) {
        const health = this.scheduler.getHealthStatus();
        const metrics = this.scheduler.getMetrics();

        console.log(
          `[Standalone Scheduler] Health: ${health.healthy ? "OK" : "UNHEALTHY"}, ` +
            `Runs: ${metrics.totalRuns}, Success: ${metrics.successfulRuns}, ` +
            `Failed: ${metrics.failedRuns}, Avg Time: ${metrics.averageRunTime}ms`
        );
      }
    }, 60000); // Every minute
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      if (this.isShuttingDown) return;

      console.log(
        `[Standalone Scheduler] Received ${signal}, shutting down gracefully...`
      );
      this.isShuttingDown = true;

      try {
        if (this.scheduler) {
          await this.scheduler.stop();
        }
        console.log("[Standalone Scheduler] Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        console.error("[Standalone Scheduler] Error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

    process.on("uncaughtException", (error) => {
      console.error("[Standalone Scheduler] Uncaught exception:", error);
      gracefulShutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error(
        "[Standalone Scheduler] Unhandled rejection at:",
        promise,
        "reason:",
        reason
      );
      gracefulShutdown("unhandledRejection");
    });
  }

  /**
   * Keep the process alive
   */
  private keepAlive(): void {
    // Setup periodic health checks
    setInterval(() => {
      if (!this.isShuttingDown && this.scheduler) {
        const status = this.scheduler.getStatus();
        if (status === SchedulerStatus.ERROR) {
          console.error(
            "[Standalone Scheduler] Scheduler is in ERROR state, exiting..."
          );
          process.exit(1);
        }
      }
    }, 30000); // Every 30 seconds
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const program = new Command();

  program
    .name("standalone-scheduler")
    .description("Run individual schedulers as standalone processes")
    .version("1.0.0")
    .requiredOption("-s, --scheduler <name>", "Scheduler name to run")
    .option("-l, --list", "List available schedulers")
    .parse();

  const options = program.opts();

  if (options.list) {
    console.log("Available schedulers:");
    Object.keys(AVAILABLE_SCHEDULERS).forEach((name) => {
      console.log(`  - ${name}`);
    });
    return;
  }

  if (!options.scheduler) {
    console.error(
      "Scheduler name is required. Use --list to see available schedulers."
    );
    process.exit(1);
  }

  const runner = new StandaloneSchedulerRunner(options.scheduler);
  await runner.run();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("[Standalone Scheduler] Fatal error:", error);
    process.exit(1);
  });
}

export { StandaloneSchedulerRunner, AVAILABLE_SCHEDULERS };
