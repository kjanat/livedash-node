/**
 * Migration Logging Utilities
 *
 * Provides comprehensive logging functionality for migration operations
 * with different log levels, structured output, and file persistence.
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface MigrationLogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
  duration?: number;
  error?: Error;
}

export class MigrationLogger {
  private logFile: string;
  private startTime: number;
  private minLogLevel: LogLevel;

  constructor(
    logFile: string = "migration.log",
    minLogLevel: LogLevel = LogLevel.INFO
  ) {
    this.logFile = join(process.cwd(), "logs", logFile);
    this.minLogLevel = minLogLevel;
    this.startTime = Date.now();
    this.ensureLogDirectory();
    this.initializeLog();
  }

  private ensureLogDirectory(): void {
    const logDir = join(process.cwd(), "logs");
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
  }

  private initializeLog(): void {
    const header = `
=================================================================
MIGRATION LOG SESSION STARTED
=================================================================
Time: ${new Date().toISOString()}
Process ID: ${process.pid}
Node Version: ${process.version}
Platform: ${process.platform}
Working Directory: ${process.cwd()}
=================================================================

`;
    writeFileSync(this.logFile, header);
  }

  private createLogEntry(
    level: LogLevel,
    category: string,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): MigrationLogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      duration: Date.now() - this.startTime,
      error,
    };
  }

  private writeLog(entry: MigrationLogEntry): void {
    if (entry.level < this.minLogLevel) return;

    const levelNames = ["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"];
    const levelName = levelNames[entry.level];

    // Console output with colors
    const colors = {
      [LogLevel.DEBUG]: "\x1b[36m", // Cyan
      [LogLevel.INFO]: "\x1b[32m",  // Green
      [LogLevel.WARN]: "\x1b[33m",  // Yellow
      [LogLevel.ERROR]: "\x1b[31m", // Red
      [LogLevel.CRITICAL]: "\x1b[35m", // Magenta
    };

    const reset = "\x1b[0m";
    const color = colors[entry.level];

    console.log(
      `${color}[${entry.timestamp}] ${levelName} [${entry.category}]${reset} ${entry.message}`
    );

    if (entry.data) {
      console.log(`  Data:`, entry.data);
    }

    if (entry.error) {
      console.error(`  Error:`, entry.error.message);
      if (entry.level >= LogLevel.ERROR) {
        console.error(`  Stack:`, entry.error.stack);
      }
    }

    // File output (structured)
    const logLine = JSON.stringify(entry) + "\n";
    appendFileSync(this.logFile, logLine);
  }

  debug(category: string, message: string, data?: Record<string, unknown>): void {
    this.writeLog(this.createLogEntry(LogLevel.DEBUG, category, message, data));
  }

  info(category: string, message: string, data?: Record<string, unknown>): void {
    this.writeLog(this.createLogEntry(LogLevel.INFO, category, message, data));
  }

  warn(category: string, message: string, data?: Record<string, unknown>): void {
    this.writeLog(this.createLogEntry(LogLevel.WARN, category, message, data));
  }

  error(category: string, message: string, error?: Error, data?: Record<string, unknown>): void {
    this.writeLog(this.createLogEntry(LogLevel.ERROR, category, message, data, error));
  }

  critical(category: string, message: string, error?: Error, data?: Record<string, unknown>): void {
    this.writeLog(this.createLogEntry(LogLevel.CRITICAL, category, message, data, error));
  }

  /**
   * Time a function execution and log the result
   */
  async timeExecution<T>(
    category: string,
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    this.info(category, `Starting ${operationName}`);

    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.info(category, `Completed ${operationName}`, { duration });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(category, `Failed ${operationName}`, error as Error, { duration });
      throw error;
    }
  }

  /**
   * Create a progress tracker for long-running operations
   */
  createProgressTracker(category: string, total: number, operationName: string) {
    let completed = 0;

    return {
      increment: (count: number = 1) => {
        completed += count;
        const percentage = Math.round((completed / total) * 100);
        this.info(category, `${operationName} progress: ${completed}/${total} (${percentage}%)`);
      },
      complete: () => {
        this.info(category, `${operationName} completed: ${completed}/${total}`);
      },
      fail: (error: Error) => {
        this.error(category, `${operationName} failed at ${completed}/${total}`, error);
      }
    };
  }

  /**
   * Log migration step start/completion
   */
  startStep(stepName: string, description?: string): void {
    this.info("MIGRATION_STEP", `🚀 Starting: ${stepName}`, { description });
  }

  completeStep(stepName: string, duration?: number): void {
    this.info("MIGRATION_STEP", `✅ Completed: ${stepName}`, { duration });
  }

  failStep(stepName: string, error: Error): void {
    this.error("MIGRATION_STEP", `❌ Failed: ${stepName}`, error);
  }

  /**
   * Log migration phase transitions
   */
  startPhase(phaseName: string, description?: string): void {
    this.info("MIGRATION_PHASE", `📋 Starting Phase: ${phaseName}`, { description });
  }

  completePhase(phaseName: string): void {
    this.info("MIGRATION_PHASE", `🎉 Completed Phase: ${phaseName}`);
  }

  /**
   * Close the log session
   */
  close(): void {
    const totalDuration = Date.now() - this.startTime;
    const footer = `
=================================================================
MIGRATION LOG SESSION ENDED
=================================================================
Total Duration: ${totalDuration}ms
Time: ${new Date().toISOString()}
=================================================================

`;
    appendFileSync(this.logFile, footer);
  }
}

// Singleton instance for easy access
export const migrationLogger = new MigrationLogger();