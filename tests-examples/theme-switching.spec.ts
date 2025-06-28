import { test, expect } from "@playwright/test";

test.describe("Theme Switching Visual Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route("**/api/auth/session", async (route) => {
      const json = {
        user: {
          id: "admin-user-id",
          email: "admin@example.com",
          role: "ADMIN",
        },
        expires: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      };
      await route.fulfill({ json });
    });

    // Mock users API
    await page.route("**/api/dashboard/users", async (route) => {
      if (route.request().method() === "GET") {
        const json = {
          users: [
            { id: "1", email: "admin@example.com", role: "ADMIN" },
            { id: "2", email: "user@example.com", role: "USER" },
            { id: "3", email: "auditor@example.com", role: "AUDITOR" },
          ],
        };
        await route.fulfill({ json });
      }
    });
  });

  test("User Management page should render correctly in light theme", async ({ page }) => {
    await page.goto("/dashboard/users");
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="user-management-page"]', { timeout: 10000 });
    
    // Ensure light theme is active
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });

    // Wait for theme change to apply
    await page.waitForTimeout(500);

    // Take screenshot of the full page
    await expect(page).toHaveScreenshot("user-management-light-theme.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("User Management page should render correctly in dark theme", async ({ page }) => {
    await page.goto("/dashboard/users");
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="user-management-page"]', { timeout: 10000 });
    
    // Enable dark theme
    await page.evaluate(() => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    });

    // Wait for theme change to apply
    await page.waitForTimeout(500);

    // Take screenshot of the full page
    await expect(page).toHaveScreenshot("user-management-dark-theme.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("Theme toggle should work correctly", async ({ page }) => {
    await page.goto("/dashboard/users");
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="user-management-page"]', { timeout: 10000 });

    // Find theme toggle button (assuming it exists in the layout)
    const themeToggle = page.locator('[data-testid="theme-toggle"]').first();
    
    if (await themeToggle.count() > 0) {
      // Start with light theme
      await page.evaluate(() => {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      });
      await page.waitForTimeout(300);

      // Take screenshot before toggle
      await expect(page.locator("main")).toHaveScreenshot("before-theme-toggle.png", {
        animations: "disabled",
      });

      // Toggle to dark theme
      await themeToggle.click();
      await page.waitForTimeout(300);

      // Take screenshot after toggle
      await expect(page.locator("main")).toHaveScreenshot("after-theme-toggle.png", {
        animations: "disabled",
      });
    }
  });

  test("Form elements should have proper styling in both themes", async ({ page }) => {
    await page.goto("/dashboard/users");
    await page.waitForSelector('[data-testid="user-management-page"]', { timeout: 10000 });

    // Test light theme form styling
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await page.waitForTimeout(300);

    const formSection = page.locator('[data-testid="invite-form"]').first();
    if (await formSection.count() > 0) {
      await expect(formSection).toHaveScreenshot("form-light-theme.png", {
        animations: "disabled",
      });
    }

    // Test dark theme form styling
    await page.evaluate(() => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    });
    await page.waitForTimeout(300);

    if (await formSection.count() > 0) {
      await expect(formSection).toHaveScreenshot("form-dark-theme.png", {
        animations: "disabled",
      });
    }
  });

  test("Table should render correctly in both themes", async ({ page }) => {
    await page.goto("/dashboard/users");
    await page.waitForSelector('[data-testid="user-management-page"]', { timeout: 10000 });

    const table = page.locator("table").first();
    await table.waitFor({ timeout: 5000 });

    // Light theme table
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await page.waitForTimeout(300);

    await expect(table).toHaveScreenshot("table-light-theme.png", {
      animations: "disabled",
    });

    // Dark theme table  
    await page.evaluate(() => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    });
    await page.waitForTimeout(300);

    await expect(table).toHaveScreenshot("table-dark-theme.png", {
      animations: "disabled",
    });
  });

  test("Badges should render correctly in both themes", async ({ page }) => {
    await page.goto("/dashboard/users");
    await page.waitForSelector('[data-testid="user-management-page"]', { timeout: 10000 });

    // Wait for badges to load
    const badges = page.locator('[data-testid="role-badge"]');
    if (await badges.count() > 0) {
      await badges.first().waitFor({ timeout: 5000 });

      // Light theme badges
      await page.evaluate(() => {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      });
      await page.waitForTimeout(300);

      await expect(badges.first()).toHaveScreenshot("badge-light-theme.png", {
        animations: "disabled",
      });

      // Dark theme badges
      await page.evaluate(() => {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
      });
      await page.waitForTimeout(300);

      await expect(badges.first()).toHaveScreenshot("badge-dark-theme.png", {
        animations: "disabled",
      });
    }
  });

  test("Focus states should be visible in both themes", async ({ page }) => {
    await page.goto("/dashboard/users");
    await page.waitForSelector('[data-testid="user-management-page"]', { timeout: 10000 });

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ timeout: 5000 });

    // Test focus in light theme
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await page.waitForTimeout(300);

    await emailInput.focus();
    await expect(emailInput).toHaveScreenshot("input-focus-light.png", {
      animations: "disabled",
    });

    // Test focus in dark theme
    await page.evaluate(() => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    });
    await page.waitForTimeout(300);

    await emailInput.focus();
    await expect(emailInput).toHaveScreenshot("input-focus-dark.png", {
      animations: "disabled",
    });
  });

  test("Error states should be visible in both themes", async ({ page }) => {
    await page.goto("/dashboard/users");
    await page.waitForSelector('[data-testid="user-management-page"]', { timeout: 10000 });

    // Mock error response
    await page.route("**/api/dashboard/users", async (route) => {
      if (route.request().method() === "POST") {
        const json = { error: "Email already exists" };
        await route.fulfill({ status: 400, json });
      }
    });

    const emailInput = page.locator('input[type="email"]').first();
    const submitButton = page.locator('button[type="submit"]').first();
    
    await emailInput.waitFor({ timeout: 5000 });
    await submitButton.waitFor({ timeout: 5000 });

    // Fill form and submit to trigger error
    await emailInput.fill("existing@example.com");
    await submitButton.click();

    // Wait for error message
    await page.waitForSelector('[role="alert"]', { timeout: 5000 });

    // Test error in light theme
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await page.waitForTimeout(300);

    const errorAlert = page.locator('[role="alert"]').first();
    await expect(errorAlert).toHaveScreenshot("error-light-theme.png", {
      animations: "disabled",
    });

    // Test error in dark theme
    await page.evaluate(() => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    });
    await page.waitForTimeout(300);

    await expect(errorAlert).toHaveScreenshot("error-dark-theme.png", {
      animations: "disabled",
    });
  });

  test("Loading states should be visible in both themes", async ({ page }) => {
    // Mock slow loading
    await page.route("**/api/dashboard/users", async (route) => {
      if (route.request().method() === "GET") {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const json = { users: [] };
        await route.fulfill({ json });
      }
    });

    await page.goto("/dashboard/users");

    // Capture loading state in light theme
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });

    const loadingElement = page.locator('text="Loading users..."').first();
    if (await loadingElement.count() > 0) {
      await expect(loadingElement).toHaveScreenshot("loading-light-theme.png", {
        animations: "disabled",
      });
    }

    // Capture loading state in dark theme
    await page.evaluate(() => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    });

    if (await loadingElement.count() > 0) {
      await expect(loadingElement).toHaveScreenshot("loading-dark-theme.png", {
        animations: "disabled",
      });
    }
  });

  test("Empty states should render correctly in both themes", async ({ page }) => {
    // Mock empty response
    await page.route("**/api/dashboard/users", async (route) => {
      if (route.request().method() === "GET") {
        const json = { users: [] };
        await route.fulfill({ json });
      }
    });

    await page.goto("/dashboard/users");
    await page.waitForSelector('[data-testid="user-management-page"]', { timeout: 10000 });

    // Wait for empty state
    await page.waitForSelector('text="No users found"', { timeout: 5000 });

    // Light theme empty state
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await page.waitForTimeout(300);

    const emptyState = page.locator('text="No users found"').first();
    await expect(emptyState.locator("..")).toHaveScreenshot("empty-state-light.png", {
      animations: "disabled",
    });

    // Dark theme empty state
    await page.evaluate(() => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    });
    await page.waitForTimeout(300);

    await expect(emptyState.locator("..")).toHaveScreenshot("empty-state-dark.png", {
      animations: "disabled",
    });
  });

  test("Theme transition should be smooth", async ({ page }) => {
    await page.goto("/dashboard/users");
    await page.waitForSelector('[data-testid="user-management-page"]', { timeout: 10000 });

    // Start with light theme
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await page.waitForTimeout(300);

    // Find theme toggle if it exists
    const themeToggle = page.locator('[data-testid="theme-toggle"]').first();
    
    if (await themeToggle.count() > 0) {
      // Record video during theme switch
      await page.video()?.path();
      
      // Toggle theme
      await themeToggle.click();
      
      // Wait for transition to complete
      await page.waitForTimeout(500);
      
      // Verify dark theme is applied
      const isDarkMode = await page.evaluate(() => {
        return document.documentElement.classList.contains("dark");
      });
      
      expect(isDarkMode).toBe(true);
    }
  });
});