/**
 * Custom error classes for better error handling and monitoring
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: string;

  constructor(
    message: string,
    statusCode = 500,
    isOperational = true,
    errorCode?: string
  ) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    this.name = this.constructor.name;
  }
}

/**
 * Validation error - 400 Bad Request
 */
export class ValidationError extends AppError {
  public readonly field?: string;
  public readonly validationErrors?: Record<string, string[]>;

  constructor(
    message: string,
    field?: string,
    validationErrors?: Record<string, string[]>
  ) {
    super(message, 400, true, "VALIDATION_ERROR");
    this.field = field;
    this.validationErrors = validationErrors;
  }
}

/**
 * Authentication error - 401 Unauthorized
 */
export class AuthError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, 401, true, "AUTH_ERROR");
  }
}

/**
 * Authorization error - 403 Forbidden
 */
export class AuthorizationError extends AppError {
  public readonly requiredRole?: string;
  public readonly userRole?: string;

  constructor(
    message = "Insufficient permissions",
    requiredRole?: string,
    userRole?: string
  ) {
    super(message, 403, true, "AUTHORIZATION_ERROR");
    this.requiredRole = requiredRole;
    this.userRole = userRole;
  }
}

/**
 * Resource not found error - 404 Not Found
 */
export class NotFoundError extends AppError {
  public readonly resource?: string;
  public readonly resourceId?: string;

  constructor(
    message = "Resource not found",
    resource?: string,
    resourceId?: string
  ) {
    super(message, 404, true, "NOT_FOUND_ERROR");
    this.resource = resource;
    this.resourceId = resourceId;
  }
}

/**
 * Conflict error - 409 Conflict
 */
export class ConflictError extends AppError {
  public readonly conflictField?: string;

  constructor(message: string, conflictField?: string) {
    super(message, 409, true, "CONFLICT_ERROR");
    this.conflictField = conflictField;
  }
}

/**
 * Rate limit error - 429 Too Many Requests
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message = "Rate limit exceeded", retryAfter?: number) {
    super(message, 429, true, "RATE_LIMIT_ERROR");
    this.retryAfter = retryAfter;
  }
}

/**
 * Database error - 500 Internal Server Error
 */
export class DatabaseError extends AppError {
  public readonly query?: string;
  public readonly table?: string;

  constructor(message: string, query?: string, table?: string) {
    super(message, 500, true, "DATABASE_ERROR");
    this.query = query;
    this.table = table;
  }
}

/**
 * External service error - 502 Bad Gateway
 */
export class ExternalServiceError extends AppError {
  public readonly service?: string;
  public readonly endpoint?: string;

  constructor(message: string, service?: string, endpoint?: string) {
    super(message, 502, true, "EXTERNAL_SERVICE_ERROR");
    this.service = service;
    this.endpoint = endpoint;
  }
}

/**
 * Processing error - 500 Internal Server Error
 */
export class ProcessingError extends AppError {
  public readonly stage?: string;
  public readonly sessionId?: string;

  constructor(message: string, stage?: string, sessionId?: string) {
    super(message, 500, true, "PROCESSING_ERROR");
    this.stage = stage;
    this.sessionId = sessionId;
  }
}

/**
 * Configuration error - 500 Internal Server Error
 */
export class ConfigurationError extends AppError {
  public readonly configKey?: string;

  constructor(message: string, configKey?: string) {
    super(message, 500, false, "CONFIGURATION_ERROR"); // Not operational - indicates system issue
    this.configKey = configKey;
  }
}

/**
 * AI service error - 502 Bad Gateway
 */
export class AIServiceError extends AppError {
  public readonly model?: string;
  public readonly tokenUsage?: number;

  constructor(message: string, model?: string, tokenUsage?: number) {
    super(message, 502, true, "AI_SERVICE_ERROR");
    this.model = model;
    this.tokenUsage = tokenUsage;
  }
}

/**
 * Utility function to check if error is operational
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Utility function to create error response object
 */
export function createErrorResponse(error: AppError) {
  return {
    error: {
      message: error.message,
      code: error.errorCode,
      statusCode: error.statusCode,
      ...(process.env.NODE_ENV === "development" && {
        stack: error.stack,
        ...(error instanceof ValidationError &&
          error.field && { field: error.field }),
        ...(error instanceof ValidationError &&
          error.validationErrors && {
            validationErrors: error.validationErrors,
          }),
        ...(error instanceof NotFoundError &&
          error.resource && { resource: error.resource }),
        ...(error instanceof NotFoundError &&
          error.resourceId && {
            resourceId: error.resourceId,
          }),
      }),
    },
  };
}

/**
 * Utility function to log errors with context
 */
export function logError(error: Error, context?: Record<string, unknown>) {
  const errorInfo = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...(error instanceof AppError && {
      statusCode: error.statusCode,
      errorCode: error.errorCode,
      isOperational: error.isOperational,
    }),
    ...context,
  };

  if (error instanceof AppError && error.isOperational) {
    console.warn("[Operational Error]", errorInfo);
  } else {
    console.error("[System Error]", errorInfo);
  }
}
