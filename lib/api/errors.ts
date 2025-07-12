/**
 * Centralized API Error Handling System
 *
 * Provides consistent error types, status codes, and error handling
 * across all API endpoints with proper logging and security considerations.
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createErrorResponse } from "./response";

/**
 * Base API Error class
 */
export class APIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = "INTERNAL_ERROR",
    public readonly details?: any,
    public readonly logLevel: "info" | "warn" | "error" = "error"
  ) {
    super(message);
    this.name = "APIError";

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }
}

/**
 * Validation Error - for input validation failures
 */
export class ValidationError extends APIError {
  constructor(errors: string[] | ZodError) {
    const errorMessages = Array.isArray(errors)
      ? errors
      : errors.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`
        );

    super("Validation failed", 400, "VALIDATION_ERROR", errorMessages, "warn");
  }
}

/**
 * Authentication Error - for missing or invalid authentication
 */
export class AuthenticationError extends APIError {
  constructor(message = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR", undefined, "info");
  }
}

/**
 * Authorization Error - for insufficient permissions
 */
export class AuthorizationError extends APIError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR", undefined, "warn");
  }
}

/**
 * Not Found Error - for missing resources
 */
export class NotFoundError extends APIError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND", undefined, "info");
  }
}

/**
 * Rate Limit Error - for rate limiting violations
 */
export class RateLimitError extends APIError {
  constructor(limit: number, windowMs: number) {
    super(
      "Rate limit exceeded",
      429,
      "RATE_LIMIT_EXCEEDED",
      { limit, windowMs },
      "warn"
    );
  }
}

/**
 * Conflict Error - for resource conflicts
 */
export class ConflictError extends APIError {
  constructor(message = "Resource conflict") {
    super(message, 409, "CONFLICT", undefined, "warn");
  }
}

/**
 * Database Error - for database operation failures
 */
export class DatabaseError extends APIError {
  constructor(message = "Database operation failed", details?: any) {
    super(message, 500, "DATABASE_ERROR", details, "error");
  }
}

/**
 * External Service Error - for third-party service failures
 */
export class ExternalServiceError extends APIError {
  constructor(
    service: string,
    message = "External service error",
    details?: any
  ) {
    super(
      `${service} service error: ${message}`,
      502,
      "EXTERNAL_SERVICE_ERROR",
      { service, ...details },
      "error"
    );
  }
}

/**
 * Check if error should be exposed to client
 */
function shouldExposeError(error: unknown): boolean {
  if (error instanceof APIError) {
    // Only expose client errors (4xx status codes)
    return error.statusCode >= 400 && error.statusCode < 500;
  }
  return false;
}

/**
 * Log error with appropriate level
 */
function logError(error: unknown, requestId: string, context?: any): void {
  const logData = {
    requestId,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
  };

  if (error instanceof APIError) {
    switch (error.logLevel) {
      case "info":
        console.info("[API Info]", logData);
        break;
      case "warn":
        console.warn("[API Warning]", logData);
        break;
      case "error":
        console.error("[API Error]", logData);
        break;
    }
  } else {
    // Unknown errors are always logged as errors
    console.error("[API Unexpected Error]", logData);
  }
}

/**
 * Handle API errors consistently across all endpoints
 */
export function handleAPIError(
  error: unknown,
  requestId?: string,
  context?: any
): NextResponse {
  const id = requestId || crypto.randomUUID();

  // Log the error
  logError(error, id, context);

  if (error instanceof APIError) {
    const response = createErrorResponse(
      error.message,
      Array.isArray(error.details) ? error.details : undefined,
      { requestId: id }
    );

    return NextResponse.json(response, {
      status: error.statusCode,
      headers: {
        "X-Request-ID": id,
      },
    });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationError = new ValidationError(error);
    return handleAPIError(validationError, id, context);
  }

  // Handle unknown errors - don't expose details in production
  const isDevelopment = process.env.NODE_ENV === "development";
  const message =
    shouldExposeError(error) || isDevelopment
      ? error instanceof Error
        ? error.message
        : String(error)
      : "Internal server error";

  const response = createErrorResponse(message, undefined, { requestId: id });

  return NextResponse.json(response, {
    status: 500,
    headers: {
      "X-Request-ID": id,
    },
  });
}

/**
 * Async error handler for promise chains
 */
export function asyncErrorHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw error instanceof APIError
        ? error
        : new APIError(error instanceof Error ? error.message : String(error));
    }
  };
}

/**
 * Error boundary for API route handlers
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse> | NextResponse
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleAPIError(error);
    }
  };
}
