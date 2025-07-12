import cron from "node-cron";
import { executeScheduledRetention } from "./auditLogRetention";
import {
  AuditOutcome,
  createAuditMetadata,
  SecurityEventType,
  securityAuditLogger,
} from "./securityAuditLogger";

export class AuditLogScheduler {
  private retentionTask: any = null;
  private isRunning = false;

  constructor() {
    this.isRunning = false;
  }

  start(): void {
    if (this.isRunning) {
      console.log("Audit log scheduler is already running");
      return;
    }

    const retentionSchedule =
      process.env.AUDIT_LOG_RETENTION_SCHEDULE || "0 2 * * 0"; // Default: 2 AM every Sunday
    const isDryRun = process.env.AUDIT_LOG_RETENTION_DRY_RUN === "true";

    console.log(
      `Starting audit log scheduler with schedule: ${retentionSchedule}`
    );
    console.log(`Dry run mode: ${isDryRun}`);

    // Schedule retention policy execution
    this.retentionTask = cron.schedule(
      retentionSchedule,
      async () => {
        console.log("Executing scheduled audit log retention...");

        try {
          await executeScheduledRetention(isDryRun);

          await securityAuditLogger.log({
            eventType: SecurityEventType.SYSTEM_CONFIG,
            action: "scheduled_audit_retention_success",
            outcome: AuditOutcome.SUCCESS,
            context: {
              metadata: createAuditMetadata({
                schedule: retentionSchedule,
                isDryRun,
                executionTime: new Date().toISOString(),
              }),
            },
          });
        } catch (error) {
          console.error("Scheduled audit log retention failed:", error);

          await securityAuditLogger.log({
            eventType: SecurityEventType.SYSTEM_CONFIG,
            action: "scheduled_audit_retention_failure",
            outcome: AuditOutcome.FAILURE,
            errorMessage: `Scheduled audit retention failed: ${error}`,
            context: {
              metadata: createAuditMetadata({
                schedule: retentionSchedule,
                isDryRun,
                executionTime: new Date().toISOString(),
                error: "retention_execution_failed",
              }),
            },
          });
        }
      },
      {
        timezone: "UTC", // Use UTC to avoid timezone issues
      }
    );

    this.retentionTask.start();
    this.isRunning = true;

    // Log scheduler startup
    securityAuditLogger.log({
      eventType: SecurityEventType.SYSTEM_CONFIG,
      action: "audit_log_scheduler_started",
      outcome: AuditOutcome.SUCCESS,
      context: {
        metadata: createAuditMetadata({
          retentionSchedule,
          isDryRun,
          timezone: "UTC",
        }),
      },
    });

    console.log("Audit log scheduler started successfully");
  }

  stop(): void {
    if (!this.isRunning) {
      console.log("Audit log scheduler is not running");
      return;
    }

    if (this.retentionTask) {
      this.retentionTask.stop();
      this.retentionTask = null;
    }

    this.isRunning = false;

    // Log scheduler shutdown
    securityAuditLogger.log({
      eventType: SecurityEventType.SYSTEM_CONFIG,
      action: "audit_log_scheduler_stopped",
      outcome: AuditOutcome.SUCCESS,
      context: {
        metadata: createAuditMetadata({
          shutdownTime: new Date().toISOString(),
        }),
      },
    });

    console.log("Audit log scheduler stopped");
  }

  getStatus(): {
    isRunning: boolean;
    nextExecution?: Date;
    schedule?: string;
  } {
    return {
      isRunning: this.isRunning,
      nextExecution: this.retentionTask?.getStatus()?.next || undefined,
      schedule: process.env.AUDIT_LOG_RETENTION_SCHEDULE || "0 2 * * 0",
    };
  }

  async executeNow(isDryRun = false): Promise<void> {
    console.log(
      `Manually executing audit log retention (dry run: ${isDryRun})...`
    );

    await securityAuditLogger.log({
      eventType: SecurityEventType.SYSTEM_CONFIG,
      action: "manual_audit_retention_triggered",
      outcome: AuditOutcome.SUCCESS,
      context: {
        metadata: createAuditMetadata({
          isDryRun,
          triggerTime: new Date().toISOString(),
          triggerType: "manual",
        }),
      },
    });

    try {
      await executeScheduledRetention(isDryRun);
    } catch (error) {
      await securityAuditLogger.log({
        eventType: SecurityEventType.SYSTEM_CONFIG,
        action: "manual_audit_retention_failed",
        outcome: AuditOutcome.FAILURE,
        errorMessage: `Manual audit retention failed: ${error}`,
        context: {
          metadata: createAuditMetadata({
            isDryRun,
            triggerTime: new Date().toISOString(),
            triggerType: "manual",
            error: "retention_execution_failed",
          }),
        },
      });
      throw error;
    }
  }
}

// Export singleton instance
export const auditLogScheduler = new AuditLogScheduler();
