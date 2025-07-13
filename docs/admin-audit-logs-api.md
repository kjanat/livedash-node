# Admin Audit Logs API

This document describes the Admin Audit Logs API endpoints for retrieving and managing security audit logs in the LiveDash application.

## Overview

The Admin Audit Logs API provides secure access to security audit trails for administrative users. It includes comprehensive filtering, pagination, and retention management capabilities.

## Authentication & Authorization

- **Authentication**: NextAuth.js session required
- **Authorization**: ADMIN role required for all endpoints
- **Rate-Limiting**: Integrated with existing authentication rate-limiting system
- **Audit Trail**: All API access is logged for security monitoring

## API Endpoints

### Get Audit Logs

Retrieve paginated audit logs with optional filtering.

```http
GET /api/admin/audit-logs
```

#### Query Parameters

| Parameter   | Type   | Description                 | Default | Example                           |
| ----------- | ------ | --------------------------- | ------- | --------------------------------- |
| `page`      | number | Page number (1-based)       | 1       | `?page=2`                         |
| `limit`     | number | Records per page (max 100)  | 50      | `?limit=25`                       |
| `eventType` | string | Filter by event type        | -       | `?eventType=login_attempt`        |
| `outcome`   | string | Filter by outcome           | -       | `?outcome=FAILURE`                |
| `severity`  | string | Filter by severity level    | -       | `?severity=HIGH`                  |
| `userId`    | string | Filter by specific user ID  | -       | `?userId=user-123`                |
| `startDate` | string | Filter from date (ISO 8601) | -       | `?startDate=2024-01-01T00:00:00Z` |
| `endDate`   | string | Filter to date (ISO 8601)   | -       | `?endDate=2024-01-02T00:00:00Z`   |

#### Example Request

```javascript
const response = await fetch(
  "/api/admin/audit-logs?" +
    new URLSearchParams({
      page: "1",
      limit: "25",
      eventType: "login_attempt",
      outcome: "FAILURE",
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2024-01-02T00:00:00Z",
    })
);

const data = await response.json();
```

#### Response Format

