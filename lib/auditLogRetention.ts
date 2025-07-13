import { prisma } from "./prisma";
import {
  AuditOutcome,
  createAuditMetadata,
  SecurityEventType,
  securityAuditLogger,
} from "./securityAuditLogger";

type AuditSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

interface PolicyResult {
  policyName: string;
  processed: number;
  deleted: number;
  archived: number;
  errors: string[];
}

interface WhereClause {
  timestamp: { lt: Date };
  severity?: { in: AuditSeverity[] };
  eventType?: { in: SecurityEventType[] };
  companyId?: string;
}

interface RetentionResults {
  totalProcessed: number;
  totalDeleted: number;
  totalArchived: number;
  policyResults: PolicyResult[];
}

export interface RetentionPolicy {
  name: string;
  maxAgeDays: number;
  severityFilter?: string[];
  eventTypeFilter?: string[];
  archiveBeforeDelete?: boolean;
}

export const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  {
    name: "Critical Events",
    maxAgeDays: 2555, // 7 years for critical security events
    severityFilter: ["CRITICAL"],
    archiveBeforeDelete: true,
  },
  {
    name: "High Severity Events",
    maxAgeDays: 1095, // 3 years for high severity events
    severityFilter: ["HIGH"],
    archiveBeforeDelete: true,
  },
  {
    name: "Authentication Events",
    maxAgeDays: 730, // 2 years for authentication events
    eventTypeFilter: ["AUTHENTICATION", "AUTHORIZATION", "PASSWORD_RESET"],
    archiveBeforeDelete: true,
  },
  {
    name: "Platform Admin Events",
    maxAgeDays: 1095, // 3 years for platform admin activities
    eventTypeFilter: ["PLATFORM_ADMIN", "COMPANY_MANAGEMENT"],
    archiveBeforeDelete: true,
  },
  {
    name: "User Management Events",
    maxAgeDays: 730, // 2 years for user management
    eventTypeFilter: ["USER_MANAGEMENT"],
    archiveBeforeDelete: true,
  },
  {
    name: "General Events",
    maxAgeDays: 365, // 1 year for general events
    severityFilter: ["INFO", "LOW", "MEDIUM"],
    archiveBeforeDelete: false,
  },
];

export class AuditLogRetentionManager {
  private policies: RetentionPolicy[];
  private isDryRun: boolean;

  constructor(
    policies: RetentionPolicy[] = DEFAULT_RETENTION_POLICIES,
    isDryRun = false
  ) {
    this.policies = policies;
    this.isDryRun = isDryRun;
  }

  private async logRetentionStart(): Promise<void> {
    await securityAuditLogger.log({
      eventType: SecurityEventType.SYSTEM_CONFIG,
      action: this.isDryRun
        ? "audit_log_retention_dry_run_started"
        : "audit_log_retention_started",
      outcome: AuditOutcome.SUCCESS,
      context: {
        metadata: createAuditMetadata({
          policiesCount: this.policies.length,
          isDryRun: this.isDryRun,
          policies: this.policies.map((p) => ({
            name: p.name,
            maxAgeDays: p.maxAgeDays,
            hasArchive: p.archiveBeforeDelete,
          })),
        }),
      },
    });
  }

  private buildWhereClause(
    policy: RetentionPolicy,
    cutoffDate: Date
  ): WhereClause {
    const whereClause: WhereClause = {
      timestamp: { lt: cutoffDate },
    };

    if (policy.severityFilter && policy.severityFilter.length > 0) {
      whereClause.severity = { in: policy.severityFilter as AuditSeverity[] };
    }

    if (policy.eventTypeFilter && policy.eventTypeFilter.length > 0) {
      whereClause.eventType = {
        in: policy.eventTypeFilter as SecurityEventType[],
      };
    }

    return whereClause;
  }

