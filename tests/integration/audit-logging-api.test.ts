import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { GET } from "../../app/api/admin/audit-logs/route";
import {
  GET as RetentionGET,
  POST as RetentionPOST,
} from "../../app/api/admin/audit-logs/retention/route";
import { prisma } from "../../lib/prisma";

// Mock dependencies
vi.mock("next-auth/next");
vi.mock("../../lib/prisma", () => ({
  prisma: {
    securityAuditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      groupBy: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("../../lib/rateLimiter", () => ({
  extractClientIP: vi.fn().mockReturnValue("192.168.1.1"),
}));

vi.mock("../../lib/securityAuditLogger", () => ({
  securityAuditLogger: {
    logAuthorization: vi.fn(),
    logDataPrivacy: vi.fn(),
    log: vi.fn(),
  },
  AuditOutcome: {
    SUCCESS: "SUCCESS",
    FAILURE: "FAILURE",
    BLOCKED: "BLOCKED",
  },
  createAuditMetadata: vi.fn((data) => data),
}));

vi.mock("../../lib/auditLogRetention", () => ({
  AuditLogRetentionManager: vi.fn().mockImplementation(() => ({
    getRetentionStatistics: vi.fn().mockResolvedValue({
      totalLogs: 1000,
      logsByEventType: { AUTHENTICATION: 600, AUTHORIZATION: 400 },
      logsBySeverity: { INFO: 700, MEDIUM: 250, HIGH: 50 },
      logsByAge: [
        { age: "Last 24 hours", count: 50 },
        { age: "Last 7 days", count: 200 },
      ],
      oldestLog: new Date("2023-01-01"),
      newestLog: new Date("2024-01-15"),
    }),
    validateRetentionPolicies: vi.fn().mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
    }),
  })),
  DEFAULT_RETENTION_POLICIES: [
    { name: "Test Policy", maxAgeDays: 365, archiveBeforeDelete: true },
  ],
  executeScheduledRetention: vi.fn().mockResolvedValue({
    totalProcessed: 100,
    totalDeleted: 50,
    totalArchived: 50,
    policyResults: [],
  }),
}));

vi.mock("../../lib/auditLogScheduler", () => ({
  auditLogScheduler: {
    getStatus: vi.fn().mockReturnValue({
      isRunning: true,
      nextExecution: new Date("2024-01-16T02:00:00Z"),
      schedule: "0 2 * * 0",
    }),
  },
}));

const createMockRequest = (url: string, options: RequestInit = {}) => {
  return new NextRequest(url, {
    headers: {
      "user-agent": "Test Agent",
      "x-forwarded-for": "192.168.1.1",
      ...options.headers,
    },
    ...options,
  });
};

const mockSession = {
  user: {
    id: "user-123",
    email: "admin@company.com",
    role: "ADMIN",
    companyId: "company-456",
  },
};

const mockUserSession = {
  user: {
    id: "user-456",
    email: "user@company.com",
    role: "USER",
    companyId: "company-456",
  },
};

describe("Audit Logs API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/audit-logs", () => {
    it("should return audit logs for admin users", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.securityAuditLog.findMany).mockResolvedValue([
        {
          id: "log-1",
          eventType: "AUTHENTICATION",
          action: "login_success",
          outcome: "SUCCESS",
          severity: "INFO",
          timestamp: new Date("2024-01-15T10:00:00Z"),
          userId: "user-123",
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
          metadata: { browser: "Chrome" },
          user: {
            id: "user-123",
            email: "user@company.com",
            name: "Test User",
            role: "USER",
          },
          platformUser: null,
        },
      ]);
      vi.mocked(prisma.securityAuditLog.count).mockResolvedValue(1);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs?page=1&limit=50"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.auditLogs).toHaveLength(1);
      expect(data.data.pagination).toEqual({
        page: 1,
        limit: 50,
        totalCount: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it("should filter audit logs by event type", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.securityAuditLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.securityAuditLog.count).mockResolvedValue(0);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs?eventType=AUTHENTICATION"
      );
      await GET(request);

      expect(prisma.securityAuditLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          eventType: "AUTHENTICATION",
        }),
        skip: 0,
        take: 50,
        orderBy: { timestamp: "desc" },
        include: expect.any(Object),
      });
    });

    it("should filter audit logs by date range", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.securityAuditLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.securityAuditLog.count).mockResolvedValue(0);

      const startDate = "2024-01-01T00:00:00Z";
      const endDate = "2024-01-31T23:59:59Z";
      const request = createMockRequest(
        `http://localhost:3000/api/admin/audit-logs?startDate=${startDate}&endDate=${endDate}`
      );
      await GET(request);

      expect(prisma.securityAuditLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          timestamp: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
        skip: 0,
        take: 50,
        orderBy: { timestamp: "desc" },
        include: expect.any(Object),
      });
    });

    it("should reject unauthorized users", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Unauthorized");
    });

    it("should reject non-admin users", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockUserSession);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Insufficient permissions");
    });

    it("should handle server errors gracefully", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.securityAuditLog.findMany).mockRejectedValue(
        new Error("Database error")
      );

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Internal server error");
    });

    it("should enforce pagination limits", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.securityAuditLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.securityAuditLog.count).mockResolvedValue(0);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs?limit=200"
      );
      await GET(request);

      expect(prisma.securityAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // Should be capped at 100
        })
      );
    });

    it("should scope logs to user's company", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.securityAuditLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.securityAuditLog.count).mockResolvedValue(0);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs"
      );
      await GET(request);

      expect(prisma.securityAuditLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          companyId: "company-456",
        }),
        skip: 0,
        take: 50,
        orderBy: { timestamp: "desc" },
        include: expect.any(Object),
      });
    });
  });

  describe("GET /api/admin/audit-logs/retention", () => {
    it("should return retention statistics for admin users", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs/retention"
      );
      const response = await RetentionGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.statistics).toBeDefined();
      expect(data.data.policies).toBeDefined();
      expect(data.data.policyValidation).toBeDefined();
      expect(data.data.scheduler).toBeDefined();
    });

    it("should reject non-admin users", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockUserSession);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs/retention"
      );
      const response = await RetentionGET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });

  describe("POST /api/admin/audit-logs/retention", () => {
    it("should execute retention policies in dry run mode", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs/retention",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "execute", isDryRun: true }),
        }
      );

      const response = await RetentionPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isDryRun).toBe(true);
      expect(data.data.message).toContain("Dry run completed");
    });

    it("should execute retention policies in production mode", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs/retention",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "execute", isDryRun: false }),
        }
      );

      const response = await RetentionPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isDryRun).toBe(false);
      expect(data.data.message).toContain("executed successfully");
    });

    it("should reject invalid actions", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs/retention",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "invalid" }),
        }
      );

      const response = await RetentionPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid action");
    });

    it("should reject unauthorized users", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockUserSession);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs/retention",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "execute" }),
        }
      );

      const response = await RetentionPOST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe("Audit Log Integration", () => {
    it("should log access to audit logs", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.securityAuditLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.securityAuditLog.count).mockResolvedValue(0);

      const { securityAuditLogger } = await import(
        "../../lib/securityAuditLogger"
      );

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs"
      );
      await GET(request);

      expect(securityAuditLogger.logDataPrivacy).toHaveBeenCalledWith(
        "audit_logs_accessed",
        "SUCCESS",
        expect.objectContaining({
          userId: "user-123",
          companyId: "company-456",
          ipAddress: "192.168.1.1",
        }),
        "Audit logs accessed by admin user"
      );
    });

    it("should log retention policy execution", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);

      const { securityAuditLogger } = await import(
        "../../lib/securityAuditLogger"
      );

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs/retention",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "execute", isDryRun: true }),
        }
      );

      await RetentionPOST(request);

      expect(securityAuditLogger.logDataPrivacy).toHaveBeenCalledWith(
        "audit_retention_manual_execution",
        "SUCCESS",
        expect.objectContaining({
          userId: "user-123",
          companyId: "company-456",
        }),
        expect.stringContaining("Admin manually triggered audit retention")
      );
    });

    it("should log unauthorized access attempts", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const { securityAuditLogger } = await import(
        "../../lib/securityAuditLogger"
      );

      const request = createMockRequest(
        "http://localhost:3000/api/admin/audit-logs"
      );
      await GET(request);

      expect(securityAuditLogger.logAuthorization).toHaveBeenCalledWith(
        "audit_logs_unauthorized_access",
        "BLOCKED",
        expect.objectContaining({
          ipAddress: "192.168.1.1",
        }),
        "Unauthorized attempt to access audit logs"
      );
    });
  });
});
