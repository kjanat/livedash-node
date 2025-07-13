# Batch Processing Monitoring Dashboard

This document describes the batch processing monitoring dashboard and API endpoints for tracking OpenAI Batch API operations in the LiveDash application.

## Overview

The Batch Monitoring Dashboard provides real-time visibility into the OpenAI Batch API processing pipeline, including job status tracking, cost analysis, and performance monitoring. This system enables 50% cost reduction on AI processing while maintaining comprehensive oversight.

## Features

### Real-time Monitoring

-   **Job Status Tracking**: Monitor batch jobs from creation to completion
-   **Queue Management**: View pending, running, and completed batch queues
-   **Processing Metrics**: Track throughput, success rates, and error patterns
-   **Cost Analysis**: Monitor API costs and savings compared to individual requests

### Performance Analytics  

-   **Batch Efficiency**: Analyze batch size optimization and processing times
-   **Success Rates**: Track completion and failure rates across different job types
-   **Resource Utilization**: Monitor API quota usage and rate limiting
-   **Historical Trends**: View processing patterns over time

### Administrative Controls

-   **Manual Intervention**: Pause, resume, or cancel batch operations
-   **Priority Management**: Adjust processing priorities for urgent requests
-   **Error Handling**: Review and retry failed batch operations
-   **Configuration Management**: Adjust batch parameters and thresholds

## API Endpoints

### Batch Monitoring API

Retrieve comprehensive batch processing metrics and status information.

```http
GET /api/admin/batch-monitoring
```

#### Query Parameters

| Parameter | Type | Description | Default | Example |
|-----------|------|-------------|---------|---------|
| `timeRange` | string | Time range for metrics | `24h` | `?timeRange=7d` |
| `status` | string | Filter by batch status | - | `?status=completed` |
| `jobType` | string | Filter by job type | - | `?jobType=ai_analysis` |
| `includeDetails` | boolean | Include detailed job information | `false` | `?includeDetails=true` |
| `page` | number | Page number for pagination | 1 | `?page=2` |
| `limit` | number | Records per page (max 100) | 50 | `?limit=25` |

#### Example Request

```javascript
const response = await fetch('/api/admin/batch-monitoring?' + new URLSearchParams({
  timeRange: '24h',
  status: 'completed',
  includeDetails: 'true'
}));

const data = await response.json();
```

#### Response Format

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalJobs": 156,
      "completedJobs": 142,
      "failedJobs": 8,
      "pendingJobs": 6,
      "totalRequests": 15600,
      "processedRequests": 14200,
      "costSavings": {
        "currentPeriod": 234.56,
        "projectedMonthly": 7038.45,
        "savingsPercentage": 48.2
      },
      "averageProcessingTime": 1800000,
      "successRate": 95.2
    },
    "queues": {
      "pending": 12,
      "processing": 3,
      "completed": 142,
      "failed": 8
    },
    "performance": {
      "throughput": {
        "requestsPerHour": 650,
        "jobsPerHour": 6.5,
        "averageBatchSize": 100
      },
      "efficiency": {
        "batchUtilization": 87.3,
        "processingEfficiency": 92.1,
        "errorRate": 4.8
      }
    },
    "jobs": [
      {
        "id": "batch-job-123",
        "batchId": "batch_abc123",
        "status": "completed",
        "jobType": "ai_analysis",
        "requestCount": 100,
        "completedCount": 98,
        "failedCount": 2,
        "createdAt": "2024-01-01T10:00:00Z",
        "startedAt": "2024-01-01T10:05:00Z",
        "completedAt": "2024-01-01T10:35:00Z",
        "processingTimeMs": 1800000,
        "costEstimate": 12.50,
        "errorSummary": [
          {
            "error": "token_limit_exceeded",
            "count": 2,
            "percentage": 2.0
          }
        ]
      }
    ]
  }
}
```

## Dashboard Components

### BatchMonitoringDashboard Component

The main dashboard component (`components/admin/BatchMonitoringDashboard.tsx`) provides:

#### Key Metrics Cards

```tsx
// Real-time overview cards
<MetricCard
  title="Total Jobs"
  value={data.summary.totalJobs}
  change={"+12 from yesterday"}
  trend="up"
/>

<MetricCard
  title="Success Rate"
  value={`${data.summary.successRate}%`}
  change={"+2.1% from last week"}
  trend="up"
/>

<MetricCard
  title="Cost Savings"
  value={`$${data.summary.costSavings.currentPeriod}`}
  change={`${data.summary.costSavings.savingsPercentage}% vs individual API`}
  trend="up"
/>
```

#### Queue Status Visualization

```tsx
// Visual representation of batch job queues
<QueueStatusChart
  pending={data.queues.pending}
  processing={data.queues.processing}
  completed={data.queues.completed}
  failed={data.queues.failed}
/>
```

#### Performance Charts

```tsx
// Processing throughput over time
<ThroughputChart
  data={data.performance.throughput}
  timeRange={timeRange}
