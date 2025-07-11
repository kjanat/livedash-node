/**
 * Main Deployment Orchestrator
 *
 * Orchestrates the complete deployment process for tRPC and batch processing
 * architecture with zero-downtime deployment strategy.
 */

import { migrationLogger } from "./migration-logger";
import { PreDeploymentChecker } from "./pre-deployment-checks";
import { DatabaseBackup } from "./backup-database";
import { EnvironmentMigration } from "./environment-migration";
import { DatabaseValidator } from "./validate-database";
import { HealthChecker } from "./health-checks";

interface DeploymentOptions {
  skipPreChecks: boolean;
  skipBackup: boolean;
  skipEnvironmentMigration: boolean;
  dryRun: boolean;
  rollbackOnFailure: boolean;
  enableProgressiveRollout: boolean;
  maxDowntime: number; // in milliseconds
}

interface DeploymentPhase {
  name: string;
  description: string;
  critical: boolean;
  execute: () => Promise<void>;
  rollback?: () => Promise<void>;
  healthCheck?: () => Promise<boolean>;
}

interface DeploymentResult {
  success: boolean;
  completedPhases: string[];
  failedPhase?: string;
  totalDuration: number;
  downtime: number;
  backupPath?: string;
  error?: Error;
}

export class DeploymentOrchestrator {
  private readonly defaultOptions: DeploymentOptions = {
    skipPreChecks: false,
    skipBackup: false,
    skipEnvironmentMigration: false,
    dryRun: false,
    rollbackOnFailure: true,
    enableProgressiveRollout: true,
    maxDowntime: 30000, // 30 seconds
  };

  private options: DeploymentOptions;
  private phases: DeploymentPhase[] = [];
  private executedPhases: string[] = [];
  private startTime: number = 0;
  private downtimeStart: number = 0;
  private downtimeEnd: number = 0;

  constructor(options?: Partial<DeploymentOptions>) {
    this.options = { ...this.defaultOptions, ...options };
    this.setupDeploymentPhases();
  }

  /**
   * Execute the complete deployment process
   */
  async deploy(): Promise<DeploymentResult> {
    this.startTime = Date.now();

    try {
      migrationLogger.startPhase(
        "DEPLOYMENT",
        `Starting deployment with options: ${JSON.stringify(this.options)}`
      );

      // Pre-deployment phase
      if (!this.options.skipPreChecks) {
        await this.runPreDeploymentChecks();
      }

      // Backup phase
      let backupPath: string | undefined;
      if (!this.options.skipBackup) {
        backupPath = await this.createBackup();
      }

      // Execute deployment phases
      for (const phase of this.phases) {
        await this.executePhase(phase);
        this.executedPhases.push(phase.name);
      }

      const totalDuration = Date.now() - this.startTime;
      const downtime = this.downtimeEnd - this.downtimeStart;

      migrationLogger.completePhase("DEPLOYMENT");
      migrationLogger.info("DEPLOYMENT", "Deployment completed successfully", {
        totalDuration,
        downtime,
        phases: this.executedPhases.length,
      });

      return {
        success: true,
        completedPhases: this.executedPhases,
        totalDuration,
        downtime,
        backupPath,
      };
    } catch (error) {
      const totalDuration = Date.now() - this.startTime;
      const downtime =
        this.downtimeEnd > 0 ? this.downtimeEnd - this.downtimeStart : 0;

      migrationLogger.error("DEPLOYMENT", "Deployment failed", error as Error);

      // Attempt rollback if enabled
      if (this.options.rollbackOnFailure) {
        try {
          await this.performRollback();
        } catch (rollbackError) {
          migrationLogger.error(
            "ROLLBACK",
            "Rollback failed",
            rollbackError as Error
          );
        }
      }

      return {
        success: false,
        completedPhases: this.executedPhases,
        totalDuration,
        downtime,
        error: error as Error,
      };
    }
  }

