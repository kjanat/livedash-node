/**
 * Optimized Database Queries for OpenAI Batch Processing
 *
 * This module provides optimized versions of batch processing queries
 * with improved performance through:
 * - Reduced data fetching with selective includes
 * - Company caching to eliminate redundant lookups
 * - Batch operations to reduce N+1 queries
 * - Query result pooling and reuse
 */

import {
  AIBatchRequestStatus,
  type AIProcessingRequest,
  AIRequestStatus,
} from "@prisma/client";
import { BatchLogLevel, BatchOperation, batchLogger } from "./batchLogger";
import { prisma } from "./prisma";

/**
 * Cache for active companies to reduce database lookups
 */
interface CachedCompany {
  id: string;
  name: string;
  cachedAt: number;
}

class CompanyCache {
  private cache = new Map<string, CachedCompany>();
  private allActiveCompanies: CachedCompany[] | null = null;
  private allActiveCompaniesCachedAt = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getActiveCompanies(): Promise<CachedCompany[]> {
    const now = Date.now();

    if (
      this.allActiveCompanies &&
      now - this.allActiveCompaniesCachedAt < this.CACHE_TTL
    ) {
      return this.allActiveCompanies;
    }

    const companies = await prisma.company.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
    });

    this.allActiveCompanies = companies.map((company) => ({
      ...company,
      cachedAt: now,
    }));
    this.allActiveCompaniesCachedAt = now;

    await batchLogger.log(
      BatchLogLevel.DEBUG,
      `Refreshed company cache with ${companies.length} active companies`,
      {
        operation: BatchOperation.SCHEDULER_ACTION,
        requestCount: companies.length,
      }
    );

    return this.allActiveCompanies;
  }

  invalidate(): void {
    this.cache.clear();
    this.allActiveCompanies = null;
    this.allActiveCompaniesCachedAt = 0;
  }
}

const companyCache = new CompanyCache();

/**
 * Optimized version of getPendingBatchRequests with minimal data fetching
 */
export async function getPendingBatchRequestsOptimized(
  companyId: string,
  limit = 1000
): Promise<AIProcessingRequest[]> {
  const startTime = Date.now();

  // Use a more efficient query that only fetches what we need
  const requests = await prisma.aIProcessingRequest.findMany({
    where: {
      session: { companyId },
      processingStatus: AIRequestStatus.PENDING_BATCHING,
      batchId: null,
    },
    // Only include essential session data, not all messages
    include: {
      session: {
        select: {
          id: true,
          companyId: true,
          // Only include message count, not full messages
          _count: {
            select: { messages: true },
          },
        },
      },
    },
    take: limit,
    orderBy: {
      requestedAt: "asc",
    },
  });

  const duration = Date.now() - startTime;

  await batchLogger.log(
    BatchLogLevel.DEBUG,
    `Retrieved ${requests.length} pending batch requests for company ${companyId} in ${duration}ms`,
    {
      operation: BatchOperation.BATCH_CREATION,
      companyId,
      requestCount: requests.length,
      duration,
    }
  );

  return requests as any; // Type assertion since we're only including essential data
}

/**
 * Batch operation to get pending requests for multiple companies
 */
export async function getPendingBatchRequestsForAllCompanies(): Promise<
  Map<string, AIProcessingRequest[]>
> {
  const startTime = Date.now();
  const companies = await companyCache.getActiveCompanies();

  if (companies.length === 0) {
    return new Map();
  }

  // Single query to get all pending requests for all companies
  const allRequests = await prisma.aIProcessingRequest.findMany({
    where: {
      session: {
        companyId: { in: companies.map((c) => c.id) },
      },
      processingStatus: AIRequestStatus.PENDING_BATCHING,
      batchId: null,
    },
    include: {
      session: {
        select: {
          id: true,
          companyId: true,
          _count: { select: { messages: true } },
        },
      },
    },
    orderBy: { requestedAt: "asc" },
  });

  // Group requests by company
  const requestsByCompany = new Map<string, AIProcessingRequest[]>();
  for (const request of allRequests) {
    const companyId = request.session?.companyId;
    if (!companyId) continue;

    if (!requestsByCompany.has(companyId)) {
      requestsByCompany.set(companyId, []);
    }
    requestsByCompany.get(companyId)?.push(request as any);
  }

  const duration = Date.now() - startTime;

  await batchLogger.log(
    BatchLogLevel.INFO,
    `Retrieved pending requests for ${companies.length} companies (${allRequests.length} total requests) in ${duration}ms`,
    {
      operation: BatchOperation.BATCH_CREATION,
      requestCount: allRequests.length,
      duration,
    }
  );

  return requestsByCompany;
}

