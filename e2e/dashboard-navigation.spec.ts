/**
 * E2E tests for dashboard navigation and data visualization
 *
 * Tests the dashboard user experience:
 * 1. Navigation between dashboard sections
 * 2. Data visualization components
 * 3. Interactive filtering and search
 * 4. Responsive design
 * 5. Accessibility features
 */

import { test, expect, type Page } from "@playwright/test";

// Test data
const testUser = {
  email: "dashboard@test.com",
  password: "DashboardTest123!",
};

// Helper functions
async function loginUser(page: Page) {
  await page.goto("http://localhost:3000/login");
  await page.fill('[data-testid="email"]', testUser.email);
  await page.fill('[data-testid="password"]', testUser.password);
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL(/\/dashboard/);
}

async function waitForChartLoad(page: Page, chartSelector: string) {
  await page.waitForSelector(chartSelector);
  await page.waitForFunction(
    (selector) => {
      const chart = document.querySelector(selector);
      return chart && chart.children.length > 0;
    },
    chartSelector
  );
}

test.describe("Dashboard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test.describe("Navigation Menu", () => {
    test("should display main navigation menu", async ({ page }) => {
      // Check navigation sidebar
      const nav = page.locator('[data-testid="main-navigation"]');
      await expect(nav).toBeVisible();

      // Check navigation items
      await expect(page.locator('[data-testid="nav-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-sessions"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-users"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-company"]')).toBeVisible();
    });

    test("should highlight active navigation item", async ({ page }) => {
      // Overview should be active by default
      await expect(page.locator('[data-testid="nav-overview"]')).toHaveClass(/active/);

      // Navigate to sessions
      await page.click('[data-testid="nav-sessions"]');
      await expect(page.locator('[data-testid="nav-sessions"]')).toHaveClass(/active/);
      await expect(page.locator('[data-testid="nav-overview"]')).not.toHaveClass(/active/);
    });

    test("should navigate between sections correctly", async ({ page }) => {
      // Navigate to Sessions
      await page.click('[data-testid="nav-sessions"]');
      await expect(page).toHaveURL(/\/dashboard\/sessions/);
      await expect(page.locator('h1')).toContainText('Sessions');

      // Navigate to Users
      await page.click('[data-testid="nav-users"]');
      await expect(page).toHaveURL(/\/dashboard\/users/);
      await expect(page.locator('h1')).toContainText('Users');

      // Navigate to Company
      await page.click('[data-testid="nav-company"]');
      await expect(page).toHaveURL(/\/dashboard\/company/);
      await expect(page.locator('h1')).toContainText('Company Settings');

      // Navigate back to Overview
      await page.click('[data-testid="nav-overview"]');
      await expect(page).toHaveURL(/\/dashboard\/overview/);
      await expect(page.locator('h1')).toContainText('Dashboard Overview');
    });

    test("should support breadcrumb navigation", async ({ page }) => {
      // Navigate to sessions and then a specific session
      await page.click('[data-testid="nav-sessions"]');

      // Mock a session item click (assuming sessions exist)
      const sessionItems = page.locator('[data-testid="session-item"]');
      const sessionCount = await sessionItems.count();

      if (sessionCount > 0) {
        await sessionItems.first().click();

        // Check breadcrumbs
        await expect(page.locator('[data-testid="breadcrumb"]')).toBeVisible();
        await expect(page.locator('[data-testid="breadcrumb-home"]')).toContainText('Dashboard');
        await expect(page.locator('[data-testid="breadcrumb-sessions"]')).toContainText('Sessions');
        await expect(page.locator('[data-testid="breadcrumb-current"]')).toContainText('Session Details');
      }
    });
  });

  test.describe("Header Navigation", () => {
    test("should display user menu", async ({ page }) => {
      // Check user menu trigger
      const userMenu = page.locator('[data-testid="user-menu"]');
      await expect(userMenu).toBeVisible();

      // Open user menu
      await userMenu.click();

      // Check menu items
      await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-settings"]')).toBeVisible();
      await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();
    });

    test("should display notifications", async ({ page }) => {
      const notifications = page.locator('[data-testid="notifications"]');

      if (await notifications.isVisible()) {
        await notifications.click();
        await expect(page.locator('[data-testid="notifications-dropdown"]')).toBeVisible();
      }
    });

    test("should display search functionality", async ({ page }) => {
      const searchInput = page.locator('[data-testid="global-search"]');

      if (await searchInput.isVisible()) {
        await searchInput.fill('test search');
        await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      }
    });
  });

  test.describe("Page Titles and Metadata", () => {
    test("should update page title for each section", async ({ page }) => {
      // Overview page
      await page.goto("http://localhost:3000/dashboard/overview");
      await expect(page).toHaveTitle(/Dashboard Overview/);

      // Sessions page
      await page.goto("http://localhost:3000/dashboard/sessions");
      await expect(page).toHaveTitle(/Sessions/);

      // Users page
      await page.goto("http://localhost:3000/dashboard/users");
      await expect(page).toHaveTitle(/Users/);
    });
  });
});