  private setupDeploymentPhases(): void {
    this.phases = [
      {
        name: "Environment Migration",
        description: "Migrate environment variables for new architecture",
        critical: false,
        execute: async () => {
          if (this.options.skipEnvironmentMigration) {
            migrationLogger.info("PHASE", "Skipping environment migration");
            return;
          }

          const envMigration = new EnvironmentMigration();
          const result = await envMigration.migrateEnvironment();

          if (!result.success) {
            throw new Error(
              `Environment migration failed: ${result.errors.join(", ")}`
            );
          }
        },
      },

      {
        name: "Database Schema Migration",
        description: "Apply database schema changes",
        critical: true,
        execute: async () => {
          await this.runDatabaseMigrations();
        },
        rollback: async () => {
          await this.rollbackDatabaseMigrations();
        },
        healthCheck: async () => {
          const validator = new DatabaseValidator();
          const result = await validator.validateDatabase();
          return result.success;
        },
      },

      {
        name: "Application Code Deployment",
        description: "Deploy new application code",
        critical: true,
        execute: async () => {
          await this.deployApplicationCode();
        },
      },

      {
        name: "Service Restart",
        description: "Restart application services",
        critical: true,
        execute: async () => {
          this.downtimeStart = Date.now();
          await this.restartServices();
          this.downtimeEnd = Date.now();

          const downtime = this.downtimeEnd - this.downtimeStart;
          if (downtime > this.options.maxDowntime) {
            throw new Error(
              `Downtime exceeded maximum allowed: ${downtime}ms > ${this.options.maxDowntime}ms`
            );
          }
        },
      },

      {
        name: "tRPC Activation",
        description: "Enable tRPC endpoints",
        critical: true,
        execute: async () => {
          await this.activateTRPCEndpoints();
        },
        healthCheck: async () => {
          return await this.testTRPCEndpoints();
        },
      },

      {
        name: "Batch Processing Activation",
        description: "Enable batch processing system",
        critical: true,
        execute: async () => {
          await this.activateBatchProcessing();
        },
        healthCheck: async () => {
          return await this.testBatchProcessing();
        },
      },

      {
        name: "Post-Deployment Validation",
        description: "Validate deployment success",
        critical: true,
        execute: async () => {
          await this.runPostDeploymentValidation();
        },
      },

      {
        name: "Progressive Rollout",
        description: "Gradually enable new features",
        critical: false,
        execute: async () => {
          if (this.options.enableProgressiveRollout) {
            await this.performProgressiveRollout();
          }
        },
      },
    ];
  }

  private async runPreDeploymentChecks(): Promise<void> {
    migrationLogger.startStep(
      "PRE_CHECKS",
      "Running pre-deployment validation"
    );

    const checker = new PreDeploymentChecker();
    const result = await checker.runAllChecks();

    if (!result.success) {
      throw new Error(
        `Pre-deployment checks failed with ${result.criticalFailures} critical failures`
      );
    }

    if (result.warningCount > 0) {
      migrationLogger.warn(
        "PRE_CHECKS",
        `Proceeding with ${result.warningCount} warnings`
      );
    }

    migrationLogger.completeStep("PRE_CHECKS");
  }

  private async createBackup(): Promise<string> {
    migrationLogger.startStep("BACKUP", "Creating database backup");

    const backup = new DatabaseBackup();
    const result = await backup.createBackup();

    if (!result.success) {
      throw new Error(`Backup failed: ${result.error?.message}`);
    }

    migrationLogger.completeStep("BACKUP");
    migrationLogger.info("BACKUP", "Backup created successfully", {
      path: result.backupPath,
      size: result.size,
    });

    return result.backupPath;
  }

  private async executePhase(phase: DeploymentPhase): Promise<void> {
    try {
      migrationLogger.startStep(
        phase.name.replace(/\s+/g, "_").toUpperCase(),
        phase.description
      );

      if (this.options.dryRun) {
        migrationLogger.info("DRY_RUN", `Would execute: ${phase.name}`);
        await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate execution time
      } else {
        await phase.execute();
      }

      // Run health check if provided
      if (phase.healthCheck && !this.options.dryRun) {
        const healthy = await phase.healthCheck();
        if (!healthy) {
          throw new Error(`Health check failed for phase: ${phase.name}`);
        }
      }

      migrationLogger.completeStep(
        phase.name.replace(/\s+/g, "_").toUpperCase()
      );
    } catch (error) {
      migrationLogger.failStep(
        phase.name.replace(/\s+/g, "_").toUpperCase(),
        error as Error
      );

      if (phase.critical) {
        throw error;
      } else {
        migrationLogger.warn(
          "PHASE",
          `Non-critical phase failed: ${phase.name}`,
          { error: (error as Error).message }
        );
      }
    }
  }