/**
 * Optimized batch status checking for all companies
 */
export async function getInProgressBatchesForAllCompanies(): Promise<
  Map<string, any[]>
> {
  const startTime = Date.now();
  const companies = await companyCache.getActiveCompanies();

  if (companies.length === 0) {
    return new Map();
  }

  // Single query for all companies
  const allBatches = await prisma.aIBatchRequest.findMany({
    where: {
      companyId: { in: companies.map((c) => c.id) },
      status: {
        in: [
          AIBatchRequestStatus.IN_PROGRESS,
          AIBatchRequestStatus.VALIDATING,
          AIBatchRequestStatus.FINALIZING,
        ],
      },
    },
    select: {
      id: true,
      companyId: true,
      openaiBatchId: true,
      status: true,
      createdAt: true,
    },
  });

  // Group by company
  const batchesByCompany = new Map<string, any[]>();
  for (const batch of allBatches) {
    if (!batchesByCompany.has(batch.companyId)) {
      batchesByCompany.set(batch.companyId, []);
    }
    batchesByCompany.get(batch.companyId)?.push(batch);
  }

  const duration = Date.now() - startTime;

  await batchLogger.log(
    BatchLogLevel.DEBUG,
    `Retrieved in-progress batches for ${companies.length} companies (${allBatches.length} total batches) in ${duration}ms`,
    {
      operation: BatchOperation.BATCH_STATUS_CHECK,
      requestCount: allBatches.length,
      duration,
    }
  );

  return batchesByCompany;
}

/**
 * Optimized completed batch processing for all companies
 */
export async function getCompletedBatchesForAllCompanies(): Promise<
  Map<string, any[]>
> {
  const startTime = Date.now();
  const companies = await companyCache.getActiveCompanies();

  if (companies.length === 0) {
    return new Map();
  }

  // Single query for all companies with minimal includes
  const allBatches = await prisma.aIBatchRequest.findMany({
    where: {
      companyId: { in: companies.map((c) => c.id) },
      status: AIBatchRequestStatus.COMPLETED,
      outputFileId: { not: null },
    },
    select: {
      id: true,
      companyId: true,
      openaiBatchId: true,
      outputFileId: true,
      status: true,
      createdAt: true,
      // Only get request IDs, not full request data
      processingRequests: {
        select: {
          id: true,
          sessionId: true,
          processingStatus: true,
        },
      },
    },
  });

  // Group by company
  const batchesByCompany = new Map<string, any[]>();
  for (const batch of allBatches) {
    if (!batchesByCompany.has(batch.companyId)) {
      batchesByCompany.set(batch.companyId, []);
    }
    batchesByCompany.get(batch.companyId)?.push(batch);
  }

  const duration = Date.now() - startTime;

  await batchLogger.log(
    BatchLogLevel.DEBUG,
    `Retrieved completed batches for ${companies.length} companies (${allBatches.length} total batches) in ${duration}ms`,
    {
      operation: BatchOperation.BATCH_RESULT_PROCESSING,
      requestCount: allBatches.length,
      duration,
    }
  );

  return batchesByCompany;
}

/**
 * Optimized failed request retry for all companies
 */
