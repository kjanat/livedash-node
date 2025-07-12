import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { extractClientIP } from "./rateLimiter";

export interface AuditLogContext {
  userId?: string;
  companyId?: string;
  platformUserId?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
  country?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogEntry {
  eventType: SecurityEventType;
  action: string;
  outcome: AuditOutcome;
  severity?: AuditSeverity;
  errorMessage?: string;
  context?: AuditLogContext;
}

/* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
export enum SecurityEventType {
  AUTHENTICATION = "AUTHENTICATION",
  AUTHORIZATION = "AUTHORIZATION",
  USER_MANAGEMENT = "USER_MANAGEMENT",
  COMPANY_MANAGEMENT = "COMPANY_MANAGEMENT",
  RATE_LIMITING = "RATE_LIMITING",
  CSRF_PROTECTION = "CSRF_PROTECTION",
  SECURITY_HEADERS = "SECURITY_HEADERS",
  PASSWORD_RESET = "PASSWORD_RESET",
  PLATFORM_ADMIN = "PLATFORM_ADMIN",
  DATA_PRIVACY = "DATA_PRIVACY",
  SYSTEM_CONFIG = "SYSTEM_CONFIG",
  API_SECURITY = "API_SECURITY",
}
/* eslint-enable @typescript-eslint/no-unused-vars, no-unused-vars */

/* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
export enum AuditOutcome {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  BLOCKED = "BLOCKED",
  RATE_LIMITED = "RATE_LIMITED",
  SUSPICIOUS = "SUSPICIOUS",
}
/* eslint-enable @typescript-eslint/no-unused-vars, no-unused-vars */

/* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
export enum AuditSeverity {
  INFO = "INFO",
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}
/* eslint-enable @typescript-eslint/no-unused-vars, no-unused-vars */

class SecurityAuditLogger {
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = process.env.AUDIT_LOGGING_ENABLED !== "false";
  }

