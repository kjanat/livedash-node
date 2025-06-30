// Combined scheduler initialization with graceful shutdown

import { prisma } from "./prisma";
import { startProcessingScheduler } from "./processingScheduler";
import { startCsvImportScheduler } from "./scheduler";

/**
 * Initialize all schedulers
 * - CSV import scheduler (runs every 15 minutes)
 * - Session processing scheduler (runs every hour)
 */
export function initializeSchedulers() {
  // Start the CSV import scheduler
  startCsvImportScheduler();

  // Start the session processing scheduler
  startProcessingScheduler();

  console.log("All schedulers initialized successfully");

  // Set up graceful shutdown for schedulers
  setupGracefulShutdown();
}

/**
 * Set up graceful shutdown handling for schedulers and database connections
 */
function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

    try {
      // Disconnect from database
      await prisma.$disconnect();
      console.log("Database connections closed.");

      // Exit the process
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  // Handle various termination signals
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGUSR2", () => shutdown("SIGUSR2")); // Nodemon restart

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    shutdown("unhandledRejection");
  });
}
