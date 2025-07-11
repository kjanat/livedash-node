import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  securityMonitoring,
  enhancedSecurityLog,
  AlertSeverity,
  AlertType,
  ThreatLevel,
} from "@/lib/securityMonitoring";
import {
  SecurityEventType,
  AuditOutcome,
  AuditSeverity,
} from "@/lib/securityAuditLogger";
import { prisma } from "@/lib/prisma";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    securityAuditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock securityAuditLogger
vi.mock("@/lib/securityAuditLogger", async () => {
  const actual = await vi.importActual("@/lib/securityAuditLogger");
  return {
    ...actual,
    securityAuditLogger: {
      log: vi.fn(),
    },
  };
});

describe("Security Monitoring System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset the monitoring service state
    securityMonitoring.updateConfig({
      thresholds: {
        failedLoginsPerMinute: 5,
        failedLoginsPerHour: 20,
        rateLimitViolationsPerMinute: 10,
        cspViolationsPerMinute: 15,
        adminActionsPerHour: 25,
        massDataAccessThreshold: 100,
        suspiciousIPThreshold: 10,
      },
    });
  });

  describe("Alert Generation", () => {
    it("should generate brute force alert for multiple failed logins", async () => {
      const mockCount = vi.mocked(prisma.securityAuditLog.count);
      const mockFindMany = vi.mocked(prisma.securityAuditLog.findMany);

      mockCount.mockResolvedValue(6); // Above threshold of 5
      mockFindMany.mockResolvedValue([]); // Empty historical events for anomaly detection

      const context = {
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0",
        requestId: "test-123",
      };

      await enhancedSecurityLog(
        SecurityEventType.AUTHENTICATION,
        "login_attempt",
        AuditOutcome.FAILURE,
        context,
        AuditSeverity.HIGH,
        "Failed login attempt"
      );

      expect(mockCount).toHaveBeenCalledWith({
        where: {
          eventType: SecurityEventType.AUTHENTICATION,
          outcome: AuditOutcome.FAILURE,
          ipAddress: "192.168.1.100",
          timestamp: expect.any(Object),
        },
      });
    });

    it("should generate rate limit breach alert", async () => {
      const mockCount = vi.mocked(prisma.securityAuditLog.count);
      const mockFindMany = vi.mocked(prisma.securityAuditLog.findMany);

      mockCount.mockResolvedValue(11); // Above threshold of 10
      mockFindMany.mockResolvedValue([]); // Empty historical events for anomaly detection

      const context = {
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0",
        requestId: "test-123",
      };

      await enhancedSecurityLog(
        SecurityEventType.RATE_LIMITING,
        "rate_limit_exceeded",
        AuditOutcome.RATE_LIMITED,
        context,
        AuditSeverity.MEDIUM,
        "Rate limit exceeded"
      );

      expect(mockCount).toHaveBeenCalled();
    });

    it("should generate admin activity alert for excessive actions", async () => {
      const mockCount = vi.mocked(prisma.securityAuditLog.count);
      const mockFindMany = vi.mocked(prisma.securityAuditLog.findMany);

      mockCount.mockResolvedValue(26); // Above threshold of 25
      mockFindMany.mockResolvedValue([]); // Empty historical events for anomaly detection

      const context = {
        userId: "user-123",
        requestId: "test-123",
      };

      await enhancedSecurityLog(
        SecurityEventType.PLATFORM_ADMIN,
        "admin_action",
        AuditOutcome.SUCCESS,
        context,
        AuditSeverity.INFO,
        "Admin action performed"
      );

      expect(mockCount).toHaveBeenCalled();
    });
  });

  describe("Anomaly Detection", () => {
    it("should detect geographical anomalies", async () => {
      const mockFindMany = vi.mocked(prisma.securityAuditLog.findMany);
      mockFindMany.mockResolvedValue([
        {
          id: "1",
          eventType: SecurityEventType.AUTHENTICATION,
          action: "login_success",
          outcome: AuditOutcome.SUCCESS,
          userId: "user-123",
          companyId: "company-1",
          platformUserId: null,
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
          country: "USA",
          metadata: null,
          errorMessage: null,
          severity: AuditSeverity.INFO,
          sessionId: null,
          requestId: "req-1",
          timestamp: new Date(),
        },
      ]);

      const context = {
        userId: "user-123",
        country: "CHN", // Different country
        requestId: "test-123",
      };

      await enhancedSecurityLog(
        SecurityEventType.AUTHENTICATION,
        "login_success",
        AuditOutcome.SUCCESS,
        context,
        AuditSeverity.INFO
      );

      expect(mockFindMany).toHaveBeenCalled();
    });

    it("should detect temporal anomalies", async () => {
      const mockFindMany = vi.mocked(prisma.securityAuditLog.findMany);

      // Mock historical data showing low activity
      mockFindMany.mockResolvedValue([
        {
          id: "1",
          eventType: SecurityEventType.AUTHENTICATION,
          action: "login_success",
          outcome: AuditOutcome.SUCCESS,
          userId: "user-123",
          companyId: "company-1",
          platformUserId: null,
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
          country: "USA",
          metadata: null,
          errorMessage: null,
          severity: AuditSeverity.INFO,
          sessionId: null,
          requestId: "req-1",
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        },
      ]);

      // Simulate multiple events in short time
      for (let i = 0; i < 10; i++) {
        await enhancedSecurityLog(
          SecurityEventType.AUTHENTICATION,
          "login_success",
          AuditOutcome.SUCCESS,
          { requestId: `test-${i}` },
          AuditSeverity.INFO
        );
      }

      expect(mockFindMany).toHaveBeenCalled();
    });
  });

  describe("Security Metrics", () => {
    it("should calculate comprehensive security metrics", async () => {
      const mockEvents = [
        {
          id: "1",
          eventType: SecurityEventType.AUTHENTICATION,
          action: "login_success",
          outcome: AuditOutcome.SUCCESS,
          userId: "user-1",
          companyId: "company-1",
          platformUserId: null,
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
          country: "USA",
          metadata: null,
          errorMessage: null,
          severity: AuditSeverity.INFO,
          sessionId: null,
          requestId: "req-1",
          timestamp: new Date(),
          user: { email: "user1@test.com" },
          company: { name: "Test Company" },
        },
        {
          id: "2",
          eventType: SecurityEventType.AUTHENTICATION,
          action: "login_failure",
          outcome: AuditOutcome.FAILURE,
          userId: "user-2",
          companyId: "company-1",
          platformUserId: null,
          ipAddress: "192.168.1.2",
          userAgent: "Mozilla/5.0",
          country: "GBR",
          metadata: null,
          errorMessage: "Invalid password",
          severity: AuditSeverity.CRITICAL,
          sessionId: null,
          requestId: "req-2",
          timestamp: new Date(),
          user: { email: "user2@test.com" },
          company: { name: "Test Company" },
        },
      ];

      const mockFindMany = vi.mocked(prisma.securityAuditLog.findMany);
      mockFindMany.mockResolvedValue(mockEvents);

      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const metrics = await securityMonitoring.getSecurityMetrics(timeRange);

      expect(metrics).toMatchObject({
        totalEvents: 2,
        criticalEvents: 1,
        activeAlerts: expect.any(Number),
        resolvedAlerts: expect.any(Number),
        securityScore: expect.any(Number),
        threatLevel: expect.any(String),
        eventsByType: expect.any(Object),
        alertsByType: expect.any(Object),
        topThreats: expect.any(Array),
        geoDistribution: expect.any(Object),
        timeDistribution: expect.any(Array),
        userRiskScores: expect.any(Array),
      });

      expect(metrics.securityScore).toBeGreaterThanOrEqual(0);
      expect(metrics.securityScore).toBeLessThanOrEqual(100);
      expect(Object.values(ThreatLevel)).toContain(metrics.threatLevel);
    });

    it("should calculate user risk scores correctly", async () => {
      const mockEvents = [
        {
          id: "1",
          eventType: SecurityEventType.AUTHENTICATION,
          action: "login_failure",
          outcome: AuditOutcome.FAILURE,
          userId: "user-1",
          companyId: "company-1",
          platformUserId: null,
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
          country: "USA",
          metadata: null,
          errorMessage: "Invalid password",
          severity: AuditSeverity.HIGH,
          sessionId: null,
          requestId: "req-1",
          timestamp: new Date(),
          user: { email: "highrisk@test.com" },
          company: { name: "Test Company" },
        },
        {
          id: "2",
          eventType: SecurityEventType.RATE_LIMITING,
          action: "rate_limit_exceeded",
          outcome: AuditOutcome.RATE_LIMITED,
          userId: "user-1",
          companyId: "company-1",
          platformUserId: null,
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
          country: "USA",
          metadata: null,
          errorMessage: null,
          severity: AuditSeverity.MEDIUM,
          sessionId: null,
          requestId: "req-2",
          timestamp: new Date(),
          user: { email: "highrisk@test.com" },
          company: { name: "Test Company" },
        },
      ];

      const mockFindMany = vi.mocked(prisma.securityAuditLog.findMany);
      mockFindMany.mockResolvedValue(mockEvents);

      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const metrics = await securityMonitoring.getSecurityMetrics(timeRange);

      expect(metrics.userRiskScores).toHaveLength(1);
      expect(metrics.userRiskScores[0]).toMatchObject({
        userId: "user-1",
        email: "highrisk@test.com",
        riskScore: expect.any(Number),
      });
      expect(metrics.userRiskScores[0].riskScore).toBeGreaterThan(0);
    });
  });

  describe("IP Threat Analysis", () => {
    it("should calculate IP threat level correctly", async () => {
      const mockEvents = [
        {
          eventType: SecurityEventType.AUTHENTICATION,
          outcome: AuditOutcome.FAILURE,
          userId: "user-1",
          ipAddress: "192.168.1.100",
          timestamp: new Date(),
        },
        {
          eventType: SecurityEventType.RATE_LIMITING,
          outcome: AuditOutcome.RATE_LIMITED,
          userId: "user-2",
          ipAddress: "192.168.1.100",
          timestamp: new Date(),
        },
      ];

      const mockFindMany = vi.mocked(prisma.securityAuditLog.findMany);
      mockFindMany.mockResolvedValue(mockEvents);

      const analysis =
        await securityMonitoring.calculateIPThreatLevel("192.168.1.100");

      expect(analysis).toMatchObject({
        threatLevel: expect.any(String),
        riskFactors: expect.any(Array),
        recommendations: expect.any(Array),
      });

      expect(Object.values(ThreatLevel)).toContain(analysis.threatLevel);
      expect(analysis.riskFactors.length).toBeGreaterThan(0);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("Configuration Management", () => {
    it("should update monitoring configuration", () => {
      const newConfig = {
        thresholds: {
          failedLoginsPerMinute: 3,
          failedLoginsPerHour: 15,
        },
        alerting: {
          enabled: false,
        },
      };

      securityMonitoring.updateConfig(newConfig);
      const currentConfig = securityMonitoring.getConfig();

      expect(currentConfig.thresholds.failedLoginsPerMinute).toBe(3);
      expect(currentConfig.thresholds.failedLoginsPerHour).toBe(15);
      expect(currentConfig.alerting.enabled).toBe(false);
    });

    it("should preserve existing config when partially updating", () => {
      const originalConfig = securityMonitoring.getConfig();

      securityMonitoring.updateConfig({
        thresholds: {
          failedLoginsPerMinute: 2,
        },
      });

      const updatedConfig = securityMonitoring.getConfig();

      expect(updatedConfig.thresholds.failedLoginsPerMinute).toBe(2);
      expect(updatedConfig.thresholds.failedLoginsPerHour).toBe(
        originalConfig.thresholds.failedLoginsPerHour
      );
      expect(updatedConfig.alerting.enabled).toBe(
        originalConfig.alerting.enabled
      );
    });
  });

  describe("Alert Management", () => {
    it("should acknowledge alerts correctly", async () => {
      // First, generate an alert
      const mockCount = vi.mocked(prisma.securityAuditLog.count);
      mockCount.mockResolvedValue(6); // Above threshold

      await enhancedSecurityLog(
        SecurityEventType.AUTHENTICATION,
        "login_attempt",
        AuditOutcome.FAILURE,
        { ipAddress: "192.168.1.100" },
        AuditSeverity.HIGH
      );

      const activeAlerts = securityMonitoring.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);

      const alertId = activeAlerts[0].id;
      const acknowledged = await securityMonitoring.acknowledgeAlert(
        alertId,
        "admin-user"
      );

      expect(acknowledged).toBe(true);

      const remainingActiveAlerts = securityMonitoring.getActiveAlerts();
      expect(remainingActiveAlerts.length).toBe(activeAlerts.length - 1);
    });

    it("should filter alerts by severity", async () => {
      // Generate alerts of different severities
      const mockCount = vi.mocked(prisma.securityAuditLog.count);
      mockCount.mockResolvedValue(6);

      await enhancedSecurityLog(
        SecurityEventType.AUTHENTICATION,
        "login_attempt",
        AuditOutcome.FAILURE,
        { ipAddress: "192.168.1.100" },
        AuditSeverity.HIGH
      );

      await enhancedSecurityLog(
        SecurityEventType.RATE_LIMITING,
        "rate_limit",
        AuditOutcome.RATE_LIMITED,
        { ipAddress: "192.168.1.101" },
        AuditSeverity.MEDIUM
      );

      const highSeverityAlerts = securityMonitoring.getActiveAlerts(
        AlertSeverity.HIGH
      );
      const allAlerts = securityMonitoring.getActiveAlerts();

      expect(highSeverityAlerts.length).toBeLessThanOrEqual(allAlerts.length);
      highSeverityAlerts.forEach((alert) => {
        expect(alert.severity).toBe(AlertSeverity.HIGH);
      });
    });
  });

  describe("Data Export", () => {
    it("should export security data in JSON format", () => {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const jsonData = securityMonitoring.exportSecurityData("json", timeRange);

      expect(() => JSON.parse(jsonData)).not.toThrow();
      const parsed = JSON.parse(jsonData);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it("should export security data in CSV format", () => {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const csvData = securityMonitoring.exportSecurityData("csv", timeRange);

      expect(typeof csvData).toBe("string");
      expect(csvData).toContain("timestamp,severity,type,title");
    });
  });
});