test.describe("Data Visualization", () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await page.goto("http://localhost:3000/dashboard/overview");
  });

  test.describe("Overview Dashboard", () => {
    test("should display key metrics cards", async ({ page }) => {
      // Check metric cards
      await expect(page.locator('[data-testid="total-sessions-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="avg-sentiment-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="escalation-rate-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="avg-response-time-card"]')).toBeVisible();

      // Check that metrics have values
      const totalSessions = page.locator('[data-testid="total-sessions-value"]');
      await expect(totalSessions).toContainText(/\d+/); // Should contain numbers
    });

    test("should display sentiment distribution chart", async ({ page }) => {
      const sentimentChart = page.locator('[data-testid="sentiment-chart"]');
      await expect(sentimentChart).toBeVisible();

      await waitForChartLoad(page, '[data-testid="sentiment-chart"]');

      // Check chart has data
      await expect(page.locator('[data-testid="positive-sentiment"]')).toBeVisible();
      await expect(page.locator('[data-testid="neutral-sentiment"]')).toBeVisible();
      await expect(page.locator('[data-testid="negative-sentiment"]')).toBeVisible();
    });

    test("should display category distribution chart", async ({ page }) => {
      const categoryChart = page.locator('[data-testid="category-chart"]');
      await expect(categoryChart).toBeVisible();

      await waitForChartLoad(page, '[data-testid="category-chart"]');

      // Should show category data
      const categories = page.locator('[data-testid="category-item"]');
      const count = await categories.count();
      expect(count).toBeGreaterThan(0);
    });

    test("should display geographic distribution map", async ({ page }) => {
      const geoMap = page.locator('[data-testid="geographic-map"]');
      await expect(geoMap).toBeVisible();

      // Wait for map to load
      await page.waitForTimeout(2000);

      // Check if country data is displayed
      const countryData = page.locator('[data-testid="country-data"]');
      if (await countryData.isVisible()) {
        expect(await countryData.count()).toBeGreaterThan(0);
      }
    });

    test("should display top questions list", async ({ page }) => {
      const topQuestions = page.locator('[data-testid="top-questions"]');
      await expect(topQuestions).toBeVisible();

      // Check if questions are displayed
      const questionItems = page.locator('[data-testid="question-item"]');
      const count = await questionItems.count();

      if (count > 0) {
        // Should show question text and count
        const firstQuestion = questionItems.first();
        await expect(firstQuestion.locator('[data-testid="question-text"]')).toBeVisible();
        await expect(firstQuestion.locator('[data-testid="question-count"]')).toBeVisible();
      }
    });

    test("should display time series chart", async ({ page }) => {
      const timeChart = page.locator('[data-testid="time-series-chart"]');

      if (await timeChart.isVisible()) {
        await waitForChartLoad(page, '[data-testid="time-series-chart"]');

        // Check chart axes
        await expect(page.locator('[data-testid="chart-x-axis"]')).toBeVisible();
        await expect(page.locator('[data-testid="chart-y-axis"]')).toBeVisible();
      }
    });
  });

  test.describe("Chart Interactions", () => {
    test("should allow chart filtering interactions", async ({ page }) => {
      const sentimentChart = page.locator('[data-testid="sentiment-chart"]');

      if (await sentimentChart.isVisible()) {
        // Click on positive sentiment section
        const positiveSection = page.locator('[data-testid="positive-segment"]');

        if (await positiveSection.isVisible()) {
          await positiveSection.click();

          // Should filter data or show details
          await expect(page.locator('[data-testid="chart-filter-active"]')).toBeVisible();
        }
      }
    });

    test("should show chart tooltips on hover", async ({ page }) => {
      const chart = page.locator('[data-testid="sentiment-chart"]');

      if (await chart.isVisible()) {
        await chart.hover();

        // Check for tooltip
        const tooltip = page.locator('[data-testid="chart-tooltip"]');
        if (await tooltip.isVisible()) {
          await expect(tooltip).toContainText(/\d+/); // Should show numeric data
        }
      }
    });

    test("should support chart zoom and pan", async ({ page }) => {
      const timeChart = page.locator('[data-testid="time-series-chart"]');

      if (await timeChart.isVisible()) {
        // Test zoom (scroll)
        await timeChart.hover();
        await page.mouse.wheel(0, -100);

        // Test pan (drag)
        const box = await timeChart.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2);
          await page.mouse.up();
        }
      }
    });
  });

  test.describe("Data Filtering", () => {
    test("should filter data by date range", async ({ page }) => {
      // Open date picker
      const dateFilter = page.locator('[data-testid="date-range-picker"]');

      if (await dateFilter.isVisible()) {
        await dateFilter.click();

        // Select date range
        await page.click('[data-testid="date-last-week"]');

        // Should update charts
        await page.waitForTimeout(1000);

        // Check that data is filtered
        await expect(page.locator('[data-testid="filter-applied"]')).toBeVisible();
      }
    });

    test("should filter data by sentiment", async ({ page }) => {
      const sentimentFilter = page.locator('[data-testid="sentiment-filter"]');

      if (await sentimentFilter.isVisible()) {
        await sentimentFilter.selectOption('POSITIVE');

        // Should update all visualizations
        await page.waitForTimeout(1000);

        // Check filter is applied
        await expect(page.locator('[data-testid="active-filters"]')).toContainText('Sentiment: Positive');
      }
    });

    test("should clear all filters", async ({ page }) => {
      // Apply some filters first
      const sentimentFilter = page.locator('[data-testid="sentiment-filter"]');
      if (await sentimentFilter.isVisible()) {
        await sentimentFilter.selectOption('POSITIVE');
      }

      // Clear filters
      const clearButton = page.locator('[data-testid="clear-filters"]');
      if (await clearButton.isVisible()) {
        await clearButton.click();

        // Should reset all data
        await expect(page.locator('[data-testid="active-filters"]')).toHaveCount(0);
      }
    });
  });

  test.describe("Data Export", () => {
    test("should export chart data as CSV", async ({ page }) => {
      const exportButton = page.locator('[data-testid="export-csv"]');

      if (await exportButton.isVisible()) {
        // Start download
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();
        const download = await downloadPromise;

        // Verify download
        expect(download.suggestedFilename()).toContain('.csv');
      }
    });

    test("should export chart as image", async ({ page }) => {
      const exportButton = page.locator('[data-testid="export-image"]');

      if (await exportButton.isVisible()) {
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toMatch(/\.(png|jpg|svg)$/);
      }
    });
  });
});