  private async processDryRun(
    policy: RetentionPolicy,
    logsToProcess: number,
    policyResult: PolicyResult
  ): Promise<void> {
    console.log(
      `DRY RUN: Would process ${logsToProcess} logs for policy "${policy.name}"`
    );
    if (policy.archiveBeforeDelete) {
      policyResult.archived = logsToProcess;
    } else {
      policyResult.deleted = logsToProcess;
    }
  }

  private async processActualRetention(
    policy: RetentionPolicy,
    logsToProcess: number,
    cutoffDate: Date,
    whereClause: WhereClause,
    policyResult: PolicyResult
  ): Promise<void> {
    if (policy.archiveBeforeDelete) {
      await securityAuditLogger.log({
        eventType: SecurityEventType.DATA_PRIVACY,
        action: "audit_logs_archived",
        outcome: AuditOutcome.SUCCESS,
        context: {
          metadata: createAuditMetadata({
            policyName: policy.name,
            logsArchived: logsToProcess,
            cutoffDate: cutoffDate.toISOString(),
          }),
        },
      });

      policyResult.archived = logsToProcess;
      console.log(`Policy "${policy.name}": Archived ${logsToProcess} logs`);
    }

    const deleteResult = await prisma.securityAuditLog.deleteMany({
      where: whereClause,
    });

    policyResult.deleted = deleteResult.count;
    console.log(`Policy "${policy.name}": Deleted ${deleteResult.count} logs`);

    await securityAuditLogger.log({
      eventType: SecurityEventType.DATA_PRIVACY,
      action: "audit_logs_deleted",
      outcome: AuditOutcome.SUCCESS,
      context: {
        metadata: createAuditMetadata({
          policyName: policy.name,
          logsDeleted: deleteResult.count,
          cutoffDate: cutoffDate.toISOString(),
          wasArchived: policy.archiveBeforeDelete,
        }),
      },
    });
  }

  private async logRetentionCompletion(
    results: RetentionResults
  ): Promise<void> {
    await securityAuditLogger.log({
      eventType: SecurityEventType.SYSTEM_CONFIG,
      action: this.isDryRun
        ? "audit_log_retention_dry_run_completed"
        : "audit_log_retention_completed",
      outcome: AuditOutcome.SUCCESS,
      context: {
        metadata: createAuditMetadata({
          totalProcessed: results.totalProcessed,
          totalDeleted: results.totalDeleted,
          totalArchived: results.totalArchived,
          policiesExecuted: this.policies.length,
          isDryRun: this.isDryRun,
          results: results.policyResults,
        }),
      },
    });
  }

  async executeRetentionPolicies(): Promise<RetentionResults> {
    const results: RetentionResults = {
      totalProcessed: 0,
      totalDeleted: 0,
      totalArchived: 0,
      policyResults: [],
    };

    await this.logRetentionStart();

    for (const policy of this.policies) {
      const policyResult: PolicyResult = {
        policyName: policy.name,
        processed: 0,
        deleted: 0,
        archived: 0,
        errors: [],
      };

      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.maxAgeDays);
        const whereClause = this.buildWhereClause(policy, cutoffDate);

        const logsToProcess = await prisma.securityAuditLog.count({
          where: whereClause,
        });

        policyResult.processed = logsToProcess;

        if (logsToProcess === 0) {
          console.log(
            `Policy "${policy.name}": No logs found for retention processing`
          );
          continue;
        }

        console.log(
          `Policy "${policy.name}": Processing ${logsToProcess} logs older than ${policy.maxAgeDays} days`
        );

        if (this.isDryRun) {
          await this.processDryRun(policy, logsToProcess, policyResult);
        } else {
          await this.processActualRetention(
            policy,
            logsToProcess,
            cutoffDate,
            whereClause,
            policyResult
          );
        }
      } catch (error) {
        const errorMessage = `Error processing policy "${policy.name}": ${error}`;
        policyResult.errors.push(errorMessage);
        console.error(errorMessage);

        await securityAuditLogger.log({
          eventType: SecurityEventType.SYSTEM_CONFIG,
          action: "audit_log_retention_policy_error",
          outcome: AuditOutcome.FAILURE,
          errorMessage: errorMessage,
          context: {
            metadata: createAuditMetadata({
              policyName: policy.name,
              error: "retention_policy_error",
            }),
          },
        });
      }

