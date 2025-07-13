import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { GET, POST } from "@/app/api/admin/security-monitoring/route";
import {
  GET as AlertsGET,
  POST as AlertsPOST,
} from "@/app/api/admin/security-monitoring/alerts/route";
import { GET as ExportGET } from "@/app/api/admin/security-monitoring/export/route";
import { POST as ThreatAnalysisPOST } from "@/app/api/admin/security-monitoring/threat-analysis/route";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock security monitoring
vi.mock("@/lib/securityMonitoring", () => ({
  securityMonitoring: {
    getSecurityMetrics: vi.fn(),
    getActiveAlerts: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    acknowledgeAlert: vi.fn(),
    exportSecurityData: vi.fn(),
    calculateIPThreatLevel: vi.fn(),
  },
}));

// Mock security audit logger
vi.mock("@/lib/securityAuditLogger", () => ({
  createAuditContext: vi.fn(),
  securityAuditLogger: {
    logPlatformAdmin: vi.fn(),
  },
}));

const { securityMonitoring } = await import("@/lib/securityMonitoring");
const { createAuditContext, securityAuditLogger } = await import(
  "@/lib/securityAuditLogger"
);

const mockPlatformUserSession = {
  user: {
    id: "platform-user-1",
    email: "admin@platform.com",
    isPlatformUser: true,
    platformRole: "ADMIN",
  },
};

const mockRegularUserSession = {
  user: {
    id: "user-1",
    email: "user@company.com",
    isPlatformUser: false,
    companyId: "company-1",
  },
};

