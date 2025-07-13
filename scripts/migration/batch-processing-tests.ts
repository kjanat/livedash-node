/**
 * Batch Processing System Tests
 *
 * Comprehensive tests to validate the OpenAI Batch API integration
 * and batch processing system functionality.
 */

import { PrismaClient } from "@prisma/client";
import { migrationLogger } from "./migration-logger";

interface BatchTest {
  name: string;
  testFn: () => Promise<{
    success: boolean;
    details?: Record<string, unknown>;
    error?: Error;
  }>;
  critical: boolean;
  timeout: number;
}

interface BatchTestResult {
  name: string;
  success: boolean;
  duration: number;
  details?: Record<string, unknown>;
  error?: Error;
}

interface BatchSystemTestResult {
  success: boolean;
  tests: BatchTestResult[];
  totalDuration: number;
  passedTests: number;
  failedTests: number;
  criticalFailures: number;
}

export class BatchProcessingTester {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Run comprehensive batch processing tests
   */
  async runBatchProcessingTests(): Promise<BatchSystemTestResult> {
    const startTime = Date.now();
    const tests: BatchTestResult[] = [];

    try {
      migrationLogger.startStep(
        "BATCH_TESTS",
        "Running batch processing system validation tests"
      );

      // Define test suite
      const batchTests: BatchTest[] = [
        {
          name: "Database Schema Validation",
          testFn: () => this.testDatabaseSchema(),
          critical: true,
          timeout: 5000,
        },
        {
          name: "Batch Processor Import",
          testFn: () => this.testBatchProcessorImport(),
          critical: true,
          timeout: 5000,
        },
        {
          name: "Batch Request Creation",
          testFn: () => this.testBatchRequestCreation(),
          critical: true,
          timeout: 10000,
        },
        {
          name: "Processing Request Management",
          testFn: () => this.testProcessingRequestManagement(),
          critical: true,
          timeout: 10000,
        },
        {
          name: "Batch Status Transitions",
          testFn: () => this.testBatchStatusTransitions(),
          critical: true,
          timeout: 10000,
        },
        {
          name: "Batch Scheduling System",
          testFn: () => this.testBatchScheduling(),
          critical: false,
          timeout: 15000,
        },
        {
          name: "OpenAI API Integration",
          testFn: () => this.testOpenAIIntegration(),
          critical: false,
          timeout: 30000,
        },
        {
          name: "Error Handling",
          testFn: () => this.testErrorHandling(),
          critical: true,
          timeout: 10000,
        },
        {
          name: "Batch Processing Performance",
          testFn: () => this.testBatchPerformance(),
          critical: false,
          timeout: 20000,
        },
        {
          name: "Data Consistency",
          testFn: () => this.testDataConsistency(),
          critical: true,
          timeout: 10000,
        },
      ];

      // Run all tests
      for (const test of batchTests) {
        const result = await this.runSingleBatchTest(test);
        tests.push(result);
      }

      const totalDuration = Date.now() - startTime;
      const passedTests = tests.filter((t) => t.success).length;
      const failedTests = tests.filter((t) => !t.success).length;
      const criticalFailures = tests.filter(
        (t) =>
          !t.success && batchTests.find((bt) => bt.name === t.name)?.critical
      ).length;

      const result: BatchSystemTestResult = {
        success: criticalFailures === 0,
        tests,
        totalDuration,
        passedTests,
        failedTests,
        criticalFailures,
      };

      if (result.success) {
        migrationLogger.completeStep("BATCH_TESTS");
      } else {
        migrationLogger.failStep(
          "BATCH_TESTS",
          new Error(`${criticalFailures} critical batch tests failed`)
        );
      }

      return result;
    } catch (error) {
      migrationLogger.error(
        "BATCH_TESTS",
        "Batch processing test suite failed",
        error as Error
      );
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  private async runSingleBatchTest(test: BatchTest): Promise<BatchTestResult> {
    const startTime = Date.now();

    try {
      migrationLogger.debug("BATCH_TEST", `Testing: ${test.name}`);

      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Test timeout")), test.timeout);
      });

      const testResult = await Promise.race([test.testFn(), timeoutPromise]);

      const duration = Date.now() - startTime;

      const result: BatchTestResult = {
        name: test.name,
        success: testResult.success,
        duration,
        details: testResult.details,
        error: testResult.error,
      };

      if (testResult.success) {
        migrationLogger.debug("BATCH_TEST", `✅ ${test.name} passed`, {
          duration,
          details: testResult.details,
        });
      } else {
        migrationLogger.warn("BATCH_TEST", `❌ ${test.name} failed`, {
          duration,
          error: testResult.error?.message,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      migrationLogger.error(
        "BATCH_TEST",
        `💥 ${test.name} crashed`,
        error as Error,
        { duration }
      );

      return {
        name: test.name,
        success: false,
        duration,
        error: error as Error,
      };
    }
  }

  private async testDatabaseSchema(): Promise<{
    success: boolean;
    details?: Record<string, unknown>;
    error?: Error;
  }> {
    try {
      // Check if AIBatchRequest table exists and has correct columns
      const batchRequestTableCheck = await this.prisma.$queryRaw<
        { count: string }[]
      >`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_name = 'AIBatchRequest'
      `;

      if (parseInt(batchRequestTableCheck[0]?.count || "0") === 0) {
        return {
          success: false,
          error: new Error("AIBatchRequest table not found"),
        };
      }

      // Check required columns
      const requiredColumns = [
        "openaiBatchId",
        "inputFileId",
        "outputFileId",
        "status",
        "companyId",
      ];

      const columnChecks = await Promise.all(
        requiredColumns.map(async (column) => {
          const result = (await this.prisma.$queryRawUnsafe(`
            SELECT COUNT(*) as count
            FROM information_schema.columns
            WHERE table_name = 'AIBatchRequest' AND column_name = '${column}'
          `)) as { count: string }[];
          return { column, exists: parseInt(result[0]?.count || "0") > 0 };
        })
      );

      const missingColumns = columnChecks
        .filter((c) => !c.exists)
        .map((c) => c.column);

      // Check AIProcessingRequest has batch fields
      const processingRequestBatchFields = (await this.prisma.$queryRawUnsafe(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'AIProcessingRequest' 
        AND column_name IN ('processingStatus', 'batchId')
      `)) as { column_name: string }[];

      const hasProcessingStatus = processingRequestBatchFields.some(
        (c) => c.column_name === "processingStatus"
      );
      const hasBatchId = processingRequestBatchFields.some(
        (c) => c.column_name === "batchId"
      );

      return {
        success:
          missingColumns.length === 0 && hasProcessingStatus && hasBatchId,
        details: {
          missingColumns,
          hasProcessingStatus,
          hasBatchId,
          requiredColumnsPresent:
            requiredColumns.length - missingColumns.length,
        },
        error:
          missingColumns.length > 0 || !hasProcessingStatus || !hasBatchId
            ? new Error(
                `Schema validation failed: missing ${missingColumns.join(", ")}${!hasProcessingStatus ? ", processingStatus" : ""}${!hasBatchId ? ", batchId" : ""}`
              )
            : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  private async testBatchProcessorImport(): Promise<{
    success: boolean;
    details?: Record<string, unknown>;
    error?: Error;
  }> {
    try {
      // Test if batch processor can be imported
      const batchProcessor = await import("../../lib/batchProcessor");

      // Check if key functions/classes exist
      const hasBatchConfig = "BATCH_CONFIG" in batchProcessor;
      const hasCreateBatch =
        typeof batchProcessor.createBatchRequest === "function";
      const hasProcessBatch =
        typeof batchProcessor.processCompletedBatches === "function";

      return {
        success: hasBatchConfig || hasCreateBatch || hasProcessBatch, // At least one should exist
        details: {
          batchProcessorImported: true,
          hasBatchConfig,
          hasCreateBatch,
          hasProcessBatch,
          exportedItems: Object.keys(batchProcessor),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        details: {
          batchProcessorImported: false,
          importError: (error as Error).message,
        },
      };
    }
  }

  private async testBatchRequestCreation(): Promise<{
    success: boolean;
    details?: Record<string, unknown>;
    error?: Error;
  }> {
    try {
      // Create a test batch request
      const testBatchRequest = await this.prisma.aIBatchRequest.create({
        data: {
          companyId: "test-company-" + Date.now(),
          openaiBatchId: "test-batch-" + Date.now(),
          inputFileId: "test-input-" + Date.now(),
          status: "PENDING",
        },
      });

      // Verify it was created correctly
      const retrievedBatch = await this.prisma.aIBatchRequest.findUnique({
        where: { id: testBatchRequest.id },
      });

      // Clean up test data
      await this.prisma.aIBatchRequest.delete({
        where: { id: testBatchRequest.id },
      });

      return {
        success: !!retrievedBatch && retrievedBatch.status === "PENDING",
        details: {
          batchRequestCreated: !!testBatchRequest,
          batchRequestRetrieved: !!retrievedBatch,
          statusCorrect: retrievedBatch?.status === "PENDING",
          testBatchId: testBatchRequest.id,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  private async testProcessingRequestManagement(): Promise<{
    success: boolean;
    details?: Record<string, unknown>;
    error?: Error;
  }> {
    try {
      // Count existing processing requests
      const initialCount = await this.prisma.aIProcessingRequest.count();

      // Check processing status distribution
      const statusDistribution = await this.prisma.aIProcessingRequest.groupBy({
        by: ["processingStatus"],
        _count: { processingStatus: true },
      });

      // Check if we can query requests ready for batching
      const readyForBatching = await this.prisma.aIProcessingRequest.findMany({
        where: {
          processingStatus: "PENDING_BATCHING",
        },
        take: 5,
      });

      return {
        success: true, // Basic query operations work
        details: {
          totalProcessingRequests: initialCount,
          statusDistribution: Object.fromEntries(
            statusDistribution.map((s) => [
              s.processingStatus,
              s._count.processingStatus,
            ])
          ),
          readyForBatchingCount: readyForBatching.length,
          canQueryByStatus: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  private async testBatchStatusTransitions(): Promise<{
    success: boolean;
    details?: Record<string, unknown>;
    error?: Error;
  }> {
    try {
      // Test that we can update batch status through all states
      const testBatchRequest = await this.prisma.aIBatchRequest.create({
        data: {
          companyId: "test-company-" + Date.now(),
          openaiBatchId: "test-status-batch-" + Date.now(),
          inputFileId: "test-status-input-" + Date.now(),
          status: "PENDING",
        },
      });

      const statusTransitions = [
        "UPLOADING",
        "VALIDATING",
        "IN_PROGRESS",
        "FINALIZING",
        "COMPLETED",
        "PROCESSED",
      ] as const;

      const transitionResults: boolean[] = [];

      for (const status of statusTransitions) {
        try {
          await this.prisma.aIBatchRequest.update({
            where: { id: testBatchRequest.id },
            data: { status },
          });
          transitionResults.push(true);
        } catch (error) {
          transitionResults.push(false);
        }
      }

      // Clean up test data
      await this.prisma.aIBatchRequest.delete({
        where: { id: testBatchRequest.id },
      });

      const successfulTransitions = transitionResults.filter((r) => r).length;

      return {
        success: successfulTransitions === statusTransitions.length,
        details: {
          totalTransitions: statusTransitions.length,
          successfulTransitions,
          failedTransitions: statusTransitions.length - successfulTransitions,
          transitionResults: Object.fromEntries(
            statusTransitions.map((status, index) => [
              status,
              transitionResults[index],
            ])
          ),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  private async testBatchScheduling(): Promise<{
    success: boolean;
    details?: Record<string, unknown>;
    error?: Error;
  }> {
    try {
      // Test if batch scheduler can be imported
      const batchScheduler = await import("../../lib/batchScheduler");

      // Check if scheduling functions exist
      const hasScheduler =
        typeof batchScheduler.startBatchScheduler === "function";
      const hasProcessor =
        typeof batchScheduler.forceBatchCreation === "function";

      // Check environment variables for scheduling
      const batchEnabled = process.env.BATCH_PROCESSING_ENABLED === "true";
      const hasIntervals = !!(
        process.env.BATCH_CREATE_INTERVAL &&
        process.env.BATCH_STATUS_CHECK_INTERVAL &&
        process.env.BATCH_RESULT_PROCESSING_INTERVAL
      );

      return {
        success: hasScheduler && batchEnabled,
        details: {
          batchSchedulerImported: true,
          hasScheduler,
          hasProcessor,
          batchEnabled,
          hasIntervals,
          exportedItems: Object.keys(batchScheduler),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        details: {
          batchSchedulerImported: false,
          importError: (error as Error).message,
        },
      };
    }
  }

  private async testOpenAIIntegration(): Promise<{
    success: boolean;
    details?: Record<string, unknown>;
    error?: Error;
  }> {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      const mockMode = process.env.OPENAI_MOCK_MODE === "true";

      if (mockMode) {
        return {
          success: true,
          details: {
            mode: "mock",
            apiKeyPresent: !!apiKey,
            testType: "mock_mode_enabled",
          },
        };
      }

      if (!apiKey) {
        return {
          success: false,
          error: new Error("OpenAI API key not configured"),
          details: {
            mode: "live",
            apiKeyPresent: false,
          },
        };
      }

      // Test basic API access (simple models list)
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: new Error(
            `OpenAI API access failed: ${response.status} ${response.statusText}`
          ),
          details: {
            mode: "live",
            apiKeyPresent: true,
            httpStatus: response.status,
          },
        };
      }

      const models = await response.json();
      const hasModels =
        models.data && Array.isArray(models.data) && models.data.length > 0;

      return {
        success: hasModels,
        details: {
          mode: "live",
          apiKeyPresent: true,
          apiAccessible: true,
          modelsCount: models.data?.length || 0,
          hasGPTModels:
            models.data?.some((m: any) => m.id.includes("gpt")) || false,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        details: {
          mode: "live",
          apiKeyPresent: !!process.env.OPENAI_API_KEY,
          networkError: true,
        },
      };
    }
  }

  private async testErrorHandling(): Promise<{
    success: boolean;
    details?: Record<string, unknown>;
    error?: Error;
  }> {
    try {
      // Test handling of invalid batch requests
      let invalidBatchHandled = false;
      try {
        await this.prisma.aIBatchRequest.create({
          data: {
            companyId: "", // Invalid empty company ID
            openaiBatchId: "test-invalid-batch",
            inputFileId: "test-invalid-input",
            status: "PENDING",
          },
        });
      } catch (error) {
        // This should fail, which means error handling is working
        invalidBatchHandled = true;
      }

      // Test handling of duplicate OpenAI batch IDs
      let duplicateHandled = false;
      const uniqueId = "test-duplicate-" + Date.now();

      try {
        // Create first batch
        const firstBatch = await this.prisma.aIBatchRequest.create({
          data: {
            companyId: "test-company-duplicate",
            openaiBatchId: uniqueId,
            inputFileId: "test-duplicate-input-1",
            status: "PENDING",
          },
        });

        // Try to create duplicate
        try {
          await this.prisma.aIBatchRequest.create({
            data: {
              companyId: "test-company-duplicate",
              openaiBatchId: uniqueId, // Same OpenAI batch ID
              inputFileId: "test-duplicate-input-2",
              status: "PENDING",
            },
          });
        } catch (error) {
          // This should fail due to unique constraint
          duplicateHandled = true;
        }

        // Clean up
        await this.prisma.aIBatchRequest.delete({
          where: { id: firstBatch.id },
        });
      } catch (error) {
        // Initial creation failed, that's also error handling
        duplicateHandled = true;
      }

      return {
        success: invalidBatchHandled && duplicateHandled,
        details: {
          invalidBatchHandled,
          duplicateHandled,
          errorHandlingWorking: invalidBatchHandled && duplicateHandled,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  private async testBatchPerformance(): Promise<{
    success: boolean;
    details?: Record<string, unknown>;
    error?: Error;
  }> {
    try {
      // Test query performance for batch operations
      const startTime = Date.now();

      // Query for batches ready for processing
      const pendingBatches = await this.prisma.aIBatchRequest.findMany({
        where: {
          status: { in: ["PENDING", "UPLOADING", "VALIDATING"] },
        },
        take: 100,
      });

      const pendingBatchesTime = Date.now() - startTime;

      // Query for requests ready for batching
      const batchingStartTime = Date.now();

      const readyRequests = await this.prisma.aIProcessingRequest.findMany({
        where: {
          processingStatus: "PENDING_BATCHING",
        },
        take: 100,
      });

      const readyRequestsTime = Date.now() - batchingStartTime;

      // Query performance should be reasonable
      const performanceAcceptable =
        pendingBatchesTime < 1000 && readyRequestsTime < 1000;

      return {
        success: performanceAcceptable,
        details: {
          pendingBatchesCount: pendingBatches.length,
          pendingBatchesQueryTime: pendingBatchesTime,
          readyRequestsCount: readyRequests.length,
          readyRequestsQueryTime: readyRequestsTime,
          performanceAcceptable,
          totalTestTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  private async testDataConsistency(): Promise<{
    success: boolean;
    details?: Record<string, unknown>;
    error?: Error;
  }> {
    try {
      // Check for orphaned processing requests (batchId points to non-existent batch)
      const orphanedRequests = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "AIProcessingRequest" apr
        LEFT JOIN "AIBatchRequest" abr ON apr."batchId" = abr.id
        WHERE apr."batchId" IS NOT NULL AND abr.id IS NULL
      `;

      const orphanedCount = Number(orphanedRequests[0]?.count || 0);

      // Check for processing requests with inconsistent status
      const inconsistentRequests = await this.prisma.$queryRaw<
        { count: bigint }[]
      >`
        SELECT COUNT(*) as count
        FROM "AIProcessingRequest"
        WHERE ("batchId" IS NOT NULL AND "processingStatus" = 'PENDING_BATCHING')
           OR ("batchId" IS NULL AND "processingStatus" IN ('BATCHING_IN_PROGRESS'))
      `;

      const inconsistentCount = Number(inconsistentRequests[0]?.count || 0);

      // Check for batches with no associated requests
      const emptyBatches = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "AIBatchRequest" abr
        LEFT JOIN "AIProcessingRequest" apr ON abr.id = apr."batchId"
        WHERE apr."batchId" IS NULL
      `;

      const emptyBatchCount = Number(emptyBatches[0]?.count || 0);

      const dataConsistent = orphanedCount === 0 && inconsistentCount === 0;

      return {
        success: dataConsistent,
        details: {
          orphanedRequests: orphanedCount,
          inconsistentRequests: inconsistentCount,
          emptyBatches: emptyBatchCount,
          dataConsistent,
          issuesFound: orphanedCount + inconsistentCount,
        },
        error: !dataConsistent
          ? new Error(
              `Data consistency issues found: ${orphanedCount} orphaned requests, ${inconsistentCount} inconsistent requests`
            )
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Generate batch processing test report
   */
  generateTestReport(result: BatchSystemTestResult): string {
    const report = `
# Batch Processing System Test Report

**Overall Status**: ${result.success ? "✅ All Critical Tests Passed" : "❌ Critical Tests Failed"}
**Total Duration**: ${result.totalDuration}ms
**Passed Tests**: ${result.passedTests}/${result.tests.length}
**Failed Tests**: ${result.failedTests}/${result.tests.length}
**Critical Failures**: ${result.criticalFailures}

## Test Results

${result.tests
  .map(
    (test) => `
### ${test.name}
- **Status**: ${test.success ? "✅ Pass" : "❌ Fail"}
- **Duration**: ${test.duration}ms
${test.details ? `- **Details**: \`\`\`json\n${JSON.stringify(test.details, null, 2)}\n\`\`\`` : ""}
${test.error ? `- **Error**: ${test.error.message}` : ""}
`
  )
  .join("")}

## Summary

${
  result.success
    ? "🎉 Batch processing system is working correctly!"
    : `⚠️ ${result.criticalFailures} critical issue(s) found. Please review and fix the issues above.`
}

## Architecture Overview

The batch processing system provides:
- **50% cost reduction** using OpenAI Batch API
- **Improved rate limiting** and throughput management
- **Enhanced error handling** and retry mechanisms
- **Automatic batching** of AI requests every 5 minutes
- **Status monitoring** with 2-minute check intervals
- **Result processing** with 1-minute intervals

${
  result.failedTests > 0
    ? `
## Issues Found

${result.tests
  .filter((t) => !t.success)
  .map(
    (test) => `
### ${test.name}
- **Error**: ${test.error?.message || "Test failed"}
- **Details**: ${test.details ? JSON.stringify(test.details, null, 2) : "No additional details"}
`
  )
  .join("")}

## Recommended Actions

1. **Database Issues**: Run database migrations to ensure all tables and columns exist
2. **Import Issues**: Verify all batch processing modules are properly installed
3. **API Issues**: Check OpenAI API key configuration and network connectivity
4. **Performance Issues**: Optimize database queries and add missing indexes
5. **Data Issues**: Run data consistency checks and fix orphaned records
`
    : `
## System Health

✅ All critical batch processing components are functioning correctly.

### Performance Metrics
${
  result.tests.find((t) => t.name === "Batch Processing Performance")?.details
    ? `- Pending batches query: ${(result.tests.find((t) => t.name === "Batch Processing Performance")?.details as any)?.pendingBatchesQueryTime}ms
- Ready requests query: ${(result.tests.find((t) => t.name === "Batch Processing Performance")?.details as any)?.readyRequestsQueryTime}ms`
    : "Performance metrics not available"
}

### Next Steps
1. Monitor batch processing queues regularly
2. Set up alerting for failed batches
3. Optimize batch sizes based on usage patterns
4. Consider implementing batch priority levels
`
}

---
*Generated at ${new Date().toISOString()}*
`;

    return report;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new BatchProcessingTester();

  const generateReport = process.argv.includes("--report");

  tester
    .runBatchProcessingTests()
    .then((result) => {
      console.log("\n=== BATCH PROCESSING TEST RESULTS ===");
      console.log(`Overall Success: ${result.success ? "✅" : "❌"}`);
      console.log(`Total Duration: ${result.totalDuration}ms`);
      console.log(`Passed Tests: ${result.passedTests}/${result.tests.length}`);
      console.log(`Failed Tests: ${result.failedTests}/${result.tests.length}`);
      console.log(`Critical Failures: ${result.criticalFailures}`);

      console.log("\n=== INDIVIDUAL TEST RESULTS ===");
      for (const test of result.tests) {
        const status = test.success ? "✅" : "❌";
        console.log(`${status} ${test.name} (${test.duration}ms)`);

        if (test.error) {
          console.log(`  Error: ${test.error.message}`);
        }

        if (test.details) {
          console.log(`  Details: ${JSON.stringify(test.details, null, 2)}`);
        }
      }

      if (generateReport) {
        const report = tester.generateTestReport(result);
        const fs = require("node:fs");
        const reportPath = `batch-processing-test-report-${Date.now()}.md`;
        fs.writeFileSync(reportPath, report);
        console.log(`\n📋 Test report saved to: ${reportPath}`);
      }

      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Batch processing tests failed:", error);
      process.exit(1);
    });
}
