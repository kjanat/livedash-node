/**
 * Base API Handler with Middleware Pattern
 *
 * Provides a composable, middleware-based approach to API endpoint creation
 * with built-in authentication, authorization, validation, rate limiting,
 * and consistent error handling.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimiter } from "@/lib/rateLimiter";
import type { UserSession } from "@/lib/types";
import {
  APIError,
  AuthenticationError,
  AuthorizationError,
  handleAPIError,
  RateLimitError,
  ValidationError,
} from "./errors";
import { createSuccessResponse, extractPaginationParams } from "./response";

/**
 * API Context passed to handlers
 */
export interface APIContext {
  request: NextRequest;
  session: UserSession | null;
  user: {
    id: string;
    email: string;
    role: string;
    companyId: string;
  } | null;
  ip: string;
  userAgent?: string;
  requestId: string;
  pagination?: {
    page: number;
    limit: number;
  };
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (context: APIContext) => string;
}

/**
 * User roles for authorization
 */
export enum UserRole {
  USER = "USER",
  AUDITOR = "AUDITOR",
  ADMIN = "ADMIN",
  PLATFORM_ADMIN = "PLATFORM_ADMIN",
}

/**
 * API handler configuration options
 */
export interface APIHandlerOptions {
  // Authentication & Authorization
  requireAuth?: boolean;
  requiredRole?: UserRole | UserRole[];
  requirePlatformAccess?: boolean;

  // Input validation
  validateInput?: z.ZodSchema;
  validateQuery?: z.ZodSchema;

  // Rate limiting
  rateLimit?: RateLimitConfig;

  // Features
  enablePagination?: boolean;
  auditLog?: boolean;

  // Response configuration
  allowCORS?: boolean;
  cacheControl?: string;
}

/**
 * API handler function type
 */
export type APIHandler<T = unknown> = (
  context: APIContext,
  validatedData?: unknown,
  validatedQuery?: unknown
) => Promise<T>;

/**
 * Create API context from request
 */
async function createAPIContext(request: NextRequest): Promise<APIContext> {
  const session = (await getServerSession(authOptions)) as UserSession | null;
  const ip = getClientIP(request);
  const userAgent = request.headers.get("user-agent") || undefined;
  const requestId = crypto.randomUUID();

  let user: {
    id: string;
    email: string;
    role: string;
    companyId: string;
  } | null = null;

  if (session?.user) {
    user = {
      id: session.user.id || "",
      email: session.user.email || "",
      role: session.user.role || "USER",
      companyId: session.user.companyId || "",
    };
  }

  const searchParams = new URL(request.url).searchParams;
  const pagination = extractPaginationParams(searchParams);

  return {
    request,
    session,
    user,
    ip,
    userAgent,
    requestId,
    pagination,
  };
}

/**
 * Extract client IP address
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfConnectingIP = request.headers.get("cf-connecting-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return realIP || cfConnectingIP || "unknown";
}

/**
 * Validate authentication
 */
async function validateAuthentication(context: APIContext): Promise<void> {
  if (!context.session || !context.user) {
    throw new AuthenticationError("Authentication required");
  }
}

/**
 * Validate authorization
 */
async function validateAuthorization(
  context: APIContext,
  options: APIHandlerOptions
): Promise<void> {
  if (!context.user) {
    throw new AuthenticationError("Authentication required");
  }

  // Check required role
  if (options.requiredRole) {
    const requiredRoles = Array.isArray(options.requiredRole)
      ? options.requiredRole
      : [options.requiredRole];

    if (!requiredRoles.includes(context.user.role as UserRole)) {
      throw new AuthorizationError(
        `Required role: ${requiredRoles.join(" or ")}`
      );
    }
  }

  // Check platform access
  if (options.requirePlatformAccess) {
    const platformRoles = [UserRole.ADMIN, UserRole.PLATFORM_ADMIN];
    if (!platformRoles.includes(context.user.role as UserRole)) {
      throw new AuthorizationError("Platform access required");
    }
  }
}

/**
 * Apply rate limiting
 */
async function applyRateLimit(
  context: APIContext,
  config: RateLimitConfig
): Promise<void> {
  const key = config.keyGenerator
    ? config.keyGenerator(context)
    : `api:${context.ip}`;

  const result = rateLimiter.checkRateLimit(key);
  const isAllowed = result.allowed;

  if (!isAllowed) {
    throw new RateLimitError(config.maxRequests, config.windowMs);
  }
}

/**
 * Validate request input
 */