test.describe("Responsive Design", () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test.describe("Mobile Layout", () => {
    test("should adapt navigation for mobile", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("http://localhost:3000/dashboard/overview");

      // Should show mobile menu button
      const mobileMenu = page.locator('[data-testid="mobile-menu-toggle"]');
      await expect(mobileMenu).toBeVisible();

      // Open mobile menu
      await mobileMenu.click();
      await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible();

      // Check navigation items in mobile menu
      await expect(page.locator('[data-testid="mobile-nav-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-nav-sessions"]')).toBeVisible();
    });

    test("should stack charts vertically on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("http://localhost:3000/dashboard/overview");

      // Charts should be stacked
      const chartContainer = page.locator('[data-testid="charts-container"]');
      await expect(chartContainer).toHaveCSS('flex-direction', 'column');
    });

    test("should show simplified metrics on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("http://localhost:3000/dashboard/overview");

      // Should show condensed metric cards
      const metricCards = page.locator('[data-testid="metric-card"]');
      const count = await metricCards.count();

      // Should show fewer cards or smaller layout
      for (let i = 0; i < count; i++) {
        const card = metricCards.nth(i);
        const box = await card.boundingBox();
        if (box) {
          expect(box.width).toBeLessThan(300); // Smaller cards on mobile
        }
      }
    });
  });

  test.describe("Tablet Layout", () => {
    test("should adapt layout for tablet", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("http://localhost:3000/dashboard/overview");

      // Should show sidebar but possibly collapsed
      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toBeVisible();

      // Charts should adapt to medium screen
      const chartGrid = page.locator('[data-testid="chart-grid"]');
      await expect(chartGrid).toHaveCSS('grid-template-columns', /repeat\(2,/);
    });
  });
});