/>

// Cost savings trend
<CostSavingsChart
  savings={data.summary.costSavings}
  historical={data.historical}
/>
```

#### Job Management Table

```tsx
// Detailed job listing with actions
<BatchJobTable
  jobs={data.jobs}
  onRetry={handleRetryJob}
  onCancel={handleCancelJob}
  onViewDetails={handleViewDetails}
/>
```

## Usage Examples

### Monitor Batch Performance

```javascript
async function monitorBatchPerformance() {
  const response = await fetch('/api/admin/batch-monitoring?timeRange=24h');
  const data = await response.json();
  
  const performance = data.data.performance;
  
  // Check if performance is within acceptable ranges
  if (performance.efficiency.errorRate > 10) {
    console.warn('High error rate detected:', performance.efficiency.errorRate + '%');
    
    // Get failed jobs for analysis
    const failedJobs = await fetch('/api/admin/batch-monitoring?status=failed');
    const failures = await failedJobs.json();
    
    // Analyze common failure patterns
    const errorSummary = failures.data.jobs.reduce((acc, job) => {
      job.errorSummary?.forEach(error => {
        acc[error.error] = (acc[error.error] || 0) + error.count;
      });
      return acc;
    }, {});
    
    console.log('Error patterns:', errorSummary);
  }
}
```

### Cost Savings Analysis

```javascript
async function analyzeCostSavings() {
  const response = await fetch('/api/admin/batch-monitoring?timeRange=30d&includeDetails=true');
  const data = await response.json();
  
  const savings = data.data.summary.costSavings;
  
  return {
    currentSavings: savings.currentPeriod,
    projectedAnnual: savings.projectedMonthly * 12,
    savingsRate: savings.savingsPercentage,
    totalProcessed: data.data.summary.processedRequests,
    averageCostPerRequest: savings.currentPeriod / data.data.summary.processedRequests
  };
}
```

### Retry Failed Jobs

```javascript
async function retryFailedJobs() {
  // Get failed jobs
  const response = await fetch('/api/admin/batch-monitoring?status=failed');
  const data = await response.json();
  
  const retryableJobs = data.data.jobs.filter(job => {
    // Only retry jobs that failed due to temporary issues
    const hasRetryableErrors = job.errorSummary?.some(error => 
      ['rate_limit_exceeded', 'temporary_error', 'timeout'].includes(error.error)
    );
    return hasRetryableErrors;
  });
  
  // Retry jobs individually
  for (const job of retryableJobs) {
    try {
      await fetch(`/api/admin/batch-monitoring/${job.id}/retry`, {
        method: 'POST'
      });
      console.log(`Retried job ${job.id}`);
    } catch (error) {
      console.error(`Failed to retry job ${job.id}:`, error);
    }
  }
}
```

### Real-time Dashboard Updates

```javascript
function useRealtimeBatchMonitoring() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/admin/batch-monitoring?timeRange=1h');
        const result = await response.json();
        setData(result.data);
      } catch (error) {
        console.error('Failed to fetch batch monitoring data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Initial fetch
    fetchData();
    
    // Update every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  return { data, isLoading };
}
```

## Configuration

### Batch Processing Settings

Configure batch processing parameters in environment variables:

```bash
# Batch Processing Configuration
BATCH_PROCESSING_ENABLED="true"
BATCH_CREATE_INTERVAL="*/5 * * * *"          # Create batches every 5 minutes
BATCH_STATUS_CHECK_INTERVAL="*/2 * * * *"    # Check status every 2 minutes
BATCH_RESULT_PROCESSING_INTERVAL="*/1 * * * *" # Process results every minute

# Batch Size and Limits
BATCH_MAX_REQUESTS="1000"                     # Maximum requests per batch
BATCH_TIMEOUT_HOURS="24"                      # Batch timeout in hours
BATCH_MIN_SIZE="10"                           # Minimum batch size

# Monitoring Configuration
BATCH_MONITORING_RETENTION_DAYS="30"          # How long to keep monitoring data
BATCH_ALERT_THRESHOLD_ERROR_RATE="10"         # Alert if error rate exceeds 10%
BATCH_ALERT_THRESHOLD_PROCESSING_TIME="3600"  # Alert if processing takes >1 hour
```

### Dashboard Refresh Settings

```javascript
// Configure dashboard update intervals
const DASHBOARD_CONFIG = {
  refreshInterval: 30000,        // 30 seconds
  alertRefreshInterval: 10000,   // 10 seconds for alerts
  detailRefreshInterval: 60000,  // 1 minute for detailed views
  maxRetries: 3,                 // Maximum retry attempts
  retryDelay: 5000              // Delay between retries
};
```

## Alerts and Notifications

### Automated Alerts

The system automatically generates alerts for:

```javascript
const alertConditions = {
  highErrorRate: {
    threshold: 10, // Error rate > 10%
    severity: 'high',
    notification: 'immediate'
  },
  longProcessingTime: {
    threshold: 3600000, // > 1 hour
    severity: 'medium',
    notification: 'hourly'
  },
  lowThroughput: {
    threshold: 0.5, // < 0.5 jobs per hour
    severity: 'medium',
    notification: 'daily'
  },
  batchFailure: {
    threshold: 1, // Any complete batch failure
    severity: 'critical',
    notification: 'immediate'
  }
};
```

### Custom Alert Configuration

```javascript
// Configure custom alerts through the admin interface
async function configureAlerts(alertConfig) {
  const response = await fetch('/api/admin/batch-monitoring/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      errorRateThreshold: alertConfig.errorRate,
      processingTimeThreshold: alertConfig.processingTime,
      notificationChannels: alertConfig.channels,
      alertSuppression: alertConfig.suppression
    })
  });
  
  return response.json();
}
```

## Troubleshooting

### Common Issues

#### High Error Rates

```javascript
// Investigate high error rates
async function investigateErrors() {
  const response = await fetch('/api/admin/batch-monitoring?status=failed&includeDetails=true');
  const data = await response.json();
  
  // Group errors by type
  const errorAnalysis = data.data.jobs.reduce((acc, job) => {
    job.errorSummary?.forEach(error => {
      if (!acc[error.error]) {
        acc[error.error] = { count: 0, jobs: [] };
      }
      acc[error.error].count += error.count;
      acc[error.error].jobs.push(job.id);
    });
    return acc;
  }, {});
  
  console.log('Error analysis:', errorAnalysis);
  return errorAnalysis;
}
```

#### Slow Processing

```javascript
// Analyze processing bottlenecks
async function analyzePerformance() {
  const response = await fetch('/api/admin/batch-monitoring?timeRange=24h&includeDetails=true');
  const data = await response.json();
  
  const slowJobs = data.data.jobs
    .filter(job => job.processingTimeMs > 3600000) // > 1 hour
    .sort((a, b) => b.processingTimeMs - a.processingTimeMs);
  
  console.log('Slowest jobs:', slowJobs.slice(0, 5));
  
  // Analyze patterns
  const avgByType = slowJobs.reduce((acc, job) => {
    if (!acc[job.jobType]) {
      acc[job.jobType] = { total: 0, count: 0 };
    }
    acc[job.jobType].total += job.processingTimeMs;
    acc[job.jobType].count++;
    return acc;
  }, {});
  
  Object.keys(avgByType).forEach(type => {
    avgByType[type].average = avgByType[type].total / avgByType[type].count;
  });
  
  return avgByType;
}
```

### Performance Optimization

#### Batch Size Optimization

```javascript
// Analyze optimal batch sizes
async function optimizeBatchSizes() {
  const response = await fetch('/api/admin/batch-monitoring?timeRange=7d&includeDetails=true');
  const data = await response.json();
  
  // Group by batch size ranges
  const sizePerformance = data.data.jobs.reduce((acc, job) => {
    const sizeRange = Math.floor(job.requestCount / 50) * 50; // Group by 50s
    if (!acc[sizeRange]) {
      acc[sizeRange] = {
        jobs: 0,
        totalTime: 0,
        totalRequests: 0,
        successRate: 0
      };
    }
    
    acc[sizeRange].jobs++;
    acc[sizeRange].totalTime += job.processingTimeMs;
    acc[sizeRange].totalRequests += job.requestCount;
    acc[sizeRange].successRate += job.completedCount / job.requestCount;
    
    return acc;
  }, {});
  
  // Calculate averages
  Object.keys(sizePerformance).forEach(range => {
    const perf = sizePerformance[range];
    perf.avgTimePerRequest = perf.totalTime / perf.totalRequests;
    perf.avgSuccessRate = perf.successRate / perf.jobs;
  });
  
  return sizePerformance;
}
```

## Integration with Existing Systems

### Security Audit Integration

All batch monitoring activities are logged through the security audit system:

```javascript
// Automatic audit logging for monitoring activities
await securityAuditLogger.logPlatformAdmin(
  'batch_monitoring_access',
  AuditOutcome.SUCCESS,
  context,
  'Admin accessed batch monitoring dashboard'
);
```

### Rate Limiting Integration

Monitoring API endpoints use the existing rate limiting system:

```javascript
// Protected by admin rate limiting
const rateLimitResult = await rateLimiter.check(
  `admin-batch-monitoring:${userId}`,
  60,  // 60 requests
  60 * 1000  // per minute
);
```

## Related Documentation

-   [Batch Processing Optimizations](./batch-processing-optimizations.md)
-   [Security Monitoring](./security-monitoring.md)
-   [Admin Audit Logs API](./admin-audit-logs-api.md)
-   [OpenAI Batch API Integration](../lib/batchProcessor.ts)

The batch monitoring dashboard provides comprehensive visibility into the AI processing pipeline, enabling administrators to optimize performance, monitor costs, and ensure reliable operation of the batch processing system.
