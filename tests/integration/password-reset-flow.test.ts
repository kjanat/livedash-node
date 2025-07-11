import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";

// Mock dependencies before importing auth router
vi.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
  },
}));

describe("Password Reset Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Forgot Password Flow", () => {
    it("should generate secure tokens during password reset request", async () => {
      // Import after mocks are set up
      const { authRouter } = await import("../../server/routers/auth");
      const { prisma } = await import("../../lib/prisma");

      const testUser = {
        id: "user-123",
        email: "test@example.com",
        password: "hashed-password",
        resetToken: null,
        resetTokenExpiry: null,
        companyId: "company-123",
        role: "USER" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(testUser);

      let capturedToken: string | undefined;
      vi.mocked(prisma.user.update).mockImplementation(async ({ data }) => {
        capturedToken = data.resetToken;
        return {
          ...testUser,
          resetToken: data.resetToken,
          resetTokenExpiry: data.resetTokenExpiry,
        };
      });

      // Create a mock tRPC context
      const ctx = {
        prisma,
        session: null,
      };

      // Call the forgotPassword procedure directly
      const result = await authRouter
        .createCaller(ctx)
        .forgotPassword({ email: "test@example.com" });

      expect(result.message).toContain("password reset link");
      expect(prisma.user.update).toHaveBeenCalled();

      // Verify the token was generated with proper security characteristics
      expect(capturedToken).toBeDefined();
      expect(capturedToken).toHaveLength(64);
      expect(capturedToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should generate different tokens for consecutive requests", async () => {
      // Import after mocks are set up
      const { authRouter } = await import("../../server/routers/auth");
      const { prisma } = await import("../../lib/prisma");

      const testUser = {
        id: "user-123",
        email: "test@example.com",
        password: "hashed-password",
        resetToken: null,
        resetTokenExpiry: null,
        companyId: "company-123",
        role: "USER" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const capturedTokens: string[] = [];

      vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser);
      vi.mocked(prisma.user.update).mockImplementation(async ({ data }) => {
        capturedTokens.push(data.resetToken);
        return {
          ...testUser,
          resetToken: data.resetToken,
          resetTokenExpiry: data.resetTokenExpiry,
        };
      });

      const ctx = {
        prisma,
        session: null,
      };

      // Generate multiple tokens
      await authRouter
        .createCaller(ctx)
        .forgotPassword({ email: "test@example.com" });
      await authRouter
        .createCaller(ctx)
        .forgotPassword({ email: "test@example.com" });
      await authRouter
        .createCaller(ctx)
        .forgotPassword({ email: "test@example.com" });

      expect(capturedTokens).toHaveLength(3);
      expect(capturedTokens[0]).not.toBe(capturedTokens[1]);
      expect(capturedTokens[1]).not.toBe(capturedTokens[2]);
      expect(capturedTokens[0]).not.toBe(capturedTokens[2]);

      // All tokens should be properly formatted
      capturedTokens.forEach((token) => {
        expect(token).toHaveLength(64);
        expect(token).toMatch(/^[0-9a-f]{64}$/);
      });
    });
  });

  describe("Reset Password Flow", () => {
    it("should accept secure tokens for password reset", async () => {
      // Import after mocks are set up
      const { authRouter } = await import("../../server/routers/auth");
      const { prisma } = await import("../../lib/prisma");

      const secureToken = crypto.randomBytes(32).toString("hex");
      const futureDate = new Date(Date.now() + 3600000);

      const userWithResetToken = {
        id: "user-123",
        email: "test@example.com",
        password: "old-hashed-password",
        resetToken: secureToken,
        resetTokenExpiry: futureDate,
        companyId: "company-123",
        role: "USER" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(
        userWithResetToken
      );
      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        ...userWithResetToken,
        password: "new-hashed-password",
        resetToken: null,
        resetTokenExpiry: null,
      });

      const ctx = {
        prisma,
        session: null,
      };

      const result = await authRouter.createCaller(ctx).resetPassword({
        token: secureToken,
        password: "NewSecurePassword123!",
      });

      expect(result.message).toBe("Password reset successfully");
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          resetToken: secureToken,
          resetTokenExpiry: {
            gt: expect.any(Date),
          },
        },
      });
    });

    it("should reject invalid token formats", async () => {
      // Import after mocks are set up
      const { authRouter } = await import("../../server/routers/auth");
      const { prisma } = await import("../../lib/prisma");

      const invalidTokens = [
        "short",
        "invalid-chars-@#$",
        Math.random().toString(36).substring(2, 15), // Old weak format
        "0".repeat(63), // Wrong length
        "g".repeat(64), // Invalid hex chars
      ];

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const ctx = {
        prisma,
        session: null,
      };

      for (const invalidToken of invalidTokens) {
        await expect(
          authRouter.createCaller(ctx).resetPassword({
            token: invalidToken,
            password: "NewSecurePassword123!",
          })
        ).rejects.toThrow("Invalid or expired reset token");
      }
    });
  });

  describe("Token Security Comparison", () => {
    it("should demonstrate improvement over weak Math.random() tokens", () => {
      // Generate tokens using both methods
      const secureTokens = Array.from({ length: 100 }, () =>
        crypto.randomBytes(32).toString("hex")
      );

      const weakTokens = Array.from({ length: 100 }, () =>
        Math.random().toString(36).substring(2, 15)
      );

      // Secure tokens should be longer
      const avgSecureLength =
        secureTokens.reduce((sum, t) => sum + t.length, 0) /
        secureTokens.length;
      const avgWeakLength =
        weakTokens.reduce((sum, t) => sum + t.length, 0) / weakTokens.length;

      expect(avgSecureLength).toBeGreaterThan(avgWeakLength * 4);

      // Secure tokens should have no collisions
      expect(new Set(secureTokens).size).toBe(secureTokens.length);

      // Weak tokens might have collisions with enough samples
      // but more importantly, they're predictable
      secureTokens.forEach((token) => {
        expect(token).toMatch(/^[0-9a-f]{64}$/);
      });
    });
  });
});
