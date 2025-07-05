import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST as registerPOST } from "../../app/api/register/route";
import { POST as forgotPasswordPOST } from "../../app/api/forgot-password/route";
import { NextRequest } from "next/server";

// Mock bcrypt
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

// Mock crypto
vi.mock("node:crypto", () => ({
  default: {
    randomBytes: vi.fn().mockReturnValue({
      toString: vi.fn().mockReturnValue("random-token"),
    }),
  },
}));

// Mock prisma
vi.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock email service
vi.mock("../../lib/sendEmail", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock rate limiter
vi.mock("../../lib/rateLimiter", () => ({
  InMemoryRateLimiter: vi.fn().mockImplementation(() => ({
    checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  })),
  extractClientIP: vi.fn().mockReturnValue("192.168.1.1"),
}));

describe("Authentication API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/register", () => {
    it("should register a new user successfully", async () => {
      const { prisma } = await import("../../lib/prisma");

      const mockCompany = {
        id: "company1",
        name: "Test Company",
        status: "ACTIVE" as const,
        csvUrl: "http://example.com/data.csv",
        csvUsername: null,
        csvPassword: null,
        dashboardOpts: {},
        maxUsers: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUser = {
        id: "user1",
        email: "test@example.com",
        name: "Test User",
        companyId: "company1",
        role: "USER" as const,
        password: "hashed-password",
        resetToken: null,
        resetTokenExpiry: null,
        invitedAt: null,
        invitedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.company.findUnique).mockResolvedValue(mockCompany);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

      const request = new NextRequest("http://localhost:3000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test User",
          email: "test@example.com",
          password: "password123",
          companyId: "company1",
        }),
      });

      const response = await registerPOST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.message).toBe("User created successfully");
      expect(data.user.email).toBe("test@example.com");
    });

    it("should return 400 for missing required fields", async () => {
      const request = new NextRequest("http://localhost:3000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          // Missing name, password, companyId
        }),
      });

      const response = await registerPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Missing required fields");
    });

    it("should return 400 for invalid email format", async () => {
      const request = new NextRequest("http://localhost:3000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test User",
          email: "invalid-email",
          password: "password123",
          companyId: "company1",
        }),
      });

      const response = await registerPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid email format");
    });

    it("should return 400 for weak password", async () => {
      const request = new NextRequest("http://localhost:3000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test User",
          email: "test@example.com",
          password: "123", // Too short
          companyId: "company1",
        }),
      });

      const response = await registerPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Password must be at least 8 characters long");
    });

    it("should return 404 for non-existent company", async () => {
      const { prisma } = await import("../../lib/prisma");

      vi.mocked(prisma.company.findUnique).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test User",
          email: "test@example.com",
          password: "password123",
          companyId: "non-existent",
        }),
      });

      const response = await registerPOST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Company not found");
    });

    it("should return 409 for existing user email", async () => {
      const { prisma } = await import("../../lib/prisma");

      const mockCompany = {
        id: "company1",
        name: "Test Company",
        status: "ACTIVE" as const,
        csvUrl: "http://example.com/data.csv",
        csvUsername: null,
        csvPassword: null,
        dashboardOpts: {},
        maxUsers: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const existingUser = {
        id: "existing-user",
        email: "test@example.com",
        name: "Existing User",
        companyId: "company1",
        role: "USER" as const,
        password: "hashed-password",
        resetToken: null,
        resetTokenExpiry: null,
        invitedAt: null,
        invitedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.company.findUnique).mockResolvedValue(mockCompany);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);

      const request = new NextRequest("http://localhost:3000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test User",
          email: "test@example.com",
          password: "password123",
          companyId: "company1",
        }),
      });

      const response = await registerPOST(request);

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe("User already exists");
    });

    it("should handle rate limiting", async () => {
      const { InMemoryRateLimiter } = await import("../../lib/rateLimiter");

      // Mock rate limiter class constructor
      const mockCheckRateLimit = vi.fn().mockReturnValue({
        allowed: false,
        resetTime: Date.now() + 60000,
      });

      vi.mocked(InMemoryRateLimiter).mockImplementation(() => ({
        checkRateLimit: mockCheckRateLimit,
        cleanup: vi.fn(),
        destroy: vi.fn(),
      } as any));

      const request = new NextRequest("http://localhost:3000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test User",
          email: "test@example.com",
          password: "password123",
          companyId: "company1",
        }),
      });

      const response = await registerPOST(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe(
        "Too many registration attempts. Please try again later."
      );
    });
  });

  describe("POST /api/forgot-password", () => {
    it("should send password reset email for existing user", async () => {
      const { prisma } = await import("../../lib/prisma");
      const { sendEmail } = await import("../../lib/sendEmail");

      const existingUser = {
        id: "user1",
        email: "test@example.com",
        name: "Test User",
        companyId: "company1",
        role: "USER" as const,
        password: "hashed-password",
        resetToken: null,
        resetTokenExpiry: null,
        invitedAt: null,
        invitedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...existingUser,
        resetToken: "random-token",
        resetTokenExpiry: new Date(Date.now() + 3600000),
      });

      const request = new NextRequest(
        "http://localhost:3000/api/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: "test@example.com",
          }),
        }
      );

      const response = await forgotPasswordPOST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Password reset email sent");
      expect(sendEmail).toHaveBeenCalled();
    });

    it("should return success even for non-existent users (security)", async () => {
      const { prisma } = await import("../../lib/prisma");

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: "nonexistent@example.com",
          }),
        }
      );

      const response = await forgotPasswordPOST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Password reset email sent");
    });

    it("should return 400 for invalid email", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: "invalid-email",
          }),
        }
      );

      const response = await forgotPasswordPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid email address");
    });

    it("should return 400 for missing email", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const response = await forgotPasswordPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Email is required");
    });

    it("should handle database errors gracefully", async () => {
      const { prisma } = await import("../../lib/prisma");

      vi.mocked(prisma.user.findUnique).mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: "test@example.com",
          }),
        }
      );

      const response = await forgotPasswordPOST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal server error");
    });

    it("should handle email sending failures gracefully", async () => {
      const { prisma } = await import("../../lib/prisma");
      const { sendEmail } = await import("../../lib/sendEmail");

      const existingUser = {
        id: "user1",
        email: "test@example.com",
        name: "Test User",
        companyId: "company1",
        role: "USER" as const,
        password: "hashed-password",
        resetToken: null,
        resetTokenExpiry: null,
        invitedAt: null,
        invitedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...existingUser,
        resetToken: "random-token",
        resetTokenExpiry: new Date(Date.now() + 3600000),
      });
      vi.mocked(sendEmail).mockResolvedValue({
        success: false,
        error: "Email service unavailable",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: "test@example.com",
          }),
        }
      );

      const response = await forgotPasswordPOST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Password reset email sent");
    });
  });
});
