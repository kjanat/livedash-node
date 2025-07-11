/**
 * Comprehensive Health Check System
 *
 * Validates that the deployed tRPC and batch processing architecture
 * is working correctly and all components are healthy.
 */

import { PrismaClient } from "@prisma/client";
import { migrationLogger } from "./migration-logger";

interface HealthCheckResult {
  name: string;
  success: boolean;
  duration: number;
  details?: Record<string, unknown>;
  error?: Error;
}

interface SystemHealthResult {
  success: boolean;
  checks: HealthCheckResult[];
  totalDuration: number;
  failedChecks: number;
  score: number; // 0-100
}

export class HealthChecker {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Run comprehensive health checks
   */
  async runHealthChecks(): Promise<SystemHealthResult> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];

    try {
      migrationLogger.startStep("HEALTH_CHECKS", "Running comprehensive health checks");

      // Define all health checks
      const healthChecks = [
        { name: "Database Connection", fn: () => this.checkDatabaseConnection() },
        { name: "Database Schema", fn: () => this.checkDatabaseSchema() },
        { name: "tRPC Endpoints", fn: () => this.checkTRPCEndpoints() },
        { name: "Batch Processing System", fn: () => this.checkBatchProcessingSystem() },
        { name: "OpenAI API Access", fn: () => this.checkOpenAIAccess() },
        { name: "Environment Configuration", fn: () => this.checkEnvironmentConfiguration() },
        { name: "File System Access", fn: () => this.checkFileSystemAccess() },
        { name: "Memory Usage", fn: () => this.checkMemoryUsage() },
        { name: "CPU Usage", fn: () => this.checkCPUUsage() },
        { name: "Application Performance", fn: () => this.checkApplicationPerformance() },
        { name: "Security Configuration", fn: () => this.checkSecurityConfiguration() },
        { name: "Logging System", fn: () => this.checkLoggingSystem() },
      ];

      // Run all checks
      for (const check of healthChecks) {
        const result = await this.runSingleHealthCheck(check.name, check.fn);
        checks.push(result);
      }

      const totalDuration = Date.now() - startTime;
      const failedChecks = checks.filter(c => !c.success).length;
      const score = Math.round(((checks.length - failedChecks) / checks.length) * 100);

      const result: SystemHealthResult = {
        success: failedChecks === 0,
        checks,
        totalDuration,
        failedChecks,
        score,
      };

      if (result.success) {
        migrationLogger.completeStep("HEALTH_CHECKS");
      } else {
        migrationLogger.failStep("HEALTH_CHECKS", new Error(`${failedChecks} health checks failed`));
      }

      return result;

    } catch (error) {
      migrationLogger.error("HEALTH_CHECKS", "Health check system failed", error as Error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  private async runSingleHealthCheck(
    name: string,
    checkFn: () => Promise<{ success: boolean; details?: Record<string, unknown>; error?: Error }>
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      migrationLogger.debug("HEALTH_CHECK", `Running: ${name}`);

      const result = await checkFn();
      const duration = Date.now() - startTime;

      const healthResult: HealthCheckResult = {
        name,
        success: result.success,
        duration,
        details: result.details,
        error: result.error,
      };

      if (result.success) {
        migrationLogger.debug("HEALTH_CHECK", `✅ ${name} passed`, { duration, details: result.details });
      } else {
        migrationLogger.warn("HEALTH_CHECK", `❌ ${name} failed`, { duration, error: result.error?.message });
      }

      return healthResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      migrationLogger.error("HEALTH_CHECK", `💥 ${name} crashed`, error as Error, { duration });

      return {
        name,
        success: false,
        duration,
        error: error as Error,
      };
    }
  }

  private async checkDatabaseConnection(): Promise<{ success: boolean; details?: Record<string, unknown>; error?: Error }> {
    try {
      const startTime = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const queryTime = Date.now() - startTime;

      // Test multiple connections
      const connectionTests = await Promise.all([
        this.prisma.$queryRaw`SELECT 1`,
        this.prisma.$queryRaw`SELECT 1`,
        this.prisma.$queryRaw`SELECT 1`,
      ]);

      return {
        success: connectionTests.length === 3,
        details: {
          queryTime,
          connectionPoolTest: "passed"
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  private async checkDatabaseSchema(): Promise<{ success: boolean; details?: Record<string, unknown>; error?: Error }> {
    try {
      // Check critical tables
      const tableChecks = await Promise.allSettled([
        this.prisma.company.findFirst(),
        this.prisma.user.findFirst(),
        this.prisma.session.findFirst(),
        this.prisma.aIBatchRequest.findFirst(),
        this.prisma.aIProcessingRequest.findFirst(),
      ]);

      const failedTables = tableChecks.filter(result => result.status === 'rejected').length;

      // Check for critical indexes
      const indexCheck = await this.prisma.$queryRaw<{count: string}[]>`
        SELECT COUNT(*) as count
        FROM pg_indexes 
        WHERE tablename IN ('Session', 'AIProcessingRequest', 'AIBatchRequest')
      `;

      const indexCount = parseInt(indexCheck[0]?.count || '0');

      return {
        success: failedTables === 0,
        details: {
          accessibleTables: tableChecks.length - failedTables,
          totalTables: tableChecks.length,
          indexes: indexCount
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  private async checkTRPCEndpoints(): Promise<{ success: boolean; details?: Record<string, unknown>; error?: Error }> {
    try {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

      // Test tRPC endpoint accessibility
      const endpoints = [
        `${baseUrl}/api/trpc/auth.getSession`,
        `${baseUrl}/api/trpc/dashboard.getMetrics`,
      ];

      const results = await Promise.allSettled(
        endpoints.map(async (url) => {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ json: null }),
          });
          return { url, status: response.status };
        })
      );

      const successfulEndpoints = results.filter(
        result => result.status === 'fulfilled' &&
        (result.value.status === 200 || result.value.status === 401 || result.value.status === 403)
      ).length;

      return {
        success: successfulEndpoints > 0,
        details: {
          testedEndpoints: endpoints.length,
          successfulEndpoints,
          endpoints: results.map(r =>
            r.status === 'fulfilled' ? r.value : { error: r.reason.message }
          )
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  private async checkBatchProcessingSystem(): Promise<{ success: boolean; details?: Record<string, unknown>; error?: Error }> {
    try {
      // Check batch processing components
      const batchEnabled = process.env.BATCH_PROCESSING_ENABLED === "true";

      // Test database components
      const batchRequestsCount = await this.prisma.aIBatchRequest.count();
      const processingRequestsCount = await this.prisma.aIProcessingRequest.count();

      // Check if batch processor can be imported
      let batchProcessorAvailable = false;
      try {
        await import("../../lib/batchProcessor");
        batchProcessorAvailable = true;
      } catch {
        // Batch processor not available
      }

      // Check batch status distribution
      const batchStatuses = await this.prisma.aIBatchRequest.groupBy({
        by: ['status'],
        _count: { status: true },
      });

      return {
        success: batchEnabled && batchProcessorAvailable,
        details: {
          enabled: batchEnabled,
          processorAvailable: batchProcessorAvailable,
          batchRequests: batchRequestsCount,
          processingRequests: processingRequestsCount,
          statusDistribution: Object.fromEntries(
            batchStatuses.map(s => [s.status, s._count.status])
          )
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  private async checkOpenAIAccess(): Promise<{ success: boolean; details?: Record<string, unknown>; error?: Error }> {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      const mockMode = process.env.OPENAI_MOCK_MODE === "true";

      if (mockMode) {
        return {
          success: true,
          details: { mode: "mock", available: true }
        };
      }

      if (!apiKey) {
        return {
          success: false,
          error: new Error("OPENAI_API_KEY not configured")
        };
      }

      // Test API with a simple request
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      const responseTime = Date.now();

      return {
        success: response.ok,
        details: {
          mode: "live",
          available: response.ok,
          status: response.status,
          responseTime: responseTime
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  private async checkEnvironmentConfiguration(): Promise<{ success: boolean; details?: Record<string, unknown>; error?: Error }> {
    try {
      const requiredVars = [
        "DATABASE_URL",
        "NEXTAUTH_SECRET",
        "NEXTAUTH_URL"
      ];

      const missingVars = requiredVars.filter(varName => !process.env[varName]);

      const newVars = [
        "BATCH_PROCESSING_ENABLED",
        "TRPC_ENDPOINT_URL",
        "BATCH_CREATE_INTERVAL"
      ];

      const missingNewVars = newVars.filter(varName => !process.env[varName]);

      return {
        success: missingVars.length === 0,
        details: {
          requiredVarsPresent: requiredVars.length - missingVars.length,
          totalRequiredVars: requiredVars.length,
          newVarsPresent: newVars.length - missingNewVars.length,
          totalNewVars: newVars.length,
          missingRequired: missingVars,
          missingNew: missingNewVars
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  private async checkFileSystemAccess(): Promise<{ success: boolean; details?: Record<string, unknown>; error?: Error }> {
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");

      // Test write access to logs directory
      const logsDir = path.join(process.cwd(), "logs");
      const testFile = path.join(logsDir, "health-check.tmp");

      try {
        await fs.mkdir(logsDir, { recursive: true });
        await fs.writeFile(testFile, "health check");
        await fs.unlink(testFile);
      } catch (error) {
        return {
          success: false,
          error: new Error(`Cannot write to logs directory: ${(error as Error).message}`)
        };
      }

      // Test read access to package.json
      try {
        await fs.access(path.join(process.cwd(), "package.json"));
      } catch (error) {
        return {
          success: false,
          error: new Error("Cannot access package.json")
        };
      }

      return {
        success: true,
        details: {
          logsWritable: true,
          packageJsonReadable: true
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  private async checkMemoryUsage(): Promise<{ success: boolean; details?: Record<string, unknown>; error?: Error }> {
    try {
      const memUsage = process.memoryUsage();
      const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const externalMB = Math.round(memUsage.external / 1024 / 1024);

      // Consider memory healthy if heap usage is under 80% of total
      const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      const healthy = usagePercent < 80;

      return {
        success: healthy,
        details: {
          heapUsed: usedMB,
          heapTotal: totalMB,
          external: externalMB,
          usagePercent: Math.round(usagePercent)
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  private async checkCPUUsage(): Promise<{ success: boolean; details?: Record<string, unknown>; error?: Error }> {
    try {
      const cpuUsage = process.cpuUsage();
      const userTime = cpuUsage.user / 1000; // Convert to milliseconds
      const systemTime = cpuUsage.system / 1000;

      // Simple CPU health check - process should be responsive
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 10));
      const responseTime = Date.now() - startTime;

      return {
        success: responseTime < 50, // Should respond within 50ms
        details: {
          userTime,
          systemTime,
          responseTime
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  private async checkApplicationPerformance(): Promise<{ success: boolean; details?: Record<string, unknown>; error?: Error }> {
    try {
      // Test database query performance
      const dbStartTime = Date.now();
      await this.prisma.company.findFirst();
      const dbQueryTime = Date.now() - dbStartTime;

      // Test complex query performance
      const complexStartTime = Date.now();
      await this.prisma.session.findMany({
        include: {
          messages: { take: 5 },
          processingStatus: true,
        },
        take: 10,
      });
      const complexQueryTime = Date.now() - complexStartTime;

      return {
        success: dbQueryTime < 100 && complexQueryTime < 500,
        details: {
          simpleQueryTime: dbQueryTime,
          complexQueryTime: complexQueryTime,
          performanceGood: dbQueryTime < 100 && complexQueryTime < 500
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  private async checkSecurityConfiguration(): Promise<{ success: boolean; details?: Record<string, unknown>; error?: Error }> {
    try {
      const securityIssues: string[] = [];

      // Check NEXTAUTH_SECRET strength
      const secret = process.env.NEXTAUTH_SECRET;
      if (!secret || secret.length < 32) {
        securityIssues.push("Weak NEXTAUTH_SECRET");
      }

      // Check if using secure URLs in production
      if (process.env.NODE_ENV === "production") {
        const url = process.env.NEXTAUTH_URL;
        if (url && !url.startsWith("https://")) {
          securityIssues.push("Non-HTTPS URL in production");
        }
      }

      // Check rate limiting configuration
      if (!process.env.RATE_LIMIT_WINDOW_MS) {
        securityIssues.push("Rate limiting not configured");
      }

      return {
        success: securityIssues.length === 0,
        details: {
          securityIssues,
          hasSecret: !!secret,
          rateLimitConfigured: !!process.env.RATE_LIMIT_WINDOW_MS
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  private async checkLoggingSystem(): Promise<{ success: boolean; details?: Record<string, unknown>; error?: Error }> {
    try {
      // Test if logging works
      const testMessage = `Health check test ${Date.now()}`;
      migrationLogger.debug("HEALTH_TEST", testMessage);

      // Check if log directory exists and is writable
      const fs = await import("node:fs");
      const path = await import("node:path");

      const logsDir = path.join(process.cwd(), "logs");
      const logsDirExists = fs.existsSync(logsDir);

      return {
        success: logsDirExists,
        details: {
          logsDirExists,
          testMessageLogged: true
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  /**
   * Generate health report
   */
  generateHealthReport(result: SystemHealthResult): string {
    const report = `
# System Health Report

**Overall Status**: ${result.success ? '✅ Healthy' : '❌ Unhealthy'}
**Health Score**: ${result.score}/100
**Total Duration**: ${result.totalDuration}ms
**Failed Checks**: ${result.failedChecks}/${result.checks.length}

## Health Check Results

${result.checks.map(check => `
### ${check.name}
- **Status**: ${check.success ? '✅ Pass' : '❌ Fail'}
- **Duration**: ${check.duration}ms
${check.details ? `- **Details**: ${JSON.stringify(check.details, null, 2)}` : ''}
${check.error ? `- **Error**: ${check.error.message}` : ''}
`).join('')}

## Summary

${result.success ?
  '🎉 All health checks passed! The system is operating normally.' :
  `⚠️ ${result.failedChecks} health check(s) failed. Please review and address the issues above.`
}

---
*Generated at ${new Date().toISOString()}*
`;

    return report;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const healthChecker = new HealthChecker();

  const generateReport = process.argv.includes("--report");

  healthChecker.runHealthChecks()
    .then((result) => {
      console.log('\n=== SYSTEM HEALTH CHECK RESULTS ===');
      console.log(`Overall Health: ${result.success ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log(`Health Score: ${result.score}/100`);
      console.log(`Total Duration: ${result.totalDuration}ms`);
      console.log(`Failed Checks: ${result.failedChecks}/${result.checks.length}`);

      console.log('\n=== INDIVIDUAL CHECKS ===');
      for (const check of result.checks) {
        const status = check.success ? '✅' : '❌';
        console.log(`${status} ${check.name} (${check.duration}ms)`);

        if (check.details) {
          console.log(`  Details:`, check.details);
        }

        if (check.error) {
          console.log(`  Error: ${check.error.message}`);
        }
      }

      if (generateReport) {
        const report = healthChecker.generateHealthReport(result);
        const fs = require("node:fs");
        const reportPath = `health-report-${Date.now()}.md`;
        fs.writeFileSync(reportPath, report);
        console.log(`\n📋 Health report saved to: ${reportPath}`);
      }

      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Health checks failed:', error);
      process.exit(1);
    });
}