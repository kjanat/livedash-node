import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../../app/api/dashboard/metrics/route";

// Mock NextAuth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock prisma
vi.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
    session: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    sessionQuestion: {
      findMany: vi.fn(),
    },
  },
}));

describe("/api/dashboard/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
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
        name: "Test User",
        email: "test@example.com",
        companyId: "company1",
        role: "ADMIN" as const,
        password: "hashed",
        resetToken: null,
        resetTokenExpiry: null,
        invitedAt: null,
        invitedBy: null,
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

    it("should return dashboard metrics successfully for admin", async () => {
      const { getServerSession } = await import("next-auth");
      const { prisma } = await import("../../lib/prisma");

      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "admin@example.com" },
        expires: "2024-12-31",
      });

      const mockUser = {
        id: "user1",
        name: "Test Admin",
        email: "admin@example.com",
        companyId: "company1",
        role: "ADMIN" as const,
        password: "hashed",
        resetToken: null,
        resetTokenExpiry: null,
        invitedAt: null,
        invitedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCompany = {
        id: "company1",
        name: "Test Company",
        csvUrl: "http://example.com/data.csv",
        csvUsername: null,
        csvPassword: null,
        dashboardOpts: {},
        maxUsers: 10,
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSessions = [
        {
          id: "session1",
          companyId: "company1",
          importId: "import1",
          startTime: new Date("2024-01-01T10:00:00Z"),
          endTime: new Date("2024-01-01T11:00:00Z"),
          ipAddress: "192.168.1.1",
          country: "US",
          fullTranscriptUrl: null,
          avgResponseTime: null,
          initialMsg: null,
          messagesSent: 5,
          escalated: false,
          forwardedHr: false,
          sentiment: "POSITIVE" as const,
          category: "SCHEDULE_HOURS" as const,
          language: "en",
          summary: "Test summary",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.company.findUnique).mockResolvedValue(mockCompany);
      vi.mocked(prisma.session.findMany).mockResolvedValue(mockSessions);
      vi.mocked(prisma.session.count).mockResolvedValue(1);
      vi.mocked(prisma.sessionQuestion.findMany).mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/dashboard/metrics"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("totalSessions");
      expect(data).toHaveProperty("sentimentDistribution");
      expect(data).toHaveProperty("countryCounts");
      expect(data).toHaveProperty("topQuestions");
      expect(data.totalSessions).toBe(1);
    });

    it("should return dashboard metrics successfully for regular user", async () => {
      const { getServerSession } = await import("next-auth");
      const { prisma } = await import("../../lib/prisma");

      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "user@example.com" },
        expires: "2024-12-31",
      });

      const mockUser = {
        id: "user1",
        name: "Test User",
        email: "user@example.com",
        companyId: "company1",
        role: "USER" as const,
        password: "hashed",
        resetToken: null,
        resetTokenExpiry: null,
        invitedAt: null,
        invitedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCompany = {
        id: "company1",
        name: "Test Company",
        csvUrl: "http://example.com/data.csv",
        csvUsername: null,
        csvPassword: null,
        dashboardOpts: {},
        maxUsers: 10,
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSessions = [
        {
          id: "session1",
          companyId: "company1",
          importId: "import1",
          startTime: new Date("2024-01-01T10:00:00Z"),
          endTime: new Date("2024-01-01T11:00:00Z"),
          ipAddress: "192.168.1.1",
          country: "US",
          fullTranscriptUrl: null,
          avgResponseTime: null,
          initialMsg: null,
          messagesSent: 5,
          escalated: false,
          forwardedHr: false,
          sentiment: "POSITIVE" as const,
          category: "SCHEDULE_HOURS" as const,
          language: "en",
          summary: "Test summary",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.company.findUnique).mockResolvedValue(mockCompany);
      vi.mocked(prisma.session.findMany).mockResolvedValue(mockSessions);
      vi.mocked(prisma.session.count).mockResolvedValue(1);
      vi.mocked(prisma.sessionQuestion.findMany).mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/dashboard/metrics"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("totalSessions");
      expect(data).toHaveProperty("sentimentDistribution");
      expect(data).toHaveProperty("countryCounts");
      expect(data).toHaveProperty("topQuestions");
    });

    it("should handle date range filters", async () => {
      const { getServerSession } = await import("next-auth");
      const { prisma } = await import("../../lib/prisma");

      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "user@example.com" },
        expires: "2024-12-31",
      });

      const mockUser = {
        id: "user1",
        name: "Test User",
        email: "user@example.com",
        companyId: "company1",
        role: "USER" as const,
        password: "hashed",
        resetToken: null,
        resetTokenExpiry: null,
        invitedAt: null,
        invitedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCompany = {
        id: "company1",
        name: "Test Company",
        csvUrl: "http://example.com/data.csv",
        csvUsername: null,
        csvPassword: null,
        dashboardOpts: {},
        maxUsers: 10,
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.company.findUnique).mockResolvedValue(mockCompany);
      vi.mocked(prisma.session.findMany).mockResolvedValue([]);
      vi.mocked(prisma.session.count).mockResolvedValue(0);
      vi.mocked(prisma.sessionQuestion.findMany).mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/dashboard/metrics?startDate=2024-01-01&endDate=2024-01-31"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.totalSessions).toBe(0);
    });

    it("should handle database errors gracefully", async () => {
      const { getServerSession } = await import("next-auth");
      const { prisma } = await import("../../lib/prisma");

      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "user@example.com" },
        expires: "2024-12-31",
      });

      vi.mocked(prisma.user.findUnique).mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/dashboard/metrics"
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal server error");
    });
  });
});