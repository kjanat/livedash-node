/**
 * Pre-Deployment Validation Checks
 *
 * Comprehensive validation suite that must pass before deploying
 * the new tRPC and batch processing architecture.
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { migrationLogger } from "./migration-logger";
import { DatabaseValidator } from "./validate-database";
import { EnvironmentMigration } from "./environment-migration";

interface CheckResult {
  name: string;
  success: boolean;
  errors: string[];
  warnings: string[];
  duration: number;
  critical: boolean;
}

interface PreDeploymentResult {
  success: boolean;
  checks: CheckResult[];
  totalDuration: number;
  criticalFailures: number;
  warningCount: number;
}

export class PreDeploymentChecker {
  private prisma: PrismaClient;
  private checks: CheckResult[] = [];

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Run all pre-deployment checks
   */
  async runAllChecks(): Promise<PreDeploymentResult> {
    const startTime = Date.now();

    try {
      migrationLogger.startPhase("PRE_DEPLOYMENT", "Running pre-deployment validation checks");

      // Define all checks to run
      const checkSuite = [
        { name: "Environment Configuration", fn: () => this.checkEnvironmentConfiguration(), critical: true },
        { name: "Database Connection", fn: () => this.checkDatabaseConnection(), critical: true },
        { name: "Database Schema", fn: () => this.checkDatabaseSchema(), critical: true },
        { name: "Database Data Integrity", fn: () => this.checkDataIntegrity(), critical: true },
        { name: "Dependencies", fn: () => this.checkDependencies(), critical: true },
        { name: "File System Permissions", fn: () => this.checkFileSystemPermissions(), critical: false },
        { name: "Port Availability", fn: () => this.checkPortAvailability(), critical: true },
        { name: "OpenAI API Access", fn: () => this.checkOpenAIAccess(), critical: true },
        { name: "tRPC Infrastructure", fn: () => this.checkTRPCInfrastructure(), critical: true },
        { name: "Batch Processing Readiness", fn: () => this.checkBatchProcessingReadiness(), critical: true },
        { name: "Security Configuration", fn: () => this.checkSecurityConfiguration(), critical: false },
        { name: "Performance Configuration", fn: () => this.checkPerformanceConfiguration(), critical: false },
        { name: "Backup Validation", fn: () => this.checkBackupValidation(), critical: false },
        { name: "Migration Rollback Readiness", fn: () => this.checkRollbackReadiness(), critical: false },
      ];

      // Run all checks
      for (const check of checkSuite) {
        await this.runSingleCheck(check.name, check.fn, check.critical);
      }

      const totalDuration = Date.now() - startTime;
      const criticalFailures = this.checks.filter(c => c.critical && !c.success).length;
      const warningCount = this.checks.reduce((sum, c) => sum + c.warnings.length, 0);

      const result: PreDeploymentResult = {
        success: criticalFailures === 0,
        checks: this.checks,
        totalDuration,
        criticalFailures,
        warningCount,
      };

      if (result.success) {
        migrationLogger.completePhase("PRE_DEPLOYMENT");
      } else {
        migrationLogger.error("PRE_DEPLOYMENT", `Pre-deployment checks failed with ${criticalFailures} critical failures`);
      }

      return result;

    } catch (error) {
      migrationLogger.error("PRE_DEPLOYMENT", "Pre-deployment check suite failed", error as Error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  private async runSingleCheck(
    name: string,
    checkFn: () => Promise<Omit<CheckResult, 'name' | 'duration'>>,
    critical: boolean
  ): Promise<void> {
    const startTime = Date.now();

    try {
      migrationLogger.info("CHECK", `Running: ${name}`);

      const result = await checkFn();
      const duration = Date.now() - startTime;

      const checkResult: CheckResult = {
        name,
        ...result,
        duration,
        critical,
      };

      this.checks.push(checkResult);

      if (result.success) {
        migrationLogger.info("CHECK", `✅ ${name} passed`, { duration, warnings: result.warnings.length });
      } else {
        const level = critical ? "ERROR" : "WARN";
        migrationLogger[level.toLowerCase() as 'error' | 'warn']("CHECK", `❌ ${name} failed`, undefined, {
          errors: result.errors.length,
          warnings: result.warnings.length,
          duration
        });
      }

      if (result.warnings.length > 0) {
        migrationLogger.warn("CHECK", `${name} has warnings`, { warnings: result.warnings });
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      const checkResult: CheckResult = {
        name,
        success: false,
        errors: [`Check failed: ${(error as Error).message}`],
        warnings: [],
        duration,
        critical,
      };

      this.checks.push(checkResult);
      migrationLogger.error("CHECK", `💥 ${name} crashed`, error as Error, { duration });
    }
  }

  private async checkEnvironmentConfiguration(): Promise<Omit<CheckResult, 'name' | 'duration'>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const envMigration = new EnvironmentMigration();
      const result = await envMigration.validateEnvironmentConfiguration();

      errors.push(...result.errors);
      warnings.push(...result.warnings);

      // Additional environment checks
      const requiredVars = [
        'DATABASE_URL',
        'NEXTAUTH_SECRET',
        'OPENAI_API_KEY'
      ];

      for (const varName of requiredVars) {
        if (!process.env[varName]) {
          errors.push(`Missing required environment variable: ${varName}`);
        }
      }

      // Check new variables
      const newVars = [
        'BATCH_PROCESSING_ENABLED',
        'TRPC_ENDPOINT_URL'
      ];

      for (const varName of newVars) {
        if (!process.env[varName]) {
          warnings.push(`New environment variable not set: ${varName}`);
        }
      }

    } catch (error) {
      errors.push(`Environment validation failed: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async checkDatabaseConnection(): Promise<Omit<CheckResult, 'name' | 'duration'>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Test basic connection
      await this.prisma.$queryRaw`SELECT 1`;

      // Test connection pooling
      const connections = await Promise.all([
        this.prisma.$queryRaw`SELECT 1`,
        this.prisma.$queryRaw`SELECT 1`,
        this.prisma.$queryRaw`SELECT 1`,
      ]);

      if (connections.length !== 3) {
        warnings.push("Connection pooling may have issues");
      }

    } catch (error) {
      errors.push(`Database connection failed: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async checkDatabaseSchema(): Promise<Omit<CheckResult, 'name' | 'duration'>> {
    const validator = new DatabaseValidator();

    try {
      const result = await validator.validateDatabase();

      return {
        success: result.success,
        errors: result.errors,
        warnings: result.warnings,
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Schema validation failed: ${(error as Error).message}`],
        warnings: [],
      };
    }
  }

  private async checkDataIntegrity(): Promise<Omit<CheckResult, 'name' | 'duration'>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check for any corrupt data that could affect migration
      const sessionCount = await this.prisma.session.count();
      const importCount = await this.prisma.sessionImport.count();

      if (sessionCount === 0 && importCount === 0) {
        warnings.push("No session data found - this may be a fresh installation");
      }

      // Check for orphaned processing status records
      const orphanedStatus = await this.prisma.$queryRaw<{count: bigint}[]>`
        SELECT COUNT(*) as count
        FROM "SessionProcessingStatus" sps
        LEFT JOIN "Session" s ON sps."sessionId" = s.id
        WHERE s.id IS NULL
      `;

      if (orphanedStatus[0]?.count > 0) {
        warnings.push(`Found ${orphanedStatus[0].count} orphaned processing status records`);
      }

    } catch (error) {
      errors.push(`Data integrity check failed: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async checkDependencies(): Promise<Omit<CheckResult, 'name' | 'duration'>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check package.json
      const packagePath = join(process.cwd(), "package.json");
      if (!existsSync(packagePath)) {
        errors.push("package.json not found");
        return { success: false, errors, warnings };
      }

      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

      // Check for required dependencies
      const requiredDeps = [
        "@trpc/server",
        "@trpc/client",
        "@trpc/next",
        "@prisma/client",
        "next",
      ];

      for (const dep of requiredDeps) {
        if (!packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]) {
          errors.push(`Missing required dependency: ${dep}`);
        }
      }

      // Check Node.js version
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

      if (majorVersion < 18) {
        errors.push(`Node.js ${nodeVersion} is too old. Requires Node.js 18+`);
      }

    } catch (error) {
      errors.push(`Dependency check failed: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async checkFileSystemPermissions(): Promise<Omit<CheckResult, 'name' | 'duration'>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const fs = await import("node:fs/promises");

      // Check if we can write to logs directory
      const logsDir = join(process.cwd(), "logs");
      try {
        await fs.mkdir(logsDir, { recursive: true });
        const testFile = join(logsDir, "test-write.tmp");
        await fs.writeFile(testFile, "test");
        await fs.unlink(testFile);
      } catch (error) {
        errors.push(`Cannot write to logs directory: ${(error as Error).message}`);
      }

      // Check if we can write to backups directory
      const backupsDir = join(process.cwd(), "backups");
      try {
        await fs.mkdir(backupsDir, { recursive: true });
        const testFile = join(backupsDir, "test-write.tmp");
        await fs.writeFile(testFile, "test");
        await fs.unlink(testFile);
      } catch (error) {
        warnings.push(`Cannot write to backups directory: ${(error as Error).message}`);
      }

    } catch (error) {
      errors.push(`File system permission check failed: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async checkPortAvailability(): Promise<Omit<CheckResult, 'name' | 'duration'>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const net = await import("node:net");
      const port = parseInt(process.env.PORT || "3000");

      // Check if port is available
      const server = net.createServer();

      await new Promise<void>((resolve, reject) => {
        server.listen(port, () => {
          server.close(() => resolve());
        });

        server.on("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "EADDRINUSE") {
            warnings.push(`Port ${port} is already in use`);
          } else {
            errors.push(`Port check failed: ${err.message}`);
          }
          resolve();
        });
      });

    } catch (error) {
      errors.push(`Port availability check failed: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async checkOpenAIAccess(): Promise<Omit<CheckResult, 'name' | 'duration'>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        errors.push("OPENAI_API_KEY not set");
        return { success: false, errors, warnings };
      }

      // Test API access (simple models list call)
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        errors.push(`OpenAI API access failed: ${response.status} ${response.statusText}`);
      } else {
        const data = await response.json();
        if (!data.data || !Array.isArray(data.data)) {
          warnings.push("OpenAI API returned unexpected response format");
        }
      }

    } catch (error) {
      errors.push(`OpenAI API check failed: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async checkTRPCInfrastructure(): Promise<Omit<CheckResult, 'name' | 'duration'>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if tRPC files exist
      const trpcFiles = [
        "app/api/trpc/[trpc]/route.ts",
        "server/routers/_app.ts",
        "lib/trpc.ts",
      ];

      for (const file of trpcFiles) {
        const fullPath = join(process.cwd(), file);
        if (!existsSync(fullPath)) {
          errors.push(`Missing tRPC file: ${file}`);
        }
      }

      // Check if tRPC types can be imported
      try {
        const { AppRouter } = await import("../../server/routers/_app");
        if (!AppRouter) {
          warnings.push("AppRouter type not found");
        }
      } catch (error) {
        errors.push(`Cannot import tRPC router: ${(error as Error).message}`);
      }

    } catch (error) {
      errors.push(`tRPC infrastructure check failed: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async checkBatchProcessingReadiness(): Promise<Omit<CheckResult, 'name' | 'duration'>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if batch processing files exist
      const batchFiles = [
        "lib/batchProcessor.ts",
        "lib/batchScheduler.ts",
      ];

      for (const file of batchFiles) {
        const fullPath = join(process.cwd(), file);
        if (!existsSync(fullPath)) {
          errors.push(`Missing batch processing file: ${file}`);
        }
      }

      // Check database readiness for batch processing
      const batchTableExists = await this.prisma.$queryRaw<{count: string}[]>`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_name = 'AIBatchRequest'
      `;

      if (parseInt(batchTableExists[0]?.count || '0') === 0) {
        errors.push("AIBatchRequest table not found");
      }

      // Check if batch status enum exists
      const batchStatusExists = await this.prisma.$queryRaw<{count: string}[]>`
        SELECT COUNT(*) as count
        FROM pg_type
        WHERE typname = 'AIBatchRequestStatus'
      `;

      if (parseInt(batchStatusExists[0]?.count || '0') === 0) {
        errors.push("AIBatchRequestStatus enum not found");
      }

    } catch (error) {
      errors.push(`Batch processing readiness check failed: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async checkSecurityConfiguration(): Promise<Omit<CheckResult, 'name' | 'duration'>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check NEXTAUTH_SECRET strength
      const secret = process.env.NEXTAUTH_SECRET;
      if (secret && secret.length < 32) {
        warnings.push("NEXTAUTH_SECRET should be at least 32 characters long");
      }

      // Check if rate limiting is configured
      if (!process.env.RATE_LIMIT_WINDOW_MS) {
        warnings.push("Rate limiting not configured");
      }

      // Check if we're running in production mode with proper settings
      if (process.env.NODE_ENV === "production") {
        if (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes("localhost")) {
          warnings.push("NEXTAUTH_URL should not use localhost in production");
        }
      }

    } catch (error) {
      warnings.push(`Security configuration check failed: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async checkPerformanceConfiguration(): Promise<Omit<CheckResult, 'name' | 'duration'>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check database connection limits
      const connectionLimit = parseInt(process.env.DATABASE_CONNECTION_LIMIT || "20");
      if (connectionLimit < 10) {
        warnings.push("DATABASE_CONNECTION_LIMIT may be too low for production");
      }

      // Check batch processing configuration
      const batchMaxRequests = parseInt(process.env.BATCH_MAX_REQUESTS || "1000");
      if (batchMaxRequests > 50000) {
        warnings.push("BATCH_MAX_REQUESTS exceeds OpenAI limits");
      }

      // Check session processing concurrency
      const concurrency = parseInt(process.env.SESSION_PROCESSING_CONCURRENCY || "5");
      if (concurrency > 10) {
        warnings.push("High SESSION_PROCESSING_CONCURRENCY may overwhelm the system");
      }

    } catch (error) {
      warnings.push(`Performance configuration check failed: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async checkBackupValidation(): Promise<Omit<CheckResult, 'name' | 'duration'>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if pg_dump is available
      const { execSync } = await import("node:child_process");

      try {
        execSync("pg_dump --version", { stdio: "ignore" });
      } catch (error) {
        errors.push("pg_dump not found - database backup will not work");
      }

      // Check backup directory
      const backupDir = join(process.cwd(), "backups");
      if (!existsSync(backupDir)) {
        warnings.push("Backup directory does not exist");
      }

    } catch (error) {
      warnings.push(`Backup validation failed: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async checkRollbackReadiness(): Promise<Omit<CheckResult, 'name' | 'duration'>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if rollback scripts exist
      const rollbackFiles = [
        "scripts/migration/rollback.ts",
        "scripts/migration/restore-database.ts",
      ];

      for (const file of rollbackFiles) {
        const fullPath = join(process.cwd(), file);
        if (!existsSync(fullPath)) {
          warnings.push(`Missing rollback file: ${file}`);
        }
      }

      // Check if migration mode allows rollback
      if (process.env.MIGRATION_ROLLBACK_ENABLED !== "true") {
        warnings.push("Rollback is disabled - consider enabling for safety");
      }

    } catch (error) {
      warnings.push(`Rollback readiness check failed: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new PreDeploymentChecker();

  checker.runAllChecks()
    .then((result) => {
      console.log('\n=== PRE-DEPLOYMENT CHECK RESULTS ===');
      console.log(`Overall Success: ${result.success ? '✅' : '❌'}`);
      console.log(`Total Duration: ${result.totalDuration}ms`);
      console.log(`Critical Failures: ${result.criticalFailures}`);
      console.log(`Total Warnings: ${result.warningCount}`);

      console.log('\n=== INDIVIDUAL CHECKS ===');
      for (const check of result.checks) {
        const status = check.success ? '✅' : '❌';
        const critical = check.critical ? ' (CRITICAL)' : '';
        console.log(`${status} ${check.name}${critical} (${check.duration}ms)`);

        if (check.errors.length > 0) {
          check.errors.forEach(error => console.log(`  ❌ ${error}`));
        }

        if (check.warnings.length > 0) {
          check.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
        }
      }

      if (!result.success) {
        console.log('\n❌ DEPLOYMENT BLOCKED - Fix critical issues before proceeding');
      } else if (result.warningCount > 0) {
        console.log('\n⚠️  DEPLOYMENT ALLOWED - Review warnings before proceeding');
      } else {
        console.log('\n✅ DEPLOYMENT READY - All checks passed');
      }

      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Pre-deployment checks failed:', error);
      process.exit(1);
    });
}