describe("Security Monitoring API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAuditContext).mockResolvedValue({
      userId: "platform-user-1",
      requestId: "test-request-123",
    });
  });

  describe("GET /api/admin/security-monitoring", () => {
    it("should return security metrics for platform admin", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockPlatformUserSession);

      const mockMetrics = {
        totalEvents: 100,
        criticalEvents: 5,
        activeAlerts: 3,
        resolvedAlerts: 10,
        securityScore: 85,
        threatLevel: "MODERATE",
        eventsByType: { AUTHENTICATION: 50, RATE_LIMITING: 30 },
        alertsByType: { BRUTE_FORCE_ATTACK: 2, RATE_LIMIT_BREACH: 1 },
        topThreats: [{ type: "BRUTE_FORCE_ATTACK", count: 2 }],
        geoDistribution: { USA: 60, GBR: 40 },
        timeDistribution: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          count: Math.floor(Math.random() * 10),
        })),
        userRiskScores: [
          { userId: "user-1", email: "test@test.com", riskScore: 75 },
        ],
      };

      const mockConfig = {
        thresholds: {
          failedLoginsPerMinute: 5,
          failedLoginsPerHour: 20,
          rateLimitViolationsPerMinute: 10,
          cspViolationsPerMinute: 15,
          adminActionsPerHour: 25,
          massDataAccessThreshold: 100,
          suspiciousIPThreshold: 10,
        },
        alerting: {
          enabled: true,
          channels: ["EMAIL"],
          suppressDuplicateMinutes: 10,
          escalationTimeoutMinutes: 60,
        },
        retention: {
          alertRetentionDays: 90,
          metricsRetentionDays: 365,
        },
      };

      const mockAlerts = [
        {
          id: "alert-1",
          timestamp: new Date(),
          severity: "HIGH",
          type: "BRUTE_FORCE_ATTACK",
          title: "Brute Force Attack Detected",
          description: "Multiple failed login attempts",
          eventType: "AUTHENTICATION",
          context: { ipAddress: "192.168.1.100" },
          metadata: {},
          acknowledged: false,
        },
      ];

      vi.mocked(securityMonitoring.getSecurityMetrics).mockResolvedValue(
        mockMetrics
      );
      vi.mocked(securityMonitoring.getConfig).mockReturnValue(mockConfig);
      vi.mocked(securityMonitoring.getActiveAlerts).mockReturnValue(mockAlerts);

      const request = new NextRequest(
        "http://localhost:3000/api/admin/security-monitoring"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        metrics: mockMetrics,
        alerts: mockAlerts,
        config: mockConfig,
        timeRange: expect.any(Object),
      });

      expect(securityAuditLogger.logPlatformAdmin).toHaveBeenCalledWith(
        "security_monitoring_access",
        "SUCCESS",
        expect.any(Object)
      );
    });

    it("should reject non-platform users", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockRegularUserSession);

      const request = new NextRequest(
        "http://localhost:3000/api/admin/security-monitoring"
      );
      const response = await GET(request);

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe("Forbidden");
    });

    it("should reject unauthenticated requests", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/admin/security-monitoring"
      );
      const response = await GET(request);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("should handle query parameters correctly", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockPlatformUserSession);
      vi.mocked(securityMonitoring.getSecurityMetrics).mockResolvedValue(
        {} as any
      );
      vi.mocked(securityMonitoring.getConfig).mockReturnValue({} as any);
      vi.mocked(securityMonitoring.getActiveAlerts).mockReturnValue([]);

      const url =
        "http://localhost:3000/api/admin/security-monitoring?startDate=2024-01-01T00:00:00Z&endDate=2024-01-02T00:00:00Z&companyId=company-1&severity=HIGH";
      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(securityMonitoring.getSecurityMetrics).toHaveBeenCalledWith(
        {
          start: new Date("2024-01-01T00:00:00Z"),
          end: new Date("2024-01-02T00:00:00Z"),
        },
        "company-1"
      );
      expect(securityMonitoring.getActiveAlerts).toHaveBeenCalledWith("HIGH");
    });
  });

  describe("POST /api/admin/security-monitoring", () => {
    it("should update security configuration", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockPlatformUserSession);

      const newConfig = {
        thresholds: {
          failedLoginsPerMinute: 3,
          failedLoginsPerHour: 15,
        },
        alerting: {
          enabled: false,
          channels: ["EMAIL", "SLACK"],
        },
      };

      const updatedConfig = {
        thresholds: {
          failedLoginsPerMinute: 3,
          failedLoginsPerHour: 15,
          rateLimitViolationsPerMinute: 10,
          cspViolationsPerMinute: 15,
          adminActionsPerHour: 25,
          massDataAccessThreshold: 100,
          suspiciousIPThreshold: 10,
        },
        alerting: {
          enabled: false,
          channels: ["EMAIL", "SLACK"],
          suppressDuplicateMinutes: 10,
          escalationTimeoutMinutes: 60,
        },
        retention: {
          alertRetentionDays: 90,
          metricsRetentionDays: 365,
        },
      };

      vi.mocked(securityMonitoring.getConfig).mockReturnValue(updatedConfig);

      const request = new NextRequest(
        "http://localhost:3000/api/admin/security-monitoring",
        {
          method: "POST",
          body: JSON.stringify(newConfig),
          headers: { "Content-Type": "application/json" },
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.config).toEqual(updatedConfig);

      expect(securityMonitoring.updateConfig).toHaveBeenCalledWith(newConfig);
      expect(securityAuditLogger.logPlatformAdmin).toHaveBeenCalledWith(
        "security_monitoring_config_update",
        "SUCCESS",
        expect.any(Object),
        undefined,
        { configChanges: newConfig }
      );
    });

    it("should validate configuration input", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockPlatformUserSession);

      const invalidConfig = {
        thresholds: {
          failedLoginsPerMinute: -1, // Invalid: negative number
          failedLoginsPerHour: 2000, // Invalid: too large
        },
      };

      const request = new NextRequest(
        "http://localhost:3000/api/admin/security-monitoring",
        {
          method: "POST",
          body: JSON.stringify(invalidConfig),
          headers: { "Content-Type": "application/json" },
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Invalid configuration");
      expect(data.details).toBeDefined();
    });
  });

  describe("GET /api/admin/security-monitoring/alerts", () => {
    it("should return filtered alerts", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockPlatformUserSession);

      const mockAlerts = [
        {
          id: "alert-1",
          timestamp: new Date().toISOString(),
          severity: "HIGH",
          type: "BRUTE_FORCE_ATTACK",
          title: "Brute Force Attack",
          description: "Multiple failed logins",
          eventType: "AUTHENTICATION",
          context: {},
          metadata: {},
          acknowledged: false,
        },
        {
          id: "alert-2",
          timestamp: new Date().toISOString(),
          severity: "MEDIUM",
          type: "RATE_LIMIT_BREACH",
          title: "Rate Limit Exceeded",
          description: "Too many requests",
          eventType: "RATE_LIMITING",
          context: {},
          metadata: {},
          acknowledged: false,
        },
      ];

      vi.mocked(securityMonitoring.getActiveAlerts).mockReturnValue(mockAlerts);

      const url =
        "http://localhost:3000/api/admin/security-monitoring/alerts?severity=HIGH&limit=10&offset=0";
      const request = new NextRequest(url);
      const response = await AlertsGET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.alerts).toEqual(mockAlerts);
      expect(data.total).toBe(2);
      expect(data.limit).toBe(10);
      expect(data.offset).toBe(0);

      expect(securityMonitoring.getActiveAlerts).toHaveBeenCalledWith("HIGH");
    });
  });

  describe("POST /api/admin/security-monitoring/alerts", () => {
    it("should acknowledge alert", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockPlatformUserSession);
      vi.mocked(securityMonitoring.acknowledgeAlert).mockResolvedValue(true);

      const request = new NextRequest(
        "http://localhost:3000/api/admin/security-monitoring/alerts",
        {
          method: "POST",
          body: JSON.stringify({
            alertId: "alert-123",
            action: "acknowledge",
          }),
          headers: { "Content-Type": "application/json" },
        }
      );

      const response = await AlertsPOST(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);

      expect(securityMonitoring.acknowledgeAlert).toHaveBeenCalledWith(
        "alert-123",
        "platform-user-1"
      );
    });

    it("should handle non-existent alert", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockPlatformUserSession);
      vi.mocked(securityMonitoring.acknowledgeAlert).mockResolvedValue(false);

      const request = new NextRequest(
        "http://localhost:3000/api/admin/security-monitoring/alerts",
        {
          method: "POST",
          body: JSON.stringify({
            alertId: "non-existent",
            action: "acknowledge",
          }),
          headers: { "Content-Type": "application/json" },
        }
      );

      const response = await AlertsPOST(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe("Alert not found");
    });
  });

  describe("GET /api/admin/security-monitoring/export", () => {
    it("should export security data as JSON", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockPlatformUserSession);

      const mockExportData = JSON.stringify([
        {
          id: "alert-1",
          timestamp: "2024-01-01T00:00:00.000Z",
          severity: "HIGH",
          type: "BRUTE_FORCE_ATTACK",
          title: "Test Alert",
          description: "Test Description",
        },
      ]);

      vi.mocked(securityMonitoring.exportSecurityData).mockReturnValue(
        mockExportData
      );

      const url =
        "http://localhost:3000/api/admin/security-monitoring/export?format=json&type=alerts&startDate=2024-01-01T00:00:00Z&endDate=2024-01-02T00:00:00Z";
      const request = new NextRequest(url);
      const response = await ExportGET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Content-Disposition")).toContain(
        "attachment"
      );

      const data = await response.text();
      expect(data).toBe(mockExportData);
    });

    it("should export security data as CSV", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockPlatformUserSession);

      const mockCsvData =
        "timestamp,severity,type,title\n2024-01-01T00:00:00.000Z,HIGH,BRUTE_FORCE_ATTACK,Test Alert";
      vi.mocked(securityMonitoring.exportSecurityData).mockReturnValue(
        mockCsvData
      );

      const url =
        "http://localhost:3000/api/admin/security-monitoring/export?format=csv&type=alerts&startDate=2024-01-01T00:00:00Z&endDate=2024-01-02T00:00:00Z";
      const request = new NextRequest(url);
      const response = await ExportGET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/csv");

      const data = await response.text();
      expect(data).toBe(mockCsvData);
    });
  });

  describe("POST /api/admin/security-monitoring/threat-analysis", () => {
    it("should perform IP threat analysis", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockPlatformUserSession);

      const mockThreatAnalysis = {
        threatLevel: "HIGH",
        riskFactors: ["Multiple failed logins", "Rate limit violations"],
        recommendations: ["Block IP address", "Investigate source"],
      };

      const mockMetrics = {
        securityScore: 65,
        threatLevel: "HIGH",
        activeAlerts: 5,
        criticalEvents: 2,
        topThreats: [],
        geoDistribution: {},
        userRiskScores: [],
      };

      vi.mocked(securityMonitoring.calculateIPThreatLevel).mockResolvedValue(
        mockThreatAnalysis
      );
      vi.mocked(securityMonitoring.getSecurityMetrics).mockResolvedValue(
        mockMetrics
      );

      const request = new NextRequest(
        "http://localhost:3000/api/admin/security-monitoring/threat-analysis",
        {
          method: "POST",
          body: JSON.stringify({
            ipAddress: "192.168.1.100",
          }),
          headers: { "Content-Type": "application/json" },
        }
      );

      const response = await ThreatAnalysisPOST(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.ipThreatAnalysis).toMatchObject({
        ipAddress: "192.168.1.100",
        ...mockThreatAnalysis,
      });
      expect(data.overallThreatLandscape).toBeDefined();

      expect(securityMonitoring.calculateIPThreatLevel).toHaveBeenCalledWith(
        "192.168.1.100"
      );
    });

    it("should validate IP address format", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockPlatformUserSession);

      const request = new NextRequest(
        "http://localhost:3000/api/admin/security-monitoring/threat-analysis",
        {
          method: "POST",
          body: JSON.stringify({
            ipAddress: "invalid-ip",
          }),
          headers: { "Content-Type": "application/json" },
        }
      );

      const response = await ThreatAnalysisPOST(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Invalid request");
      expect(data.details).toBeDefined();
    });
  });
});
