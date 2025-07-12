/**
 * tRPC Endpoint Validation Tests
 *
 * Comprehensive tests to validate tRPC endpoints are working correctly
 * after deployment of the new architecture.
 */

import { migrationLogger } from "./migration-logger";

interface EndpointTest {
  name: string;
  path: string;
  method: string;
  payload?: unknown;
  expectedStatuses: number[];
  timeout: number;
  critical: boolean;
}

interface TestResult {
  name: string;
  success: boolean;
  status: number;
  duration: number;
  response?: unknown;
  error?: Error;
}

interface TRPCTestResult {
  success: boolean;
  tests: TestResult[];
  totalDuration: number;
  passedTests: number;
  failedTests: number;
  criticalFailures: number;
}

export class TRPCEndpointTester {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl?: string, timeout: number = 30000) {
    this.baseUrl =
      baseUrl || process.env.NEXTAUTH_URL || "http://localhost:3000";
    this.timeout = timeout;
  }

  /**
   * Run comprehensive tRPC endpoint tests
   */
  async runEndpointTests(): Promise<TRPCTestResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];

    try {
      migrationLogger.startStep(
        "TRPC_TESTS",
        "Running tRPC endpoint validation tests"
      );

      // Define test suite
      const endpointTests: EndpointTest[] = [
        // Authentication endpoints
        {
          name: "Auth - Get Session",
          path: "/api/trpc/auth.getSession",
          method: "POST",
          payload: { json: null },
          expectedStatuses: [200, 401], // 401 is OK for unauthenticated requests
          timeout: 5000,
          critical: true,
        },

        // Dashboard endpoints
        {
          name: "Dashboard - Get Metrics",
          path: "/api/trpc/dashboard.getMetrics",
          method: "POST",
          payload: { json: { dateRange: "7d" } },
          expectedStatuses: [200, 401, 403],
          timeout: 10000,
          critical: true,
        },

        {
          name: "Dashboard - Get Sessions",
          path: "/api/trpc/dashboard.getSessions",
          method: "POST",
          payload: {
            json: {
              page: 1,
              pageSize: 10,
              filters: {},
            },
          },
          expectedStatuses: [200, 401, 403],
          timeout: 10000,
          critical: true,
        },

        {
          name: "Dashboard - Get Session Filter Options",
          path: "/api/trpc/dashboard.getSessionFilterOptions",
          method: "POST",
          payload: { json: null },
          expectedStatuses: [200, 401, 403],
          timeout: 5000,
          critical: false,
        },

        // Admin endpoints
        {
          name: "Admin - Get System Health",
          path: "/api/trpc/admin.getSystemHealth",
          method: "POST",
          payload: { json: null },
          expectedStatuses: [200, 401, 403],
          timeout: 15000,
          critical: false,
        },

        {
          name: "Admin - Get Processing Status",
          path: "/api/trpc/admin.getProcessingStatus",
          method: "POST",
          payload: { json: null },
          expectedStatuses: [200, 401, 403],
          timeout: 10000,
          critical: false,
        },

        // Batch request endpoints (if available)
        {
          name: "Admin - Get Batch Requests",
          path: "/api/trpc/admin.getBatchRequests",
          method: "POST",
          payload: { json: { page: 1, pageSize: 10 } },
          expectedStatuses: [200, 401, 403, 404], // 404 OK if endpoint doesn't exist yet
          timeout: 10000,
          critical: false,
        },

        // Test invalid endpoint (should return 404)
        {
          name: "Invalid Endpoint Test",
          path: "/api/trpc/nonexistent.invalidMethod",
          method: "POST",
          payload: { json: null },
          expectedStatuses: [404, 400],
          timeout: 5000,
          critical: false,
        },
      ];

      // Run all tests
      for (const test of endpointTests) {
        const result = await this.runSingleTest(test);
        tests.push(result);
      }

      const totalDuration = Date.now() - startTime;
      const passedTests = tests.filter((t) => t.success).length;
      const failedTests = tests.filter((t) => !t.success).length;
      const criticalFailures = tests.filter(
        (t) =>
          !t.success && endpointTests.find((et) => et.name === t.name)?.critical
      ).length;

      const result: TRPCTestResult = {
        success: criticalFailures === 0,
        tests,
        totalDuration,
        passedTests,
        failedTests,
        criticalFailures,
      };

      if (result.success) {
        migrationLogger.completeStep("TRPC_TESTS");
      } else {
        migrationLogger.failStep(
          "TRPC_TESTS",
          new Error(`${criticalFailures} critical tRPC tests failed`)
        );
      }

      return result;
    } catch (error) {
      migrationLogger.error(
        "TRPC_TESTS",
        "tRPC test suite failed",
        error as Error
      );
      throw error;
    }
  }

  private async runSingleTest(test: EndpointTest): Promise<TestResult> {
    const startTime = Date.now();

    try {
      migrationLogger.debug("TRPC_TEST", `Testing: ${test.name}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), test.timeout);

      const url = `${this.baseUrl}${test.path}`;
      const response = await fetch(url, {
        method: test.method,
        headers: {
          "Content-Type": "application/json",
        },
        body: test.payload ? JSON.stringify(test.payload) : null,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      // Check if status is expected
      const success = test.expectedStatuses.includes(response.status);

      let responseData: unknown;
      try {
        responseData = await response.json();
      } catch {
        // Response might not be JSON, that's OK
        responseData = await response.text();
      }

      const result: TestResult = {
        name: test.name,
        success,
        status: response.status,
        duration,
        response: responseData,
      };

      if (success) {
        migrationLogger.debug("TRPC_TEST", `✅ ${test.name} passed`, {
          status: response.status,
          duration,
        });
      } else {
        migrationLogger.warn("TRPC_TEST", `❌ ${test.name} failed`, {
          status: response.status,
          expected: test.expectedStatuses,
          duration,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      migrationLogger.error(
        "TRPC_TEST",
        `💥 ${test.name} crashed`,
        error as Error,
        { duration }
      );

      return {
        name: test.name,
        success: false,
        status: 0,
        duration,
        error: error as Error,
      };
    }
  }

  /**
   * Test tRPC batch requests
   */
  async testBatchRequests(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      migrationLogger.info("TRPC_BATCH", "Testing tRPC batch requests");

      // Create a batch request with multiple calls
      const batchPayload = [
        {
          id: 1,
          jsonrpc: "2.0",
          method: "query",
          params: {
            path: "auth.getSession",
            input: { json: null },
          },
        },
        {
          id: 2,
          jsonrpc: "2.0",
          method: "query",
          params: {
            path: "dashboard.getMetrics",
            input: { json: { dateRange: "7d" } },
          },
        },
      ];

      const response = await fetch(`${this.baseUrl}/api/trpc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batchPayload),
      });

      const duration = Date.now() - startTime;
      const responseData = await response.json();

      // Batch requests should return an array of responses
      const success =
        response.ok && Array.isArray(responseData) && responseData.length === 2;

      return {
        name: "tRPC Batch Requests",
        success,
        status: response.status,
        duration,
        response: responseData,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        name: "tRPC Batch Requests",
        success: false,
        status: 0,
        duration,
        error: error as Error,
      };
    }
  }

  /**
   * Test tRPC subscription endpoints (if available)
   */
  async testSubscriptions(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      migrationLogger.info("TRPC_SUBSCRIPTIONS", "Testing tRPC subscriptions");

      // Test if WebSocket connection is available for subscriptions
      const wsUrl = this.baseUrl.replace(/^https?/, "ws") + "/api/trpc";

      return new Promise<TestResult>((resolve) => {
        try {
          const ws = new WebSocket(wsUrl);

          const timeout = setTimeout(() => {
            ws.close();
            resolve({
              name: "tRPC Subscriptions",
              success: false,
              status: 0,
              duration: Date.now() - startTime,
              error: new Error("WebSocket connection timeout"),
            });
          }, 5000);

          ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve({
              name: "tRPC Subscriptions",
              success: true,
              status: 200,
              duration: Date.now() - startTime,
            });
          };

          ws.onerror = (error) => {
            clearTimeout(timeout);
            resolve({
              name: "tRPC Subscriptions",
              success: false,
              status: 0,
              duration: Date.now() - startTime,
              error: new Error("WebSocket connection failed"),
            });
          };
        } catch (error) {
          resolve({
            name: "tRPC Subscriptions",
            success: false,
            status: 0,
            duration: Date.now() - startTime,
            error: error as Error,
          });
        }
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        name: "tRPC Subscriptions",
        success: false,
        status: 0,
        duration,
        error: error as Error,
      };
    }
  }

  /**
   * Generate test report
   */
  generateTestReport(result: TRPCTestResult): string {
    const report = `
# tRPC Endpoint Test Report

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
- **HTTP Status**: ${test.status}
- **Duration**: ${test.duration}ms
${test.error ? `- **Error**: ${test.error.message}` : ""}
${test.response && typeof test.response === "object" ? `- **Response**: \`\`\`json\n${JSON.stringify(test.response, null, 2)}\n\`\`\`` : ""}
`
  )
  .join("")}

## Summary

${
  result.success
    ? "🎉 All critical tRPC endpoints are working correctly!"
    : `⚠️ ${result.criticalFailures} critical endpoint(s) failed. Please review and fix the issues above.`
}

## Recommendations

${
  result.failedTests > 0
    ? `
