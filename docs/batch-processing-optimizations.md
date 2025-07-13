# Batch Processing Database Query Optimizations

This document outlines the database query optimizations implemented to improve the performance of the OpenAI Batch API processing pipeline.

## Overview

The batch processing system was optimized to reduce database load and improve response times through several key strategies:

1.  **Database Index Optimization**
2.  **Query Pattern Improvements**
3.  **Company Caching**
4.  **Batch Operations**
5.  **Integration Layer with Fallback**

## Database Index Improvements

### New Indexes Added

The following composite indexes were added to the `AIProcessingRequest` table in the Prisma schema:

```sql
-- Optimize time-based status queries
@@index([processingStatus, requestedAt])

-- Optimize batch-related queries  
@@index([batchId])

-- Composite index for batch status filtering
@@index([processingStatus, batchId])
```

### Query Performance Impact

These indexes specifically optimize:

-   Finding pending requests by status and creation time
-   Batch-related lookups by batch ID
-   Combined status and batch filtering operations

## Query Optimization Strategies

### 1. Selective Data Fetching

**Before:**

```typescript
// Loaded full session with all messages
include: {
  session: {
    include: {
      messages: {
        orderBy: { order: "asc" },
      },
    },
  },
}
```

**After:**

```typescript
// Only essential data with message count
include: {
  session: {
    select: {
      id: true,
      companyId: true,
      _count: { select: { messages: true } }
    },
  },
}
```

### 2. Company Caching

Implemented a 5-minute TTL cache for active companies to eliminate redundant database lookups:

```typescript
class CompanyCache {
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  async getActiveCompanies(): Promise<CachedCompany[]> {
    // Returns cached data if available and fresh
    // Otherwise refreshes from database
  }
}
```

### 3. Batch Operations

**Before:** N+1 queries for each company

```typescript
// Sequential processing per company
for (const company of companies) {
  const requests = await getPendingRequests(company.id);
  // Process each company separately
}
```

**After:** Single query for all companies

```typescript
// Batch query for all companies at once
const allRequests = await prisma.aIProcessingRequest.findMany({
  where: {
    session: {
      companyId: { in: companies.map(c => c.id) },
    },
    processingStatus: AIRequestStatus.PENDING_BATCHING,
  },
});

// Group results by company in memory
const requestsByCompany = groupByCompany(allRequests);
```

## Performance Improvements

### Query Count Reduction

-   **Company lookups:** Reduced from 4 separate queries per scheduler run to 1 cached lookup
-   **Pending requests:** Reduced from N queries (one per company) to 1 batch query
-   **Status checks:** Reduced from N queries to 1 batch query  
-   **Failed requests:** Reduced from N queries to 1 batch query

### Parallel Processing

Added configurable parallel processing with batching:

```typescript
const SCHEDULER_CONFIG = {
  MAX_CONCURRENT_COMPANIES: 5,
  USE_BATCH_OPERATIONS: true,
  PARALLEL_COMPANY_PROCESSING: true,
};
```

### Memory Optimization

-   Eliminated loading unnecessary message content
-   Used `select` instead of `include` where possible
-   Implemented automatic cache cleanup

## Integration Layer

Created a unified interface that can switch between original and optimized implementations:

### Environment Configuration

```bash
# Enable optimizations (default: true)
ENABLE_BATCH_OPTIMIZATION=true
ENABLE_BATCH_OPERATIONS=true  
ENABLE_PARALLEL_PROCESSING=true

# Fallback behavior
FALLBACK_ON_ERRORS=true
```

### Performance Tracking

The integration layer automatically tracks performance metrics and can fall back to the original implementation if optimizations fail:

```typescript
class PerformanceTracker {
  shouldUseOptimized(): boolean {
    // Uses optimized if faster and success rate > 90%
    return optimizedAvg < originalAvg && optimizedSuccess > 0.9;
  }
}
```

## Files Modified

### New Files

-   `lib/batchProcessorOptimized.ts` - Optimized query implementations
-   `lib/batchSchedulerOptimized.ts` - Optimized scheduler
-   `lib/batchProcessorIntegration.ts` - Integration layer with fallback

### Modified Files

-   `prisma/schema.prisma` - Added composite indexes
-   `server.ts` - Updated to use integration layer
-   `app/api/admin/batch-monitoring/route.ts` - Updated import

## Monitoring

The optimizations include comprehensive logging and monitoring:

-   Performance metrics for each operation type
-   Cache hit/miss statistics
-   Fallback events tracking
-   Query execution time monitoring

## Rollback Strategy

The integration layer allows for easy rollback:

1.  Set `ENABLE_BATCH_OPTIMIZATION=false`
2.  System automatically uses original implementation
3.  No database schema changes needed for rollback
4.  Indexes remain beneficial for manual queries

## Expected Performance Gains

-   **Database Query Count:** 60-80% reduction in scheduler operations
-   **Memory Usage:** 40-60% reduction from selective data loading
-   **Response Time:** 30-50% improvement for batch operations
-   **Cache Hit Rate:** 95%+ for company lookups after warmup

## Testing

Performance improvements can be validated by:

1.  Monitoring the batch monitoring dashboard
2.  Checking performance metrics in logs
3.  Comparing execution times before/after optimization
4.  Load testing with multiple companies and large batches
