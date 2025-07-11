# Migration Scripts for tRPC and Batch API Integration

This directory contains comprehensive migration scripts for deploying the new architecture that includes tRPC implementation and OpenAI Batch API integration.

## Migration Components

### 1. Database Migrations

- `01-schema-migrations.sql` - Prisma database schema migrations
- `02-data-migrations.sql` - Data transformation scripts
- `validate-database.ts` - Database validation and health checks

### 2. Environment Configuration

- `environment-migration.ts` - Environment variable migration guide
- `config-validator.ts` - Configuration validation scripts

### 3. Deployment Scripts

- `deploy.ts` - Main deployment orchestrator
- `pre-deployment-checks.ts` - Pre-deployment validation
- `post-deployment-validation.ts` - Post-deployment verification
- `rollback.ts` - Rollback procedures

### 4. Health Checks

- `health-checks.ts` - Comprehensive system health validation
- `trpc-endpoint-tests.ts` - tRPC endpoint validation
- `batch-processing-tests.ts` - Batch processing system tests

### 5. Migration Utilities

- `backup-database.ts` - Database backup procedures
- `restore-database.ts` - Database restore procedures
- `migration-logger.ts` - Migration logging utilities

## Usage

### Pre-Migration

1. Run database backup: `pnpm migration:backup`
2. Validate environment: `pnpm migration:validate-env`
3. Run pre-deployment checks: `pnpm migration:pre-check`

### Migration

1. Run schema migrations: `pnpm migration:schema`
2. Run data migrations: `pnpm migration:data`
3. Deploy application: `pnpm migration:deploy`

### Post-Migration

1. Validate deployment: `pnpm migration:validate`
2. Run health checks: `pnpm migration:health-check`
3. Test critical paths: `pnpm migration:test`

### Rollback (if needed)

1. Rollback deployment: `pnpm migration:rollback`
2. Restore database: `pnpm migration:restore`

## Environment Variables

The migration requires these new environment variables:

```bash
# tRPC Configuration
TRPC_ENDPOINT_URL=http://localhost:3000/api/trpc
TRPC_BATCH_TIMEOUT=30000

# Batch Processing Configuration
BATCH_PROCESSING_ENABLED=true
BATCH_CREATE_INTERVAL="*/5 * * * *"
BATCH_STATUS_CHECK_INTERVAL="*/2 * * * *"
BATCH_RESULT_PROCESSING_INTERVAL="*/1 * * * *"
BATCH_MAX_REQUESTS=1000
BATCH_TIMEOUT_HOURS=24

# Migration Specific
MIGRATION_MODE=production
MIGRATION_BACKUP_ENABLED=true
MIGRATION_ROLLBACK_ENABLED=true
```

## Zero-Downtime Deployment Strategy

The migration implements a blue-green deployment strategy:

1. **Phase 1**: Deploy new code with feature flags disabled
2. **Phase 2**: Run database migrations
3. **Phase 3**: Enable tRPC endpoints progressively
4. **Phase 4**: Enable batch processing system
5. **Phase 5**: Full activation and old system decommission

## Safety Features

- Automatic database backups before migration
- Rollback scripts for quick recovery
- Health checks at each stage
- Progressive feature enablement
- Comprehensive logging and monitoring
- Backwards compatibility maintained during migration
