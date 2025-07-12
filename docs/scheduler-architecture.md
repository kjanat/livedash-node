# Scheduler Architecture for Horizontal Scaling

This document describes the extracted scheduler architecture that enables horizontal scaling of background processing tasks.

## Architecture Overview

The scheduler system has been refactored from a monolithic approach to a service-oriented architecture that supports:

- **Individual Scheduler Services** - Each scheduler runs as a separate service
- **Horizontal Scaling** - Multiple instances of the same scheduler can run across different machines
- **Health Monitoring** - Built-in health checks for load balancers and orchestrators
- **Graceful Shutdown** - Proper handling of shutdown signals for zero-downtime deployments
- **Centralized Management** - Optional scheduler manager for coordinated operations

## Components

### 1. BaseSchedulerService

Abstract base class providing common functionality:

```typescript
export abstract class BaseSchedulerService extends EventEmitter {
  // Common scheduler functionality
  protected abstract executeTask(): Promise<void>;

  async start(): Promise<void>;
  async stop(): Promise<void>;
  pause(): void;
  resume(): void;
  getHealthStatus(): HealthStatus;
  getMetrics(): SchedulerMetrics;
}
```

**Features:**

- Status management (STOPPED, STARTING, RUNNING, PAUSED, ERROR)
- Metrics collection (run counts, timing, success/failure rates)
- Event emission for monitoring
- Configurable intervals and timeouts
- Automatic retry handling

### 2. Individual Scheduler Services

#### CsvImportSchedulerService

Handles periodic CSV data import from companies:

```typescript
const csvScheduler = new CsvImportSchedulerService({
  interval: "*/10 * * * *", // Every 10 minutes
  batchSize: 10,
  maxConcurrentImports: 5,
  timeout: 300000, // 5 minutes
});
```

**Features:**

- Batch processing with configurable concurrency
- Duplicate detection
- Company-specific error handling
- Progress monitoring

#### Additional Schedulers (To Be Implemented)

- `ImportProcessingSchedulerService` - Process imported CSV data into sessions
- `SessionProcessingSchedulerService` - AI analysis and categorization
- `BatchProcessingSchedulerService` - OpenAI Batch API integration

### 3. SchedulerManager

Orchestrates multiple schedulers in a single process:

```typescript
const manager = new SchedulerManager();

manager.registerScheduler({
  id: "csv-import",
  name: "CSV Import Scheduler",
  service: new CsvImportSchedulerService(),
  autoStart: true,
  critical: true, // Auto-restart on failure
});

await manager.startAll();
```

**Features:**

- Automatic restart of failed critical schedulers
- Health monitoring across all schedulers
- Coordinated start/stop operations
- Event aggregation and logging

### 4. Standalone Scheduler Runner

Runs individual schedulers as separate processes:

```bash
# Run CSV import scheduler as standalone process
npx tsx lib/services/schedulers/StandaloneSchedulerRunner.ts --scheduler=csv-import

# List available schedulers
npx tsx lib/services/schedulers/StandaloneSchedulerRunner.ts --list
```

**Features:**

- Independent process execution
- Environment variable configuration
- Graceful shutdown handling
- Health reporting for monitoring

## Deployment Patterns

### 1. Single Process (Current Default)

All schedulers run within the main Next.js server process:

```typescript
// server.ts
import { initializeSchedulers } from "./lib/services/schedulers/ServerSchedulerIntegration";

await initializeSchedulers();
```

**Pros:**

- Simple deployment
- Lower resource usage
- Easy local development

**Cons:**

- Limited scalability
- Single point of failure
- Resource contention

### 2. Separate Processes

Each scheduler runs as an independent process:

```bash
# Terminal 1: Main application
npm run dev

# Terminal 2: CSV Import Scheduler
npm run scheduler:csv-import

# Terminal 3: Session Processing Scheduler
npm run scheduler:session-processing
```

**Pros:**

- Independent scaling
- Fault isolation
- Resource optimization per scheduler

**Cons:**

- More complex deployment
- Higher resource overhead
- Inter-process coordination needed

### 3. Container Orchestration (Recommended for Production)

Each scheduler runs in separate containers managed by Kubernetes/Docker Swarm:

```yaml
# docker-compose.yml
version: "3.8"
services:
  app:
    build: .
    environment:
      - SCHEDULER_ENABLED=false # Disable in-process schedulers

  csv-import-scheduler:
    build: .
    command: npx tsx lib/services/schedulers/StandaloneSchedulerRunner.ts --scheduler=csv-import
    environment:
      - CSV_IMPORT_INTERVAL=*/10 * * * *
      - CSV_IMPORT_BATCH_SIZE=10

  session-processing-scheduler:
    build: .
    command: npx tsx lib/services/schedulers/StandaloneSchedulerRunner.ts --scheduler=session-processing
    environment:
      - SESSION_PROCESSING_INTERVAL=*/5 * * * *
```

**Pros:**

- Full horizontal scaling
- Independent resource allocation
- Health monitoring integration
- Zero-downtime deployments

**Cons:**

- Complex orchestration setup
- Network latency considerations
- Distributed system challenges

## Configuration

### Environment Variables

