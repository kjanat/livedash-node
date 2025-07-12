import { prisma } from "../prisma";
import {
  type AuditLogContext,
  AuditOutcome,
  SecurityEventType,
} from "../securityAuditLogger";
import {
  AlertSeverity,
  AlertType,
  type MonitoringConfig,
} from "../securityMonitoring";
import type { SecurityEventData } from "./SecurityEventProcessor";

export interface ThreatDetectionResult {
  threats: Array<{
    severity: AlertSeverity;
    type: AlertType;
    title: string;
    description: string;
    eventType: SecurityEventType;
    context: AuditLogContext;
    metadata: Record<string, unknown>;
  }>;
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  confidence: number;
  type: string;
  description: string;
  recommendedActions: string[];
}

/**
 * Handles security threat detection and anomaly analysis
 * Single Responsibility: Threat identification and risk assessment
 */
export class ThreatDetectionService {
  constructor(private config: MonitoringConfig) {}

  /**
   * Detect immediate threats from security event
   */
  async detectImmediateThreats(
    eventType: SecurityEventType,
    outcome: AuditOutcome,
    context: AuditLogContext,
    metadata?: Record<string, unknown>
  ): Promise<ThreatDetectionResult> {
    const threats: Array<{
      severity: AlertSeverity;
      type: AlertType;
      title: string;
      description: string;
      eventType: SecurityEventType;
      context: AuditLogContext;
      metadata: Record<string, unknown>;
    }> = [];

    const now = new Date();

    // Multiple failed logins detection
    if (
      eventType === SecurityEventType.AUTHENTICATION &&
      outcome === AuditOutcome.FAILURE &&
      context.ipAddress
    ) {
      const threatResult = await this.detectBruteForceAttack(
        context.ipAddress,
        now
      );
      if (threatResult) {
        threats.push({
          ...threatResult,
          eventType,
          context,
          metadata: { ...threatResult.metadata, ...metadata },
        });
      }
    }

    // Suspicious admin activity
    if (
      eventType === SecurityEventType.PLATFORM_ADMIN ||
      (eventType === SecurityEventType.USER_MANAGEMENT && context.userId)
    ) {
      const threatResult = await this.detectSuspiciousAdminActivity(
        context.userId!,
        now
      );
      if (threatResult) {
        threats.push({
          ...threatResult,
          eventType,
          context,
          metadata: { ...threatResult.metadata, ...metadata },
        });
      }
    }

    // Rate limiting violations
    if (outcome === AuditOutcome.RATE_LIMITED && context.ipAddress) {
      const threatResult = await this.detectRateLimitBreach(
        context.ipAddress,
        now
      );
      if (threatResult) {
        threats.push({
          ...threatResult,
          eventType,
          context,
          metadata: { ...threatResult.metadata, ...metadata },
        });
      }
    }

    return { threats };
  }

  /**
   * Detect anomalies in security events
   */
  async detectAnomalies(
    eventType: SecurityEventType,
    context: AuditLogContext,
    eventBuffer: SecurityEventData[]
  ): Promise<AnomalyDetectionResult> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get historical data for baseline
    const historicalEvents = await prisma.securityAuditLog.findMany({
      where: {
        eventType,
        timestamp: { gte: sevenDaysAgo, lt: now },
      },
    });

    // Check for geographical anomalies
    if (context.country && context.userId) {
      // Transform historical events to match expected type
      const transformedEvents = historicalEvents.map(event => ({
        userId: event.userId || undefined,
        country: event.country || undefined,
      }));
      const geoAnomaly = this.checkGeographicalAnomaly(
        context.userId,
        context.country,
        transformedEvents
      );
      if (geoAnomaly.isAnomaly) return geoAnomaly;
    }

    // Check for time-based anomalies
    const timeAnomaly = this.checkTemporalAnomaly(
      eventType,
      now,
      historicalEvents,
      eventBuffer
    );
    if (timeAnomaly.isAnomaly) return timeAnomaly;

