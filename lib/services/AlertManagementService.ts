import { TIME } from "../constants";
import {
  AuditOutcome,
  AuditSeverity,
  SecurityEventType,
  securityAuditLogger,
} from "../securityAuditLogger";
import {
  AlertChannel,
  AlertSeverity,
  type MonitoringConfig,
  type SecurityAlert,
} from "../securityMonitoring";

/**
 * Handles security alert management and notifications
 * Single Responsibility: Alert creation, storage, and notifications
 */
export class AlertManagementService {
  private alerts: SecurityAlert[] = [];

  constructor(private config: MonitoringConfig) {}

  /**
   * Create and store a new security alert
   */
  async createAlert(
    alertData: Omit<SecurityAlert, "id" | "timestamp" | "acknowledged">
  ): Promise<SecurityAlert | null> {
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

    if (isDuplicate) return null;

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
    });

    // Send notifications if enabled
    if (this.config.alerting.enabled) {
      await this.sendAlertNotifications(alert);
    }

    return alert;
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
   * Get all alerts within time range
   */
  getAlertsInTimeRange(timeRange: { start: Date; end: Date }): SecurityAlert[] {
    return this.alerts.filter(
      (alert) =>
        alert.timestamp >= timeRange.start && alert.timestamp <= timeRange.end
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
   * Export security alerts for analysis
   */
  exportAlertsData(
    format: "json" | "csv",
    timeRange: { start: Date; end: Date }
  ): string {
    const filteredAlerts = this.getAlertsInTimeRange(timeRange);

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
   * Clean up old alerts based on retention policy
   */
  cleanupOldAlerts(): void {
    const alertCutoff = new Date(
      Date.now() - this.config.retention.alertRetentionDays * TIME.DAY
    );
    this.alerts = this.alerts.filter((a) => a.timestamp >= alertCutoff);
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    total: number;
    active: number;
    acknowledged: number;
    bySeverity: Record<AlertSeverity, number>;
  } {
    const bySeverity = this.alerts.reduce(
      (acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      },
      {} as Record<AlertSeverity, number>
    );

    return {
      total: this.alerts.length,
      active: this.alerts.filter((a) => !a.acknowledged).length,
      acknowledged: this.alerts.filter((a) => a.acknowledged).length,
      bySeverity,
    };
  }

  /**
   * Send alert notifications via configured channels
   */
  private async sendAlertNotifications(alert: SecurityAlert): Promise<void> {
    // Console logging for immediate visibility
    console.error(
      `🚨 SECURITY ALERT [${alert.severity}] ${alert.type}: ${alert.title}`
    );
    console.error(`Description: ${alert.description}`);
    console.error("Context:", alert.context);

    // In production, implement actual notification integrations:
    for (const channel of this.config.alerting.channels) {
      switch (channel) {
        case AlertChannel.EMAIL:
          await this.sendEmailNotification(alert);
          break;
        case AlertChannel.SLACK:
          await this.sendSlackNotification(alert);
          break;
        case AlertChannel.WEBHOOK:
          await this.sendWebhookNotification(alert);
          break;
        case AlertChannel.DISCORD:
          await this.sendDiscordNotification(alert);
          break;
        case AlertChannel.PAGERDUTY:
          await this.sendPagerDutyNotification(alert);
          break;
      }
    }
  }

  private async sendEmailNotification(alert: SecurityAlert): Promise<void> {
    // Implement email notification
    console.log(`[EMAIL] Security alert: ${alert.title}`);
  }

  private async sendSlackNotification(alert: SecurityAlert): Promise<void> {
    // Implement Slack webhook notification
    console.log(`[SLACK] Security alert: ${alert.title}`);
  }

  private async sendWebhookNotification(alert: SecurityAlert): Promise<void> {
    // Implement custom webhook notification
    console.log(`[WEBHOOK] Security alert: ${alert.title}`);
  }

  private async sendDiscordNotification(alert: SecurityAlert): Promise<void> {
    // Implement Discord webhook notification
    console.log(`[DISCORD] Security alert: ${alert.title}`);
  }

  private async sendPagerDutyNotification(alert: SecurityAlert): Promise<void> {
    // Implement PagerDuty API notification
    console.log(`[PAGERDUTY] Security alert: ${alert.title}`);
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
}
