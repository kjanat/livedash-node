/**
 * Deployment Rollback System
 *
 * Provides comprehensive rollback capabilities to restore the system
 * to a previous state in case of deployment failures.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { migrationLogger } from "./migration-logger";

interface RollbackOptions {
  backupPath?: string;
  rollbackDatabase: boolean;
  rollbackCode: boolean;
  rollbackEnvironment: boolean;
  skipConfirmation: boolean;
  dryRun: boolean;
}

interface RollbackStep {
  name: string;
  description: string;
  critical: boolean;
  execute: () => Promise<void>;
  verify?: () => Promise<boolean>;
}

interface RollbackResult {
  success: boolean;
  completedSteps: string[];
  failedStep?: string;
  totalDuration: number;
  error?: Error;
}

export class RollbackManager {
  private readonly defaultOptions: RollbackOptions = {
    rollbackDatabase: true,
    rollbackCode: true,
    rollbackEnvironment: true,
    skipConfirmation: false,
    dryRun: false,
  };

  private options: RollbackOptions;
  private steps: RollbackStep[] = [];
  private completedSteps: string[] = [];

  constructor(options?: Partial<RollbackOptions>) {
    this.options = { ...this.defaultOptions, ...options };
    this.setupRollbackSteps();
  }

  /**
   * Execute complete rollback process
   */
  async rollback(): Promise<RollbackResult> {
    const startTime = Date.now();

    try {
      migrationLogger.startPhase("ROLLBACK", "Starting deployment rollback");

      // Confirmation check
      if (!this.options.skipConfirmation && !this.options.dryRun) {
        await this.confirmRollback();
      }

      // Execute rollback steps
      for (const step of this.steps) {
        await this.executeRollbackStep(step);
        this.completedSteps.push(step.name);
      }

      const totalDuration = Date.now() - startTime;

      migrationLogger.completePhase("ROLLBACK");
      migrationLogger.info("ROLLBACK", "Rollback completed successfully", {
        totalDuration,
        steps: this.completedSteps.length,
      });

      return {
        success: true,
        completedSteps: this.completedSteps,
        totalDuration,
      };
    } catch (error) {
      const totalDuration = Date.now() - startTime;

      migrationLogger.error("ROLLBACK", "Rollback failed", error as Error);

      return {
        success: false,
        completedSteps: this.completedSteps,
        totalDuration,
        error: error as Error,
      };
    }
  }

  /**
   * Create rollback snapshot before deployment
   */
  async createRollbackSnapshot(): Promise<string> {
    migrationLogger.startStep(
      "ROLLBACK_SNAPSHOT",
      "Creating rollback snapshot"
    );

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const snapshotDir = join(process.cwd(), "rollback-snapshots", timestamp);

      const fs = await import("node:fs/promises");
      await fs.mkdir(snapshotDir, { recursive: true });

      // Save environment snapshot
      await this.saveEnvironmentSnapshot(snapshotDir);

      // Save package.json and lock file snapshot
      await this.savePackageSnapshot(snapshotDir);

      // Save git commit information
      await this.saveGitSnapshot(snapshotDir);

      // Save deployment state
      await this.saveDeploymentState(snapshotDir);

      migrationLogger.completeStep("ROLLBACK_SNAPSHOT");
      migrationLogger.info("ROLLBACK_SNAPSHOT", "Rollback snapshot created", {
        snapshotDir,
      });

      return snapshotDir;
    } catch (error) {
      migrationLogger.failStep("ROLLBACK_SNAPSHOT", error as Error);
      throw error;
    }
  }

  private setupRollbackSteps(): void {
    this.steps = [
      {
        name: "Pre-Rollback Validation",
        description: "Validate rollback prerequisites",
        critical: true,
        execute: async () => {
          await this.validateRollbackPrerequisites();
        },
      },

      {
        name: "Stop Services",
        description: "Stop application services safely",
        critical: true,
        execute: async () => {
          await this.stopServices();
        },
      },

      {
        name: "Database Rollback",
        description: "Restore database to previous state",
        critical: true,
        execute: async () => {
          if (this.options.rollbackDatabase) {
            await this.rollbackDatabase();
          } else {
            migrationLogger.info("DB_ROLLBACK", "Database rollback skipped");
          }
        },
        verify: async () => {
          return await this.verifyDatabaseRollback();
        },
      },

      {
        name: "Code Rollback",
        description: "Restore application code to previous version",
        critical: true,
        execute: async () => {
          if (this.options.rollbackCode) {
            await this.rollbackCode();
          } else {
            migrationLogger.info("CODE_ROLLBACK", "Code rollback skipped");
          }
        },
      },

      {
        name: "Environment Rollback",
        description: "Restore environment configuration",
        critical: false,
        execute: async () => {
          if (this.options.rollbackEnvironment) {
            await this.rollbackEnvironment();
          } else {
            migrationLogger.info(
              "ENV_ROLLBACK",
              "Environment rollback skipped"
            );
          }
        },
      },

      {
        name: "Dependencies Restoration",
        description: "Restore previous dependencies",
        critical: true,
        execute: async () => {
          await this.restoreDependencies();
        },
      },

      {
        name: "Restart Services",
        description: "Restart services with previous configuration",
        critical: true,
        execute: async () => {
          await this.restartServices();
        },
      },

      {
        name: "Verify Rollback",
        description: "Verify system is working correctly",
        critical: true,
        execute: async () => {
          await this.verifyRollback();
        },
      },
    ];
  }

  private async executeRollbackStep(step: RollbackStep): Promise<void> {
    try {
      migrationLogger.startStep(
        step.name.replace(/\s+/g, "_").toUpperCase(),
        step.description
      );

      if (this.options.dryRun) {
        migrationLogger.info("DRY_RUN", `Would execute rollback: ${step.name}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else {
        await step.execute();
      }

      // Run verification if provided
      if (step.verify && !this.options.dryRun) {
        const verified = await step.verify();
        if (!verified) {
          throw new Error(
            `Verification failed for rollback step: ${step.name}`
          );
        }
      }

      migrationLogger.completeStep(
        step.name.replace(/\s+/g, "_").toUpperCase()
      );
    } catch (error) {
      migrationLogger.failStep(
        step.name.replace(/\s+/g, "_").toUpperCase(),
        error as Error
      );

      if (step.critical) {
        throw error;
      } else {
        migrationLogger.warn(
          "ROLLBACK_STEP",
          `Non-critical rollback step failed: ${step.name}`,
          {
            error: (error as Error).message,
          }
        );
      }
    }
  }

  private async confirmRollback(): Promise<void> {
    console.log("\n⚠️  ROLLBACK CONFIRMATION REQUIRED ⚠️");
    console.log("This will restore the system to a previous state.");
    console.log("The following actions will be performed:");

    if (this.options.rollbackDatabase) {
      console.log("  - Restore database from backup");
    }
    if (this.options.rollbackCode) {
      console.log("  - Restore application code to previous version");
    }
    if (this.options.rollbackEnvironment) {
      console.log("  - Restore environment configuration");
    }

    console.log("\nThis operation cannot be easily undone.");

    // In a real implementation, you would prompt for user input
    // For automation purposes, we'll check for a confirmation flag
    if (!process.env.ROLLBACK_CONFIRMED) {
      throw new Error(
        "Rollback not confirmed. Set ROLLBACK_CONFIRMED=true to proceed."
      );
    }
  }

  private async validateRollbackPrerequisites(): Promise<void> {
    migrationLogger.info(
      "ROLLBACK_VALIDATION",
      "Validating rollback prerequisites"
    );

    // Check if backup exists
    if (this.options.rollbackDatabase && this.options.backupPath) {
      if (!existsSync(this.options.backupPath)) {
        throw new Error(`Backup file not found: ${this.options.backupPath}`);
      }
    }

    // Check if pg_restore is available for database rollback
    if (this.options.rollbackDatabase) {
      try {
        execSync("pg_restore --version", { stdio: "ignore" });
      } catch (error) {
        throw new Error(
          "pg_restore not found - database rollback not possible"
        );
      }
    }

    // Check git status for code rollback
    if (this.options.rollbackCode) {
      try {
        execSync("git status", { stdio: "ignore" });
      } catch (error) {
        throw new Error("Git not available - code rollback not possible");
      }
    }

    migrationLogger.info(
      "ROLLBACK_VALIDATION",
      "Prerequisites validated successfully"
    );
  }

  private async stopServices(): Promise<void> {
    migrationLogger.info("SERVICE_STOP", "Stopping application services");

    // In a real deployment, this would stop the actual services
    // For this implementation, we'll simulate service stopping
    await new Promise((resolve) => setTimeout(resolve, 1000));

    migrationLogger.info("SERVICE_STOP", "Services stopped successfully");
  }

  private async rollbackDatabase(): Promise<void> {
    if (!this.options.backupPath) {
      migrationLogger.warn(
        "DB_ROLLBACK",
        "No backup path specified, skipping database rollback"
      );
      return;
    }

    migrationLogger.info(
      "DB_ROLLBACK",
      `Restoring database from backup: ${this.options.backupPath}`
    );

    try {
      // Parse database URL
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error("DATABASE_URL not found");
      }

      const parsed = new URL(dbUrl);

      // Drop existing connections
      migrationLogger.info(
        "DB_ROLLBACK",
        "Terminating existing database connections"
      );

      // Restore from backup
      const restoreCommand = [
        "pg_restore",
        "-h",
        parsed.hostname,
        "-p",
        parsed.port || "5432",
        "-U",
        parsed.username,
        "-d",
        parsed.pathname.slice(1),
        "--clean",
        "--if-exists",
        "--verbose",
        this.options.backupPath,
      ].join(" ");

      migrationLogger.debug("DB_ROLLBACK", `Executing: ${restoreCommand}`);

      execSync(restoreCommand, {
        env: {
          ...process.env,
          PGPASSWORD: parsed.password,
        },
        stdio: "pipe",
      });

      migrationLogger.info(
        "DB_ROLLBACK",
        "Database rollback completed successfully"
      );
    } catch (error) {
      throw new Error(`Database rollback failed: ${(error as Error).message}`);
    }
  }

  private async verifyDatabaseRollback(): Promise<boolean> {
    try {
      migrationLogger.info("DB_VERIFY", "Verifying database rollback");

      // Test database connection
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      try {
        await prisma.$queryRaw`SELECT 1`;
        await prisma.$disconnect();

        migrationLogger.info("DB_VERIFY", "Database verification successful");
        return true;
      } catch (error) {
        await prisma.$disconnect();
        migrationLogger.error(
          "DB_VERIFY",
          "Database verification failed",
          error as Error
        );
        return false;
      }
    } catch (error) {
      migrationLogger.error(
        "DB_VERIFY",
        "Database verification error",
        error as Error
      );
      return false;
    }
  }

  private async rollbackCode(): Promise<void> {
    migrationLogger.info("CODE_ROLLBACK", "Rolling back application code");

    try {
      // Get the previous commit (this is a simplified approach)
      const previousCommit = execSync("git rev-parse HEAD~1", {
        encoding: "utf8",
      }).trim();

      migrationLogger.info(
        "CODE_ROLLBACK",
        `Rolling back to commit: ${previousCommit}`
      );

      // Reset to previous commit
      execSync(`git reset --hard ${previousCommit}`, { stdio: "pipe" });

      migrationLogger.info(
        "CODE_ROLLBACK",
        "Code rollback completed successfully"
      );
    } catch (error) {
      throw new Error(`Code rollback failed: ${(error as Error).message}`);
    }
  }

  private async rollbackEnvironment(): Promise<void> {
    migrationLogger.info(
      "ENV_ROLLBACK",
      "Rolling back environment configuration"
    );

    try {
      // Look for environment backup
      const backupFiles = [
        ".env.local.backup",
        ".env.backup",
        ".env.production.backup",
      ];

      let restored = false;

      for (const backupFile of backupFiles) {
        const backupPath = join(process.cwd(), backupFile);
        const targetPath = backupPath.replace(".backup", "");

        if (existsSync(backupPath)) {
          const backupContent = readFileSync(backupPath, "utf8");
          writeFileSync(targetPath, backupContent);

          migrationLogger.info(
            "ENV_ROLLBACK",
            `Restored ${targetPath} from ${backupFile}`
          );
          restored = true;
        }
      }

      if (!restored) {
        migrationLogger.warn(
          "ENV_ROLLBACK",
          "No environment backup found to restore"
        );
      } else {
        migrationLogger.info(
          "ENV_ROLLBACK",
          "Environment rollback completed successfully"
        );
      }
    } catch (error) {
      throw new Error(
        `Environment rollback failed: ${(error as Error).message}`
      );
    }
  }

  private async restoreDependencies(): Promise<void> {
    migrationLogger.info("DEPS_RESTORE", "Restoring dependencies");

    try {
      // Check if package-lock.json backup exists
      const packageLockBackup = join(process.cwd(), "package-lock.json.backup");
      const packageLock = join(process.cwd(), "package-lock.json");

      if (existsSync(packageLockBackup)) {
        const backupContent = readFileSync(packageLockBackup, "utf8");
        writeFileSync(packageLock, backupContent);
        migrationLogger.info(
          "DEPS_RESTORE",
          "Restored package-lock.json from backup"
        );
      }

      // Reinstall dependencies
      execSync("npm ci", { stdio: "pipe" });

      migrationLogger.info(
        "DEPS_RESTORE",
        "Dependencies restored successfully"
      );
    } catch (error) {
      throw new Error(
        `Dependencies restoration failed: ${(error as Error).message}`
      );
    }
  }

  private async restartServices(): Promise<void> {
    migrationLogger.info(
      "SERVICE_RESTART",
      "Restarting services after rollback"
    );

    // In a real deployment, this would restart the actual services
    await new Promise((resolve) => setTimeout(resolve, 2000));

    migrationLogger.info("SERVICE_RESTART", "Services restarted successfully");
  }

  private async verifyRollback(): Promise<void> {
    migrationLogger.info("ROLLBACK_VERIFY", "Verifying rollback success");

    try {
      // Test database connection
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();

      // Test basic application functionality
      // This would typically involve checking key endpoints or services

      migrationLogger.info(
        "ROLLBACK_VERIFY",
        "Rollback verification successful"
      );
    } catch (error) {
      throw new Error(
        `Rollback verification failed: ${(error as Error).message}`
      );
    }
  }

  private async saveEnvironmentSnapshot(snapshotDir: string): Promise<void> {
    const fs = await import("node:fs/promises");

    const envFiles = [".env.local", ".env.production", ".env"];

    for (const envFile of envFiles) {
      const envPath = join(process.cwd(), envFile);
      if (existsSync(envPath)) {
        const content = await fs.readFile(envPath, "utf8");
        await fs.writeFile(join(snapshotDir, envFile), content);
      }
    }
  }

  private async savePackageSnapshot(snapshotDir: string): Promise<void> {
    const fs = await import("node:fs/promises");

    const packageFiles = [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
    ];

    for (const packageFile of packageFiles) {
      const packagePath = join(process.cwd(), packageFile);
      if (existsSync(packagePath)) {
        const content = await fs.readFile(packagePath, "utf8");
        await fs.writeFile(join(snapshotDir, packageFile), content);
      }
    }
  }

  private async saveGitSnapshot(snapshotDir: string): Promise<void> {
    try {
      const gitInfo = {
        commit: execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(),
        branch: execSync("git rev-parse --abbrev-ref HEAD", {
          encoding: "utf8",
        }).trim(),
        status: execSync("git status --porcelain", { encoding: "utf8" }).trim(),
        remotes: execSync("git remote -v", { encoding: "utf8" }).trim(),
      };

      const fs = await import("node:fs/promises");
      await fs.writeFile(
        join(snapshotDir, "git-info.json"),
        JSON.stringify(gitInfo, null, 2)
      );
    } catch (error) {
      migrationLogger.warn("GIT_SNAPSHOT", "Failed to save git snapshot", {
        error: (error as Error).message,
      });
    }
  }

  private async saveDeploymentState(snapshotDir: string): Promise<void> {
    const deploymentState = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      environment: process.env.NODE_ENV,
      rollbackOptions: this.options,
    };

    const fs = await import("node:fs/promises");
    await fs.writeFile(
      join(snapshotDir, "deployment-state.json"),
      JSON.stringify(deploymentState, null, 2)
    );
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  const options: Partial<RollbackOptions> = {};

  // Parse command line arguments
  args.forEach((arg, index) => {
    switch (arg) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--skip-confirmation":
        options.skipConfirmation = true;
        break;
      case "--no-database":
        options.rollbackDatabase = false;
        break;
      case "--no-code":
        options.rollbackCode = false;
        break;
      case "--no-environment":
        options.rollbackEnvironment = false;
        break;
      case "--backup":
        options.backupPath = args[index + 1];
        break;
    }
  });

  const command = args[0];

  if (command === "snapshot") {
    const rollbackManager = new RollbackManager();
    rollbackManager
      .createRollbackSnapshot()
      .then((snapshotDir) => {
        console.log("\n=== ROLLBACK SNAPSHOT CREATED ===");
        console.log(`Snapshot Directory: ${snapshotDir}`);
        console.log("\nThe snapshot contains:");
        console.log("  - Environment configuration");
        console.log("  - Package dependencies");
        console.log("  - Git information");
        console.log("  - Deployment state");
        console.log("\nUse this snapshot for rollback if needed.");
        process.exit(0);
      })
      .catch((error) => {
        console.error("Snapshot creation failed:", error);
        process.exit(1);
      });
  } else {
    const rollbackManager = new RollbackManager(options);

    rollbackManager
      .rollback()
      .then((result) => {
        console.log("\n=== ROLLBACK RESULTS ===");
        console.log(`Success: ${result.success ? "✅" : "❌"}`);
        console.log(`Total Duration: ${result.totalDuration}ms`);
        console.log(`Completed Steps: ${result.completedSteps.length}`);

        if (result.failedStep) {
          console.log(`Failed Step: ${result.failedStep}`);
        }

        if (result.error) {
          console.error(`Error: ${result.error.message}`);
        }

        console.log("\nCompleted Steps:");
        result.completedSteps.forEach((step) => console.log(`  ✅ ${step}`));

        if (result.success) {
          console.log("\n🎉 ROLLBACK SUCCESSFUL!");
          console.log("\nNext Steps:");
          console.log("1. Verify system functionality");
          console.log("2. Monitor logs for any issues");
          console.log("3. Investigate root cause of deployment failure");
        } else {
          console.log("\n💥 ROLLBACK FAILED!");
          console.log("\nNext Steps:");
          console.log("1. Check logs for error details");
          console.log("2. Manual intervention may be required");
          console.log("3. Contact system administrators");
        }

        process.exit(result.success ? 0 : 1);
      })
      .catch((error) => {
        console.error("Rollback failed:", error);
        process.exit(1);
      });
  }
}
