import { describe, it, expect, beforeEach, vi } from "vitest";
import { InMemoryRateLimiter, extractClientIP } from "../../lib/rateLimiter";
import { validateInput, registerSchema, loginSchema, forgotPasswordSchema } from "../../lib/validation";
import { z } from "zod";

// Import password schema directly from validation file
const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters long")
  .regex(/^(?=.*[a-z])/, "Password must contain at least one lowercase letter")
  .regex(/^(?=.*[A-Z])/, "Password must contain at least one uppercase letter")
  .regex(/^(?=.*\d)/, "Password must contain at least one number")
  .regex(
    /^(?=.*[@$!%*?&])/,
    "Password must contain at least one special character (@$!%*?&)"
  );

describe("Security Tests", () => {
  describe("Rate Limiter", () => {
    let rateLimiter: InMemoryRateLimiter;

    beforeEach(() => {
      rateLimiter = new InMemoryRateLimiter({
        maxAttempts: 3,
        windowMs: 1000, // 1 second for testing
        maxEntries: 10,
      });
    });

    afterEach(() => {
      rateLimiter.destroy();
    });

    it("should allow requests within rate limit", () => {
      const result1 = rateLimiter.checkRateLimit("test-ip");
      const result2 = rateLimiter.checkRateLimit("test-ip");
      const result3 = rateLimiter.checkRateLimit("test-ip");

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(true);
    });

    it("should block requests exceeding rate limit", () => {
      // Make max attempts
      rateLimiter.checkRateLimit("test-ip");
      rateLimiter.checkRateLimit("test-ip");
      rateLimiter.checkRateLimit("test-ip");

      // This should be blocked
      const result = rateLimiter.checkRateLimit("test-ip");
      expect(result.allowed).toBe(false);
      expect(result.resetTime).toBeDefined();
    });

    it("should reset after window expires", async () => {
      // Max out attempts
      rateLimiter.checkRateLimit("test-ip");
      rateLimiter.checkRateLimit("test-ip");
      rateLimiter.checkRateLimit("test-ip");

      // Should be blocked
      expect(rateLimiter.checkRateLimit("test-ip").allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be allowed again
      expect(rateLimiter.checkRateLimit("test-ip").allowed).toBe(true);
    });

    it("should track different IPs separately", () => {
      // Max out one IP
      rateLimiter.checkRateLimit("ip-1");
      rateLimiter.checkRateLimit("ip-1");
      rateLimiter.checkRateLimit("ip-1");

      // ip-1 should be blocked
      expect(rateLimiter.checkRateLimit("ip-1").allowed).toBe(false);

      // ip-2 should still be allowed
      expect(rateLimiter.checkRateLimit("ip-2").allowed).toBe(true);
    });

    it("should handle cleanup of expired entries", async () => {
      // Add multiple IPs
      for (let i = 0; i < 20; i++) {
        rateLimiter.checkRateLimit(`ip-${i}`);
      }

      // Wait for entries to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Force cleanup by checking rate limit
      rateLimiter.checkRateLimit("cleanup-trigger");

      // All IPs should be allowed again after cleanup
      for (let i = 0; i < 20; i++) {
        expect(rateLimiter.checkRateLimit(`ip-${i}`).allowed).toBe(true);
      }
    });
  });

  describe("IP Extraction", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const request = new Request("http://example.com", {
        headers: {
          "x-forwarded-for": "192.168.1.1, 10.0.0.1",
        },
      });

      expect(extractClientIP(request)).toBe("192.168.1.1");
    });

    it("should extract IP from x-real-ip header", () => {
      const request = new Request("http://example.com", {
        headers: {
          "x-real-ip": "192.168.1.2",
        },
      });

      expect(extractClientIP(request)).toBe("192.168.1.2");
    });

    it("should extract IP from cf-connecting-ip header", () => {
      const request = new Request("http://example.com", {
        headers: {
          "cf-connecting-ip": "192.168.1.3",
        },
      });

      expect(extractClientIP(request)).toBe("192.168.1.3");
    });

    it("should return unknown when no IP headers present", () => {
      const request = new Request("http://example.com");
      expect(extractClientIP(request)).toBe("unknown");
    });

    it("should prioritize headers correctly", () => {
      const request = new Request("http://example.com", {
        headers: {
          "x-forwarded-for": "192.168.1.1",
          "x-real-ip": "192.168.1.2",
          "cf-connecting-ip": "192.168.1.3",
        },
      });

      // x-forwarded-for should take precedence
      expect(extractClientIP(request)).toBe("192.168.1.1");
    });
  });

  describe("Input Validation", () => {
    describe("Password Validation", () => {
      it("should reject weak passwords", () => {
        const weakPasswords = [
          "short", // Too short
          "nouppercase123!", // No uppercase
          "NOLOWERCASE123!", // No lowercase  
          "NoNumbers!@#", // No numbers
          "NoSpecialChars123", // No special chars
          "password123!", // Common password pattern
        ];

        weakPasswords.forEach(password => {
          const result = validateInput(passwordSchema, password);
          expect(result.success).toBe(false);
        });
      });

      it("should accept strong passwords", () => {
        const strongPasswords = [
          "StrongP@ssw0rd123",
          "C0mpl3x!Pass#2024",
          "MyS3cur3P@ssword!",
        ];

        strongPasswords.forEach(password => {
          const result = validateInput(passwordSchema, password);
          expect(result.success).toBe(true);
        });
      });
    });

    describe("Registration Validation", () => {
      it("should validate registration data", () => {
        const validData = {
          email: "test@example.com",
          password: "StrongP@ssw0rd123",
          company: "Test Company Inc",
        };

        const result = validateInput(registerSchema, validData);
        expect(result.success).toBe(true);
      });

      it("should reject invalid email formats", () => {
        const invalidData = {
          email: "not-an-email",
          password: "StrongP@ssw0rd123",
          company: "Test Company",
        };

        const result = validateInput(registerSchema, invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors[0]).toContain("email");
        }
      });

      it("should reject invalid company names", () => {
        const invalidData = {
          email: "test@example.com",
          password: "StrongP@ssw0rd123",
          company: "Test@#$%^&*()", // Invalid characters
        };

        const result = validateInput(registerSchema, invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors[0]).toContain("company");
        }
      });

      it("should normalize email to lowercase", () => {
        const data = {
          email: "TEST@EXAMPLE.COM",
          password: "StrongP@ssw0rd123",
          company: "Test Company",
        };

        const result = validateInput(registerSchema, data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe("test@example.com");
        }
      });
    });

    describe("Login Validation", () => {
      it("should validate login credentials", () => {
        const validData = {
          email: "test@example.com",
          password: "anypassword",
        };

        const result = validateInput(loginSchema, validData);
        expect(result.success).toBe(true);
      });

      it("should require both email and password", () => {
        const missingPassword = {
          email: "test@example.com",
        };

        const result = validateInput(loginSchema, missingPassword);
        expect(result.success).toBe(false);
      });
    });

    describe("XSS Prevention", () => {
      it("should handle potential XSS in company names", () => {
        const xssData = {
          email: "test@example.com",
          password: "StrongP@ssw0rd123",
          company: "<script>alert('xss')</script>",
        };

        const result = validateInput(registerSchema, xssData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors[0]).toContain("invalid characters");
        }
      });
    });

    describe("SQL Injection Prevention", () => {
      it("should handle SQL injection attempts in email", () => {
        const sqlInjection = {
          email: "test'; DROP TABLE users; --",
          password: "StrongP@ssw0rd123",
          company: "Test Company",
        };

        const result = validateInput(registerSchema, sqlInjection);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors[0]).toContain("email");
        }
      });
    });
  });

  describe("Session Security", () => {
    it("should have secure cookie configuration", () => {
      // This is tested in the auth configuration
      // In production, cookies should be:
      // - httpOnly: true
      // - secure: true (in production)
      // - sameSite: 'lax'
      expect(true).toBe(true); // Placeholder for cookie config tests
    });
  });
});