### Failed Tests Analysis
${result.tests
  .filter((t) => !t.success)
  .map(
    (test) => `
- **${test.name}**: ${test.error?.message || `HTTP ${test.status}`}
`
  )
  .join("")}

### Next Steps
1. Check server logs for detailed error information
2. Verify tRPC router configuration
3. Ensure all required dependencies are installed
4. Validate environment configuration
5. Test endpoints manually if needed
`
    : `
### Optimization Opportunities
1. Monitor response times for performance optimization
2. Consider implementing caching for frequently accessed endpoints
3. Add monitoring and alerting for endpoint health
4. Implement rate limiting if not already in place
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
  const baseUrl = process.argv[2];
  const tester = new TRPCEndpointTester(baseUrl);

  const generateReport = process.argv.includes("--report");
  const testBatch = process.argv.includes("--batch");
  const testSubscriptions = process.argv.includes("--subscriptions");

  const runTests = async () => {
    // Run main endpoint tests
    const result = await tester.runEndpointTests();

    // Run additional tests if requested
    if (testBatch) {
      const batchResult = await tester.testBatchRequests();
      result.tests.push(batchResult);
      if (!batchResult.success) {
        result.failedTests++;
      } else {
        result.passedTests++;
      }
    }

    if (testSubscriptions) {
      const subscriptionResult = await tester.testSubscriptions();
      result.tests.push(subscriptionResult);
      if (!subscriptionResult.success) {
        result.failedTests++;
      } else {
        result.passedTests++;
      }
    }

    return result;
  }

  runTests()
    .then((result) => {
      console.log("\n=== tRPC ENDPOINT TEST RESULTS ===");
      console.log(`Overall Success: ${result.success ? "✅" : "❌"}`);
      console.log(`Total Duration: ${result.totalDuration}ms`);
      console.log(`Passed Tests: ${result.passedTests}/${result.tests.length}`);
      console.log(`Failed Tests: ${result.failedTests}/${result.tests.length}`);
      console.log(`Critical Failures: ${result.criticalFailures}`);

      console.log("\n=== INDIVIDUAL TEST RESULTS ===");
      for (const test of result.tests) {
        const status = test.success ? "✅" : "❌";
        console.log(
          `${status} ${test.name} (HTTP ${test.status}, ${test.duration}ms)`
        );

        if (test.error) {
          console.log(`  Error: ${test.error.message}`);
        }
      }

      if (generateReport) {
        const report = tester.generateTestReport(result);
        const fs = require("node:fs");
        const reportPath = `trpc-test-report-${Date.now()}.md`;
        fs.writeFileSync(reportPath, report);
        console.log(`\n📋 Test report saved to: ${reportPath}`);
      }

      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("tRPC endpoint tests failed:", error);
      process.exit(1);
    });
}