test.describe("Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test.describe("Keyboard Navigation", () => {
    test("should support keyboard navigation in dashboard", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/overview");

      // Test tab navigation
      await page.keyboard.press('Tab');

      // Should focus on first interactive element
      const focused = page.locator(':focus');
      await expect(focused).toBeVisible();

      // Navigate through elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        const currentFocus = page.locator(':focus');
        await expect(currentFocus).toBeVisible();
      }
    });

    test("should support keyboard shortcuts", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/overview");

      // Test keyboard shortcuts (if implemented)
      await page.keyboard.press('Alt+1'); // Navigate to overview
      await expect(page).toHaveURL(/\/dashboard\/overview/);

      await page.keyboard.press('Alt+2'); // Navigate to sessions
      await expect(page).toHaveURL(/\/dashboard\/sessions/);
    });
  });

  test.describe("Screen Reader Support", () => {
    test("should have proper ARIA labels", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/overview");

      // Check main landmarks
      await expect(page.locator('main')).toHaveAttribute('role', 'main');
      await expect(page.locator('nav')).toHaveAttribute('role', 'navigation');

      // Check chart accessibility
      const sentimentChart = page.locator('[data-testid="sentiment-chart"]');
      if (await sentimentChart.isVisible()) {
        await expect(sentimentChart).toHaveAttribute('role', 'img');
        await expect(sentimentChart).toHaveAttribute('aria-label');
      }
    });

    test("should provide alternative text for charts", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/overview");

      // Check chart descriptions
      const charts = page.locator('[role="img"]');
      const count = await charts.count();

      for (let i = 0; i < count; i++) {
        const chart = charts.nth(i);
        const ariaLabel = await chart.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel?.length).toBeGreaterThan(10); // Should be descriptive
      }
    });

    test("should announce dynamic content changes", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/overview");

      // Check for live regions
      const liveRegions = page.locator('[aria-live]');
      const count = await liveRegions.count();

      if (count > 0) {
        // Should have appropriate aria-live settings
        for (let i = 0; i < count; i++) {
          const region = liveRegions.nth(i);
          const ariaLive = await region.getAttribute('aria-live');
          expect(['polite', 'assertive']).toContain(ariaLive);
        }
      }
    });
  });

  test.describe("Color and Contrast", () => {
    test("should maintain accessibility in dark mode", async ({ page }) => {
      await page.goto("http://localhost:3000/dashboard/overview");

      // Toggle dark mode (if available)
      const darkModeToggle = page.locator('[data-testid="theme-toggle"]');

      if (await darkModeToggle.isVisible()) {
        await darkModeToggle.click();

        // Check that elements are still visible
        await expect(page.locator('[data-testid="total-sessions-card"]')).toBeVisible();
        await expect(page.locator('[data-testid="sentiment-chart"]')).toBeVisible();
      }
    });

    test("should work without color", async ({ page }) => {
      // Test with forced colors (simulates high contrast mode)
      await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' });
      await page.goto("http://localhost:3000/dashboard/overview");

      // Elements should still be distinguishable
      await expect(page.locator('[data-testid="total-sessions-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="sentiment-chart"]')).toBeVisible();
    });
  });
});