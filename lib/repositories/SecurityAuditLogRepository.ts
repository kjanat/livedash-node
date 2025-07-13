import type { Prisma, SecurityAuditLog } from "@prisma/client";
import { prisma } from "../prisma";
import {
  AuditOutcome,
  type AuditSeverity,
  SecurityEventType,
} from "../securityAuditLogger";
import {
  type BaseRepository,
  type CountOptions,
  type CreateInput,
  type FindManyOptions,
  RepositoryError,
  type UpdateInput,
} from "./BaseRepository";

/**
 * Security audit log with included relations
 */
export type SecurityAuditLogWithRelations = SecurityAuditLog & {
  user: {
    id: string;
    email: string;
  } | null;
  company: {
    id: string;
    name: string;
  } | null;
};

/**
 * Security audit analytics interface
 */
export interface SecurityAnalytics {
  totalEvents: number;
  eventsByType: Record<SecurityEventType, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  eventsByOutcome: Record<AuditOutcome, number>;
  topIPs: Array<{ ip: string; count: number }>;
  topUsers: Array<{ userId: string; email: string; count: number }>;
  hourlyDistribution: Array<{ hour: number; count: number }>;
  geoDistribution: Record<string, number>;
}

/**
 * SecurityAuditLog repository implementing database operations
 */
