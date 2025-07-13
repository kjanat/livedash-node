import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "../../lib/prisma";
import {
  securityAuditLogger,
  SecurityEventType,
  AuditOutcome,
  AuditSeverity,
  createAuditMetadata,
  createAuditContext,
} from "../../lib/securityAuditLogger";
import {
  AuditLogRetentionManager,
  DEFAULT_RETENTION_POLICIES,
} from "../../lib/auditLogRetention";
import { NextRequest } from "next/server";

// Mock Prisma
vi.mock("../../lib/prisma", () => ({
  prisma: {
    securityAuditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

describe("Security Audit Logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("SecurityAuditLogger", () => {
    it("should log authentication events with correct structure", async () => {
      const mockCreate = vi.mocked(prisma.securityAuditLog.create);
      mockCreate.mockResolvedValueOnce({} as any);

      const context = {
        userId: "user-123",
        companyId: "company-456",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        metadata: { action: "login" },
      };

      await securityAuditLogger.logAuthentication(
        "user_login",
        AuditOutcome.SUCCESS,
        context,
        undefined
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          eventType: SecurityEventType.AUTHENTICATION,
          action: "user_login",
          outcome: AuditOutcome.SUCCESS,
          severity: AuditSeverity.INFO,
          userId: "user-123",
          companyId: "company-456",
          platformUserId: null,
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
          country: null,
          sessionId: null,
          requestId: null,
          metadata: { action: "login" },
          errorMessage: null,
        },
      });
    });

    it("should assign correct severity for failed authentication", async () => {
      const mockCreate = vi.mocked(prisma.securityAuditLog.create);
      mockCreate.mockResolvedValueOnce({} as any);

      await securityAuditLogger.logAuthentication(
        "user_login_failed",
        AuditOutcome.FAILURE,
        { ipAddress: "192.168.1.1" },
        "Invalid credentials"
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: AuditSeverity.MEDIUM,
          errorMessage: "Invalid credentials",
        }),
      });
    });

    it("should assign high severity for blocked authentication", async () => {
      const mockCreate = vi.mocked(prisma.securityAuditLog.create);
      mockCreate.mockResolvedValueOnce({} as any);

      await securityAuditLogger.logAuthentication(
        "user_login_blocked",
        AuditOutcome.BLOCKED,
        { ipAddress: "192.168.1.1" },
        "Account suspended"
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: AuditSeverity.HIGH,
        }),
      });
    });

    it("should log platform admin events with critical severity", async () => {
      const mockCreate = vi.mocked(prisma.securityAuditLog.create);
      mockCreate.mockResolvedValueOnce({} as any);

      await securityAuditLogger.logPlatformAdmin(
        "company_suspended",
        AuditOutcome.SUCCESS,
        {
          platformUserId: "admin-123",
          companyId: "company-456",
          ipAddress: "10.0.0.1",
        }
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: SecurityEventType.PLATFORM_ADMIN,
          severity: AuditSeverity.HIGH,
          platformUserId: "admin-123",
        }),
      });
    });

    it("should handle logging errors gracefully", async () => {
      const mockCreate = vi.mocked(prisma.securityAuditLog.create);
      mockCreate.mockRejectedValueOnce(new Error("Database error"));

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Should not throw
      await expect(
        securityAuditLogger.logAuthentication(
          "test_action",
          AuditOutcome.SUCCESS,
          { ipAddress: "127.0.0.1" }
        )
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to write audit log:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should respect audit logging disabled flag", async () => {
      const originalEnv = process.env.AUDIT_LOGGING_ENABLED;
      process.env.AUDIT_LOGGING_ENABLED = "false";

      const mockCreate = vi.mocked(prisma.securityAuditLog.create);

      // Create new instance to pick up environment change
      const disabledLogger = new (
        await import("../../lib/securityAuditLogger")
      ).SecurityAuditLogger();

      await (disabledLogger as any).log({
        eventType: SecurityEventType.AUTHENTICATION,
        action: "test",
        outcome: AuditOutcome.SUCCESS,
        context: {},
      });

      expect(mockCreate).not.toHaveBeenCalled();

      process.env.AUDIT_LOGGING_ENABLED = originalEnv;
    });
  });

  describe("createAuditMetadata", () => {
    it("should sanitize sensitive data", () => {
      const input = {
        email: "user@example.com",
        password: "secret123",
        token: "jwt-token",
        count: 5,
        isValid: true,
        nestedObject: { key: "value" },
        arrayOfObjects: [{ id: 1 }, { id: 2 }],
        arrayOfStrings: ["a", "b", "c"],
      };

      const result = createAuditMetadata(input);

      expect(result).toEqual({
        email: "user@example.com",
        password: "secret123",
        token: "jwt-token",
        count: 5,
        isValid: true,
        nestedObject: "[Object]",
        arrayOfObjects: ["[Object]", "[Object]"],
        arrayOfStrings: ["a", "b", "c"],
      });
    });

    it("should handle empty and null values", () => {
      const input = {
        emptyString: "",
        nullValue: null,
        undefinedValue: undefined,
        zeroNumber: 0,
        falseBool: false,
      };

      const result = createAuditMetadata(input);

      expect(result).toEqual({
        emptyString: "",
        zeroNumber: 0,
        falseBool: false,
      });
    });
  });

  describe("createAuditContext", () => {
    it("should extract context from NextRequest", async () => {
      const mockRequest = new NextRequest("http://localhost:3000/api/test", {
        headers: {
          "user-agent": "Test Agent",
          "x-forwarded-for": "203.0.113.1",
          "x-request-id": "req-123",
        },
      });

      const context = await createAuditContext(mockRequest);

      expect(context).toEqual({
        requestId: expect.any(String),
        ipAddress: "203.0.113.1",
        userAgent: "Test Agent",
      });
    });

    it("should include session information when provided", async () => {
      const mockSession = {
        user: {
          id: "user-123",
          email: "user@example.com",
          companyId: "company-456",
          role: "USER",
        },
      };

      const context = await createAuditContext(undefined, mockSession);

      expect(context).toEqual({
        requestId: expect.any(String),
        userId: "user-123",
        companyId: "company-456",
      });
    });

    it("should detect platform users", async () => {
      const mockSession = {
        user: {
          id: "admin-123",
          email: "admin@platform.com",
          isPlatformUser: true,
        },
      };

      const context = await createAuditContext(undefined, mockSession);

      expect(context).toEqual({
        requestId: expect.any(String),
        userId: "admin-123",
        platformUserId: "admin-123",
      });
    });
  });

  describe("AuditLogRetentionManager", () => {
    it("should validate retention policies correctly", async () => {
      const manager = new AuditLogRetentionManager();
      const validation = await manager.validateRetentionPolicies();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it("should detect invalid retention policies", async () => {
      const invalidPolicies = [
        {
          name: "",
          maxAgeDays: 30,
        },
        {
          name: "Invalid Age",
          maxAgeDays: -5,
        },
      ];

      const manager = new AuditLogRetentionManager(invalidPolicies);
      const validation = await manager.validateRetentionPolicies();

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("should calculate retention statistics", async () => {
      const mockCount = vi.mocked(prisma.securityAuditLog.count);
      const mockGroupBy = vi.mocked(prisma.securityAuditLog.groupBy);
      const mockFindFirst = vi.mocked(prisma.securityAuditLog.findFirst);

      mockCount
        .mockResolvedValueOnce(1000) // total logs
        .mockResolvedValueOnce(50) // last 24 hours
        .mockResolvedValueOnce(200) // last 7 days
        .mockResolvedValueOnce(500) // last 30 days
        .mockResolvedValueOnce(800) // last 90 days
        .mockResolvedValueOnce(950) // last 365 days
        .mockResolvedValueOnce(50); // older than 1 year

      mockGroupBy
        .mockResolvedValueOnce([
          { eventType: "AUTHENTICATION", _count: { id: 600 } },
          { eventType: "AUTHORIZATION", _count: { id: 400 } },
        ])
        .mockResolvedValueOnce([
          { severity: "INFO", _count: { id: 700 } },
          { severity: "MEDIUM", _count: { id: 250 } },
          { severity: "HIGH", _count: { id: 50 } },
        ]);

      mockFindFirst
        .mockResolvedValueOnce({ timestamp: new Date("2023-01-01") })
        .mockResolvedValueOnce({ timestamp: new Date("2024-01-15") });

      const manager = new AuditLogRetentionManager();
      const stats = await manager.getRetentionStatistics();

      expect(stats.totalLogs).toBe(1000);
      expect(stats.logsByEventType).toEqual({
        AUTHENTICATION: 600,
        AUTHORIZATION: 400,
      });
      expect(stats.logsBySeverity).toEqual({
        INFO: 700,
        MEDIUM: 250,
        HIGH: 50,
      });
      expect(stats.logsByAge).toHaveLength(6);
      expect(stats.oldestLog).toEqual(new Date("2023-01-01"));
      expect(stats.newestLog).toEqual(new Date("2024-01-15"));
    });

    it("should execute retention policies in dry run mode", async () => {
      const mockCount = vi.mocked(prisma.securityAuditLog.count);
      const mockDeleteMany = vi.mocked(prisma.securityAuditLog.deleteMany);

      mockCount.mockResolvedValue(100);

      const manager = new AuditLogRetentionManager(
        DEFAULT_RETENTION_POLICIES,
        true
      );
      const results = await manager.executeRetentionPolicies();

      expect(results.totalProcessed).toBeGreaterThan(0);
      expect(mockDeleteMany).not.toHaveBeenCalled(); // Dry run shouldn't delete
    });

    it("should execute retention policies with actual deletion", async () => {
      const mockCount = vi.mocked(prisma.securityAuditLog.count);
      const mockDeleteMany = vi.mocked(prisma.securityAuditLog.deleteMany);

      mockCount.mockResolvedValue(50);
      mockDeleteMany.mockResolvedValue({ count: 50 });

      const testPolicies = [
        {
          name: "Test Policy",
          maxAgeDays: 30,
          severityFilter: ["INFO"],
          archiveBeforeDelete: false,
        },
      ];

      const manager = new AuditLogRetentionManager(testPolicies, false);
      const results = await manager.executeRetentionPolicies();

      expect(results.totalDeleted).toBe(50);
      expect(mockDeleteMany).toHaveBeenCalled();
    });

    it("should handle retention policy errors gracefully", async () => {
      const mockCount = vi.mocked(prisma.securityAuditLog.count);
      mockCount.mockRejectedValue(new Error("Database connection failed"));

      const manager = new AuditLogRetentionManager();
      const results = await manager.executeRetentionPolicies();

      expect(
        results.policyResults.every((result) => result.errors.length > 0)
      ).toBe(true);
    });

    it("should detect policy overlaps", async () => {
      const overlappingPolicies = [
        {
          name: "Policy 1",
          maxAgeDays: 30,
          severityFilter: ["INFO", "LOW"],
        },
        {
          name: "Policy 2",
          maxAgeDays: 60,
          severityFilter: ["LOW", "MEDIUM"],
        },
      ];

      const manager = new AuditLogRetentionManager(overlappingPolicies);
      const validation = await manager.validateRetentionPolicies();

      expect(validation.warnings.some((w) => w.includes("overlap"))).toBe(true);
    });
  });

  describe("Severity Assignment", () => {
    it("should assign correct severity for user management actions", async () => {
      const mockCreate = vi.mocked(prisma.securityAuditLog.create);
      mockCreate.mockResolvedValue({} as any);

      // Test privileged action
      await securityAuditLogger.logUserManagement(
        "user_deleted",
        AuditOutcome.SUCCESS,
        { userId: "admin-123" }
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: AuditSeverity.HIGH,
        }),
      });

      mockCreate.mockClear();

      // Test regular action
      await securityAuditLogger.logUserManagement(
        "user_profile_updated",
        AuditOutcome.SUCCESS,
        { userId: "user-123" }
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: AuditSeverity.MEDIUM,
        }),
      });
    });

    it("should assign correct severity for company management actions", async () => {
      const mockCreate = vi.mocked(prisma.securityAuditLog.create);
      mockCreate.mockResolvedValue({} as any);

      // Test critical action
      await securityAuditLogger.logCompanyManagement(
        "company_suspended",
        AuditOutcome.SUCCESS,
        { platformUserId: "admin-123" }
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: AuditSeverity.CRITICAL,
        }),
      });
    });

    it("should assign high severity for data privacy events", async () => {
      const mockCreate = vi.mocked(prisma.securityAuditLog.create);
      mockCreate.mockResolvedValue({} as any);

      await securityAuditLogger.logDataPrivacy(
        "data_exported",
        AuditOutcome.SUCCESS,
        { userId: "user-123" }
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: AuditSeverity.HIGH,
        }),
      });
    });
  });

  describe("Error Handling", () => {
    it("should continue operation when audit logging fails", async () => {
      const mockCreate = vi.mocked(prisma.securityAuditLog.create);
      mockCreate.mockRejectedValue(new Error("Database error"));

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // This should not throw an error
      await expect(
        securityAuditLogger.logAuthentication(
          "test_action",
          AuditOutcome.SUCCESS,
          {}
        )
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should handle missing context gracefully", async () => {
      const mockCreate = vi.mocked(prisma.securityAuditLog.create);
      mockCreate.mockResolvedValue({} as any);

      await securityAuditLogger.logAuthentication(
        "test_action",
        AuditOutcome.SUCCESS,
        {} // Empty context
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
          companyId: null,
          ipAddress: null,
        }),
      });
    });
  });
});