      results.policyResults.push(policyResult);
      results.totalProcessed += policyResult.processed;
      results.totalDeleted += policyResult.deleted;
      results.totalArchived += policyResult.archived;
    }

    await this.logRetentionCompletion(results);
    return results;
  }

  async getRetentionStatistics(): Promise<{
    totalLogs: number;
    logsByEventType: Record<string, number>;
    logsBySeverity: Record<string, number>;
    logsByAge: Array<{ age: string; count: number }>;
    oldestLog?: Date;
    newestLog?: Date;
  }> {
    const [totalLogs, logsByEventType, logsBySeverity, oldestLog, newestLog] =
      await Promise.all([
        // Total count
        prisma.securityAuditLog.count(),

        // Group by event type
        prisma.securityAuditLog.groupBy({
          by: ["eventType"],
          _count: { id: true },
        }),

        // Group by severity
        prisma.securityAuditLog.groupBy({
          by: ["severity"],
          _count: { id: true },
        }),

        // Oldest log
        prisma.securityAuditLog.findFirst({
          orderBy: { timestamp: "asc" },
          select: { timestamp: true },
        }),

        // Newest log
        prisma.securityAuditLog.findFirst({
          orderBy: { timestamp: "desc" },
          select: { timestamp: true },
        }),
      ]);

    // Calculate logs by age buckets
    const now = new Date();
    const ageBuckets = [
      { name: "Last 24 hours", days: 1 },
      { name: "Last 7 days", days: 7 },
      { name: "Last 30 days", days: 30 },
      { name: "Last 90 days", days: 90 },
      { name: "Last 365 days", days: 365 },
      { name: "Older than 1 year", days: Number.POSITIVE_INFINITY },
    ];

    const logsByAge: Array<{ age: string; count: number }> = [];
    let previousDate = now;

    for (const bucket of ageBuckets) {
      const bucketDate =
        bucket.days === Number.POSITIVE_INFINITY
          ? new Date(0)
          : new Date(now.getTime() - bucket.days * 24 * 60 * 60 * 1000);

      const count = await prisma.securityAuditLog.count({
        where: {
          timestamp: {
            gte: bucketDate,
            lt: previousDate,
          },
        },
      });

      logsByAge.push({
        age: bucket.name,
        count,
      });

      previousDate = bucketDate;
    }

    return {
      totalLogs,
      logsByEventType: Object.fromEntries(
        logsByEventType.map((item) => [item.eventType, item._count.id])
      ),
      logsBySeverity: Object.fromEntries(
        logsBySeverity.map((item) => [item.severity, item._count.id])
      ),
      logsByAge,
      oldestLog: oldestLog?.timestamp,
      newestLog: newestLog?.timestamp,
    };
  }

  private validatePolicyStructure(
    policy: RetentionPolicy,
    errors: string[]
  ): void {
    if (!policy.name || policy.name.trim() === "") {
      errors.push("Policy must have a non-empty name");
    }

    if (!policy.maxAgeDays || policy.maxAgeDays <= 0) {
      errors.push(
        `Policy "${policy.name}": maxAgeDays must be a positive number`
      );
    }
  }

  private validatePolicyFilters(
    policy: RetentionPolicy,
    warnings: string[]
  ): void {
    if (policy.severityFilter && policy.eventTypeFilter) {
      warnings.push(
        `Policy "${policy.name}": Has both severity and event type filters, ensure this is intentional`
      );
    }

    if (!policy.severityFilter && !policy.eventTypeFilter) {
      warnings.push(
        `Policy "${policy.name}": No filters specified, will apply to all logs`
      );
    }
  }

  private validateRetentionPeriods(
    policy: RetentionPolicy,
    warnings: string[]
  ): void {
    if (policy.maxAgeDays < 30) {
      warnings.push(
        `Policy "${policy.name}": Very short retention period (${policy.maxAgeDays} days)`
      );
    }

    if (policy.maxAgeDays > 1095 && !policy.archiveBeforeDelete) {
      warnings.push(
        `Policy "${policy.name}": Long retention period without archiving may impact performance`
      );
    }
  }

  async validateRetentionPolicies(): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const policy of this.policies) {
      this.validatePolicyStructure(policy, errors);
      this.validatePolicyFilters(policy, warnings);
      this.validateRetentionPeriods(policy, warnings);
    }

    const overlaps = this.findPolicyOverlaps();
    if (overlaps.length > 0) {
      warnings.push(
        ...overlaps.map(
          (overlap) =>
            `Potential policy overlap: "${overlap.policy1}" and "${overlap.policy2}"`
        )
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private findPolicyOverlaps(): Array<{ policy1: string; policy2: string }> {
    const overlaps: Array<{ policy1: string; policy2: string }> = [];

    for (let i = 0; i < this.policies.length; i++) {
      for (let j = i + 1; j < this.policies.length; j++) {
        const policy1 = this.policies[i];
        const policy2 = this.policies[j];

        // Check if policies have overlapping filters
        const hasOverlappingSeverity = this.arraysOverlap(
          policy1.severityFilter || [],
          policy2.severityFilter || []
        );

        const hasOverlappingEventType = this.arraysOverlap(
          policy1.eventTypeFilter || [],
          policy2.eventTypeFilter || []
        );

        if (hasOverlappingSeverity || hasOverlappingEventType) {
          overlaps.push({ policy1: policy1.name, policy2: policy2.name });
        }
      }
    }

    return overlaps;
  }

  private arraysOverlap(arr1: string[], arr2: string[]): boolean {
    if (arr1.length === 0 || arr2.length === 0) return false;
    return arr1.some((item) => arr2.includes(item));
  }
}

// Utility function for scheduled retention execution
export async function executeScheduledRetention(
  isDryRun = false
): Promise<void> {
  const manager = new AuditLogRetentionManager(
    DEFAULT_RETENTION_POLICIES,
    isDryRun
  );

  console.log(
    `Starting scheduled audit log retention (dry run: ${isDryRun})...`
  );

  try {
    // Validate policies first
    const validation = await manager.validateRetentionPolicies();
    if (!validation.valid) {
      throw new Error(
        `Invalid retention policies: ${validation.errors.join(", ")}`
      );
    }

    if (validation.warnings.length > 0) {
      console.warn("Retention policy warnings:", validation.warnings);
    }

    // Execute retention
    const results = await manager.executeRetentionPolicies();

    console.log("Retention execution completed:");
    console.log(`  Total processed: ${results.totalProcessed}`);
    console.log(`  Total deleted: ${results.totalDeleted}`);
    console.log(`  Total archived: ${results.totalArchived}`);

    // Log detailed results
    for (const policyResult of results.policyResults) {
      console.log(`  Policy "${policyResult.policyName}":`);
      console.log(`    Processed: ${policyResult.processed}`);
      console.log(`    Deleted: ${policyResult.deleted}`);
      console.log(`    Archived: ${policyResult.archived}`);
      if (policyResult.errors.length > 0) {
        console.log(`    Errors: ${policyResult.errors.join(", ")}`);
      }
    }
  } catch (error) {
    console.error("Scheduled retention execution failed:", error);

    await securityAuditLogger.log({
      eventType: SecurityEventType.SYSTEM_CONFIG,
      action: "scheduled_retention_failed",
      outcome: AuditOutcome.FAILURE,
      errorMessage: `Scheduled retention failed: ${error}`,
      context: {
        metadata: createAuditMetadata({
          isDryRun,
          error: "scheduled_retention_failure",
        }),
      },
    });

    throw error;
  }
}
