/**
 * E2E tests for complete user registration and login workflow
 *
 * Tests the full user journey:
 * 1. Company registration
 * 2. User login
 * 3. Dashboard access
 * 4. Authentication state management
 * 5. Session persistence
 * 6. Logout functionality
 */

import { test, expect, type Page } from "@playwright/test";

// Test data
const testCompany = {
  name: "E2E Test Company",
  csvUrl: "https://example.com/test.csv",
  csvUsername: "testuser",
  csvPassword: "testpass123",
  adminEmail: "admin@e2etest.com",
  adminName: "E2E Admin",
  adminPassword: "E2ETestPassword123!",
};

const testUser = {
  email: "user@e2etest.com",
  password: "UserTestPassword123!",
  name: "E2E Test User",
};

// Helper functions
async function fillRegistrationForm(page: Page) {
  await page.fill('[data-testid="company-name"]', testCompany.name);
  await page.fill('[data-testid="csv-url"]', testCompany.csvUrl);
  await page.fill('[data-testid="csv-username"]', testCompany.csvUsername);
  await page.fill('[data-testid="csv-password"]', testCompany.csvPassword);
  await page.fill('[data-testid="admin-email"]', testCompany.adminEmail);
  await page.fill('[data-testid="admin-name"]', testCompany.adminName);
  await page.fill('[data-testid="admin-password"]', testCompany.adminPassword);
}

async function fillLoginForm(page: Page, email: string, password: string) {
  await page.fill('[data-testid="email"]', email);
  await page.fill('[data-testid="password"]', password);
}

async function waitForDashboard(page: Page) {
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator("h1")).toContainText("Dashboard");
}

