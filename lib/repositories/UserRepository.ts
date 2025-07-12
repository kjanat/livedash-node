import type { Prisma, User } from "@prisma/client";
import { prisma } from "../prisma";
import {
  type BaseRepository,
  type CountOptions,
  type CreateInput,
  type FindManyOptions,
  NotFoundError,
  RepositoryError,
  type UpdateInput,
} from "./BaseRepository";

/**
 * User with included relations
 */
export type UserWithRelations = User & {
  company?: {
    id: string;
    name: string;
  };
  securityAuditLogs?: Array<{
    id: string;
    eventType: string;
    timestamp: Date;
    outcome: string;
  }>;
};

/**
 * User repository implementing database operations
 */
export class UserRepository implements BaseRepository<User> {
  /**
   * Find user by ID with optional relations
   */
  async findById(
    id: string,
    include?: { company?: boolean; securityAuditLogs?: boolean }
  ): Promise<UserWithRelations | null> {
    try {
      return await prisma.user.findUnique({
        where: { id },
        include: {
          company: include?.company
            ? { select: { id: true, name: true } }
            : undefined,
          auditLogs: include?.securityAuditLogs
            ? {
                select: {
                  id: true,
                  eventType: true,
                  timestamp: true,
                  outcome: true,
                },
                take: 100,
                orderBy: { timestamp: "desc" },
              }
            : undefined,
        },
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to find user ${id}`,
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { email },
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to find user by email ${email}`,
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Find users by company ID
   */
  async findByCompanyId(companyId: string): Promise<User[]> {
    try {
      return await prisma.user.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to find users by company ${companyId}`,
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Find users by role
   */
  async findByRole(role: string, companyId?: string): Promise<User[]> {
    try {
      return await prisma.user.findMany({
        where: {
          role: role as any,
          ...(companyId && { companyId }),
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to find users by role ${role}`,
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Find many users with filters
   */
  async findMany(options?: FindManyOptions<User>): Promise<User[]> {
    try {
      return await prisma.user.findMany({
        where: options?.where as Prisma.UserWhereInput,
        orderBy: options?.orderBy as Prisma.UserOrderByWithRelationInput,
        skip: options?.skip,
        take: options?.take,
        include: options?.include as Prisma.UserInclude,
      });
    } catch (error) {
      throw new RepositoryError(
        "Failed to find users",
        "FIND_ERROR",
        error as Error
      );
    }
  }

  /**
   * Create a new user
   */
  async create(data: CreateInput<User>): Promise<User> {
    try {
      return await prisma.user.create({
        data: data as unknown as Prisma.UserCreateInput,
      });
    } catch (error) {
      throw new RepositoryError(
        "Failed to create user",
        "CREATE_ERROR",
        error as Error
      );
    }
  }

  /**
   * Update user by ID
   */
  async update(id: string, data: UpdateInput<User>): Promise<User | null> {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new NotFoundError("User", id);
      }

      return await prisma.user.update({
        where: { id },
        data: data as Prisma.UserUpdateInput,
      });
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new RepositoryError(
        `Failed to update user ${id}`,
        "UPDATE_ERROR",
        error as Error
      );
    }
  }

  /**
   * Delete user by ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new NotFoundError("User", id);
      }

      await prisma.user.delete({ where: { id } });
      return true;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new RepositoryError(
        `Failed to delete user ${id}`,
        "DELETE_ERROR",
        error as Error
      );
    }
  }

  /**
   * Count users with optional filters
   */
  async count(options?: CountOptions<User>): Promise<number> {
    try {
      return await prisma.user.count({
        where: options?.where as Prisma.UserWhereInput,
      });
    } catch (error) {
      throw new RepositoryError(
        "Failed to count users",
        "COUNT_ERROR",
        error as Error
      );
    }
  }

  /**
   * Update user last login timestamp
   */
  async updateLastLogin(id: string): Promise<User | null> {
    try {
      return await prisma.user.update({
        where: { id },
        data: { 
          lastLoginAt: new Date(),
          failedLoginAttempts: 0, // Reset failed attempts on successful login
          lockedAt: null // Unlock account if it was locked
        },
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to update last login for user ${id}`,
        "UPDATE_LOGIN_ERROR",
        error as Error
      );
    }
  }

  /**
   * Find users with recent security events
   */
  async findUsersWithRecentSecurityEvents(
    hoursBack = 24,
    minEvents = 5
  ): Promise<Array<{ user: User; eventCount: number }>> {
    try {
      const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      const usersWithEvents = await prisma.user.findMany({
        where: {
          auditLogs: {
            some: {
              timestamp: { gte: startTime },
            },
          },
        },
        include: {
          auditLogs: {
            where: {
              timestamp: { gte: startTime },
            },
            select: { id: true },
          },
        },
      });

      return usersWithEvents
        .map((user) => ({
          user: {
            ...user,
            auditLogs: undefined, // Remove from result
          } as User,
          eventCount: user.auditLogs?.length || 0,
        }))
        .filter((item) => item.eventCount >= minEvents)
        .sort((a, b) => b.eventCount - a.eventCount);
    } catch (error) {
      throw new RepositoryError(
        "Failed to find users with recent security events",
        "SECURITY_EVENTS_ERROR",
        error as Error
      );
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(
    userId: string,
    hoursBack = 24
  ): Promise<{
    totalEvents: number;
    failedLogins: number;
    successfulLogins: number;
    rateLimitViolations: number;
    lastActivity: Date | null;
    countriesAccessed: string[];
  }> {
    try {
      const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      const events = await prisma.securityAuditLog.findMany({
        where: {
          userId,
          timestamp: { gte: startTime },
        },
        orderBy: { timestamp: "desc" },
      });

      const totalEvents = events.length;
      const failedLogins = events.filter(
        (e) => e.eventType === "AUTHENTICATION" && e.outcome === "FAILURE"
      ).length;
      const successfulLogins = events.filter(
        (e) => e.eventType === "AUTHENTICATION" && e.outcome === "SUCCESS"
      ).length;
      const rateLimitViolations = events.filter(
        (e) => e.outcome === "RATE_LIMITED"
      ).length;
      const lastActivity = events.length > 0 ? events[0].timestamp : null;
      const countriesAccessed = Array.from(
        new Set(events.map((e) => e.country).filter((c): c is string => c !== null))
      );

      return {
        totalEvents,
        failedLogins,
        successfulLogins,
        rateLimitViolations,
        lastActivity,
        countriesAccessed,
      };
    } catch (error) {
      throw new RepositoryError(
        `Failed to get activity summary for user ${userId}`,
        "ACTIVITY_SUMMARY_ERROR",
        error as Error
      );
    }
  }

  /**
   * Find inactive users (no login for specified days)
   */
  async findInactiveUsers(daysInactive = 30): Promise<User[]> {
    try {
      const cutoffDate = new Date(
        Date.now() - daysInactive * 24 * 60 * 60 * 1000
      );

      return await prisma.user.findMany({
        where: {
          OR: [
            { lastLoginAt: { lt: cutoffDate } }, // Users who haven't logged in recently
            { lastLoginAt: null, createdAt: { lt: cutoffDate } }, // Users who never logged in and were created long ago
          ],
          isActive: true, // Only consider active users
        },
        orderBy: { lastLoginAt: "asc" },
      });
    } catch (error) {
      throw new RepositoryError(
        "Failed to find inactive users",
        "FIND_INACTIVE_ERROR",
        error as Error
      );
    }
  }

  /**
   * Search users by name or email
   */
  async searchUsers(query: string, companyId?: string): Promise<User[]> {
    try {
      return await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
          ...(companyId && { companyId }),
        },
        orderBy: { name: "asc" },
        take: 50, // Limit results
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to search users with query "${query}"`,
        "SEARCH_ERROR",
        error as Error
      );
    }
  }

  /**
   * Increment failed login attempts and lock account if threshold exceeded
   */
  async incrementFailedLoginAttempts(email: string, maxAttempts = 5): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) return null;

      const newFailedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = newFailedAttempts >= maxAttempts;

      return await prisma.user.update({
        where: { email },
        data: {
          failedLoginAttempts: newFailedAttempts,
          ...(shouldLock && { lockedAt: new Date() }),
        },
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to increment failed login attempts for ${email}`,
        "INCREMENT_FAILED_LOGIN_ERROR",
        error as Error
      );
    }
  }

  /**
   * Mark user email as verified
   */
  async verifyEmail(id: string): Promise<User | null> {
    try {
      return await prisma.user.update({
        where: { id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpiry: null,
        },
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to verify email for user ${id}`,
        "VERIFY_EMAIL_ERROR",
        error as Error
      );
    }
  }

  /**
   * Set email verification token
   */
  async setEmailVerificationToken(id: string, token: string, expiryHours = 24): Promise<User | null> {
    try {
      const expiry = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
      return await prisma.user.update({
        where: { id },
        data: {
          emailVerificationToken: token,
          emailVerificationExpiry: expiry,
        },
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to set email verification token for user ${id}`,
        "SET_VERIFICATION_TOKEN_ERROR",
        error as Error
      );
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(id: string): Promise<User | null> {
    try {
      return await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to deactivate user ${id}`,
        "DEACTIVATE_USER_ERROR",
        error as Error
      );
    }
  }

  /**
   * Unlock user account
   */
  async unlockUser(id: string): Promise<User | null> {
    try {
      return await prisma.user.update({
        where: { id },
        data: {
          lockedAt: null,
          failedLoginAttempts: 0,
        },
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to unlock user ${id}`,
        "UNLOCK_USER_ERROR",
        error as Error
      );
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(id: string, preferences: Record<string, unknown>): Promise<User | null> {
    try {
      return await prisma.user.update({
        where: { id },
        data: { preferences: preferences as any },
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to update preferences for user ${id}`,
        "UPDATE_PREFERENCES_ERROR",
        error as Error
      );
    }
  }
}