    return {
      isAnomaly: false,
      confidence: 0,
      type: "normal",
      description: "No anomalies detected",
      recommendedActions: [],
    };
  }

  private async detectBruteForceAttack(ipAddress: string, now: Date) {
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const recentFailures = await prisma.securityAuditLog.count({
      where: {
        eventType: SecurityEventType.AUTHENTICATION,
        outcome: AuditOutcome.FAILURE,
        ipAddress,
        timestamp: { gte: fiveMinutesAgo },
      },
    });

    if (recentFailures >= this.config.thresholds.failedLoginsPerMinute) {
      return {
        severity: AlertSeverity.HIGH,
        type: AlertType.BRUTE_FORCE_ATTACK,
        title: "Brute Force Attack Detected",
        description: `${recentFailures} failed login attempts from IP ${ipAddress} in 5 minutes`,
        metadata: { failedAttempts: recentFailures },
      };
    }
    return null;
  }

  private async detectSuspiciousAdminActivity(userId: string, now: Date) {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const adminActions = await prisma.securityAuditLog.count({
      where: {
        userId,
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
      return {
        severity: AlertSeverity.MEDIUM,
        type: AlertType.UNUSUAL_ADMIN_ACTIVITY,
        title: "Unusual Admin Activity",
        description: `User ${userId} performed ${adminActions} admin actions in 1 hour`,
        metadata: { adminActions },
      };
    }
    return null;
  }

  private async detectRateLimitBreach(ipAddress: string, now: Date) {
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const rateLimitViolations = await prisma.securityAuditLog.count({
      where: {
        outcome: AuditOutcome.RATE_LIMITED,
        ipAddress,
        timestamp: { gte: oneMinuteAgo },
      },
    });

    if (
      rateLimitViolations >= this.config.thresholds.rateLimitViolationsPerMinute
    ) {
      return {
        severity: AlertSeverity.MEDIUM,
        type: AlertType.RATE_LIMIT_BREACH,
        title: "Rate Limit Breach",
        description: `IP ${ipAddress} exceeded rate limits ${rateLimitViolations} times in 1 minute`,
        metadata: { violations: rateLimitViolations },
      };
    }
    return null;
  }

  private checkGeographicalAnomaly(
    userId: string,
    country: string,
    historicalEvents: Array<{ userId?: string; country?: string }>
  ): AnomalyDetectionResult {
    const userCountries = new Set(
      historicalEvents
        .filter((e) => e.userId === userId && e.country)
        .map((e) => e.country)
    );

    if (userCountries.size > 0 && !userCountries.has(country)) {
      return {
        isAnomaly: true,
        confidence: 0.8,
        type: "geographical_anomaly",
        description: `User accessing from unusual country: ${country}`,
        recommendedActions: [
          "Verify user identity",
          "Check for compromised credentials",
          "Consider additional authentication",
        ],
      };
    }

    return {
      isAnomaly: false,
      confidence: 0,
      type: "normal",
      description: "No geographical anomalies detected",
      recommendedActions: [],
    };
  }

  private checkTemporalAnomaly(
    eventType: SecurityEventType,
    now: Date,
    historicalEvents: Array<{ timestamp: Date }>,
    eventBuffer: SecurityEventData[]
  ): AnomalyDetectionResult {
    const currentHour = now.getHours();
    const hourlyEvents = historicalEvents.filter(
      (e) => e.timestamp.getHours() === currentHour
    );
    const avgHourlyEvents = hourlyEvents.length / 7; // 7 days average

    const recentHourEvents = eventBuffer.filter(
      (e) =>
        e.eventType === eventType &&
        e.timestamp.getHours() === currentHour &&
        e.timestamp > new Date(now.getTime() - 60 * 60 * 1000)
    ).length;

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
      description: "No temporal anomalies detected",
      recommendedActions: [],
    };
  }
}
