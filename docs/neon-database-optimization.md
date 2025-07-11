# Neon Database Optimization Guide

This document provides specific recommendations for optimizing database connections when using Neon PostgreSQL.

## Current Issues Observed

From your logs, we can see:

```bash
Can't reach database server at `ep-tiny-math-a2zsshve-pooler.eu-central-1.aws.neon.tech:5432`
[NODE-CRON] [WARN] missed execution at Sun Jun 29 2025 12:00:00 GMT+0200! Possible blocking IO or high CPU
```

## Root Causes

### 1. Neon Connection Limits

-   **Free Tier**: 20 concurrent connections
-   **Pro Tier**: 100 concurrent connections
-   **Multiple schedulers** can quickly exhaust connections

### 2. Connection Pooling Issues

-   Each scheduler was creating separate PrismaClient instances
-   No connection reuse between operations
-   No retry logic for temporary failures

### 3. Neon-Specific Challenges

-   **Auto-pause**: Databases pause after inactivity
-   **Cold starts**: First connection after pause takes longer
-   **Regional latency**: eu-central-1 may have variable latency

## Solutions Implemented

### 1. Fixed Multiple PrismaClient Instances ✅

```typescript
// Before: Each file created its own client
const prisma = new PrismaClient(); // ❌

// After: All use singleton
import { prisma } from "./prisma.js"; // ✅
```

### 2. Added Connection Retry Logic ✅

```typescript
// Automatic retry for connection errors
await withRetry(async () => await databaseOperation(), {
  maxRetries: 3,
  initialDelay: 2000,
  maxDelay: 10000,
  backoffMultiplier: 2,
});
```

### 3. Enhanced Connection Pooling ✅

```typescript
// Production-ready pooling with @prisma/adapter-pg
USE_ENHANCED_POOLING = true;
DATABASE_CONNECTION_LIMIT = 20;
DATABASE_POOL_TIMEOUT = 10;
```

## Neon-Specific Configuration

### Environment Variables

```bash
# Optimized for Neon
DATABASE_URL="postgresql://user:pass@ep-tiny-math-a2zsshve-pooler.eu-central-1.aws.neon.tech:5432/db?sslmode=require&connection_limit=15"

# Connection pooling (leave some headroom for manual connections)
DATABASE_CONNECTION_LIMIT=15  # Below Neon's 20 limit
DATABASE_POOL_TIMEOUT=30      # Longer timeout for cold starts
USE_ENHANCED_POOLING=true     # Enable for better resource management

# Scheduler intervals (reduce frequency to avoid overwhelming)
CSV_IMPORT_INTERVAL="*/30 * * * *"    # Every 30 minutes instead of 15
IMPORT_PROCESSING_INTERVAL="*/10 * * * *"  # Every 10 minutes instead of 5
SESSION_PROCESSING_INTERVAL="0 */2 * * *"  # Every 2 hours instead of 1
```

### Connection String Optimization

```bash
# Add these parameters to your DATABASE_URL
?sslmode=require                    # Required for Neon
&connection_limit=15                # Explicit limit
&pool_timeout=30                    # Connection timeout
&connect_timeout=10                 # Initial connection timeout
&application_name=livedash-scheduler # For monitoring
```

## Monitoring & Troubleshooting

### 1. Health Check Endpoint

```bash
# Check connection health
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     http://localhost:3000/api/admin/database-health
```

### 2. Neon Dashboard Monitoring

-   Monitor "Active connections" in Neon dashboard
-   Check for connection spikes during scheduler runs
-   Review query performance and slow queries

### 3. Application Logs

```bash
# Look for connection patterns
grep "Database connection" logs/*.log
grep "pool" logs/*.log
grep "retry" logs/*.log
```

## Performance Optimizations

### 1. Reduce Scheduler Frequency

```typescript
// Current intervals may be too aggressive
CSV_IMPORT_INTERVAL = "*/15 * * * *"; // ➜ "*/30 * * * *"
IMPORT_PROCESSING_INTERVAL = "*/5 * * * *"; // ➜ "*/10 * * * *"
SESSION_PROCESSING_INTERVAL = "0 * * * *"; // ➜ "0 */2 * * *"
```

### 2. Batch Size Optimization

```typescript
// Reduce batch sizes to avoid long-running transactions
CSV_IMPORT_BATCH_SIZE = 50; // ➜ 25
IMPORT_PROCESSING_BATCH_SIZE = 50; // ➜ 25
SESSION_PROCESSING_BATCH_SIZE = 20; // ➜ 10
```

### 3. Connection Keepalive

```typescript
// Keep connections warm to avoid cold starts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + "&keepalive=true",
    },
  },
});
```

## Troubleshooting Common Issues

### "Can't reach database server"

**Causes:**

-   Neon database auto-paused
-   Connection limit exceeded
-   Network issues

**Solutions:**

1.  Enable enhanced pooling: `USE_ENHANCED_POOLING=true`
2.  Reduce connection limit: `DATABASE_CONNECTION_LIMIT=15`
3.  Implement retry logic (already done)
4.  Check Neon dashboard for database status

### "Connection terminated"

**Causes:**

-   Idle connection timeout
-   Neon maintenance
-   Long-running transactions

**Solutions:**

1.  Increase pool timeout: `DATABASE_POOL_TIMEOUT=30`
2.  Add connection cycling
3.  Break large operations into smaller batches

### "Missed cron execution"

**Causes:**

-   Blocking database operations
-   Scheduler overlap
-   High CPU usage

**Solutions:**

1.  Reduce scheduler frequency
2.  Add concurrency limits
3.  Monitor scheduler execution time

## Recommended Production Settings

### For Neon Free Tier (20 connections)

```bash
DATABASE_CONNECTION_LIMIT=15
DATABASE_POOL_TIMEOUT=30
USE_ENHANCED_POOLING=true
CSV_IMPORT_INTERVAL="*/30 * * * *"
IMPORT_PROCESSING_INTERVAL="*/15 * * * *"
SESSION_PROCESSING_INTERVAL="0 */3 * * *"
```

### For Neon Pro Tier (100 connections)

```bash
DATABASE_CONNECTION_LIMIT=50
DATABASE_POOL_TIMEOUT=20
USE_ENHANCED_POOLING=true
CSV_IMPORT_INTERVAL="*/15 * * * *"
IMPORT_PROCESSING_INTERVAL="*/10 * * * *"
SESSION_PROCESSING_INTERVAL="0 */2 * * *"
```

## Next Steps

1.  **Immediate**: Apply the new environment variables
2.  **Short-term**: Monitor connection usage via health endpoint
3.  **Long-term**: Consider upgrading to Neon Pro for more connections
4.  **Optional**: Implement read replicas for analytics queries

## Monitoring Checklist

-   [ ] Check Neon dashboard for connection spikes
-   [ ] Monitor scheduler execution times
-   [ ] Review error logs for connection patterns
-   [ ] Test health endpoint regularly
-   [ ] Set up alerts for connection failures

With these optimizations, your Neon database connections should be much more stable and efficient!