```json
{
  "success": true,
  "data": {
    "auditLogs": [
      {
        "id": "log-123",
        "eventType": "login_attempt",
        "outcome": "FAILURE",
        "severity": "HIGH",
        "userId": "user-456",
        "companyId": "company-789",
        "ipAddress": "192.168.1.***",
        "userAgent": "Mozilla/5.0 (masked)",
        "timestamp": "2024-01-01T12:00:00Z",
        "description": "Failed login attempt",
        "metadata": {
          "error": "invalid_password",
          "endpoint": "/api/auth/signin"
        },
        "user": {
          "id": "user-456",
          "email": "user@example.com",
          "name": "John Doe",
          "role": "USER"
        },
        "platformUser": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 25,
      "totalCount": 150,
      "totalPages": 6,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

#### Error Responses

**Unauthorized (401)**

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**Insufficient permissions (403)**

```json
{
  "success": false,
  "error": "Insufficient permissions"
}
```

**Server error (500)**

```json
{
  "success": false,
  "error": "Internal server error"
}
```

### Audit Log Retention Management

Manage audit log retention policies and cleanup.

```http
POST /api/admin/audit-logs/retention
```

#### Request Body

```json
{
  "action": "cleanup",
  "retentionDays": 90,
  "dryRun": true
}
```

<!-- prettier-ignore -->
**Note**: `action` field accepts one of: `"cleanup"`, `"configure"`, or `"status"`

#### Parameters

| Parameter       | Type    | Required | Description                                            |
| --------------- | ------- | -------- | ------------------------------------------------------ |
| `action`        | string  | Yes      | Action to perform: `cleanup`, `configure`, or `status` |
| `retentionDays` | number  | No       | Retention period in days (for configure action)        |
| `dryRun`        | boolean | No       | Preview changes without executing (for cleanup)        |

#### Example Requests

**Check retention status:**

```javascript
const response = await fetch("/api/admin/audit-logs/retention", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "status" }),
});
```

**Configure retention policy:**

```javascript
const response = await fetch("/api/admin/audit-logs/retention", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "configure",
    retentionDays: 365,
  }),
});
```

**Cleanup old logs (dry run):**

```javascript
const response = await fetch("/api/admin/audit-logs/retention", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "cleanup",
    dryRun: true,
  }),
});
```

## Security Features

### Access Control

- **Role-based Access**: Only ADMIN users can access audit logs
- **Company Isolation**: Users only see logs for their company
- **Session Validation**: Active NextAuth session required

### Audit Trail

- **Access Logging**: All audit log access is recorded
- **Metadata Tracking**: Request parameters and results are logged
- **IP Tracking**: Client IP addresses are recorded for all requests

### Rate Limiting

- **Integrated Protection**: Uses existing authentication rate-limiting
- **Abuse Prevention**: Protects against excessive API usage
- **Error Tracking**: Failed attempts are monitored

## Event Types

Common event types available for filtering:

| Event Type                | Description                |
| ------------------------- | -------------------------- |
| `login_attempt`           | User login attempts        |
| `login_success`           | Successful logins          |
| `logout`                  | User logouts               |
| `password_reset_request`  | Password reset requests    |
| `password_reset_complete` | Password reset completions |
| `user_creation`           | New user registrations     |
| `user_modification`       | User profile changes       |
| `admin_action`            | Administrative actions     |
| `data_export`             | Data export activities     |
| `security_violation`      | Security policy violations |

## Outcome Types

| Outcome        | Description                              |
| -------------- | ---------------------------------------- |
| `SUCCESS`      | Operation completed successfully         |
| `FAILURE`      | Operation failed                         |
| `BLOCKED`      | Operation was blocked by security policy |
| `WARNING`      | Operation completed with warnings        |
| `RATE_LIMITED` | Operation was rate limited               |

## Severity Levels

| Severity   | Description              | Use Case                  |
| ---------- | ------------------------ | ------------------------- |
| `LOW`      | Informational events     | Normal operations         |
| `MEDIUM`   | Notable events           | Configuration changes     |
| `HIGH`     | Security events          | Failed logins, violations |
| `CRITICAL` | Critical security events | Breaches, attacks         |

## Usage Examples

### Daily Security Report

```javascript
async function getDailySecurityReport() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const response = await fetch(
    "/api/admin/audit-logs?" +
      new URLSearchParams({
        startDate: yesterday.toISOString(),
        endDate: today.toISOString(),
        limit: "100",
      })
  );

  const data = await response.json();
  return data.data.auditLogs;
}
```

### Failed Login Analysis

```javascript
async function getFailedLogins(hours = 24) {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  const response = await fetch(
    "/api/admin/audit-logs?" +
      new URLSearchParams({
        eventType: "login_attempt",
        outcome: "FAILURE",
        startDate: since.toISOString(),
        limit: "100",
      })
  );

  const data = await response.json();
  return data.data.auditLogs;
}
```

### User Activity Tracking

```javascript
async function getUserActivity(userId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const response = await fetch(
    "/api/admin/audit-logs?" +
      new URLSearchParams({
        userId: userId,
        startDate: since.toISOString(),
        limit: "50",
      })
  );

  const data = await response.json();
  return data.data.auditLogs;
}
```

## Performance Considerations

### Database Optimization

- **Indexed Queries**: All filter columns are properly indexed
- **Pagination**: Efficient offset-based pagination with limits
- **Time Range Filtering**: Optimized for date range queries

### Memory Usage

- **Limited Results**: Maximum 100 records per request
- **Streaming**: Large exports use streaming for memory efficiency
- **Connection Pooling**: Database connections are pooled

### Caching Considerations

- **No Caching**: Audit logs are never cached for security reasons
- **Fresh Data**: All queries hit the database for real-time results
- **Read Replicas**: Consider using read replicas for heavy reporting

## Error Handling

### Common Errors

```javascript
try {
  const response = await fetch("/api/admin/audit-logs");
  const data = await response.json();

  if (!data.success) {
    switch (response.status) {
      case 401:
        console.error("User not authenticated");
        break;
      case 403:
        console.error("User lacks admin permissions");
        break;
      case 500:
        console.error("Server error:", data.error);
        break;
    }
  }
} catch (error) {
  console.error("Network error:", error);
}
```

### Rate-Limiting Handling

```javascript
async function fetchWithRetry(url, options = {}, maxRetries = 3, retryCount = 0) {
  const response = await fetch(url, options);

  if (response.status === 429 && retryCount < maxRetries) {
    // Rate limited, wait with exponential backoff and retry
    const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchWithRetry(url, options, maxRetries, retryCount + 1);
  }

  if (response.status === 429) {
    throw new Error(`Rate limited after ${maxRetries} retries`);
  }

  return response;
}
```

## Monitoring and Alerting

### Key Metrics to Monitor

- **Request Volume**: Track API usage patterns
- **Error Rates**: Monitor authentication and authorization failures
- **Query Performance**: Track slow queries and optimize
- **Data Growth**: Monitor audit log size and plan retention

### Alert Conditions

- **High Error Rates**: >5% of requests failing
- **Unusual Access Patterns**: Off-hours access, high-volume usage
- **Performance Degradation**: Query times >2 seconds
- **Security Events**: Multiple failed admin access attempts

## Best Practices

### Security

- Always validate user permissions before displaying UI
- Log all administrative access to audit logs
- Use HTTPS in production environments
- Implement proper error handling to avoid information leakage

### Performance

- Use appropriate page sizes (25-50 records typical)
- Implement client-side pagination for better UX
- Cache results only in memory, never persist
- Use date range filters to limit query scope

### User Experience

- Provide clear filtering options in the UI
- Show loading states for long-running queries
- Implement export functionality for reports
- Provide search and sort capabilities

## Related Documentation

- [Security Audit Logging](./security-audit-logging.md)
- [Security Monitoring](./security-monitoring.md)
- [CSRF Protection](./CSRF_PROTECTION.md)
- [Authentication System](../lib/auth.ts)
