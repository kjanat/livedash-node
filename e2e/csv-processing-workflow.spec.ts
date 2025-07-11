/**
 * E2E tests for CSV upload and session processing workflow
 *
 * Tests the complete data processing pipeline:
 * 1. CSV import configuration
 * 2. Data import and validation
 * 3. Session processing and AI analysis
 * 4. Dashboard visualization
 * 5. Data filtering and search
 */

import { test, expect, type Page } from "@playwright/test";

// Test data
const testAdmin = {
  email: "admin@csvtest.com",
  password: "AdminTestPassword123!",
};

const mockCsvData = `sessionId,userId,language,country,ipAddress,sentiment,messagesSent,startTime,endTime,escalated,forwardedHr,summary
session1,user1,en,US,192.168.1.1,positive,5,2024-01-15T10:00:00Z,2024-01-15T10:30:00Z,false,false,User requested vacation time
session2,user2,nl,NL,192.168.1.2,neutral,3,2024-01-15T11:00:00Z,2024-01-15T11:20:00Z,true,false,User had login issues
session3,user3,de,DE,192.168.1.3,negative,8,2024-01-15T12:00:00Z,2024-01-15T12:45:00Z,false,true,User complained about salary`;

// Helper functions
async function loginAsAdmin(page: Page) {
  await page.goto("http://localhost:3000/login");
  await page.fill('[data-testid="email"]', testAdmin.email);
  await page.fill('[data-testid="password"]', testAdmin.password);
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL(/\/dashboard/);
}

async function waitForDataProcessing(page: Page, timeout = 30000) {
  // Wait for processing indicators to disappear
  await page.waitForSelector('[data-testid="processing-indicator"]', {
    state: "hidden",
    timeout,
  });
}

async function setupMockCsvEndpoint(page: Page) {
  // Mock the CSV endpoint to return test data
  await page.route("**/test-csv-data", (route) => {
    route.fulfill({
      status: 200,
      contentType: "text/csv",
      body: mockCsvData,
    });
  });
}