```bash
# Global Scheduler Settings
SCHEDULER_ENABLED=true
SCHEDULER_AUTO_RESTART=true

# CSV Import Scheduler
CSV_IMPORT_INTERVAL="*/10 * * * *"
CSV_IMPORT_BATCH_SIZE=10
CSV_IMPORT_MAX_CONCURRENT=5
CSV_IMPORT_TIMEOUT=300000

# Import Processing Scheduler
IMPORT_PROCESSING_INTERVAL="*/2 * * * *"
IMPORT_PROCESSING_TIMEOUT=120000

# Session Processing Scheduler
SESSION_PROCESSING_INTERVAL="*/5 * * * *"
SESSION_PROCESSING_BATCH_SIZE=50

# Batch Processing Scheduler
BATCH_PROCESSING_INTERVAL="*/5 * * * *"
BATCH_PROCESSING_CHECK_INTERVAL="*/2 * * * *"
```

### Package.json Scripts

```json
{
  "scripts": {
    "scheduler:csv-import": "tsx lib/services/schedulers/StandaloneSchedulerRunner.ts --scheduler=csv-import",
    "scheduler:import-processing": "tsx lib/services/schedulers/StandaloneSchedulerRunner.ts --scheduler=import-processing",
    "scheduler:session-processing": "tsx lib/services/schedulers/StandaloneSchedulerRunner.ts --scheduler=session-processing",
    "scheduler:batch-processing": "tsx lib/services/schedulers/StandaloneSchedulerRunner.ts --scheduler=batch-processing"
  }
}
```

## Health Monitoring

### Health Check Endpoints

```bash
# Overall scheduler health
GET /api/admin/schedulers/health

# Scheduler management
GET /api/admin/schedulers
POST /api/admin/schedulers
```

### Response Format

```json
{
  "healthy": true,
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "schedulers": {
    "total": 4,
    "running": 4,
    "errors": 0
  },
  "details": {
    "csv-import": {
      "status": "RUNNING",
      "healthy": true,
      "lastSuccess": "2024-01-15T10:25:00.000Z"
    }
  }
}
```

### Kubernetes Integration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: csv-import-scheduler
spec:
  template:
    spec:
      containers:
        - name: scheduler
          image: livedash:latest
          command:
            [
              "npx",
              "tsx",
              "lib/services/schedulers/StandaloneSchedulerRunner.ts",
              "--scheduler=csv-import",
            ]
          livenessProbe:
            httpGet:
              path: /api/admin/schedulers/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/admin/schedulers/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
```

## Scaling Strategies

### 1. Vertical Scaling

Increase resources for scheduler processes:

```yaml
# docker-compose.yml
csv-import-scheduler:
  deploy:
    resources:
      limits:
        cpus: "2.0"
        memory: 2G
      reservations:
        cpus: "1.0"
        memory: 1G
```

### 2. Horizontal Scaling

Run multiple instances of the same scheduler:

```yaml
# Kubernetes
apiVersion: apps/v1
kind: Deployment
metadata:
  name: csv-import-scheduler
spec:
  replicas: 3 # Multiple instances
  template:
    spec:
      containers:
        - name: scheduler
          env:
            - name: SCHEDULER_INSTANCE_ID
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
```

**Note:** Ensure scheduler logic handles multiple instances correctly (e.g., using database locks or partitioning).

### 3. Geographic Distribution

Deploy schedulers across different regions:

```yaml
# Region-specific scheduling
csv-import-scheduler-us:
  environment:
    - REGION=us
    - CSV_COMPANIES_FILTER=region:us

csv-import-scheduler-eu:
  environment:
    - REGION=eu
    - CSV_COMPANIES_FILTER=region:eu
```

## Migration Guide

### From Current Architecture

1. **Phase 1: Extract Schedulers**
   - ✅ Create BaseSchedulerService
   - ✅ Implement CsvImportSchedulerService
   - ✅ Create SchedulerManager
   - ⏳ Implement remaining scheduler services

2. **Phase 2: Deployment Options**
   - ✅ Add ServerSchedulerIntegration for backwards compatibility
   - ✅ Create StandaloneSchedulerRunner
   - ✅ Add health check endpoints

3. **Phase 3: Container Support**
   - ⏳ Create Dockerfile for scheduler containers
   - ⏳ Add Kubernetes manifests
   - ⏳ Implement distributed coordination

4. **Phase 4: Production Migration**
   - ⏳ Deploy separate scheduler containers
   - ⏳ Monitor performance and stability
   - ⏳ Gradually increase horizontal scaling

### Breaking Changes

- Scheduler initialization moved from `server.ts` to `ServerSchedulerIntegration`
- Individual scheduler functions replaced with service classes
- Configuration moved to environment variables

## Benefits

1. **Scalability**: Independent scaling of different scheduler types
2. **Reliability**: Fault isolation prevents cascading failures
3. **Performance**: Optimized resource allocation per scheduler
4. **Monitoring**: Granular health checks and metrics
5. **Deployment**: Zero-downtime updates and rollbacks
6. **Development**: Easier testing and debugging of individual schedulers

## Next Steps

1. Implement remaining scheduler services (ImportProcessing, SessionProcessing, BatchProcessing)
2. Add distributed coordination for multi-instance schedulers
3. Create Kubernetes operators for automatic scaling
4. Implement scheduler-specific metrics and dashboards
5. Add scheduler performance optimization tools
