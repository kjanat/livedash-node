import { getSecurityAuditLogRepository } from "../repositories/RepositoryFactory";
import {
  AuditOutcome,
  AuditSeverity,
  SecurityEventType,
} from "../securityAuditLogger";
import {
  AlertType,
  type SecurityAlert,
  type SecurityMetrics,
  ThreatLevel,
} from "../securityMonitoring";

/**
 * Handles security metrics calculation and reporting
 * Single Responsibility: Metrics computation and data analysis
 */
export class SecurityMetricsService {
  /**
   * Calculate comprehensive security metrics for a time range
   */
  async calculateSecurityMetrics(
    timeRange: { start: Date; end: Date },
    companyId?: string,
    alerts: SecurityAlert[] = []
  ): Promise<SecurityMetrics> {
    const auditRepository = getSecurityAuditLogRepository();

    // Get security analytics using repository
    const analytics = await auditRepository.getSecurityAnalytics(
      timeRange.start,
      timeRange.end,
      companyId
    );

    // Get additional audit log data for user risk calculations
    const events = await auditRepository.findMany({
      where: {
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end,
        } as any,
        ...(companyId && { companyId }),
      },
    });

    // Use analytics data from repository
    const totalEvents = analytics.totalEvents;
    const criticalEvents =
      analytics.eventsBySeverity[AuditSeverity.CRITICAL] || 0;

    const activeAlerts = alerts.filter((a) => !a.acknowledged).length;
    const resolvedAlerts = alerts.filter((a) => a.acknowledged).length;

    // Alert distribution by type
    const alertsByType = alerts.reduce(
      (acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      },
      {} as Record<AlertType, number>
    );

    // Top threats from alerts
    const topThreats = Object.entries(alertsByType)
      .map(([type, count]) => ({ type: type as AlertType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // User risk scores - transform data to match expected format
    const transformedEvents = events.map(event => ({
      userId: event.userId || undefined,
      user: event.user ? { email: event.user.email } : undefined,
      eventType: event.eventType as SecurityEventType,
      outcome: event.outcome as AuditOutcome,
      severity: event.severity as AuditSeverity,
      country: event.country || undefined,
    }));
    const userRiskScores = await this.calculateUserRiskScores(transformedEvents);

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
      eventsByType: analytics.eventsByType,
      alertsByType,
      topThreats,
      geoDistribution: analytics.geoDistribution,
      timeDistribution: analytics.hourlyDistribution,
      userRiskScores,
    };
  }

  /**
   * Calculate risk scores for users based on their security events
   */
  async calculateUserRiskScores(
    events: Array<{
      userId?: string;
      user?: { email: string };
      eventType: SecurityEventType;
      outcome: AuditOutcome;
      severity: AuditSeverity;
      country?: string;
    }>
  ): Promise<Array<{ userId: string; email: string; riskScore: number }>> {
    const userEvents = events.filter((e) => e.userId) as Array<typeof events[0] & { userId: string }>;
    const userScores = new Map<
      string,
      { email: string; score: number; events: typeof userEvents }
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

    for (const [userId, userData] of Array.from(userScores.entries())) {
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

  /**
   * Calculate threat level for a specific IP address
   */
  async calculateIPThreatLevel(ipAddress: string): Promise<{
    threatLevel: ThreatLevel;
    riskFactors: string[];
    recommendations: string[];
    isBlacklisted: boolean;
  }> {
    const auditRepository = getSecurityAuditLogRepository();

    // Get IP activity summary using repository
    const activitySummary = await auditRepository.getIPActivitySummary(
      ipAddress,
      24
    );

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const _events = await auditRepository.findByIPAddress(ipAddress, oneDayAgo);

    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    // Use activity summary data from repository
    const {
      failedLogins,
      rateLimitViolations,
      uniqueUsersTargeted,
      totalEvents,
    } = activitySummary;

    if (failedLogins > 10) {
      riskFactors.push(`${failedLogins} failed login attempts in 24h`);
      recommendations.push("Consider temporary IP blocking");
    }

    if (rateLimitViolations > 5) {
      riskFactors.push(`${rateLimitViolations} rate limit violations`);
      recommendations.push("Implement stricter rate limiting");
    }

    if (uniqueUsersTargeted > 5) {
      riskFactors.push(
        `Access attempts to ${uniqueUsersTargeted} different accounts`
      );
      recommendations.push("Investigate for account enumeration");
    }

    // Determine threat level
    let threatLevel = ThreatLevel.LOW;
    if (riskFactors.length >= 3) threatLevel = ThreatLevel.CRITICAL;
    else if (riskFactors.length >= 2) threatLevel = ThreatLevel.HIGH;
    else if (riskFactors.length >= 1) threatLevel = ThreatLevel.MODERATE;

    // Ensure we always provide at least basic analysis
    if (riskFactors.length === 0) {
      riskFactors.push(`${totalEvents} security events in 24h`);
    }

    if (recommendations.length === 0) {
      recommendations.push("Continue monitoring for suspicious activity");
    }

    // Simple blacklist check based on threat level and risk factors
    const isBlacklisted =
      threatLevel === ThreatLevel.CRITICAL && riskFactors.length >= 3;

    return { threatLevel, riskFactors, recommendations, isBlacklisted };
  }

  /**
   * Calculate overall security score based on various factors
   */
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

  /**
   * Determine overall threat level based on security metrics
   */
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

  /**
   * Get security score trend over time
   */
  async getSecurityScoreTrend(
    days: number,
    companyId?: string
  ): Promise<Array<{ date: Date; score: number }>> {
    const trends: Array<{ date: Date; score: number }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const metrics = await this.calculateSecurityMetrics(
        { start: startOfDay, end: endOfDay },
        companyId
      );

      trends.push({
        date: startOfDay,
        score: metrics.securityScore,
      });
    }

    return trends;
  }
}