test.describe("User Authentication Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Set base URL for local development
    await page.goto("http://localhost:3000");
  });

  test.describe("Company Registration Flow", () => {
    test("should allow new company registration with admin user", async ({
      page,
    }) => {
      // Navigate to registration page
      await page.click('[data-testid="register-link"]');
      await expect(page).toHaveURL(/\/register/);

      // Fill registration form
      await fillRegistrationForm(page);

      // Submit registration
      await page.click('[data-testid="register-button"]');

      // Should redirect to login page with success message
      await expect(page).toHaveURL(/\/login/);
      await expect(
        page.locator('[data-testid="success-message"]')
      ).toContainText("Registration successful");
    });

    test("should validate registration form fields", async ({ page }) => {
      await page.goto("http://localhost:3000/register");

      // Try to submit empty form
      await page.click('[data-testid="register-button"]');

      // Should show validation errors
      await expect(
        page.locator('[data-testid="company-name-error"]')
      ).toContainText("Company name is required");
      await expect(
        page.locator('[data-testid="admin-email-error"]')
      ).toContainText("Email is required");
      await expect(
        page.locator('[data-testid="admin-password-error"]')
      ).toContainText("Password must be at least 12 characters");
    });

    test("should enforce password strength requirements", async ({ page }) => {
      await page.goto("http://localhost:3000/register");

      // Test weak password
      await page.fill('[data-testid="admin-password"]', "weakpass");
      await page.blur('[data-testid="admin-password"]');

      await expect(
        page.locator('[data-testid="admin-password-error"]')
      ).toContainText("Password must contain at least one uppercase letter");

      // Test strong password
      await page.fill('[data-testid="admin-password"]', "StrongPassword123!");
      await page.blur('[data-testid="admin-password"]');

      await expect(
        page.locator('[data-testid="admin-password-error"]')
      ).toHaveCount(0);
    });
  });

  test.describe("User Login Flow", () => {
    test.beforeEach(async ({ page }) => {
      // Assume company registration was completed in previous test
      // Navigate directly to login page
      await page.goto("http://localhost:3000/login");
    });

    test("should allow successful login with valid credentials", async ({
      page,
    }) => {
      // Fill login form
      await fillLoginForm(
        page,
        testCompany.adminEmail,
        testCompany.adminPassword
      );

      // Submit login
      await page.click('[data-testid="login-button"]');

      // Should redirect to dashboard
      await waitForDashboard(page);

      // Verify user info is displayed
      await expect(page.locator('[data-testid="user-name"]')).toContainText(
        testCompany.adminName
      );
    });

    test("should reject invalid credentials", async ({ page }) => {
      // Fill login form with wrong password
      await fillLoginForm(page, testCompany.adminEmail, "wrongpassword");

      // Submit login
      await page.click('[data-testid="login-button"]');

      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toContainText(
        "Invalid credentials"
      );

      // Should remain on login page
      await expect(page).toHaveURL(/\/login/);
    });

    test("should validate login form fields", async ({ page }) => {
      // Try to submit empty form
      await page.click('[data-testid="login-button"]');

      // Should show validation errors
      await expect(page.locator('[data-testid="email-error"]')).toContainText(
        "Email is required"
      );
      await expect(
        page.locator('[data-testid="password-error"]')
      ).toContainText("Password is required");
    });

    test("should handle rate limiting", async ({ page }) => {
      // Attempt multiple failed logins
      for (let i = 0; i < 6; i++) {
        await fillLoginForm(page, "invalid@email.com", "wrongpassword");
        await page.click('[data-testid="login-button"]');
        await page.waitForTimeout(100); // Small delay between attempts
      }

      // Should show rate limit error
      await expect(page.locator('[data-testid="error-message"]')).toContainText(
        "Too many login attempts"
      );
    });
  });

  test.describe("Dashboard Access and Navigation", () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto("http://localhost:3000/login");
      await fillLoginForm(
        page,
        testCompany.adminEmail,
        testCompany.adminPassword
      );
      await page.click('[data-testid="login-button"]');
      await waitForDashboard(page);
    });

    test("should display dashboard overview correctly", async ({ page }) => {
      // Check main dashboard elements
      await expect(page.locator("h1")).toContainText("Dashboard Overview");

      // Check metric cards
      await expect(
        page.locator('[data-testid="total-sessions-card"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="avg-sentiment-card"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="escalation-rate-card"]')
      ).toBeVisible();

      // Check navigation sidebar
      await expect(page.locator('[data-testid="nav-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-sessions"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-users"]')).toBeVisible();
    });

    test("should navigate between dashboard sections", async ({ page }) => {
      // Navigate to Sessions
      await page.click('[data-testid="nav-sessions"]');
      await expect(page).toHaveURL(/\/dashboard\/sessions/);
      await expect(page.locator("h1")).toContainText("Sessions");

      // Navigate to Users
      await page.click('[data-testid="nav-users"]');
      await expect(page).toHaveURL(/\/dashboard\/users/);
      await expect(page.locator("h1")).toContainText("Users");

      // Navigate back to Overview
      await page.click('[data-testid="nav-overview"]');
      await expect(page).toHaveURL(/\/dashboard\/overview/);
      await expect(page.locator("h1")).toContainText("Dashboard Overview");
    });

    test("should handle unauthorized access attempts", async ({ page }) => {
      // Try to access admin-only features as regular user
      await page.goto("http://localhost:3000/dashboard/users");

      // If user is not admin, should show appropriate message or redirect
      const isAdmin = await page
        .locator('[data-testid="admin-panel"]')
        .isVisible();

      if (!isAdmin) {
        await expect(
          page.locator('[data-testid="access-denied"]')
        ).toBeVisible();
      }
    });
  });

  test.describe("Session Management", () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto("http://localhost:3000/login");
      await fillLoginForm(
        page,
        testCompany.adminEmail,
        testCompany.adminPassword
      );
      await page.click('[data-testid="login-button"]');
      await waitForDashboard(page);
    });

    test("should persist session across page refreshes", async ({ page }) => {
      // Refresh the page
      await page.reload();

      // Should still be logged in
      await waitForDashboard(page);
      await expect(page.locator('[data-testid="user-name"]')).toContainText(
        testCompany.adminName
      );
    });

    test("should persist session across browser tabs", async ({ context }) => {
      // Open new tab
      const newTab = await context.newPage();
      await newTab.goto("http://localhost:3000/dashboard");

      // Should be automatically logged in
      await waitForDashboard(newTab);
      await expect(newTab.locator('[data-testid="user-name"]')).toContainText(
        testCompany.adminName
      );

      await newTab.close();
    });

    test("should redirect to login when session expires", async ({ page }) => {
      // Simulate session expiration by clearing localStorage/cookies
      await page.evaluate(() => {
        localStorage.clear();
        document.cookie.split(";").forEach((c) => {
          const eqPos = c.indexOf("=");
          const name = eqPos > -1 ? c.substr(0, eqPos) : c;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });
      });

      // Try to navigate to protected page
      await page.goto("http://localhost:3000/dashboard");

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Logout Functionality", () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto("http://localhost:3000/login");
      await fillLoginForm(
        page,
        testCompany.adminEmail,
        testCompany.adminPassword
      );
      await page.click('[data-testid="login-button"]');
      await waitForDashboard(page);
    });

    test("should successfully logout user", async ({ page }) => {
      // Open user menu
      await page.click('[data-testid="user-menu"]');

      // Click logout
      await page.click('[data-testid="logout-button"]');

      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/);

      // Should show logout success message
      await expect(
        page.locator('[data-testid="success-message"]')
      ).toContainText("Logged out successfully");

      // Try to access protected page
      await page.goto("http://localhost:3000/dashboard");

      // Should redirect back to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("should clear session data on logout", async ({ page }) => {
      // Check that session data exists
      const sessionBefore = await page.evaluate(() =>
        localStorage.getItem("session")
      );
      expect(sessionBefore).toBeTruthy();

      // Logout
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      // Check that session data is cleared
      const sessionAfter = await page.evaluate(() =>
        localStorage.getItem("session")
      );
      expect(sessionAfter).toBeFalsy();
    });
  });

  test.describe("Password Reset Flow", () => {
    test("should allow password reset request", async ({ page }) => {
      await page.goto("http://localhost:3000/login");

      // Click forgot password link
      await page.click('[data-testid="forgot-password-link"]');
      await expect(page).toHaveURL(/\/forgot-password/);

      // Enter email
      await page.fill('[data-testid="email"]', testCompany.adminEmail);
      await page.click('[data-testid="reset-button"]');

      // Should show success message
      await expect(
        page.locator('[data-testid="success-message"]')
      ).toContainText("Password reset email sent");
    });

    test("should validate email format in password reset", async ({ page }) => {
      await page.goto("http://localhost:3000/forgot-password");

      // Enter invalid email
      await page.fill('[data-testid="email"]', "invalid-email");
      await page.click('[data-testid="reset-button"]');

      // Should show validation error
      await expect(page.locator('[data-testid="email-error"]')).toContainText(
        "Invalid email format"
      );
    });
  });

  test.describe("Mobile Responsive Design", () => {
    test("should work correctly on mobile devices", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Test login flow on mobile
      await page.goto("http://localhost:3000/login");
      await fillLoginForm(
        page,
        testCompany.adminEmail,
        testCompany.adminPassword
      );
      await page.click('[data-testid="login-button"]');

      // Should work on mobile
      await waitForDashboard(page);

      // Check mobile navigation
      const mobileMenu = page.locator('[data-testid="mobile-menu-toggle"]');
      if (await mobileMenu.isVisible()) {
        await mobileMenu.click();
        await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should be accessible with keyboard navigation", async ({ page }) => {
      await page.goto("http://localhost:3000/login");

      // Test keyboard navigation
      await page.keyboard.press("Tab");
      await expect(page.locator('[data-testid="email"]')).toBeFocused();

      await page.keyboard.press("Tab");
      await expect(page.locator('[data-testid="password"]')).toBeFocused();

      await page.keyboard.press("Tab");
      await expect(page.locator('[data-testid="login-button"]')).toBeFocused();

      // Test form submission with Enter key
      await page.fill('[data-testid="email"]', testCompany.adminEmail);
      await page.fill('[data-testid="password"]', testCompany.adminPassword);
      await page.keyboard.press("Enter");

      await waitForDashboard(page);
    });

    test("should have proper ARIA labels and roles", async ({ page }) => {
      await page.goto("http://localhost:3000/login");

      // Check form accessibility
      await expect(page.locator('[data-testid="email"]')).toHaveAttribute(
        "aria-label",
        "Email address"
      );
      await expect(page.locator('[data-testid="password"]')).toHaveAttribute(
        "aria-label",
        "Password"
      );
      await expect(
        page.locator('[data-testid="login-button"]')
      ).toHaveAttribute("role", "button");
    });
  });
});