export class SecurityAuditLogRepository
  implements BaseRepository<SecurityAuditLog>
{
  /**
   * Find audit log by ID
   */
  async findById(id: string): Promise<SecurityAuditLogWithRelations | null> {
    try {
      return await prisma.securityAuditLog.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, email: true },
          },
          company: {
            select: { id: true, name: true },
          },
        },
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to find audit log ${id}`,
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Find many audit logs with filters
   */
  async findMany(
    options?: FindManyOptions<SecurityAuditLog>
  ): Promise<SecurityAuditLogWithRelations[]> {
    try {
      return await prisma.securityAuditLog.findMany({
        where: options?.where as Prisma.SecurityAuditLogWhereInput,
        orderBy:
          options?.orderBy as Prisma.SecurityAuditLogOrderByWithRelationInput,
        skip: options?.skip,
        take: options?.take,
        include: {
          user: {
            select: { id: true, email: true },
          },
          company: {
            select: { id: true, name: true },
          },
        },
      });
    } catch (error) {
      throw new RepositoryError(
        "Failed to find audit logs",
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Find audit logs by event type
   */
  async findByEventType(
    eventType: SecurityEventType,
    limit = 100
  ): Promise<SecurityAuditLog[]> {
    try {
      return await prisma.securityAuditLog.findMany({
        where: { eventType },
        orderBy: { timestamp: "desc" },
        take: limit,
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to find audit logs by event type ${eventType}`,
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Find audit logs by IP address within time range
   */
  async findByIPAddress(
    ipAddress: string,
    startTime: Date,
    endTime?: Date
  ): Promise<SecurityAuditLog[]> {
    try {
      return await prisma.securityAuditLog.findMany({
        where: {
          ipAddress,
          timestamp: {
            gte: startTime,
            ...(endTime && { lte: endTime }),
          },
        },
        orderBy: { timestamp: "desc" },
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to find audit logs by IP ${ipAddress}`,
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Find failed authentication attempts
   */
  async findFailedAuthAttempts(
    ipAddress?: string,
    timeWindow = 24 * 60 * 60 * 1000 // 24 hours in ms
  ): Promise<SecurityAuditLog[]> {
    try {
      const startTime = new Date(Date.now() - timeWindow);
      return await prisma.securityAuditLog.findMany({
        where: {
          eventType: SecurityEventType.AUTHENTICATION,
          outcome: AuditOutcome.FAILURE,
          timestamp: { gte: startTime },
          ...(ipAddress && { ipAddress }),
        },
        orderBy: { timestamp: "desc" },
      });
    } catch (error) {
      throw new RepositoryError(
        "Failed to find failed authentication attempts",
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Create audit log entry
   */
  async create(data: CreateInput<SecurityAuditLog>): Promise<SecurityAuditLog> {
    try {
      return await prisma.securityAuditLog.create({
        data: data as Prisma.SecurityAuditLogCreateInput,
      });
    } catch (error) {
      throw new RepositoryError(
        "Failed to create audit log",
        "CREATE_ERROR",
        error as Error
      );
    }
  }

  /**
   * Update audit log (rarely used, mainly for corrections)
   */
  async update(
    id: string,
    data: UpdateInput<SecurityAuditLog>
  ): Promise<SecurityAuditLog | null> {
    try {
      return await prisma.securityAuditLog.update({
        where: { id },
        data: data as Prisma.SecurityAuditLogUpdateInput,
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to update audit log ${id}`,
        "UPDATE_ERROR",
        error as Error
      );
    }
  }

  /**
   * Delete audit log (used for cleanup)
   */
  async delete(id: string): Promise<boolean> {
    try {
      await prisma.securityAuditLog.delete({ where: { id } });
      return true;
    } catch (error) {
      throw new RepositoryError(
        `Failed to delete audit log ${id}`,
        "DELETE_ERROR",
        error as Error
      );
    }
  }

  /**
   * Count audit logs with filters
   */
  async count(options?: CountOptions<SecurityAuditLog>): Promise<number> {
    try {
      return await prisma.securityAuditLog.count({
        where: options?.where as Prisma.SecurityAuditLogWhereInput,
      });
    } catch (error) {
      throw new RepositoryError(
        "Failed to count audit logs",
        "COUNT_ERROR",
        error as Error
      );
    }
  }

  /**
   * Get security analytics for dashboard
   */
  async getSecurityAnalytics(
    startDate: Date,
    endDate: Date,
    companyId?: string
  ): Promise<SecurityAnalytics> {
    try {
      const whereClause = {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
        ...(companyId && { companyId }),
      };

      const [events, eventsByType, eventsBySeverity, eventsByOutcome] =
        await Promise.all([
          prisma.securityAuditLog.findMany({
            where: whereClause,
            include: {
              user: { select: { id: true, email: true } },
            },
          }),
          prisma.securityAuditLog.groupBy({
            by: ["eventType"],
            where: whereClause,
            _count: { eventType: true },
          }),
          prisma.securityAuditLog.groupBy({
            by: ["severity"],
            where: whereClause,
            _count: { severity: true },
          }),
          prisma.securityAuditLog.groupBy({
            by: ["outcome"],
            where: whereClause,
            _count: { outcome: true },
          }),
        ]);

      // Process aggregated data
      const totalEvents = events.length;

      const eventsByTypeMap = eventsByType.reduce(
        (acc, item) => {
          acc[item.eventType as SecurityEventType] = item._count.eventType;
          return acc;
        },
        {} as Record<SecurityEventType, number>
      );

      const eventsBySeverityMap = eventsBySeverity.reduce(
        (acc, item) => {
          acc[item.severity as AuditSeverity] = item._count.severity;
          return acc;
        },
        {} as Record<AuditSeverity, number>
      );

      const eventsByOutcomeMap = eventsByOutcome.reduce(
        (acc, item) => {
          acc[item.outcome as AuditOutcome] = item._count.outcome;
          return acc;
        },
        {} as Record<AuditOutcome, number>
      );

      // Top IPs
      const ipCounts = events.reduce(
        (acc, event) => {
          if (event.ipAddress) {
            acc[event.ipAddress] = (acc[event.ipAddress] || 0) + 1;
          }
          return acc;
        },
        {} as Record<string, number>
      );

      const topIPs = Object.entries(ipCounts)
        .map(([ip, count]) => ({ ip, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Top users
      const userCounts = events
        .filter((e) => e.userId && e.user)
        .reduce(
          (acc, event) => {
            const key = event.userId!;
            if (!acc[key]) {
              acc[key] = {
                userId: event.userId!,
                email: event.user?.email || "Unknown",
                count: 0,
              };
            }
            acc[key].count++;
            return acc;
          },
          {} as Record<string, { userId: string; email: string; count: number }>
        );

      const topUsers = Object.values(userCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Hourly distribution
      const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: events.filter((e) => e.timestamp.getHours() === hour).length,
      }));

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

      return {
        totalEvents,
        eventsByType: eventsByTypeMap,
        eventsBySeverity: eventsBySeverityMap,
        eventsByOutcome: eventsByOutcomeMap,
        topIPs,
        topUsers,
        hourlyDistribution,
        geoDistribution,
      };
    } catch (error) {
      throw new RepositoryError(
        "Failed to get security analytics",
        "ANALYTICS_ERROR",
        error as Error
      );
    }
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date(
        Date.now() - retentionDays * 24 * 60 * 60 * 1000
      );

      const result = await prisma.securityAuditLog.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
        },
      });

      return result.count;
    } catch (error) {
      throw new RepositoryError(
        "Failed to cleanup old audit logs",
        "CLEANUP_ERROR",
        error as Error
      );
    }
  }

  /**
   * Get suspicious activity summary for an IP
   */
  async getIPActivitySummary(
    ipAddress: string,
    hoursBack = 24
  ): Promise<{
    failedLogins: number;
    rateLimitViolations: number;
    uniqueUsersTargeted: number;
    totalEvents: number;
    timeSpan: { first: Date | null; last: Date | null };
  }> {
    try {
      const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      const events = await this.findByIPAddress(ipAddress, startTime);

      const failedLogins = events.filter(
        (e) =>
          e.eventType === SecurityEventType.AUTHENTICATION &&
          e.outcome === AuditOutcome.FAILURE
      ).length;

      const rateLimitViolations = events.filter(
        (e) => e.outcome === AuditOutcome.RATE_LIMITED
      ).length;

      const uniqueUsersTargeted = new Set(
        events.map((e) => e.userId).filter(Boolean)
      ).size;

      const timeSpan = {
        first: events.length > 0 ? events[events.length - 1].timestamp : null,
        last: events.length > 0 ? events[0].timestamp : null,
      };

      return {
        failedLogins,
        rateLimitViolations,
        uniqueUsersTargeted,
        totalEvents: events.length,
        timeSpan,
      };
    } catch (error) {
      throw new RepositoryError(
        `Failed to get IP activity summary for ${ipAddress}`,
        "ACTIVITY_SUMMARY_ERROR",
        error as Error
      );
    }
  }
}
