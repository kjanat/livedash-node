# Database Connection Pooling Guide

This document explains how to optimize database connection pooling for better performance and resource management in the LiveDash application.

## Overview

The application now supports two connection pooling modes:

1. **Standard Pooling**: Default Prisma client connection pooling
2. **Enhanced Pooling**: Advanced PostgreSQL connection pooling with custom configuration

## Configuration

### Environment Variables

Add these variables to your `.env.local` file:

```bash
# Database Connection Pooling Configuration
DATABASE_CONNECTION_LIMIT=20          # Maximum connections in pool
DATABASE_POOL_TIMEOUT=10              # Idle timeout in seconds
USE_ENHANCED_POOLING=true             # Enable advanced pooling (production recommended)

# Optional: Add pool parameters to DATABASE_URL for additional control
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10"
```

### Pooling Modes

#### Standard Pooling (Default)

- Uses Prisma's built-in connection pooling
- Simpler configuration
- Good for development and small-scale deployments

#### Enhanced Pooling (Recommended for Production)

- Uses PostgreSQL native connection pooling with `@prisma/adapter-pg`
- Advanced monitoring and health checks
- Better resource management
- Detailed connection metrics

## Implementation Details

### Fixed Issues

1. **Multiple PrismaClient Instances**:
   - ❌ Before: Each scheduler created its own PrismaClient
   - ✅ After: All modules use singleton pattern from `lib/prisma.ts`

2. **No Connection Management**:
   - ❌ Before: No graceful shutdown or connection cleanup
   - ✅ After: Proper cleanup on process termination

3. **No Monitoring**:
   - ❌ Before: No visibility into connection usage
   - ✅ After: Health check endpoint and connection metrics

### Key Files Modified

- `lib/prisma.ts` - Enhanced singleton with pooling options
- `lib/database-pool.ts` - Advanced pooling configuration
- `lib/processingScheduler.ts` - Fixed to use singleton
- `lib/importProcessor.ts` - Fixed to use singleton
- `lib/processingStatusManager.ts` - Fixed to use singleton
- `lib/schedulers.ts` - Added graceful shutdown
- `app/api/admin/database-health/route.ts` - Monitoring endpoint

## Monitoring

### Health Check Endpoint

Check database connection health:

```bash
curl -H "Authorization: Bearer your-token" \
     http://localhost:3000/api/admin/database-health
```

Response includes:

- Connection status
- Pool statistics (if enhanced pooling enabled)
- Basic metrics (session counts, etc.)
- Configuration details

### Connection Metrics

With enhanced pooling enabled, you'll see console logs for:

- Connection acquisitions/releases
- Pool size changes
- Error events
- Health check results

## Performance Benefits

### Before Optimization

- Multiple connection pools (one per scheduler)
- Potential connection exhaustion under load
- No connection monitoring
- Resource waste from idle connections

### After Optimization

- Single shared connection pool
- Configurable pool size and timeouts
- Connection health monitoring
- Graceful shutdown and cleanup
- Better resource utilization

## Recommended Settings

### Development

```bash
DATABASE_CONNECTION_LIMIT=10
DATABASE_POOL_TIMEOUT=30
USE_ENHANCED_POOLING=false
```

### Production

```bash
DATABASE_CONNECTION_LIMIT=20
DATABASE_POOL_TIMEOUT=10
USE_ENHANCED_POOLING=true
```

### High-Load Production

```bash
DATABASE_CONNECTION_LIMIT=50
DATABASE_POOL_TIMEOUT=5
USE_ENHANCED_POOLING=true
```

## Troubleshooting

### Connection Pool Exhaustion

If you see "too many connections" errors:

1. Increase `DATABASE_CONNECTION_LIMIT`
2. Check for connection leaks in application code
3. Monitor the health endpoint for pool statistics

### Slow Database Queries

If queries are timing out:

1. Decrease `DATABASE_POOL_TIMEOUT`
2. Check database query performance
3. Consider connection pooling at the infrastructure level (PgBouncer)

### Memory Usage

If memory usage is high:

1. Decrease `DATABASE_CONNECTION_LIMIT`
2. Enable enhanced pooling for better resource management
3. Monitor idle connection cleanup

## Best Practices

1. **Always use the singleton**: Import `prisma` from `lib/prisma.ts`
2. **Monitor connection usage**: Use the health endpoint regularly
3. **Set appropriate limits**: Don't over-provision connections
4. **Enable enhanced pooling in production**: Better resource management
5. **Implement graceful shutdown**: Ensure connections are properly closed
6. **Log connection events**: Monitor for issues and optimize accordingly

## Next Steps

Consider implementing:

1. **Connection pooling middleware**: PgBouncer or similar
2. **Read replicas**: For read-heavy workloads
3. **Connection retry logic**: For handling temporary failures
4. **Metrics collection**: Prometheus/Grafana for detailed monitoring
