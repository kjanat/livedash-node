import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "../../app/api/dashboard/metrics/route";
import { NextRequest } from "next/server";

// Mock NextAuth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock prisma
vi.mock("../../lib/prisma", () => ({
  prisma: {
    session: {
      count: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock auth options
vi.mock("../../lib/auth", () => ({
  authOptions: {},
}));

describe("/api/dashboard/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/dashboard/metrics", () => {
    it("should return 401 for unauthenticated users", async () => {
      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/dashboard/metrics"
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 404 when user not found", async () => {
      const { getServerSession } = await import("next-auth");
      const { prisma } = await import("../../lib/prisma");

      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "test@example.com" },
        expires: "2024-12-31",
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/dashboard/metrics"
      );
      const response = await GET(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("User not found");
    });

    it("should return 404 when company not found", async () => {
      const { getServerSession } = await import("next-auth");
      const { prisma } = await import("../../lib/prisma");

      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "test@example.com" },
        expires: "2024-12-31",
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user1",
        email: "test@example.com",
        companyId: "company1",
        role: "ADMIN",
        password: "hashed",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.company.findUnique).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/dashboard/metrics"
      );
      const response = await GET(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Company not found");
    });

    it("should return metrics data for valid requests", async () => {
      const { getServerSession } = await import("next-auth");
      const { prisma } = await import("../../lib/prisma");

      const mockUser = {
        id: "user1",
        email: "test@example.com",
        companyId: "company1",
        role: "ADMIN",
        password: "hashed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCompany = {
        id: "company1",
        name: "Test Company",
        csvUrl: "http://example.com/data.csv",
        sentimentAlert: 0.5,
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSessions = [
        {
          id: "session1",
          sessionId: "s1",
          companyId: "company1",
          startTime: new Date("2024-01-01T10:00:00Z"),
          endTime: new Date("2024-01-01T10:30:00Z"),
          sentiment: "POSITIVE",
          messagesSent: 5,
          avgResponseTime: 2.5,
          tokens: 100,
          tokensEur: 0.002,
          language: "en",
          country: "US",
          category: "SUPPORT",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "session2",
          sessionId: "s2",
          companyId: "company1",
          startTime: new Date("2024-01-02T14:00:00Z"),
          endTime: new Date("2024-01-02T14:15:00Z"),
          sentiment: "NEGATIVE",
          messagesSent: 3,
          avgResponseTime: 1.8,
          tokens: 75,
          tokensEur: 0.0015,
          language: "es",
          country: "ES",
          category: "BILLING",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "test@example.com" },
        expires: "2024-12-31",
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.company.findUnique).mockResolvedValue(mockCompany);
      vi.mocked(prisma.session.findMany).mockResolvedValue(mockSessions);
      vi.mocked(prisma.session.count).mockResolvedValue(2);

      const request = new NextRequest(
        "http://localhost:3000/api/dashboard/metrics"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.metrics).toBeDefined();
      expect(data.company).toBeDefined();
      expect(data.metrics.totalSessions).toBe(2);
      expect(data.company.name).toBe("Test Company");
    });

    it("should handle date range filtering", async () => {
      const { getServerSession } = await import("next-auth");
      const { prisma } = await import("../../lib/prisma");

      const mockUser = {
        id: "user1",
        email: "test@example.com",
        companyId: "company1",
        role: "ADMIN",
        password: "hashed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCompany = {
        id: "company1",
        name: "Test Company",
        csvUrl: "http://example.com/data.csv",
        sentimentAlert: 0.5,
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "test@example.com" },
        expires: "2024-12-31",
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.company.findUnique).mockResolvedValue(mockCompany);
      vi.mocked(prisma.session.findMany).mockResolvedValue([]);
      vi.mocked(prisma.session.count).mockResolvedValue(0);

      const request = new NextRequest(
        "http://localhost:3000/api/dashboard/metrics?startDate=2024-01-01&endDate=2024-01-31"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: "company1",
            startTime: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it("should calculate metrics correctly", async () => {
      const { getServerSession } = await import("next-auth");
      const { prisma } = await import("../../lib/prisma");

      const mockUser = {
        id: "user1",
        email: "test@example.com",
        companyId: "company1",
        role: "ADMIN",
        password: "hashed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCompany = {
        id: "company1",
        name: "Test Company",
        csvUrl: "http://example.com/data.csv",
        sentimentAlert: 0.5,
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSessions = [
        {
          id: "session1",
          sessionId: "s1",
          companyId: "company1",
          startTime: new Date("2024-01-01T10:00:00Z"),
          endTime: new Date("2024-01-01T10:30:00Z"),
          sentiment: "POSITIVE",
          messagesSent: 5,
          avgResponseTime: 2.0,
          tokens: 100,
          tokensEur: 0.002,
          language: "en",
          country: "US",
          category: "SUPPORT",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "session2",
          sessionId: "s2",
          companyId: "company1",
          startTime: new Date("2024-01-01T14:00:00Z"),
          endTime: new Date("2024-01-01T14:20:00Z"),
          sentiment: "NEGATIVE",
          messagesSent: 3,
          avgResponseTime: 3.0,
          tokens: 150,
          tokensEur: 0.003,
          language: "en",
          country: "US",
          category: "BILLING",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "test@example.com" },
        expires: "2024-12-31",
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.company.findUnique).mockResolvedValue(mockCompany);
      vi.mocked(prisma.session.findMany).mockResolvedValue(mockSessions);
      vi.mocked(prisma.session.count).mockResolvedValue(2);

      const request = new NextRequest(
        "http://localhost:3000/api/dashboard/metrics"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.metrics.totalSessions).toBe(2);
      expect(data.metrics.avgResponseTime).toBe(2.5); // (2.0 + 3.0) / 2
      expect(data.metrics.totalTokens).toBe(250); // 100 + 150
      expect(data.metrics.totalTokensEur).toBe(0.005); // 0.002 + 0.003
      expect(data.metrics.sentimentPositiveCount).toBe(1);
      expect(data.metrics.sentimentNegativeCount).toBe(1);
      expect(data.metrics.languages).toEqual({ en: 2 });
      expect(data.metrics.countries).toEqual({ US: 2 });
      expect(data.metrics.categories).toEqual({ SUPPORT: 1, BILLING: 1 });
    });

    it("should handle errors gracefully", async () => {
      const { getServerSession } = await import("next-auth");
      const { prisma } = await import("../../lib/prisma");

      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "test@example.com" },
        expires: "2024-12-31",
      });

      vi.mocked(prisma.user.findUnique).mockRejectedValue(
        new Error("Database error")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/dashboard/metrics"
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Database error");
    });

    it("should return empty metrics for companies with no sessions", async () => {
      const { getServerSession } = await import("next-auth");
      const { prisma } = await import("../../lib/prisma");

      const mockUser = {
        id: "user1",
        email: "test@example.com",
        companyId: "company1",
        role: "ADMIN",
        password: "hashed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCompany = {
        id: "company1",
        name: "Test Company",
        csvUrl: "http://example.com/data.csv",
        sentimentAlert: 0.5,
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "test@example.com" },
        expires: "2024-12-31",
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.company.findUnique).mockResolvedValue(mockCompany);
      vi.mocked(prisma.session.findMany).mockResolvedValue([]);
      vi.mocked(prisma.session.count).mockResolvedValue(0);

      const request = new NextRequest(
        "http://localhost:3000/api/dashboard/metrics"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.metrics.totalSessions).toBe(0);
      expect(data.metrics.avgResponseTime).toBe(0);
      expect(data.metrics.totalTokens).toBe(0);
      expect(data.metrics.languages).toEqual({});
      expect(data.metrics.countries).toEqual({});
      expect(data.metrics.categories).toEqual({});
    });
  });
});
