/**
 * API Infrastructure Export Module
 *
 * Centralized exports for the standardized API layer architecture.
 * This module provides a clean interface for importing API utilities
 * throughout the application.
 */

// Authorization system
export {
  type CompanyAccessResult,
  canManageUser,
  createPermissionChecker,
  getUserPermissions,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isRoleHigherThan,
  Permission,
  ResourceType,
  requireAllPermissions,
  requireAnyPermission,
  requireCompanyAccess,
  requireCompanyAccessFromRequest,
  requirePermission,
  requireUserManagementPermission,
  validateCompanyAccess,
  withPermissions,
} from "./authorization";

// Error handling
export {
  APIError,
  AuthenticationError,
  AuthorizationError,
  asyncErrorHandler,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  handleAPIError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  withErrorHandling,
} from "./errors";

// API handlers and middleware
export {
  type APIContext,
  type APIHandler,
  type APIHandlerOptions,
  createAdminHandler,
  createAPIHandler,
  createAuthenticatedHandler,
  createGETHandler,
  createPOSTHandler,
  type RateLimitConfig,
  UserRole,
} from "./handler";

import { createPermissionChecker, type Permission } from "./authorization";
// Re-import types for use in functions below
import type { APIContext, APIHandler, APIHandlerOptions } from "./handler";
import { createAPIHandler } from "./handler";

// Response utilities
export {
  type APIResponse,
  type APIResponseMeta,
  calculatePaginationMeta,
  createErrorResponse,
  createPaginatedResponse,
  createSuccessResponse,
  extractPaginationParams,
  type PaginationMeta,
} from "./response";

/**
 * Utility function to create a fully configured API endpoint
 * with authentication, authorization, and validation
 */
export function createSecureAPIEndpoint<T = unknown>(
  handler: APIHandler<T>,
  requiredPermission: Permission,
  options: Omit<APIHandlerOptions, "requireAuth" | "requiredRole"> = {}
) {
  return createAPIHandler(
    async (context, validatedData, validatedQuery) => {
      // Check permission
      const permissions = createPermissionChecker(context);
      permissions.require(requiredPermission);

      // Execute handler
      return handler(context, validatedData, validatedQuery);
    },
    {
      ...options,
      requireAuth: true,
      auditLog: true,
    }
  );
}

/**
 * Utility function to create a company-scoped API endpoint
 */
export function createCompanyScopedEndpoint<T = unknown>(
  handler: (
    context: APIContext,
    validatedData?: unknown,
    validatedQuery?: unknown
  ) => Promise<T>,
  requiredPermission: Permission,
  getCompanyId: (context: APIContext) => string | Promise<string>,
  options: Omit<APIHandlerOptions, "requireAuth"> = {}
) {
  return createAPIHandler(
    async (context, validatedData, validatedQuery) => {
      // Check permission
      const permissions = createPermissionChecker(context);
      permissions.require(requiredPermission);

      // Validate company access
      const companyId = await getCompanyId(context);
      permissions.requireCompanyAccess(companyId);

      // Execute handler with company context
      return handler(context, validatedData, validatedQuery);
    },
    {
      ...options,
      requireAuth: true,
      auditLog: true,
    }
  );
}