test.describe("CSV Processing Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Setup mock CSV endpoint
    await setupMockCsvEndpoint(page);

    // Login as admin
    await loginAsAdmin(page);
  });

  test.describe("CSV Import Configuration", () => {
    test("should configure CSV import settings", async ({ page }) => {
      // Navigate to company settings
      await page.click('[data-testid="nav-company"]');
      await expect(page).toHaveURL(/\/dashboard\/company/);

      // Update CSV configuration
      await page.fill(
        '[data-testid="csv-url"]',
        "http://localhost:3000/api/test-csv-data"
      );
      await page.fill('[data-testid="csv-username"]', "testuser");
      await page.fill('[data-testid="csv-password"]', "testpass");

      // Save settings
      await page.click('[data-testid="save-settings"]');

      // Should show success message
      await expect(
        page.locator('[data-testid="success-message"]')
      ).toContainText("Settings saved successfully");
    });

    test("should validate CSV URL format", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/company");

      // Enter invalid URL
      await page.fill('[data-testid="csv-url"]', "invalid-url");
      await page.click('[data-testid="save-settings"]');

      // Should show validation error
      await expect(page.locator('[data-testid="csv-url-error"]')).toContainText(
        "Invalid URL format"
      );
    });
  });

  test.describe("Manual CSV Import", () => {
    test.beforeEach(async ({ page }) => {
      // Configure CSV settings first
      await page.goto("http://localhost:3000/dashboard/company");
      await page.fill(
        '[data-testid="csv-url"]',
        "http://localhost:3000/api/test-csv-data"
      );
      await page.click('[data-testid="save-settings"]');
      await expect(
        page.locator('[data-testid="success-message"]')
      ).toBeVisible();
    });

    test("should trigger manual CSV import", async ({ page }) => {
      // Navigate to overview
      await page.goto("http://localhost:3000/dashboard/overview");

      // Trigger manual refresh
      await page.click('[data-testid="refresh-data-button"]');

      // Should show processing indicator
      await expect(
        page.locator('[data-testid="processing-indicator"]')
      ).toBeVisible();

      // Wait for processing to complete
      await waitForDataProcessing(page);

      // Should show success message
      await expect(
        page.locator('[data-testid="import-success"]')
      ).toContainText("Data imported successfully");
    });

    test("should display import progress", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/overview");

      // Start import
      await page.click('[data-testid="refresh-data-button"]');

      // Check progress indicators
      await expect(
        page.locator('[data-testid="import-progress"]')
      ).toBeVisible();

      // Progress should show stages
      await expect(
        page.locator('[data-testid="stage-csv-import"]')
      ).toContainText("CSV Import");
      await expect(
        page.locator('[data-testid="stage-processing"]')
      ).toContainText("Processing");
      await expect(
        page.locator('[data-testid="stage-ai-analysis"]')
      ).toContainText("AI Analysis");
    });

    test("should handle import errors gracefully", async ({ page }) => {
      // Configure invalid CSV URL
      await page.goto("http://localhost:3000/dashboard/company");
      await page.fill(
        '[data-testid="csv-url"]',
        "http://localhost:3000/api/nonexistent-csv"
      );
      await page.click('[data-testid="save-settings"]');

      // Try to import
      await page.goto("http://localhost:3000/dashboard/overview");
      await page.click('[data-testid="refresh-data-button"]');

      // Should show error message
      await expect(page.locator('[data-testid="import-error"]')).toContainText(
        "Failed to fetch CSV data"
      );
    });
  });

  test.describe("Data Visualization", () => {
    test.beforeEach(async ({ page }) => {
      // Import test data first
      await page.goto("http://localhost:3000/dashboard/company");
      await page.fill(
        '[data-testid="csv-url"]',
        "http://localhost:3000/api/test-csv-data"
      );
      await page.click('[data-testid="save-settings"]');

      await page.goto("http://localhost:3000/dashboard/overview");
      await page.click('[data-testid="refresh-data-button"]');
      await waitForDataProcessing(page);
    });

    test("should display session metrics correctly", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/overview");

      // Check metric cards show correct data
      await expect(
        page.locator('[data-testid="total-sessions"]')
      ).toContainText("3");

      // Check sentiment distribution
      const sentimentChart = page.locator('[data-testid="sentiment-chart"]');
      await expect(sentimentChart).toBeVisible();

      // Verify sentiment data
      await expect(
        page.locator('[data-testid="positive-sentiment"]')
      ).toContainText("1");
      await expect(
        page.locator('[data-testid="neutral-sentiment"]')
      ).toContainText("1");
      await expect(
        page.locator('[data-testid="negative-sentiment"]')
      ).toContainText("1");
    });

    test("should display geographic distribution", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/overview");

      // Check geographic map
      const geoMap = page.locator('[data-testid="geographic-map"]');
      await expect(geoMap).toBeVisible();

      // Check country data
      await expect(page.locator('[data-testid="country-us"]')).toContainText(
        "US: 1"
      );
      await expect(page.locator('[data-testid="country-nl"]')).toContainText(
        "NL: 1"
      );
      await expect(page.locator('[data-testid="country-de"]')).toContainText(
        "DE: 1"
      );
    });

    test("should display escalation metrics", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/overview");

      // Check escalation rate
      await expect(
        page.locator('[data-testid="escalation-rate"]')
      ).toContainText("33%");

      // Check HR forwarding rate
      await expect(
        page.locator('[data-testid="hr-forwarding-rate"]')
      ).toContainText("33%");
    });
  });

  test.describe("Session Management", () => {
    test.beforeEach(async ({ page }) => {
      // Import test data
      await page.goto("http://localhost:3000/dashboard/company");
      await page.fill(
        '[data-testid="csv-url"]',
        "http://localhost:3000/api/test-csv-data"
      );
      await page.click('[data-testid="save-settings"]');

      await page.goto("http://localhost:3000/dashboard/overview");
      await page.click('[data-testid="refresh-data-button"]');
      await waitForDataProcessing(page);
    });

    test("should display sessions list", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/sessions");

      // Should show all sessions
      await expect(page.locator('[data-testid="session-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="session-item"]')).toHaveCount(3);

      // Check session details
      const firstSession = page.locator('[data-testid="session-item"]').first();
      await expect(firstSession).toContainText("session1");
      await expect(firstSession).toContainText("positive");
      await expect(firstSession).toContainText("US");
    });

    test("should filter sessions by sentiment", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/sessions");

      // Filter by positive sentiment
      await page.selectOption('[data-testid="sentiment-filter"]', "POSITIVE");

      // Should show only positive sessions
      await expect(page.locator('[data-testid="session-item"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="session-item"]')).toContainText(
        "session1"
      );
    });

    test("should filter sessions by country", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/sessions");

      // Filter by Germany
      await page.selectOption('[data-testid="country-filter"]', "DE");

      // Should show only German sessions
      await expect(page.locator('[data-testid="session-item"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="session-item"]')).toContainText(
        "session3"
      );
    });

    test("should search sessions by content", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/sessions");

      // Search for "vacation"
      await page.fill('[data-testid="search-input"]', "vacation");

      // Should show matching sessions
      await expect(page.locator('[data-testid="session-item"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="session-item"]')).toContainText(
        "vacation time"
      );
    });

    test("should paginate sessions", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/sessions");

      // Set small page size
      await page.selectOption('[data-testid="page-size"]', "2");

      // Should show pagination
      await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
      await expect(page.locator('[data-testid="session-item"]')).toHaveCount(2);

      // Go to next page
      await page.click('[data-testid="next-page"]');
      await expect(page.locator('[data-testid="session-item"]')).toHaveCount(1);
    });
  });

  test.describe("Session Details", () => {
    test.beforeEach(async ({ page }) => {
      // Import test data
      await page.goto("http://localhost:3000/dashboard/company");
      await page.fill(
        '[data-testid="csv-url"]',
        "http://localhost:3000/api/test-csv-data"
      );
      await page.click('[data-testid="save-settings"]');

      await page.goto("http://localhost:3000/dashboard/overview");
      await page.click('[data-testid="refresh-data-button"]');
      await waitForDataProcessing(page);
    });

    test("should view individual session details", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/sessions");

      // Click on first session
      await page.click('[data-testid="session-item"]');

      // Should navigate to session detail page
      await expect(page).toHaveURL(/\/dashboard\/sessions\/[^/]+/);

      // Check session details
      await expect(page.locator('[data-testid="session-id"]')).toContainText(
        "session1"
      );
      await expect(
        page.locator('[data-testid="sentiment-badge"]')
      ).toContainText("positive");
      await expect(page.locator('[data-testid="country-badge"]')).toContainText(
        "US"
      );
      await expect(
        page.locator('[data-testid="session-summary"]')
      ).toContainText("vacation time");
    });

    test("should display session timeline", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/sessions");
      await page.click('[data-testid="session-item"]');

      // Check timeline
      const timeline = page.locator('[data-testid="session-timeline"]');
      await expect(timeline).toBeVisible();

      // Should show start and end times
      await expect(page.locator('[data-testid="start-time"]')).toContainText(
        "10:00"
      );
      await expect(page.locator('[data-testid="end-time"]')).toContainText(
        "10:30"
      );
      await expect(page.locator('[data-testid="duration"]')).toContainText(
        "30 minutes"
      );
    });

    test("should display extracted questions", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/sessions");
      await page.click('[data-testid="session-item"]');

      // Check questions section
      const questionsSection = page.locator(
        '[data-testid="extracted-questions"]'
      );
      await expect(questionsSection).toBeVisible();

      // Should show AI-extracted questions (if any)
      const questionsList = page.locator('[data-testid="questions-list"]');
      if (await questionsList.isVisible()) {
        await expect(
          questionsList.locator('[data-testid="question-item"]')
        ).toHaveCount.greaterThan(0);
      }
    });
  });

  test.describe("Real-time Updates", () => {
    test("should show real-time processing status", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/overview");

      // Configure CSV
      await page.goto("http://localhost:3000/dashboard/company");
      await page.fill(
        '[data-testid="csv-url"]',
        "http://localhost:3000/api/test-csv-data"
      );
      await page.click('[data-testid="save-settings"]');

      // Start import and monitor status
      await page.goto("http://localhost:3000/dashboard/overview");
      await page.click('[data-testid="refresh-data-button"]');

      // Should show real-time status updates
      await expect(
        page.locator('[data-testid="status-importing"]')
      ).toBeVisible();

      // Status should progress through stages
      await page.waitForSelector('[data-testid="status-processing"]', {
        timeout: 10000,
      });
      await page.waitForSelector('[data-testid="status-analyzing"]', {
        timeout: 10000,
      });
      await page.waitForSelector('[data-testid="status-complete"]', {
        timeout: 30000,
      });
    });

    test("should update metrics in real-time", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/overview");

      // Get initial metrics
      const initialSessions = await page
        .locator('[data-testid="total-sessions"]')
        .textContent();

      // Import data
      await page.goto("http://localhost:3000/dashboard/company");
      await page.fill(
        '[data-testid="csv-url"]',
        "http://localhost:3000/api/test-csv-data"
      );
      await page.click('[data-testid="save-settings"]');

      await page.goto("http://localhost:3000/dashboard/overview");
      await page.click('[data-testid="refresh-data-button"]');
      await waitForDataProcessing(page);

      // Metrics should be updated
      const updatedSessions = await page
        .locator('[data-testid="total-sessions"]')
        .textContent();
      expect(updatedSessions).not.toBe(initialSessions);
    });
  });

  test.describe("Error Handling", () => {
    test("should handle CSV parsing errors", async ({ page }) => {
      // Mock invalid CSV data
      await page.route("**/invalid-csv", (route) => {
        route.fulfill({
          status: 200,
          contentType: "text/csv",
          body: "invalid,csv,format\nwithout,proper,headers",
        });
      });

      await page.goto("http://localhost:3000/dashboard/company");
      await page.fill(
        '[data-testid="csv-url"]',
        "http://localhost:3000/api/invalid-csv"
      );
      await page.click('[data-testid="save-settings"]');

      await page.goto("http://localhost:3000/dashboard/overview");
      await page.click('[data-testid="refresh-data-button"]');

      // Should show parsing error
      await expect(page.locator('[data-testid="parsing-error"]')).toContainText(
        "Invalid CSV format"
      );
    });

    test("should handle AI processing failures", async ({ page }) => {
      // Mock AI service failure
      await page.route("**/api/openai/**", (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: "AI service unavailable" }),
        });
      });

      await page.goto("http://localhost:3000/dashboard/company");
      await page.fill(
        '[data-testid="csv-url"]',
        "http://localhost:3000/api/test-csv-data"
      );
      await page.click('[data-testid="save-settings"]');

      await page.goto("http://localhost:3000/dashboard/overview");
      await page.click('[data-testid="refresh-data-button"]');

      // Should show AI processing error
      await expect(page.locator('[data-testid="ai-error"]')).toContainText(
        "AI analysis failed"
      );
    });

    test("should retry failed operations", async ({ page }) => {
      let attemptCount = 0;

      // Mock failing then succeeding API
      await page.route("**/api/process-batch", (route) => {
        attemptCount++;
        if (attemptCount === 1) {
          route.fulfill({ status: 500, body: "Server error" });
        } else {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ success: true }),
          });
        }
      });

      await page.goto("http://localhost:3000/dashboard/overview");
      await page.click('[data-testid="refresh-data-button"]');

      // Should show retry attempt
      await expect(
        page.locator('[data-testid="retry-indicator"]')
      ).toBeVisible();

      // Should eventually succeed
      await waitForDataProcessing(page);
      await expect(
        page.locator('[data-testid="import-success"]')
      ).toBeVisible();
    });
  });
});
