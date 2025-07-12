/**
 * Centralized Authorization System
 *
 * Provides role-based access control with granular permissions,
 * company-level access control, and audit trail integration.
 */

import { AuthorizationError } from "./errors";
import type { APIContext } from "./handler";

/**
 * System permissions enumeration
 */
export enum Permission {
  // Audit & Security
  READ_AUDIT_LOGS = "audit_logs:read",
  EXPORT_AUDIT_LOGS = "audit_logs:export",
  MANAGE_SECURITY = "security:manage",

  // User Management
  READ_USERS = "users:read",
  MANAGE_USERS = "users:manage",
  INVITE_USERS = "users:invite",

  // Company Management
  READ_COMPANIES = "companies:read",
  MANAGE_COMPANIES = "companies:manage",
  MANAGE_COMPANY_SETTINGS = "companies:settings",

  // Dashboard & Analytics
  READ_DASHBOARD = "dashboard:read",
  READ_SESSIONS = "sessions:read",
  MANAGE_SESSIONS = "sessions:manage",

  // System Administration
  PLATFORM_ADMIN = "platform:admin",
  CACHE_MANAGE = "cache:manage",
  SCHEDULER_MANAGE = "schedulers:manage",

  // AI & Processing
  MANAGE_AI_PROCESSING = "ai:manage",
  READ_AI_METRICS = "ai:read",

  // Import & Export
  IMPORT_DATA = "data:import",
  EXPORT_DATA = "data:export",
}

/**
 * User roles with their associated permissions
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  USER: [Permission.READ_DASHBOARD, Permission.READ_SESSIONS],

  AUDITOR: [
    Permission.READ_DASHBOARD,
    Permission.READ_SESSIONS,
    Permission.READ_AUDIT_LOGS,
    Permission.EXPORT_AUDIT_LOGS,
    Permission.READ_AI_METRICS,
  ],

  ADMIN: [
    // Inherit USER permissions
    Permission.READ_DASHBOARD,
    Permission.READ_SESSIONS,
    Permission.MANAGE_SESSIONS,

    // Inherit AUDITOR permissions
    Permission.READ_AUDIT_LOGS,
    Permission.EXPORT_AUDIT_LOGS,
    Permission.READ_AI_METRICS,

    // Admin-specific permissions
    Permission.READ_USERS,
    Permission.MANAGE_USERS,
    Permission.INVITE_USERS,
    Permission.MANAGE_COMPANY_SETTINGS,
    Permission.MANAGE_SECURITY,
    Permission.MANAGE_AI_PROCESSING,
    Permission.IMPORT_DATA,
    Permission.EXPORT_DATA,
    Permission.CACHE_MANAGE,
  ],

  PLATFORM_ADMIN: [
    // Include all ADMIN permissions
    Permission.READ_DASHBOARD,
    Permission.READ_SESSIONS,
    Permission.MANAGE_SESSIONS,
    Permission.READ_AUDIT_LOGS,
    Permission.EXPORT_AUDIT_LOGS,
    Permission.READ_AI_METRICS,
    Permission.READ_USERS,
    Permission.MANAGE_USERS,
    Permission.INVITE_USERS,
    Permission.MANAGE_COMPANY_SETTINGS,
    Permission.MANAGE_SECURITY,
    Permission.MANAGE_AI_PROCESSING,
    Permission.IMPORT_DATA,
    Permission.EXPORT_DATA,
    Permission.CACHE_MANAGE,

    // Platform-specific permissions
    Permission.PLATFORM_ADMIN,
    Permission.READ_COMPANIES,
    Permission.MANAGE_COMPANIES,
    Permission.SCHEDULER_MANAGE,
  ],
};

/**
 * Resource types for company-level access control
 */
export enum ResourceType {
  AUDIT_LOG = "audit_log",
  SESSION = "session",
  USER = "user",
  COMPANY = "company",
  AI_REQUEST = "ai_request",
}

/**
 * Company access validation result
 */
export interface CompanyAccessResult {
  allowed: boolean;
  reason?: string;
  companyId?: string;
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  userRole: string,
  permission: Permission
): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  return rolePermissions?.includes(permission) ?? false;
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(
  userRole: string,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(userRole, permission));
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(
  userRole: string,
  permissions: Permission[]
): boolean {
  return permissions.every((permission) => hasPermission(userRole, permission));
}

/**
 * Get all permissions for a user role
 */
export function getUserPermissions(userRole: string): Permission[] {
  return ROLE_PERMISSIONS[userRole] || [];
}

/**
 * Validate permission access and throw if unauthorized
 */
export function requirePermission(permission: Permission) {
  return (context: APIContext) => {
    if (!context.user) {
      throw new AuthorizationError("Authentication required");
    }

    if (!hasPermission(context.user.role, permission)) {
      throw new AuthorizationError(`Permission required: ${permission}`);
    }
  };
}

/**
 * Validate any of the specified permissions
 */
