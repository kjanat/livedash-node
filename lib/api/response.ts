/**
 * Standardized API Response System
 *
 * Provides consistent response formatting across all API endpoints
 * with proper typing, error handling, and metadata support.
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface APIResponseMeta {
  timestamp: string;
  requestId: string;
  pagination?: PaginationMeta;
  version?: string;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: string[];
  meta: APIResponseMeta;
}

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: Partial<APIResponseMeta>
): APIResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      version: "1.0",
      ...meta,
    },
  };
}

/**
 * Create an error API response
 */
export function createErrorResponse(
  error: string,
  errors?: string[],
  meta?: Partial<APIResponseMeta>
): APIResponse {
  return {
    success: false,
    error,
    errors,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      version: "1.0",
      ...meta,
    },
  };
}

/**
 * Create a paginated success response
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  meta?: Partial<APIResponseMeta>
): APIResponse<T[]> {
  return createSuccessResponse(data, {
    ...meta,
    pagination,
  });
}

/**
 * Extract pagination parameters from request
 */
export function extractPaginationParams(searchParams: URLSearchParams): {
  page: number;
  limit: number;
} {
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") || "1", 10)
  );
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10))
  );

  return { page, limit };
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
