/**
 * Database Backup Utilities
 *
 * Provides comprehensive database backup functionality for safe migration.
 * Supports both schema and data backups with compression and verification.
 */

import { execSync, spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createGzip } from "node:zlib";
import { migrationLogger } from "./migration-logger";
import { env } from "../../lib/env";

interface BackupOptions {
  includeData: boolean;
  includeSchema: boolean;
  compress: boolean;
  outputDir: string;
  filename?: string;
  verifyBackup: boolean;
}

interface BackupResult {
  success: boolean;
  backupPath: string;
  size: number;
  duration: number;
  checksumMD5?: string;
  error?: Error;
}

export class DatabaseBackup {
  private readonly defaultOptions: BackupOptions = {
    includeData: true,
    includeSchema: true,
    compress: true,
    outputDir: join(process.cwd(), "backups"),
    verifyBackup: true,
  };

  /**
   * Create a comprehensive database backup
   */
  async createBackup(options?: Partial<BackupOptions>): Promise<BackupResult> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    try {
      migrationLogger.startStep("DATABASE_BACKUP", "Creating database backup");

      // Ensure backup directory exists
      this.ensureBackupDirectory(opts.outputDir);

      // Generate backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = opts.filename || `livedash-backup-${timestamp}.sql`;
      const backupPath = join(opts.outputDir, filename);
      const finalPath = opts.compress ? `${backupPath}.gz` : backupPath;

      // Extract database connection info
      const dbConfig = this.parseDatabaseUrl(env.DATABASE_URL);

      // Create the backup
      await this.performBackup(dbConfig, backupPath, opts);

      // Compress if requested
      if (opts.compress) {
        await this.compressBackup(backupPath, `${backupPath}.gz`);
      }

      // Verify backup if requested
      let checksumMD5: string | undefined;
      if (opts.verifyBackup) {
        checksumMD5 = await this.verifyBackup(finalPath);
      }

      const duration = Date.now() - startTime;
      const stats = statSync(finalPath);

      const result: BackupResult = {
        success: true,
        backupPath: finalPath,
        size: stats.size,
        duration,
        checksumMD5,
      };

      migrationLogger.completeStep("DATABASE_BACKUP", duration);
      migrationLogger.info("DATABASE_BACKUP", "Backup completed successfully", {
        path: finalPath,
        sizeBytes: stats.size,
        sizeMB: Math.round((stats.size / 1024 / 1024) * 100) / 100,
        duration,
        checksum: checksumMD5,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      migrationLogger.failStep("DATABASE_BACKUP", error as Error);

      return {
        success: false,
        backupPath: "",
        size: 0,
        duration,
        error: error as Error,
      };
    }
  }

  /**
   * Create schema-only backup for structure validation
   */
  async createSchemaBackup(): Promise<BackupResult> {
    return this.createBackup({
      includeData: false,
      includeSchema: true,
      filename: `schema-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`,
    });
  }

  /**
   * Create data-only backup for content preservation
   */
  async createDataBackup(): Promise<BackupResult> {
    return this.createBackup({
      includeData: true,
      includeSchema: false,
      filename: `data-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`,
    });
  }

  /**
   * List existing backups with metadata
   */
  async listBackups(backupDir?: string): Promise<
    Array<{
      filename: string;
      path: string;
      size: number;
      created: Date;
      type: string;
    }>
  > {
    const dir = backupDir || this.defaultOptions.outputDir;

    if (!existsSync(dir)) {
      return [];
    }

    try {
      const files = await import("node:fs/promises").then((fs) =>
        fs.readdir(dir)
      );
      const backups = [];

      for (const file of files) {
        if (file.endsWith(".sql") || file.endsWith(".sql.gz")) {
          const fullPath = join(dir, file);
          const stats = statSync(fullPath);

          let type = "unknown";
          if (file.includes("schema")) type = "schema";
          else if (file.includes("data")) type = "data";
          else type = "full";

          backups.push({
            filename: file,
            path: fullPath,
            size: stats.size,
            created: stats.birthtime,
            type,
          });
        }
      }

      return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
    } catch (error) {
      migrationLogger.warn("BACKUP_LIST", "Failed to list backups", {
        error: (error as Error).message,
      });
      return [];
    }
  }

  private ensureBackupDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      migrationLogger.debug("BACKUP_DIR", `Created backup directory: ${dir}`);
    }
  }

  private parseDatabaseUrl(url: string): {
    host: string;
    port: string;
    database: string;
    username: string;
    password: string;
  } {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parsed.port || "5432",
        database: parsed.pathname.slice(1),
        username: parsed.username,
        password: parsed.password,
      };
    } catch (error) {
      throw new Error(`Invalid database URL: ${(error as Error).message}`);
    }
  }

  private async performBackup(
    dbConfig: ReturnType<typeof this.parseDatabaseUrl>,
    outputPath: string,
    options: BackupOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        "-h",
        dbConfig.host,
        "-p",
        dbConfig.port,
        "-U",
        dbConfig.username,
        "-d",
        dbConfig.database,
        "-f",
        outputPath,
        "--verbose",
      ];

      // Add schema/data options
      if (!options.includeSchema) {
        args.push("--data-only");
      }
      if (!options.includeData) {
        args.push("--schema-only");
      }

      // Additional options for better backup quality
      args.push(
        "--create", // Include CREATE DATABASE
        "--clean", // Include DROP statements
        "--if-exists", // Use IF EXISTS
        "--disable-triggers", // Disable triggers during restore
        "--no-owner", // Don't output ownership commands
        "--no-privileges" // Don't output privilege commands
      );

      migrationLogger.debug("PG_DUMP", "Starting pg_dump", {
        args: args.filter((arg) => arg !== dbConfig.password),
      });

      const process = spawn("pg_dump", args, {
        env: {
          ...process.env,
          PGPASSWORD: dbConfig.password,
        },
      });

      let errorOutput = "";

      process.stderr.on("data", (data) => {
        const message = data.toString();
        errorOutput += message;

        // pg_dump sends progress info to stderr, so we log it as debug
        if (message.includes("dumping")) {
          migrationLogger.debug("PG_DUMP", message.trim());
        }
      });

      process.on("close", (code) => {
        if (code === 0) {
          migrationLogger.debug("PG_DUMP", "Backup completed successfully");
          resolve();
        } else {
          reject(new Error(`pg_dump failed with code ${code}: ${errorOutput}`));
        }
      });

      process.on("error", (error) => {
        reject(new Error(`Failed to start pg_dump: ${error.message}`));
      });
    });
  }

  private async compressBackup(
    sourcePath: string,
    targetPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const fs = require("node:fs");
      const readStream = fs.createReadStream(sourcePath);
      const writeStream = fs.createWriteStream(targetPath);
      const gzip = createGzip({ level: 6 });

      readStream
        .pipe(gzip)
        .pipe(writeStream)
        .on("finish", () => {
          // Remove uncompressed file
          fs.unlinkSync(sourcePath);
          migrationLogger.debug(
            "COMPRESSION",
            `Compressed backup: ${targetPath}`
          );
          resolve();
        })
        .on("error", reject);
    });
  }

  private async verifyBackup(backupPath: string): Promise<string> {
    try {
      // Calculate MD5 checksum
      const crypto = await import("node:crypto");
      const fs = await import("node:fs");

      const hash = crypto.createHash("md5");
      const stream = fs.createReadStream(backupPath);

      return new Promise((resolve, reject) => {
        stream.on("data", (data) => hash.update(data));
        stream.on("end", () => {
          const checksum = hash.digest("hex");
          migrationLogger.debug(
            "BACKUP_VERIFICATION",
            `Backup checksum: ${checksum}`
          );
          resolve(checksum);
        });
        stream.on("error", reject);
      });
    } catch (error) {
      migrationLogger.warn("BACKUP_VERIFICATION", "Failed to verify backup", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Clean up old backups, keeping only the specified number
   */
  async cleanupOldBackups(
    keepCount: number = 5,
    backupDir?: string
  ): Promise<void> {
    const dir = backupDir || this.defaultOptions.outputDir;
    const backups = await this.listBackups(dir);

    if (backups.length <= keepCount) {
      migrationLogger.info(
        "BACKUP_CLEANUP",
        `No cleanup needed. Found ${backups.length} backups, keeping ${keepCount}`
      );
      return;
    }

    const toDelete = backups.slice(keepCount);
    migrationLogger.info(
      "BACKUP_CLEANUP",
      `Cleaning up ${toDelete.length} old backups`
    );

    const fs = await import("node:fs/promises");

    for (const backup of toDelete) {
      try {
        await fs.unlink(backup.path);
        migrationLogger.debug(
          "BACKUP_CLEANUP",
          `Deleted old backup: ${backup.filename}`
        );
      } catch (error) {
        migrationLogger.warn(
          "BACKUP_CLEANUP",
          `Failed to delete backup: ${backup.filename}`,
          {
            error: (error as Error).message,
          }
        );
      }
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const backup = new DatabaseBackup();

  const command = process.argv[2];

  async function runCommand() {
    switch (command) {
      case "full":
        return backup.createBackup();

      case "schema":
        return backup.createSchemaBackup();

      case "data":
        return backup.createDataBackup();

      case "list":
        const backups = await backup.listBackups();
        console.log("\n=== DATABASE BACKUPS ===");
        if (backups.length === 0) {
          console.log("No backups found.");
        } else {
          backups.forEach((b) => {
            const sizeMB = Math.round((b.size / 1024 / 1024) * 100) / 100;
            console.log(
              `${b.filename} (${b.type}, ${sizeMB}MB, ${b.created.toISOString()})`
            );
          });
        }
        return { success: true, backupPath: "", size: 0, duration: 0 };

      case "cleanup":
        await backup.cleanupOldBackups(5);
        return { success: true, backupPath: "", size: 0, duration: 0 };

      default:
        console.log(`
Usage: node backup-database.js <command>

Commands:
  full     - Create full database backup (schema + data)
  schema   - Create schema-only backup
  data     - Create data-only backup
  list     - List existing backups
  cleanup  - Clean up old backups (keep 5 most recent)

Examples:
  node backup-database.js full
  node backup-database.js schema
  node backup-database.js list
        `);
        process.exit(1);
    }
  }

  runCommand()
    .then((result) => {
      if (command !== "list" && command !== "cleanup") {
        console.log("\n=== BACKUP RESULTS ===");
        console.log(`Success: ${result.success ? "✅" : "❌"}`);
        if (result.success) {
          console.log(`Path: ${result.backupPath}`);
          console.log(
            `Size: ${Math.round((result.size / 1024 / 1024) * 100) / 100} MB`
          );
          console.log(`Duration: ${result.duration}ms`);
          if (result.checksumMD5) {
            console.log(`Checksum: ${result.checksumMD5}`);
          }
        } else {
          console.error(`Error: ${result.error?.message}`);
        }
      }

      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Backup failed:", error);
      process.exit(1);
    });
}