  async log(entry: AuditLogEntry): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      await prisma.securityAuditLog.create({
        data: {
          eventType: entry.eventType,
          action: entry.action,
          outcome: entry.outcome,
          severity: entry.severity || AuditSeverity.INFO,
          userId: entry.context?.userId || null,
          companyId: entry.context?.companyId || null,
          platformUserId: entry.context?.platformUserId || null,
          ipAddress: entry.context?.ipAddress || null,
          userAgent: entry.context?.userAgent || null,
          country: entry.context?.country || null,
          sessionId: entry.context?.sessionId || null,
          requestId: entry.context?.requestId || null,
          metadata: entry.context?.metadata || null,
          errorMessage: entry.errorMessage || null,
        },
      });
    } catch (error) {
      console.error("Failed to write audit log:", error);
    }
  }

  async logAuthentication(
    action: string,
    outcome: AuditOutcome,
    context: AuditLogContext,
    errorMessage?: string
  ): Promise<void> {
    const severity = this.getAuthenticationSeverity(outcome);
    await this.log({
      eventType: SecurityEventType.AUTHENTICATION,
      action,
      outcome,
      severity,
      errorMessage,
      context,
    });
  }

  async logAuthorization(
    action: string,
    outcome: AuditOutcome,
    context: AuditLogContext,
    errorMessage?: string
  ): Promise<void> {
    const severity =
      outcome === AuditOutcome.BLOCKED
        ? AuditSeverity.MEDIUM
        : AuditSeverity.INFO;
    await this.log({
      eventType: SecurityEventType.AUTHORIZATION,
      action,
      outcome,
      severity,
      errorMessage,
      context,
    });
  }

  async logUserManagement(
    action: string,
    outcome: AuditOutcome,
    context: AuditLogContext,
    errorMessage?: string
  ): Promise<void> {
    const severity = this.getUserManagementSeverity(action, outcome);
    await this.log({
      eventType: SecurityEventType.USER_MANAGEMENT,
      action,
      outcome,
      severity,
      errorMessage,
      context,
    });
  }

  async logCompanyManagement(
    action: string,
    outcome: AuditOutcome,
    context: AuditLogContext,
    errorMessage?: string
  ): Promise<void> {
    const severity = this.getCompanyManagementSeverity(action, outcome);
    await this.log({
      eventType: SecurityEventType.COMPANY_MANAGEMENT,
      action,
      outcome,
      severity,
      errorMessage,
      context,
    });
  }

  async logRateLimiting(
    action: string,
    outcome: AuditOutcome,
    context: AuditLogContext,
    errorMessage?: string
  ): Promise<void> {
    const severity =
      outcome === AuditOutcome.RATE_LIMITED
        ? AuditSeverity.MEDIUM
        : AuditSeverity.LOW;
    await this.log({
      eventType: SecurityEventType.RATE_LIMITING,
      action,
      outcome,
      severity,
      errorMessage,
      context,
    });
  }

  async logCSRFProtection(
    action: string,
    outcome: AuditOutcome,
    context: AuditLogContext,
    errorMessage?: string
  ): Promise<void> {
    const severity =
      outcome === AuditOutcome.BLOCKED
        ? AuditSeverity.HIGH
        : AuditSeverity.MEDIUM;
    await this.log({
      eventType: SecurityEventType.CSRF_PROTECTION,
      action,
      outcome,
      severity,
      errorMessage,
      context,
    });
  }

  async logSecurityHeaders(
    action: string,
    outcome: AuditOutcome,
    context: AuditLogContext,
    errorMessage?: string
  ): Promise<void> {
    const severity =
      outcome === AuditOutcome.BLOCKED
        ? AuditSeverity.MEDIUM
        : AuditSeverity.LOW;
    await this.log({
      eventType: SecurityEventType.SECURITY_HEADERS,
      action,
      outcome,
      severity,
      errorMessage,
      context,
    });
  }

  async logPasswordReset(
    action: string,
    outcome: AuditOutcome,
    context: AuditLogContext,
    errorMessage?: string
  ): Promise<void> {
    const severity = this.getPasswordResetSeverity(action, outcome);
    await this.log({
      eventType: SecurityEventType.PASSWORD_RESET,
      action,
      outcome,
      severity,
      errorMessage,
      context,
    });
  }

  async logPlatformAdmin(
    action: string,
    outcome: AuditOutcome,
    context: AuditLogContext,
    errorMessage?: string
  ): Promise<void> {
    const severity = AuditSeverity.HIGH; // All platform admin actions are high severity
    await this.log({
      eventType: SecurityEventType.PLATFORM_ADMIN,
      action,
      outcome,
      severity,
      errorMessage,
      context,
    });
  }

  async logDataPrivacy(
    action: string,
    outcome: AuditOutcome,
    context: AuditLogContext,
    errorMessage?: string
  ): Promise<void> {
    const severity = AuditSeverity.HIGH; // Data privacy events are always high severity
    await this.log({
      eventType: SecurityEventType.DATA_PRIVACY,
      action,
      outcome,
      severity,
      errorMessage,
      context,
    });
  }

  async logAPIStatus(
    action: string,
    outcome: AuditOutcome,
    context: AuditLogContext,
    errorMessage?: string
  ): Promise<void> {
    const severity = this.getAPISecuritySeverity(outcome);
    await this.log({
      eventType: SecurityEventType.API_SECURITY,
      action,
      outcome,
      severity,
      errorMessage,
      context,
    });
  }

  private getAuthenticationSeverity(outcome: AuditOutcome): AuditSeverity {
    switch (outcome) {
      case AuditOutcome.SUCCESS:
        return AuditSeverity.INFO;
      case AuditOutcome.FAILURE:
        return AuditSeverity.MEDIUM;
      case AuditOutcome.BLOCKED:
      case AuditOutcome.RATE_LIMITED:
        return AuditSeverity.HIGH;
      case AuditOutcome.SUSPICIOUS:
        return AuditSeverity.MEDIUM;
      default:
        return AuditSeverity.INFO;
    }
  }

  private getUserManagementSeverity(
    action: string,
    outcome: AuditOutcome
  ): AuditSeverity {
    const privilegedActions = ["delete", "suspend", "elevate", "grant"];
    const isPrivilegedAction = privilegedActions.some((pa) =>
      action.toLowerCase().includes(pa)
    );

    if (isPrivilegedAction) {
      return outcome === AuditOutcome.SUCCESS
        ? AuditSeverity.HIGH
        : AuditSeverity.MEDIUM;
    }

    return outcome === AuditOutcome.SUCCESS
      ? AuditSeverity.MEDIUM
      : AuditSeverity.LOW;
  }

  private getCompanyManagementSeverity(
    action: string,
    outcome: AuditOutcome
  ): AuditSeverity {
    const criticalActions = ["suspend", "delete", "archive"];
    const isCriticalAction = criticalActions.some((ca) =>
      action.toLowerCase().includes(ca)
    );

    if (isCriticalAction) {
      return outcome === AuditOutcome.SUCCESS
        ? AuditSeverity.CRITICAL
        : AuditSeverity.HIGH;
    }

    return outcome === AuditOutcome.SUCCESS
      ? AuditSeverity.HIGH
      : AuditSeverity.MEDIUM;
  }

  private getPasswordResetSeverity(
    action: string,
    outcome: AuditOutcome
  ): AuditSeverity {
    if (action.toLowerCase().includes("complete")) {
      return outcome === AuditOutcome.SUCCESS
        ? AuditSeverity.MEDIUM
        : AuditSeverity.LOW;
    }

    return AuditSeverity.INFO;
  }

  private getAPISecuritySeverity(outcome: AuditOutcome): AuditSeverity {
    switch (outcome) {
      case AuditOutcome.BLOCKED:
        return AuditSeverity.HIGH;
      case AuditOutcome.SUSPICIOUS:
        return AuditSeverity.MEDIUM;
      case AuditOutcome.RATE_LIMITED:
        return AuditSeverity.MEDIUM;
      default:
        return AuditSeverity.LOW;
    }
  }

  static extractContextFromRequest(
    request: NextRequest
  ): Partial<AuditLogContext> {
    return {
      ipAddress: extractClientIP(request),
      userAgent: request.headers.get("user-agent") || undefined,
      requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
    };
  }

  static createSessionContext(sessionId?: string): Partial<AuditLogContext> {
    return {
      sessionId,
      requestId: crypto.randomUUID(),
    };
  }
}

export const securityAuditLogger = new SecurityAuditLogger();

export async function createAuditContext(
  request?: NextRequest,
  session?: { user?: { id?: string; email?: string } },
  additionalContext?: Partial<AuditLogContext>
): Promise<AuditLogContext> {
  const context: AuditLogContext = {
    requestId: crypto.randomUUID(),
    ...additionalContext,
  };

  if (request) {
    const requestContext =
      SecurityAuditLogger.extractContextFromRequest(request);
    Object.assign(context, requestContext);
  }

  if (session?.user) {
    context.userId = session.user.id;
    context.companyId = session.user.companyId;
    if (session.user.isPlatformUser) {
      context.platformUserId = session.user.id;
    }
  }

  return context;
}

export function createAuditMetadata(
  data: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === "object" ? "[Object]" : item
      );
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = "[Object]";
    }
  }

  return sanitized;
}