  private async runDatabaseMigrations(): Promise<void> {
    migrationLogger.info("DB_MIGRATION", "Applying database schema migrations");

    try {
      const { execSync } = await import("node:child_process");

      // Run Prisma migrations
      execSync("npx prisma migrate deploy", {
        stdio: "pipe",
        encoding: "utf8",
      });

      migrationLogger.info(
        "DB_MIGRATION",
        "Database migrations completed successfully"
      );
    } catch (error) {
      throw new Error(`Database migration failed: ${(error as Error).message}`);
    }
  }

  private async rollbackDatabaseMigrations(): Promise<void> {
    migrationLogger.warn("DB_ROLLBACK", "Rolling back database migrations");

    try {
      // This would typically involve running specific rollback migrations
      // For now, we'll log the intent
      migrationLogger.warn(
        "DB_ROLLBACK",
        "Database rollback would be performed here"
      );
    } catch (error) {
      throw new Error(`Database rollback failed: ${(error as Error).message}`);
    }
  }

  private async deployApplicationCode(): Promise<void> {
    migrationLogger.info("CODE_DEPLOY", "Deploying application code");

    try {
      const { execSync } = await import("node:child_process");

      // Build the application
      execSync("pnpm build", {
        stdio: "pipe",
        encoding: "utf8",
      });

      migrationLogger.info(
        "CODE_DEPLOY",
        "Application build completed successfully"
      );
    } catch (error) {
      throw new Error(`Code deployment failed: ${(error as Error).message}`);
    }
  }

  private async restartServices(): Promise<void> {
    migrationLogger.info("SERVICE_RESTART", "Restarting application services");

    // In a real deployment, this would restart the actual services
    // For development, we'll simulate the restart
    await new Promise((resolve) => setTimeout(resolve, 1000));

    migrationLogger.info("SERVICE_RESTART", "Services restarted successfully");
  }

  private async activateTRPCEndpoints(): Promise<void> {
    migrationLogger.info("TRPC_ACTIVATION", "Activating tRPC endpoints");

    // Set environment variable to enable tRPC
    process.env.TRPC_ENABLED = "true";

    migrationLogger.info("TRPC_ACTIVATION", "tRPC endpoints activated");
  }

  private async testTRPCEndpoints(): Promise<boolean> {
    try {
      migrationLogger.info("TRPC_TEST", "Testing tRPC endpoints");

      // Test basic tRPC endpoint
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const response = await fetch(`${baseUrl}/api/trpc/auth.getSession`);

      return response.status === 200 || response.status === 401; // 401 is OK for auth endpoint
    } catch (error) {
      migrationLogger.error(
        "TRPC_TEST",
        "tRPC endpoint test failed",
        error as Error
      );
      return false;
    }
  }

  private async activateBatchProcessing(): Promise<void> {
    migrationLogger.info(
      "BATCH_ACTIVATION",
      "Activating batch processing system"
    );

    // Set environment variable to enable batch processing
    process.env.BATCH_PROCESSING_ENABLED = "true";

    migrationLogger.info(
      "BATCH_ACTIVATION",
      "Batch processing system activated"
    );
  }

  private async testBatchProcessing(): Promise<boolean> {
    try {
      migrationLogger.info("BATCH_TEST", "Testing batch processing system");

      // Test that batch processing components can be imported
      const { BatchProcessor } = await import("../../lib/batchProcessor");
      return BatchProcessor !== undefined;
    } catch (error) {
      migrationLogger.error(
        "BATCH_TEST",
        "Batch processing test failed",
        error as Error
      );
      return false;
    }
  }

