import { SECURITY_MONITORING } from "./constants";
import {
  type AuditLogContext,
  type AuditOutcome,
  AuditSeverity,
  SecurityEventType,
  securityAuditLogger,
} from "./securityAuditLogger";
import { AlertManagementService } from "./services/AlertManagementService";
import { SecurityEventProcessor } from "./services/SecurityEventProcessor";
import { SecurityMetricsService } from "./services/SecurityMetricsService";
import { ThreatDetectionService } from "./services/ThreatDetectionService";

// Utility type for deep partial objects
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  description: string;
  eventType: SecurityEventType;
  context: AuditLogContext;
  metadata: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

/* eslint-disable no-unused-vars */
export enum AlertSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}
/* eslint-enable no-unused-vars */

/* eslint-disable no-unused-vars */
export enum AlertType {
  AUTHENTICATION_ANOMALY = "AUTHENTICATION_ANOMALY",
  RATE_LIMIT_BREACH = "RATE_LIMIT_BREACH",
  MULTIPLE_FAILED_LOGINS = "MULTIPLE_FAILED_LOGINS",
  SUSPICIOUS_IP_ACTIVITY = "SUSPICIOUS_IP_ACTIVITY",
  PRIVILEGE_ESCALATION = "PRIVILEGE_ESCALATION",
  DATA_BREACH_ATTEMPT = "DATA_BRECH_ATTEMPT",
  CSRF_ATTACK = "CSRF_ATTACK",
  CSP_VIOLATION_SPIKE = "CSP_VIOLATION_SPIKE",
  ACCOUNT_ENUMERATION = "ACCOUNT_ENUMERATION",
  BRUTE_FORCE_ATTACK = "BRUTE_FORCE_ATTACK",
  UNUSUAL_ADMIN_ACTIVITY = "UNUSUAL_ADMIN_ACTIVITY",
  GEOLOCATION_ANOMALY = "GEOLOCATION_ANOMALY",
  MASS_DATA_ACCESS = "MASS_DATA_ACCESS",
  SUSPICIOUS_USER_AGENT = "SUSPICIOUS_USER_AGENT",
  SESSION_HIJACKING = "SESSION_HIJACKING",
}
/* eslint-enable no-unused-vars */

export interface SecurityMetrics {
  totalEvents: number;
  criticalEvents: number;
  activeAlerts: number;
  resolvedAlerts: number;
  securityScore: number;
  threatLevel: ThreatLevel;
  eventsByType: Record<SecurityEventType, number>;
  alertsByType: Record<AlertType, number>;
  topThreats: Array<{ type: AlertType; count: number }>;
  geoDistribution: Record<string, number>;
  timeDistribution: Array<{ hour: number; count: number }>;
  userRiskScores: Array<{ userId: string; email: string; riskScore: number }>;
}

/* eslint-disable no-unused-vars */
export enum ThreatLevel {
  LOW = "LOW",
  MODERATE = "MODERATE",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}
/* eslint-enable no-unused-vars */

export interface MonitoringConfig {
  thresholds: {
    failedLoginsPerMinute: number;
    failedLoginsPerHour: number;
    rateLimitViolationsPerMinute: number;
    cspViolationsPerMinute: number;
    adminActionsPerHour: number;
    massDataAccessThreshold: number;
    suspiciousIPThreshold: number;
  };
  alerting: {
    enabled: boolean;
    channels: AlertChannel[];
    suppressDuplicateMinutes: number;
    escalationTimeoutMinutes: number;
  };
  retention: {
    alertRetentionDays: number;
    metricsRetentionDays: number;
  };
}

/* eslint-disable no-unused-vars */
export enum AlertChannel {
  EMAIL = "EMAIL",
  WEBHOOK = "WEBHOOK",
  SLACK = "SLACK",
  DISCORD = "DISCORD",
  PAGERDUTY = "PAGERDUTY",
}
/* eslint-enable no-unused-vars */

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  confidence: number;
  type: string;
  description: string;
  recommendedActions: string[];
}

/**
 * Refactored SecurityMonitoringService that coordinates focused services
 * Responsibilities: Configuration, coordination, and background processing
 */
class SecurityMonitoringService {
  private config: MonitoringConfig;
  private eventProcessor: SecurityEventProcessor;
  private threatDetection: ThreatDetectionService;
  private alertManagement: AlertManagementService;
  private metricsService: SecurityMetricsService;

  constructor() {
    this.config = this.getDefaultConfig();

    // Initialize focused services
    this.eventProcessor = new SecurityEventProcessor();
    this.threatDetection = new ThreatDetectionService(this.config);
    this.alertManagement = new AlertManagementService(this.config);
    this.metricsService = new SecurityMetricsService();

    this.startBackgroundProcessing();
  }