export async function getFailedRequestsForAllCompanies(
  maxPerCompany = 10
): Promise<Map<string, AIProcessingRequest[]>> {
  const startTime = Date.now();
  const companies = await companyCache.getActiveCompanies();

  if (companies.length === 0) {
    return new Map();
  }

  // Get failed requests for all companies in a single query
  const allFailedRequests = await prisma.aIProcessingRequest.findMany({
    where: {
      session: {
        companyId: { in: companies.map((c) => c.id) },
      },
      processingStatus: AIRequestStatus.PROCESSING_FAILED,
    },
    include: {
      session: {
        select: {
          id: true,
          companyId: true,
          _count: { select: { messages: true } },
        },
      },
    },
    orderBy: { requestedAt: "asc" },
  });

  // Group by company and limit per company
  const requestsByCompany = new Map<string, AIProcessingRequest[]>();
  for (const request of allFailedRequests) {
    const companyId = request.session?.companyId;
    if (!companyId) continue;

    if (!requestsByCompany.has(companyId)) {
      requestsByCompany.set(companyId, []);
    }

    const companyRequests = requestsByCompany.get(companyId)!;
    if (companyRequests.length < maxPerCompany) {
      companyRequests.push(request as any);
    }
  }

  const duration = Date.now() - startTime;
  const totalRequests = Array.from(requestsByCompany.values()).reduce(
    (sum, requests) => sum + requests.length,
    0
  );

  await batchLogger.log(
    BatchLogLevel.DEBUG,
    `Retrieved failed requests for ${companies.length} companies (${totalRequests} total requests) in ${duration}ms`,
    {
      operation: BatchOperation.INDIVIDUAL_REQUEST_RETRY,
      requestCount: totalRequests,
      duration,
    }
  );

  return requestsByCompany;
}

/**
 * Optimized check for oldest pending request with minimal data
 */
export async function getOldestPendingRequestOptimized(
  companyId: string
): Promise<{ requestedAt: Date } | null> {
  const startTime = Date.now();

  // Only fetch the timestamp we need
  const oldestPending = await prisma.aIProcessingRequest.findFirst({
    where: {
      session: { companyId },
      processingStatus: AIRequestStatus.PENDING_BATCHING,
    },
    select: { requestedAt: true },
    orderBy: { requestedAt: "asc" },
  });

  const duration = Date.now() - startTime;

  await batchLogger.log(
    BatchLogLevel.DEBUG,
    `Retrieved oldest pending request timestamp for company ${companyId} in ${duration}ms`,
    {
      operation: BatchOperation.SCHEDULER_ACTION,
      companyId,
      duration,
    }
  );

  return oldestPending;
}

/**
 * Batch statistics query optimization
 */
export async function getBatchProcessingStatsOptimized(
  companyId?: string
): Promise<any> {
  const startTime = Date.now();

  const whereClause = companyId ? { companyId } : {};

  // Use aggregation instead of loading individual records
  const [
    totalBatches,
    pendingRequests,
    inProgressBatches,
    completedBatches,
    failedRequests,
  ] = await Promise.all([
    prisma.aIBatchRequest.count({ where: whereClause }),
    prisma.aIProcessingRequest.count({
      where: {
        ...(companyId && { session: { companyId } }),
        processingStatus: AIRequestStatus.PENDING_BATCHING,
      },
    }),
    prisma.aIBatchRequest.count({
      where: {
        ...whereClause,
        status: {
          in: [
            AIBatchRequestStatus.IN_PROGRESS,
            AIBatchRequestStatus.VALIDATING,
            AIBatchRequestStatus.FINALIZING,
          ],
        },
      },
    }),
    prisma.aIBatchRequest.count({
      where: {
        ...whereClause,
        status: AIBatchRequestStatus.COMPLETED,
      },
    }),
    prisma.aIProcessingRequest.count({
      where: {
        ...(companyId && { session: { companyId } }),
        processingStatus: AIRequestStatus.PROCESSING_FAILED,
      },
    }),
  ]);

  const duration = Date.now() - startTime;
  const stats = {
    totalBatches,
    pendingRequests,
    inProgressBatches,
    completedBatches,
    failedRequests,
  };

  await batchLogger.log(
    BatchLogLevel.DEBUG,
    `Retrieved batch processing stats ${companyId ? `for company ${companyId}` : "globally"} in ${duration}ms`,
    {
      operation: BatchOperation.SCHEDULER_ACTION,
      companyId,
      duration,
      metadata: stats,
    }
  );

  return stats;
}

/**
 * Utility to invalidate company cache (call when companies are added/removed/status changed)
 */
export function invalidateCompanyCache(): void {
  companyCache.invalidate();
}

/**
 * Get cache statistics for monitoring
 */
export function getCompanyCacheStats() {
  return {
    isActive: companyCache.allActiveCompanies !== null,
    cachedAt: new Date(companyCache.allActiveCompaniesCachedAt),
    cacheSize: companyCache.allActiveCompanies?.length || 0,
  };
}