async function validateInput<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ValidationError(["Invalid JSON in request body"]);
    }
    throw new ValidationError(error as z.ZodError);
  }
}

/**
 * Validate query parameters
 */
function validateQuery<T>(request: NextRequest, schema: z.ZodSchema<T>): T {
  try {
    const searchParams = new URL(request.url).searchParams;
    const query = Object.fromEntries(searchParams.entries());
    return schema.parse(query);
  } catch (error) {
    throw new ValidationError(error as z.ZodError);
  }
}

/**
 * Log API access for audit purposes
 */
async function logAPIAccess(
  context: APIContext,
  outcome: "success" | "error",
  endpoint: string,
  error?: Error
): Promise<void> {
  try {
    // Only log if audit logging is enabled for this endpoint
    // TODO: Integrate with security audit logger service
    // Production logging should use proper logging service instead of console.log
  } catch (logError) {
    // Don't fail the request if logging fails
    // TODO: Send to error tracking service
  }
}

/**
 * Add CORS headers if enabled
 */
function addCORSHeaders(
  response: NextResponse,
  options: APIHandlerOptions
): void {
  if (options.allowCORS) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
  }
}

/**
 * Main API handler factory
 */
export function createAPIHandler<T = unknown>(
  handler: APIHandler<T>,
  options: APIHandlerOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    let context: APIContext | undefined;

    try {
      // 1. Create request context
      context = await createAPIContext(request);

      // 2. Apply rate limiting
      if (options.rateLimit) {
        await applyRateLimit(context, options.rateLimit);
      }

      // 3. Validate authentication
      if (options.requireAuth) {
        await validateAuthentication(context);
      }

      // 4. Validate authorization
      if (options.requiredRole || options.requirePlatformAccess) {
        await validateAuthorization(context, options);
      }

      // 5. Validate input
      let validatedData;
      if (options.validateInput && request.method !== "GET") {
        validatedData = await validateInput(request, options.validateInput);
      }

      // 6. Validate query parameters
      let validatedQuery;
      if (options.validateQuery) {
        validatedQuery = validateQuery(request, options.validateQuery);
      }

      // 7. Execute handler
      const result = await handler(context, validatedData, validatedQuery);

      // 8. Audit logging
      if (options.auditLog) {
        await logAPIAccess(context, "success", request.url);
      }

      // 9. Create response
      const response = NextResponse.json(
        createSuccessResponse(result, { requestId: context.requestId })
      );

      // 10. Add headers
      response.headers.set("X-Request-ID", context.requestId);

      if (options.cacheControl) {
        response.headers.set("Cache-Control", options.cacheControl);
      }

      addCORSHeaders(response, options);

      return response;
    } catch (error) {
      // Handle errors consistently
      const requestId = context?.requestId || crypto.randomUUID();

      // Log failed requests
      if (options.auditLog && context) {
        await logAPIAccess(context, "error", request.url, error as Error);
      }

      return handleAPIError(error, requestId, {
        endpoint: request.url,
        method: request.method,
        ip: context?.ip,
        userId: context?.user?.id,
      });
    }
  };
}

/**
 * Utility function for GET endpoints
 */
export function createGETHandler<T = unknown>(
  handler: APIHandler<T>,
  options: Omit<APIHandlerOptions, "validateInput"> = {}
) {
  return createAPIHandler(handler, {
    ...options,
    cacheControl: options.cacheControl || "private, max-age=300", // 5 minutes default
  });
}

/**
 * Utility function for POST endpoints
 */
export function createPOSTHandler<T = unknown>(
  handler: APIHandler<T>,
  options: APIHandlerOptions = {}
) {
  return createAPIHandler(handler, {
    ...options,
    auditLog: options.auditLog ?? true, // Enable audit logging by default for POST
  });
}

/**
 * Utility function for authenticated endpoints
 */
export function createAuthenticatedHandler<T = unknown>(
  handler: APIHandler<T>,
  options: APIHandlerOptions = {}
) {
  return createAPIHandler(handler, {
    ...options,
    requireAuth: true,
    auditLog: true,
  });
}

/**
 * Utility function for admin endpoints
 */
export function createAdminHandler<T = unknown>(
  handler: APIHandler<T>,
  options: APIHandlerOptions = {}
) {
  return createAPIHandler(handler, {
    ...options,
    requireAuth: true,
    requiredRole: [UserRole.ADMIN, UserRole.PLATFORM_ADMIN],
    auditLog: true,
    rateLimit: options.rateLimit || {
      maxRequests: 100,
      windowMs: 15 * 60 * 1000, // 15 minutes
    },
  });
}