export function requireAnyPermission(permissions: Permission[]) {
  return (context: APIContext) => {
    if (!context.user) {
      throw new AuthorizationError("Authentication required");
    }

    if (!hasAnyPermission(context.user.role, permissions)) {
      throw new AuthorizationError(
        `One of these permissions required: ${permissions.join(", ")}`
      );
    }
  };
}

/**
 * Validate all of the specified permissions
 */
export function requireAllPermissions(permissions: Permission[]) {
  return (context: APIContext) => {
    if (!context.user) {
      throw new AuthorizationError("Authentication required");
    }

    if (!hasAllPermissions(context.user.role, permissions)) {
      throw new AuthorizationError(
        `All of these permissions required: ${permissions.join(", ")}`
      );
    }
  };
}

/**
 * Check if user can access resources from a specific company
 */
export function validateCompanyAccess(
  context: APIContext,
  targetCompanyId: string,
  resourceType?: ResourceType
): CompanyAccessResult {
  if (!context.user) {
    return {
      allowed: false,
      reason: "Authentication required",
    };
  }

  // Platform admins can access all companies
  if (context.user.role === "PLATFORM_ADMIN") {
    return {
      allowed: true,
      companyId: targetCompanyId,
    };
  }

  // Regular users can only access their own company's resources
  if (context.user.companyId !== targetCompanyId) {
    return {
      allowed: false,
      reason: `Access denied to company ${targetCompanyId}`,
      companyId: context.user.companyId,
    };
  }

  return {
    allowed: true,
    companyId: targetCompanyId,
  };
}

/**
 * Require company access validation
 */
export function requireCompanyAccess(
  targetCompanyId: string,
  resourceType?: ResourceType
) {
  return (context: APIContext) => {
    const accessResult = validateCompanyAccess(
      context,
      targetCompanyId,
      resourceType
    );

    if (!accessResult.allowed) {
      throw new AuthorizationError(accessResult.reason);
    }
  };
}

/**
 * Extract company ID from request and validate access
 */
export function requireCompanyAccessFromRequest(
  getCompanyId: (context: APIContext) => string | Promise<string>,
  resourceType?: ResourceType
) {
  return async (context: APIContext) => {
    const companyId = await getCompanyId(context);
    const accessResult = validateCompanyAccess(
      context,
      companyId,
      resourceType
    );

    if (!accessResult.allowed) {
      throw new AuthorizationError(accessResult.reason);
    }

    return companyId;
  };
}

/**
 * Role hierarchy helper - check if role A is higher than role B
 */
export function isRoleHigherThan(roleA: string, roleB: string): boolean {
  const roleHierarchy = {
    USER: 1,
    AUDITOR: 2,
    ADMIN: 3,
    PLATFORM_ADMIN: 4,
  };

  const levelA = roleHierarchy[roleA as keyof typeof roleHierarchy] || 0;
  const levelB = roleHierarchy[roleB as keyof typeof roleHierarchy] || 0;

  return levelA > levelB;
}

/**
 * Check if user can manage another user (role hierarchy)
 */
export function canManageUser(
  managerRole: string,
  targetUserRole: string
): boolean {
  // Platform admins can manage anyone
  if (managerRole === "PLATFORM_ADMIN") {
    return true;
  }

  // Admins can manage users and auditors, but not other admins or platform admins
  if (managerRole === "ADMIN") {
    return ["USER", "AUDITOR"].includes(targetUserRole);
  }

  // Other roles cannot manage users
  return false;
}

/**
 * Require user management permission
 */
export function requireUserManagementPermission(targetUserRole: string) {
  return (context: APIContext) => {
    if (!context.user) {
      throw new AuthorizationError("Authentication required");
    }

    if (!canManageUser(context.user.role, targetUserRole)) {
      throw new AuthorizationError(
        `Insufficient permissions to manage ${targetUserRole} users`
      );
    }
  };
}

/**
 * Create a permission checker function
 */
export function createPermissionChecker(context: APIContext) {
  return {
    has: (permission: Permission) =>
      hasPermission(context.user?.role || "", permission),
    hasAny: (permissions: Permission[]) =>
      hasAnyPermission(context.user?.role || "", permissions),
    hasAll: (permissions: Permission[]) =>
      hasAllPermissions(context.user?.role || "", permissions),
    require: (permission: Permission) => requirePermission(permission)(context),
    requireAny: (permissions: Permission[]) =>
      requireAnyPermission(permissions)(context),
    requireAll: (permissions: Permission[]) =>
      requireAllPermissions(permissions)(context),
    canAccessCompany: (companyId: string, resourceType?: ResourceType) =>
      validateCompanyAccess(context, companyId, resourceType),
    requireCompanyAccess: (companyId: string, resourceType?: ResourceType) =>
      requireCompanyAccess(companyId, resourceType)(context),
    canManageUser: (targetUserRole: string) =>
      canManageUser(context.user?.role || "", targetUserRole),
  };
}

/**
 * Middleware function to attach permission checker to context
 */
export function withPermissions<T extends APIContext>(
  context: T
): T & { permissions: ReturnType<typeof createPermissionChecker> } {
  return {
    ...context,
    permissions: createPermissionChecker(context),
  };
}
