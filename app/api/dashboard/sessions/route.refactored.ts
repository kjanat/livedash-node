/**
 * Refactored Sessions API Endpoint
 *
 * This demonstrates how to use the new standardized API architecture
 * for consistent error handling, validation, authentication, and response formatting.
 *
 * BEFORE: Manual auth, inconsistent errors, no validation, mixed response format
 * AFTER: Standardized middleware, typed validation, consistent responses, audit logging
 */

import type { Prisma } from "@prisma/client";
import { SessionCategory } from "@prisma/client";
import { z } from "zod";
import {
  calculatePaginationMeta,
  createAuthenticatedHandler,
  createPaginatedResponse,
  DatabaseError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { ChatSession } from "@/lib/types";

/**
 * Input validation schema for session queries
 */
const SessionQuerySchema = z.object({
  // Search parameters
  searchTerm: z.string().max(100).optional(),
  category: z.nativeEnum(SessionCategory).optional(),
  language: z.string().min(2).max(5).optional(),

  // Date filtering
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),

  // Sorting
  sortKey: z
    .enum([
      "startTime",
      "category",
      "language",
      "sentiment",
      "messagesSent",
      "avgResponseTime",
    ])
    .default("startTime"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),

  // Pagination (handled by middleware but included for completeness)
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

type SessionQueryInput = z.infer<typeof SessionQuerySchema>;

/**
 * Build where clause for session filtering
 */
function buildWhereClause(
  companyId: string,
  filters: SessionQueryInput
): Prisma.SessionWhereInput {
  const whereClause: Prisma.SessionWhereInput = { companyId };

  // Search across multiple fields
  if (filters.searchTerm?.trim()) {
    whereClause.OR = [
      { id: { contains: filters.searchTerm, mode: "insensitive" } },
      { initialMsg: { contains: filters.searchTerm, mode: "insensitive" } },
      { summary: { contains: filters.searchTerm, mode: "insensitive" } },
    ];
  }

  // Category filter
  if (filters.category) {
    whereClause.category = filters.category;
  }

  // Language filter
  if (filters.language) {
    whereClause.language = filters.language;
  }

  // Date range filter
  if (filters.startDate || filters.endDate) {
    whereClause.startTime = {};

    if (filters.startDate) {
      whereClause.startTime.gte = new Date(filters.startDate);
    }

    if (filters.endDate) {
      // Make end date inclusive by adding one day
      const inclusiveEndDate = new Date(filters.endDate);
      inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
      whereClause.startTime.lt = inclusiveEndDate;
    }
  }

  return whereClause;
}

/**
 * Build order by clause for session sorting
 */
function buildOrderByClause(
  filters: SessionQueryInput
):
  | Prisma.SessionOrderByWithRelationInput
  | Prisma.SessionOrderByWithRelationInput[] {
  if (filters.sortKey === "startTime") {
    return { startTime: filters.sortOrder };
  }

  // For non-time fields, add secondary sort by startTime
  return [{ [filters.sortKey]: filters.sortOrder }, { startTime: "desc" }];
}

/**
 * Convert Prisma session to ChatSession format
 */
function convertPrismaSessionToChatSession(ps: {
  id: string;
  companyId: string;
  startTime: Date;
  endTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: string | null;
  language: string | null;
  country: string | null;
  ipAddress: string | null;
  sentiment: string | null;
  messagesSent: number | null;
  avgResponseTime: number | null;
  escalated: boolean | null;
  forwardedHr: boolean | null;
  initialMsg: string | null;
  fullTranscriptUrl: string | null;
  summary: string | null;
}): ChatSession {
  return {
    id: ps.id,
    sessionId: ps.id, // Using ID as sessionId for consistency
    companyId: ps.companyId,
    startTime: ps.startTime,
    endTime: ps.endTime,
    createdAt: ps.createdAt,
    updatedAt: ps.updatedAt,
    userId: null, // Not stored at session level
    category: ps.category,
    language: ps.language,
    country: ps.country,
    ipAddress: ps.ipAddress,
    sentiment: ps.sentiment,
    messagesSent: ps.messagesSent ?? undefined,
    avgResponseTime: ps.avgResponseTime,
    escalated: ps.escalated ?? undefined,
    forwardedHr: ps.forwardedHr ?? undefined,
    initialMsg: ps.initialMsg ?? undefined,
    fullTranscriptUrl: ps.fullTranscriptUrl,
    summary: ps.summary,
    transcriptContent: null, // Not included in list view for performance
  };
}

/**
 * GET /api/dashboard/sessions
 *
 * Retrieve paginated list of sessions with filtering and sorting capabilities.
 *
 * Features:
 * - Automatic authentication and company access validation
 * - Input validation with Zod schemas
 * - Consistent error handling and response format
 * - Audit logging for security monitoring
 * - Rate limiting protection
 * - Pagination with metadata
 */
export const GET = createAuthenticatedHandler(
  async (context, _, validatedQuery) => {
    const filters = validatedQuery as SessionQueryInput;
    // biome-ignore lint/style/noNonNullAssertion: pagination is guaranteed to exist when enablePagination is true
    const { page, limit } = context.pagination!;

    try {
      // Validate company access (users can only see their company's sessions)
      // biome-ignore lint/style/noNonNullAssertion: user is guaranteed to exist in authenticated handler
      const companyId = context.user!.companyId;

      // Build query conditions
      const whereClause = buildWhereClause(companyId, filters);
      const orderByClause = buildOrderByClause(filters);

      // Execute queries in parallel for better performance
      const [sessions, totalCount] = await Promise.all([
        prisma.session.findMany({
          where: whereClause,
          orderBy: orderByClause,
          skip: (page - 1) * limit,
          take: limit,
          // Only select needed fields for performance
          select: {
            id: true,
            companyId: true,
            startTime: true,
            endTime: true,
            createdAt: true,
            updatedAt: true,
            category: true,
            language: true,
            country: true,
            ipAddress: true,
            sentiment: true,
            messagesSent: true,
            avgResponseTime: true,
            escalated: true,
            forwardedHr: true,
            initialMsg: true,
            fullTranscriptUrl: true,
            summary: true,
          },
        }),
        prisma.session.count({ where: whereClause }),
      ]);

      // Transform data
      const transformedSessions: ChatSession[] = sessions.map(
        convertPrismaSessionToChatSession
      );

      // Calculate pagination metadata
      const paginationMeta = calculatePaginationMeta(page, limit, totalCount);

      // Return paginated response with metadata
      return createPaginatedResponse(transformedSessions, paginationMeta);
    } catch (error) {
      // Database errors are automatically handled by the error system
      if (error instanceof Error) {
        throw new DatabaseError("Failed to fetch sessions", {
          // biome-ignore lint/style/noNonNullAssertion: user is guaranteed to exist in authenticated handler
          companyId: context.user!.companyId,
          filters,
          error: error.message,
        });
      }
      throw error;
    }
  },
  {
    // Configuration
    validateQuery: SessionQuerySchema,
    enablePagination: true,
    auditLog: true,
    rateLimit: {
      maxRequests: 60, // 60 requests per window
      windowMs: 60 * 1000, // 1 minute window
    },
    cacheControl: "private, max-age=30", // Cache for 30 seconds
  }
);

/*
COMPARISON: Before vs After Refactoring

BEFORE (Original Implementation):
- ❌ Manual session authentication with repetitive code
- ❌ Inconsistent error responses: { error: "...", details: "..." }
- ❌ No input validation - accepts any query parameters
- ❌ No rate limiting protection
- ❌ No audit logging for security monitoring
- ❌ Manual pagination parameter extraction
- ❌ Inconsistent response format: { sessions, totalSessions }
- ❌ Basic error logging without context
- ❌ No company access validation
- ❌ Performance issue: sequential database queries

AFTER (Refactored with New Architecture):
- ✅ Automatic authentication via createAuthenticatedHandler middleware
- ✅ Standardized error responses with proper status codes and request IDs
- ✅ Strong input validation with Zod schemas and type safety
- ✅ Built-in rate limiting (60 req/min) with configurable limits
- ✅ Automatic audit logging for security compliance
- ✅ Automatic pagination handling via middleware
- ✅ Consistent API response format with metadata
- ✅ Comprehensive error handling with proper categorization
- ✅ Automatic company access validation for multi-tenant security
- ✅ Performance optimization: parallel database queries

BENEFITS:
1. **Consistency**: All endpoints follow the same patterns
2. **Security**: Built-in auth, rate limiting, audit logging, company isolation
3. **Maintainability**: Less boilerplate, centralized logic, type safety
4. **Performance**: Optimized queries, caching headers, parallel execution
5. **Developer Experience**: Better error messages, validation, debugging
6. **Scalability**: Standardized patterns that can be applied across all endpoints

MIGRATION STRATEGY:
1. Replace the original route.ts with this refactored version
2. Update any frontend code to expect the new response format
3. Test thoroughly to ensure backward compatibility where needed
4. Repeat this pattern for other endpoints
*/