  /**
   * Process security event and check for threats
   */
  async processSecurityEvent(
    eventType: SecurityEventType,
    outcome: AuditOutcome,
    context: AuditLogContext,
    severity: AuditSeverity = AuditSeverity.INFO,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // Add event to buffer for analysis
    this.eventProcessor.addEvent(eventType, outcome, context, severity);

    // Immediate threat detection
    const threatResult = await this.threatDetection.detectImmediateThreats(
      eventType,
      outcome,
      context,
      metadata
    );

    for (const threat of threatResult.threats) {
      await this.alertManagement.createAlert(threat);
    }

    // Anomaly detection
    const recentEvents = this.eventProcessor.getRecentEvents();
    const anomaly = await this.threatDetection.detectAnomalies(
      eventType,
      context,
      recentEvents
    );

    if (anomaly.isAnomaly && anomaly.confidence > 0.7) {
      await this.alertManagement.createAlert({
        severity: this.mapConfidenceToSeverity(anomaly.confidence),
        type: AlertType.AUTHENTICATION_ANOMALY,
        title: `Anomaly Detected: ${anomaly.type}`,
        description: anomaly.description,
        eventType,
        context,
        metadata: { anomaly, confidence: anomaly.confidence },
      });
    }

    // Clean old events to prevent memory issues
    this.eventProcessor.cleanup();
  }

  /**
   * Get comprehensive security metrics
   */
  async getSecurityMetrics(
    timeRange: { start: Date; end: Date },
    companyId?: string
  ): Promise<SecurityMetrics> {
    const alerts = this.alertManagement.getAlertsInTimeRange(timeRange);
    return this.metricsService.calculateSecurityMetrics(
      timeRange,
      companyId,
      alerts
    );
  }

  /**
   * Get active security alerts
   */
  getActiveAlerts(severity?: AlertSeverity): SecurityAlert[] {
    return this.alertManagement.getActiveAlerts(severity);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string
  ): Promise<boolean> {
    return this.alertManagement.acknowledgeAlert(alertId, acknowledgedBy);
  }

  /**
   * Export security data for analysis
   */
  exportSecurityData(
    format: "json" | "csv",
    timeRange: { start: Date; end: Date }
  ): string {
    return this.alertManagement.exportAlertsData(format, timeRange);
  }

  /**
   * Configure monitoring thresholds
   */
  updateConfig(config: DeepPartial<MonitoringConfig>): void {
    this.config = this.deepMerge(
      this.config as any,
      config as any
    ) as unknown as MonitoringConfig;
  }

  /**
   * Deep merge helper function for config updates
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] !== null &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(
          target[key] || ({} as any),
          source[key] as any
        );
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Get current monitoring configuration
   */
  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  /**
   * Calculate threat level for a specific IP
   */
  async calculateIPThreatLevel(ipAddress: string): Promise<{
    threatLevel: ThreatLevel;
    riskFactors: string[];
    recommendations: string[];
    isBlacklisted: boolean;
  }> {
    return this.metricsService.calculateIPThreatLevel(ipAddress);
  }

  private mapConfidenceToSeverity(confidence: number): AlertSeverity {
    if (confidence >= 0.9) return AlertSeverity.CRITICAL;
    if (confidence >= 0.8) return AlertSeverity.HIGH;
    if (confidence >= 0.6) return AlertSeverity.MEDIUM;
    return AlertSeverity.LOW;
  }

  private getDefaultConfig(): MonitoringConfig {
    return {
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
        enabled: process.env.SECURITY_ALERTING_ENABLED !== "false",
        channels: [AlertChannel.EMAIL],
        suppressDuplicateMinutes: 10,
        escalationTimeoutMinutes: 60,
      },
      retention: {
        alertRetentionDays: 90,
        metricsRetentionDays: 365,
      },
    };
  }

  private startBackgroundProcessing(): void {
    // Clean up old data every cleanup interval
    setInterval(() => {
      this.cleanupOldData();
    }, SECURITY_MONITORING.EVENT_BUFFER_CLEANUP_INTERVAL);

    // Process event buffer for threat detection
    setInterval(() => {
      this.processEventBuffer();
    }, SECURITY_MONITORING.BACKGROUND_PROCESSING_INTERVAL);
  }

  private cleanupOldData(): void {
    this.alertManagement.cleanupOldAlerts();
    this.eventProcessor.cleanup();
  }

  private async processEventBuffer(): Promise<void> {
    // Analyze patterns in event buffer for real-time threat detection
    const recentEvents = this.eventProcessor.getRecentEvents();

    // Check for event spikes
    if (recentEvents.length > 50) {
      await this.alertManagement.createAlert({
        severity: AlertSeverity.MEDIUM,
        type: AlertType.SUSPICIOUS_IP_ACTIVITY,
        title: "High Event Volume Detected",
        description: `${recentEvents.length} security events in the last minute`,
        eventType: SecurityEventType.API_SECURITY,
        context: { requestId: crypto.randomUUID() },
        metadata: { eventCount: recentEvents.length },
      });
    }
  }
}

// Singleton instance
export const securityMonitoring = new SecurityMonitoringService();

// Helper function to integrate with existing audit logger
export async function enhancedSecurityLog(
  eventType: SecurityEventType,
  action: string,
  outcome: AuditOutcome,
  context: AuditLogContext,
  severity: AuditSeverity = AuditSeverity.INFO,
  errorMessage?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  // Log to audit system
  await securityAuditLogger.log({
    eventType,
    action,
    outcome,
    severity,
    errorMessage,
    context,
  });

  // Process through security monitoring
  await securityMonitoring.processSecurityEvent(
    eventType,
    outcome,
    context,
    severity,
    metadata
  );
}
