import { prisma } from "./prisma";
import {
  type AuditLogContext,
  AuditOutcome,
  AuditSeverity,
  SecurityEventType,
  securityAuditLogger,
} from "./securityAuditLogger";

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  description: string;
  eventType: SecurityEventType;
  context: AuditLogContext;
  metadata: Record<string, any>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export enum AlertSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum AlertType {
  AUTHENTICATION_ANOMALY = "AUTHENTICATION_ANOMALY",
  RATE_LIMIT_BREACH = "RATE_LIMIT_BREACH",
  MULTIPLE_FAILED_LOGINS = "MULTIPLE_FAILED_LOGINS",
  SUSPICIOUS_IP_ACTIVITY = "SUSPICIOUS_IP_ACTIVITY",
  PRIVILEGE_ESCALATION = "PRIVILEGE_ESCALATION",
  DATA_BREACH_ATTEMPT = "DATA_BREACH_ATTEMPT",
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

export enum ThreatLevel {
  LOW = "LOW",
  MODERATE = "MODERATE",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

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

export enum AlertChannel {
  EMAIL = "EMAIL",
  WEBHOOK = "WEBHOOK",
  SLACK = "SLACK",
  DISCORD = "DISCORD",
  PAGERDUTY = "PAGERDUTY",
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  confidence: number;
  type: string;
  description: string;
  recommendedActions: string[];
}

class SecurityMonitoringService {
  private alerts: SecurityAlert[] = [];
  private config: MonitoringConfig;
  private eventBuffer: Array<{
    timestamp: Date;
    eventType: SecurityEventType;
    context: AuditLogContext;
    outcome: AuditOutcome;
    severity: AuditSeverity;
  }> = [];

  constructor() {
    this.config = this.getDefaultConfig();
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
    metadata?: Record<string, any>
  ): Promise<void> {
    // Add event to buffer for analysis
    this.eventBuffer.push({
      timestamp: new Date(),
      eventType,
      context,
      outcome,
      severity,
    });

    // Immediate threat detection
    const threats = await this.detectImediateThreats(
      eventType,
      outcome,
      context,
      metadata
    );

    for (const threat of threats) {
      await this.createAlert(threat);
    }

    // Anomaly detection
    const anomaly = await this.detectAnomalies(eventType, context);
    if (anomaly.isAnomaly && anomaly.confidence > 0.7) {
      await this.createAlert({
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
    this.cleanupEventBuffer();
  }

  /**
   * Get comprehensive security metrics
   */
  async getSecurityMetrics(
    timeRange: { start: Date; end: Date },
    companyId?: string
  ): Promise<SecurityMetrics> {
    const whereClause = {
      timestamp: {
        gte: timeRange.start,
        lte: timeRange.end,
      },
      ...(companyId && { companyId }),
    };

    // Get audit log data
    const events = await prisma.securityAuditLog.findMany({
      where: whereClause,
      include: {
        user: { select: { email: true } },
        company: { select: { name: true } },
      },
    });

    // Calculate metrics
    const totalEvents = events.length;
    const criticalEvents = events.filter(
      (e) => e.severity === AuditSeverity.CRITICAL
    ).length;

    const activeAlerts = this.alerts.filter((a) => !a.acknowledged).length;
    const resolvedAlerts = this.alerts.filter((a) => a.acknowledged).length;

    // Event distribution by type
    const eventsByType = events.reduce(
      (acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      },
      {} as Record<SecurityEventType, number>
    );

    // Alert distribution by type
    const alertsByType = this.alerts.reduce(
      (acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      },
      {} as Record<AlertType, number>
    );

    // Top threats
    const topThreats = Object.entries(alertsByType)
      .map(([type, count]) => ({ type: type as AlertType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Geographic distribution
    const geoDistribution = events.reduce(
      (acc, event) => {
        if (event.country) {
          acc[event.country] = (acc[event.country] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    // Time distribution (by hour)
    const timeDistribution = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: events.filter((e) => e.timestamp.getHours() === hour).length,
    }));

    // User risk scores
    const userRiskScores = await this.calculateUserRiskScores(events);

    // Calculate overall security score
    const securityScore = this.calculateSecurityScore({
      totalEvents,
      criticalEvents,
      activeAlerts,
      topThreats,
    });

    // Determine threat level
    const threatLevel = this.determineThreatLevel(
      securityScore,
      activeAlerts,
      criticalEvents
    );

    return {
      totalEvents,
      criticalEvents,
      activeAlerts,
      resolvedAlerts,
      securityScore,
      threatLevel,
      eventsByType,
      alertsByType,
      topThreats,
      geoDistribution,
      timeDistribution,
      userRiskScores,
    };
  }

  /**
   * Get active security alerts
   */
  getActiveAlerts(severity?: AlertSeverity): SecurityAlert[] {
    return this.alerts.filter(
      (alert) =>
        !alert.acknowledged && (!severity || alert.severity === severity)
    );
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string
  ): Promise<boolean> {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    // Log the acknowledgment
    await securityAuditLogger.log({
      eventType: SecurityEventType.SYSTEM_CONFIG,
      action: "alert_acknowledged",
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.INFO,
      context: {
        userId: acknowledgedBy,
        metadata: { alertId, alertType: alert.type },
      },
    });

    return true;
  }

  /**
   * Export security data for analysis
   */
  exportSecurityData(
    format: "json" | "csv",
    timeRange: { start: Date; end: Date }
  ): string {
    const filteredAlerts = this.alerts.filter(
      (a) => a.timestamp >= timeRange.start && a.timestamp <= timeRange.end
    );

    if (format === "csv") {
      const headers = [
        "timestamp",
        "severity",
        "type",
        "title",
        "description",
        "eventType",
        "userId",
        "companyId",
        "ipAddress",
        "userAgent",
        "acknowledged",
      ].join(",");

      const rows = filteredAlerts.map((alert) =>
        [
          alert.timestamp.toISOString(),
          alert.severity,
          alert.type,
          `"${alert.title}"`,
          `"${alert.description}"`,
          alert.eventType,
          alert.context.userId || "",
          alert.context.companyId || "",
          alert.context.ipAddress || "",
          alert.context.userAgent || "",
          alert.acknowledged.toString(),
        ].join(",")
      );

      return [headers, ...rows].join("\n");
    }

    return JSON.stringify(filteredAlerts, null, 2);
  }

  /**
   * Configure monitoring thresholds
   */
  updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = this.deepMerge(this.config, config);
  }

  /**
   * Deep merge helper function for config updates
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] !== null &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
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
  }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const events = await prisma.securityAuditLog.findMany({
      where: {
        ipAddress,
        timestamp: { gte: oneDayAgo },
      },
    });

    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    // Failed login attempts
    const failedLogins = events.filter(
      (e) =>
        e.eventType === SecurityEventType.AUTHENTICATION &&
        e.outcome === AuditOutcome.FAILURE
    ).length;

    if (failedLogins > 10) {
      riskFactors.push(`${failedLogins} failed login attempts in 24h`);
      recommendations.push("Consider temporary IP blocking");
    }

    // Rate limit violations
    const rateLimitViolations = events.filter(
      (e) => e.outcome === AuditOutcome.RATE_LIMITED
    ).length;

    if (rateLimitViolations > 5) {
      riskFactors.push(`${rateLimitViolations} rate limit violations`);
      recommendations.push("Implement stricter rate limiting");
    }

    // Multiple user attempts
    const uniqueUsers = new Set(events.map((e) => e.userId).filter(Boolean))
      .size;
    if (uniqueUsers > 5) {
      riskFactors.push(`Access attempts to ${uniqueUsers} different accounts`);
      recommendations.push("Investigate for account enumeration");
    }

    // Determine threat level
    let threatLevel = ThreatLevel.LOW;
    if (riskFactors.length >= 3) threatLevel = ThreatLevel.CRITICAL;
    else if (riskFactors.length >= 2) threatLevel = ThreatLevel.HIGH;
    else if (riskFactors.length >= 1) threatLevel = ThreatLevel.MODERATE;

    // Ensure we always provide at least basic analysis
    if (riskFactors.length === 0) {
      riskFactors.push(`${events.length} security events in 24h`);
    }

    if (recommendations.length === 0) {
      recommendations.push("Continue monitoring for suspicious activity");
    }

    return { threatLevel, riskFactors, recommendations };
  }

  private async detectImediateThreats(
    eventType: SecurityEventType,
    outcome: AuditOutcome,
    context: AuditLogContext,
    metadata?: Record<string, any>
  ): Promise<Array<Omit<SecurityAlert, "id" | "timestamp" | "acknowledged">>> {
    const threats: Array<
      Omit<SecurityAlert, "id" | "timestamp" | "acknowledged">
    > = [];
    const now = new Date();

    // Multiple failed logins detection
    if (
      eventType === SecurityEventType.AUTHENTICATION &&
      outcome === AuditOutcome.FAILURE &&
      context.ipAddress
    ) {
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const recentFailures = await prisma.securityAuditLog.count({
        where: {
          eventType: SecurityEventType.AUTHENTICATION,
          outcome: AuditOutcome.FAILURE,
          ipAddress: context.ipAddress,
          timestamp: { gte: fiveMinutesAgo },
        },
      });

      if (recentFailures >= this.config.thresholds.failedLoginsPerMinute) {
        threats.push({
          severity: AlertSeverity.HIGH,
          type: AlertType.BRUTE_FORCE_ATTACK,
          title: "Brute Force Attack Detected",
          description: `${recentFailures} failed login attempts from IP ${context.ipAddress} in 5 minutes`,
          eventType,
          context,
          metadata: { failedAttempts: recentFailures, ...metadata },
        });
      }
    }

    // Suspicious admin activity
    if (
      eventType === SecurityEventType.PLATFORM_ADMIN ||
      (eventType === SecurityEventType.USER_MANAGEMENT && context.userId)
    ) {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const adminActions = await prisma.securityAuditLog.count({
        where: {
          userId: context.userId,
          eventType: {
            in: [
              SecurityEventType.PLATFORM_ADMIN,
              SecurityEventType.USER_MANAGEMENT,
            ],
          },
          timestamp: { gte: oneHourAgo },
        },
      });

      if (adminActions >= this.config.thresholds.adminActionsPerHour) {
        threats.push({
          severity: AlertSeverity.MEDIUM,
          type: AlertType.UNUSUAL_ADMIN_ACTIVITY,
          title: "Unusual Admin Activity",
          description: `User ${context.userId} performed ${adminActions} admin actions in 1 hour`,
          eventType,
          context,
          metadata: { adminActions, ...metadata },
        });
      }
    }

    // Rate limiting violations
    if (outcome === AuditOutcome.RATE_LIMITED && context.ipAddress) {
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const rateLimitViolations = await prisma.securityAuditLog.count({
        where: {
          outcome: AuditOutcome.RATE_LIMITED,
          ipAddress: context.ipAddress,
          timestamp: { gte: oneMinuteAgo },
        },
      });

      if (
        rateLimitViolations >=
        this.config.thresholds.rateLimitViolationsPerMinute
      ) {
        threats.push({
          severity: AlertSeverity.MEDIUM,
          type: AlertType.RATE_LIMIT_BREACH,
          title: "Rate Limit Breach",
          description: `IP ${context.ipAddress} exceeded rate limits ${rateLimitViolations} times in 1 minute`,
          eventType,
          context,
          metadata: { violations: rateLimitViolations, ...metadata },
        });
      }
    }

    return threats;
  }

  private async detectAnomalies(
    eventType: SecurityEventType,
    context: AuditLogContext
  ): Promise<AnomalyDetectionResult> {
    // Simple anomaly detection based on historical patterns
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get historical data for baseline
    const historicalEvents = await prisma.securityAuditLog.findMany({
      where: {
        eventType,
        timestamp: { gte: sevenDaysAgo, lt: now },
      },
    });

    // Check for unusual time patterns
    const currentHour = now.getHours();
    const hourlyEvents = (historicalEvents || []).filter(
      (e) => e.timestamp.getHours() === currentHour
    );
    const avgHourlyEvents = hourlyEvents.length / 7; // 7 days average

    const recentHourEvents = this.eventBuffer.filter(
      (e) =>
        e.eventType === eventType &&
        e.timestamp.getHours() === currentHour &&
        e.timestamp > new Date(now.getTime() - 60 * 60 * 1000)
    ).length;

    // Check for geographical anomalies
    if (context.country && context.userId) {
      const userCountries = new Set(
        (historicalEvents || [])
          .filter((e) => e.userId === context.userId && e.country)
          .map((e) => e.country)
      );

      if (userCountries.size > 0 && !userCountries.has(context.country)) {
        return {
          isAnomaly: true,
          confidence: 0.8,
          type: "geographical_anomaly",
          description: `User accessing from unusual country: ${context.country}`,
          recommendedActions: [
            "Verify user identity",
            "Check for compromised credentials",
            "Consider additional authentication",
          ],
        };
      }
    }

    // Check for time-based anomalies
    if (recentHourEvents > avgHourlyEvents * 3 && avgHourlyEvents > 0) {
      return {
        isAnomaly: true,
        confidence: 0.7,
        type: "temporal_anomaly",
        description: `Unusual activity spike: ${recentHourEvents} events vs ${avgHourlyEvents.toFixed(1)} average`,
        recommendedActions: [
          "Investigate source of increased activity",
          "Check for automated attacks",
          "Review recent system changes",
        ],
      };
    }

    return {
      isAnomaly: false,
      confidence: 0,
      type: "normal",
      description: "No anomalies detected",
      recommendedActions: [],
    };
  }

  private async createAlert(
    alertData: Omit<SecurityAlert, "id" | "timestamp" | "acknowledged">
  ): Promise<void> {
    // Check for duplicate suppression
    const suppressionWindow = new Date(
      Date.now() - this.config.alerting.suppressDuplicateMinutes * 60 * 1000
    );
    const isDuplicate = this.alerts.some(
      (a) =>
        a.type === alertData.type &&
        a.context.ipAddress === alertData.context.ipAddress &&
        a.timestamp > suppressionWindow
    );

    if (isDuplicate) return;

    const alert: SecurityAlert = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      acknowledged: false,
      ...alertData,
    };

    this.alerts.push(alert);

    // Log alert creation
    await securityAuditLogger.log({
      eventType: SecurityEventType.SYSTEM_CONFIG,
      action: "security_alert_created",
      outcome: AuditOutcome.SUCCESS,
      severity: this.mapAlertSeverityToAuditSeverity(alert.severity),
      context: alert.context,
      errorMessage: undefined,
    });

    // Send notifications if enabled
    if (this.config.alerting.enabled) {
      await this.sendAlertNotifications(alert);
    }
  }

  private async sendAlertNotifications(alert: SecurityAlert): Promise<void> {
    // In production, integrate with actual notification services
    console.error(
      `🚨 SECURITY ALERT [${alert.severity}] ${alert.type}: ${alert.title}`
    );
    console.error(`Description: ${alert.description}`);
    console.error("Context:", alert.context);

    // Example integrations you could implement:
    // - Email notifications
    // - Slack webhooks
    // - PagerDuty alerts
    // - SMS notifications
    // - Custom webhook endpoints
  }

  private async calculateUserRiskScores(
    events: any[]
  ): Promise<Array<{ userId: string; email: string; riskScore: number }>> {
    const userEvents = events.filter((e) => e.userId);
    const userScores = new Map<
      string,
      { email: string; score: number; events: any[] }
    >();

    for (const event of userEvents) {
      if (!userScores.has(event.userId)) {
        userScores.set(event.userId, {
          email: event.user?.email || "unknown",
          score: 0,
          events: [],
        });
      }
      userScores.get(event.userId)?.events.push(event);
    }

    const riskScores: Array<{
      userId: string;
      email: string;
      riskScore: number;
    }> = [];

    for (const [userId, userData] of userScores) {
      let riskScore = 0;

      // Failed authentication attempts
      const failedAuth = userData.events.filter(
        (e) =>
          e.eventType === SecurityEventType.AUTHENTICATION &&
          e.outcome === AuditOutcome.FAILURE
      ).length;
      riskScore += failedAuth * 10;

      // Rate limit violations
      const rateLimited = userData.events.filter(
        (e) => e.outcome === AuditOutcome.RATE_LIMITED
      ).length;
      riskScore += rateLimited * 15;

      // Critical events
      const criticalEvents = userData.events.filter(
        (e) => e.severity === AuditSeverity.CRITICAL
      ).length;
      riskScore += criticalEvents * 25;

      // Multiple countries
      const countries = new Set(
        userData.events.map((e) => e.country).filter(Boolean)
      );
      if (countries.size > 2) riskScore += 20;

      // Normalize score to 0-100 range
      riskScore = Math.min(100, riskScore);

      riskScores.push({
        userId,
        email: userData.email,
        riskScore,
      });
    }

    return riskScores.sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);
  }

  private calculateSecurityScore(data: {
    totalEvents: number;
    criticalEvents: number;
    activeAlerts: number;
    topThreats: Array<{ type: AlertType; count: number }>;
  }): number {
    let score = 100;

    // Deduct points for critical events
    score -= Math.min(30, data.criticalEvents * 2);

    // Deduct points for active alerts
    score -= Math.min(25, data.activeAlerts * 3);

    // Deduct points for high-severity threats
    const highSeverityThreats = data.topThreats.filter((t) =>
      [
        AlertType.BRUTE_FORCE_ATTACK,
        AlertType.DATA_BREACH_ATTEMPT,
        AlertType.PRIVILEGE_ESCALATION,
      ].includes(t.type)
    );
    score -= Math.min(
      20,
      highSeverityThreats.reduce((sum, t) => sum + t.count, 0) * 5
    );

    // Deduct points for high event volume (potential attacks)
    if (data.totalEvents > 1000) {
      score -= Math.min(15, (data.totalEvents - 1000) / 100);
    }

    return Math.max(0, Math.round(score));
  }

  private determineThreatLevel(
    securityScore: number,
    activeAlerts: number,
    criticalEvents: number
  ): ThreatLevel {
    if (securityScore < 50 || activeAlerts >= 5 || criticalEvents >= 3) {
      return ThreatLevel.CRITICAL;
    }
    if (securityScore < 70 || activeAlerts >= 3 || criticalEvents >= 2) {
      return ThreatLevel.HIGH;
    }
    if (securityScore < 85 || activeAlerts >= 1 || criticalEvents >= 1) {
      return ThreatLevel.MODERATE;
    }
    return ThreatLevel.LOW;
  }

  private mapConfidenceToSeverity(confidence: number): AlertSeverity {
    if (confidence >= 0.9) return AlertSeverity.CRITICAL;
    if (confidence >= 0.8) return AlertSeverity.HIGH;
    if (confidence >= 0.6) return AlertSeverity.MEDIUM;
    return AlertSeverity.LOW;
  }

  private mapAlertSeverityToAuditSeverity(
    severity: AlertSeverity
  ): AuditSeverity {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return AuditSeverity.CRITICAL;
      case AlertSeverity.HIGH:
        return AuditSeverity.HIGH;
      case AlertSeverity.MEDIUM:
        return AuditSeverity.MEDIUM;
      case AlertSeverity.LOW:
        return AuditSeverity.LOW;
    }
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
    // Clean up old data every hour
    setInterval(
      () => {
        this.cleanupOldData();
      },
      60 * 60 * 1000
    );

    // Process event buffer every 30 seconds
    setInterval(() => {
      this.processEventBuffer();
    }, 30 * 1000);
  }

  private cleanupEventBuffer(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.eventBuffer = this.eventBuffer.filter(
      (e) => e.timestamp >= oneHourAgo
    );
  }

  private cleanupOldData(): void {
    const alertCutoff = new Date(
      Date.now() -
        this.config.retention.alertRetentionDays * 24 * 60 * 60 * 1000
    );
    this.alerts = this.alerts.filter((a) => a.timestamp >= alertCutoff);
    this.cleanupEventBuffer();
  }

  private async processEventBuffer(): Promise<void> {
    // Analyze patterns in event buffer for real-time threat detection
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const recentEvents = this.eventBuffer.filter(
      (e) => e.timestamp >= oneMinuteAgo
    );

    // Check for event spikes
    if (recentEvents.length > 50) {
      await this.createAlert({
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
  metadata?: Record<string, any>
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