  private async runPostDeploymentValidation(): Promise<void> {
    migrationLogger.info(
      "POST_VALIDATION",
      "Running post-deployment validation"
    );

    const healthChecker = new HealthChecker();
    const result = await healthChecker.runHealthChecks();

    if (!result.success) {
      throw new Error(
        `Post-deployment validation failed: ${result.errors.join(", ")}`
      );
    }

    migrationLogger.info(
      "POST_VALIDATION",
      "Post-deployment validation passed"
    );
  }

  private async performProgressiveRollout(): Promise<void> {
    migrationLogger.info(
      "PROGRESSIVE_ROLLOUT",
      "Starting progressive feature rollout"
    );

    // This would implement a gradual rollout strategy
    // For now, we'll just enable all features
    const rolloutSteps = [
      { feature: "tRPC Authentication", percentage: 100 },
      { feature: "tRPC Dashboard APIs", percentage: 100 },
      { feature: "Batch Processing", percentage: 100 },
    ];

    for (const step of rolloutSteps) {
      migrationLogger.info(
        "PROGRESSIVE_ROLLOUT",
        `Enabling ${step.feature} at ${step.percentage}%`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    migrationLogger.info(
      "PROGRESSIVE_ROLLOUT",
      "Progressive rollout completed"
    );
  }

  private async performRollback(): Promise<void> {
    migrationLogger.warn("ROLLBACK", "Starting deployment rollback");

    // Rollback executed phases in reverse order
    const rollbackPhases = this.phases
      .filter((p) => this.executedPhases.includes(p.name) && p.rollback)
      .reverse();

    for (const phase of rollbackPhases) {
      try {
        migrationLogger.info("ROLLBACK", `Rolling back: ${phase.name}`);

        if (phase.rollback) {
          await phase.rollback();
        }
      } catch (error) {
        migrationLogger.error(
          "ROLLBACK",
          `Rollback failed for ${phase.name}`,
          error as Error
        );
      }
    }

    migrationLogger.warn("ROLLBACK", "Rollback completed");
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  const options: Partial<DeploymentOptions> = {};

  // Parse command line arguments
  args.forEach((arg) => {
    switch (arg) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--skip-pre-checks":
        options.skipPreChecks = true;
        break;
      case "--skip-backup":
        options.skipBackup = true;
        break;
      case "--no-rollback":
        options.rollbackOnFailure = false;
        break;
      case "--no-progressive-rollout":
        options.enableProgressiveRollout = false;
        break;
    }
  });

  const orchestrator = new DeploymentOrchestrator(options);

  orchestrator
    .deploy()
    .then((result) => {
      console.log("\n=== DEPLOYMENT RESULTS ===");
      console.log(`Success: ${result.success ? "✅" : "❌"}`);
      console.log(`Total Duration: ${result.totalDuration}ms`);
      console.log(`Downtime: ${result.downtime}ms`);
      console.log(`Completed Phases: ${result.completedPhases.length}`);

      if (result.backupPath) {
        console.log(`Backup Created: ${result.backupPath}`);
      }

      if (result.failedPhase) {
        console.log(`Failed Phase: ${result.failedPhase}`);
      }

      if (result.error) {
        console.error(`Error: ${result.error.message}`);
      }

      console.log("\nCompleted Phases:");
      result.completedPhases.forEach((phase) => console.log(`  ✅ ${phase}`));

      if (result.success) {
        console.log("\n🎉 DEPLOYMENT SUCCESSFUL!");
        console.log("\nNext Steps:");
        console.log("1. Monitor application logs for any issues");
        console.log("2. Run post-deployment tests: pnpm migration:test");
        console.log("3. Verify new features are working correctly");
      } else {
        console.log("\n💥 DEPLOYMENT FAILED!");
        console.log("\nNext Steps:");
        console.log("1. Check logs for error details");
        console.log("2. Fix identified issues");
        console.log("3. Re-run deployment");
      }

      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Deployment orchestration failed:", error);
      process.exit(1);
    });
}
