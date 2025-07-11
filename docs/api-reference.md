# LiveDash-Node API Reference

This document provides a comprehensive reference for all API endpoints in the LiveDash-Node application, including authentication, security monitoring, audit logging, and administrative functions.

## Base URL

```
Local Development: http://localhost:3000
Production: https://your-domain.com
```

## Authentication

All API endpoints (except public endpoints) require authentication via NextAuth.js session cookies.

### Authentication Headers

```http
Cookie: next-auth.session-token=<session-token>
```

### CSRF Protection

State-changing endpoints require CSRF tokens:

```http
X-CSRF-Token: <csrf-token>
```

Get CSRF token:
```http
GET /api/csrf-token
```

## API Endpoints Overview

### Public Endpoints
- `POST /api/csp-report` - CSP violation reporting (no auth required)
- `OPTIONS /api/csp-report` - CORS preflight

### Authentication Endpoints
- `POST /api/auth/[...nextauth]` - NextAuth.js authentication
- `GET /api/csrf-token` - Get CSRF token
- `POST /api/register` - User registration
- `POST /api/forgot-password` - Password reset request
- `POST /api/reset-password` - Password reset completion

### Admin Endpoints (ADMIN role required)
- `GET /api/admin/audit-logs` - Retrieve audit logs
- `POST /api/admin/audit-logs/retention` - Manage audit log retention
- `GET /api/admin/batch-monitoring` - Batch processing monitoring
- `POST /api/admin/batch-monitoring/{id}/retry` - Retry failed batch job

### Platform Admin Endpoints (Platform admin only)
- `GET /api/admin/security-monitoring` - Security monitoring metrics
- `POST /api/admin/security-monitoring` - Update security configuration
- `GET /api/admin/security-monitoring/alerts` - Alert management
- `POST /api/admin/security-monitoring/alerts` - Acknowledge alerts
- `GET /api/admin/security-monitoring/export` - Export security data
- `POST /api/admin/security-monitoring/threat-analysis` - Threat analysis

### Security Monitoring Endpoints
- `GET /api/csp-metrics` - CSP violation metrics
- `POST /api/csp-report` - CSP violation reporting

### Dashboard Endpoints
- `GET /api/dashboard/sessions` - Session data
- `GET /api/dashboard/session/{id}` - Individual session details
- `GET /api/dashboard/metrics` - Dashboard metrics
- `GET /api/dashboard/config` - Dashboard configuration

### Platform Management
- `GET /api/platform/companies` - Company management
- `POST /api/platform/companies` - Create company
- `GET /api/platform/companies/{id}` - Company details
- `GET /api/platform/companies/{id}/users` - Company users
- `POST /api/platform/companies/{id}/users` - Add company user

### tRPC Endpoints
- `POST /api/trpc/[trpc]` - tRPC procedure calls

## Detailed Endpoint Documentation

### Admin Audit Logs

#### Get Audit Logs
```http
GET /api/admin/audit-logs
```

**Authorization**: ADMIN role required

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Records per page, max 100 (default: 50)
- `eventType` (string, optional): Filter by event type
- `outcome` (string, optional): Filter by outcome (SUCCESS, FAILURE, BLOCKED, etc.)
- `severity` (string, optional): Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)
- `userId` (string, optional): Filter by user ID
- `startDate` (string, optional): Start date (ISO 8601)
- `endDate` (string, optional): End date (ISO 8601)

**Response**:
```json
{
  "success": true,
  "data": {
    "auditLogs": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "totalCount": 150,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Rate Limit**: Inherits from auth rate limiting

#### Manage Audit Log Retention
```http
POST /api/admin/audit-logs/retention
```

**Authorization**: ADMIN role required

**Request Body**:
```json
{
  "action": "cleanup" | "configure" | "status",
  "retentionDays": 90,
  "dryRun": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "action": "cleanup",
    "recordsAffected": 1250,
    "retentionDays": 90,
    "dryRun": true
  }
}
```

### Security Monitoring

#### Get Security Metrics
```http
GET /api/admin/security-monitoring
```

**Authorization**: Platform admin required

**Query Parameters**:
- `startDate` (string, optional): Start date (ISO 8601)
- `endDate` (string, optional): End date (ISO 8601)
- `companyId` (string, optional): Filter by company
- `severity` (string, optional): Filter by severity

**Response**:
```json
{
  "metrics": {
    "securityScore": 85,
    "threatLevel": "LOW",
    "eventCounts": {...},
    "anomalies": [...]
  },
  "alerts": [...],
  "config": {...},
  "timeRange": {...}
}
```

#### Update Security Configuration
```http
POST /api/admin/security-monitoring
```

**Authorization**: Platform admin required

**Request Body**:
```json
{
  "thresholds": {
    "failedLoginsPerMinute": 5,
    "rateLimitViolationsPerMinute": 10
  },
  "alerting": {
    "enabled": true,
    "channels": ["EMAIL", "WEBHOOK"]
  }
}
```

### CSP Monitoring

#### CSP Violation Reporting
```http
POST /api/csp-report
```

**Authorization**: None (public endpoint)

**Headers**:
- `Content-Type`: `application/csp-report` or `application/json`

**Request Body** (automatic from browser):
```json
{
  "csp-report": {
    "document-uri": "https://example.com/page",
    "violated-directive": "script-src 'self'",
    "blocked-uri": "https://malicious.com/script.js",
    "source-file": "https://example.com/page",
    "line-number": 42
  }
}
```

**Rate Limit**: 10 reports per minute per IP

**Response**: `204 No Content`

#### Get CSP Metrics
```http
GET /api/csp-metrics
```

**Authorization**: Admin role required

**Query Parameters**:
- `timeRange` (string, optional): Time range (1h, 6h, 24h, 7d, 30d)
- `format` (string, optional): Response format (json, csv)
- `groupBy` (string, optional): Group by field (hour, directive, etc.)
- `includeDetails` (boolean, optional): Include violation details

**Response**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalViolations": 45,
      "uniqueViolations": 12,
      "highRiskViolations": 3,
      "bypassAttempts": 1
    },
    "trends": {...},
    "topViolations": [...],
    "riskAnalysis": {...},
    "violations": [...]
  }
}
```

### Batch Monitoring

#### Get Batch Monitoring Data
```http
GET /api/admin/batch-monitoring
```

**Authorization**: ADMIN role required

**Query Parameters**:
- `timeRange` (string, optional): Time range (1h, 6h, 24h, 7d, 30d)
- `status` (string, optional): Filter by status (pending, completed, failed)
- `jobType` (string, optional): Filter by job type
- `includeDetails` (boolean, optional): Include detailed job information
- `page` (number, optional): Page number
- `limit` (number, optional): Records per page

**Response**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalJobs": 156,
      "completedJobs": 142,
      "failedJobs": 8,
      "costSavings": {...}
    },
    "queues": {...},
    "performance": {...},
    "jobs": [...]
  }
}
```

#### Retry Batch Job
```http
POST /api/admin/batch-monitoring/{jobId}/retry
```

**Authorization**: ADMIN role required

**Response**:
```json
{
  "success": true,
  "data": {
    "jobId": "batch-job-123",
    "status": "retrying",
    "message": "Job queued for retry"
  }
}
```

### CSRF Token

#### Get CSRF Token
```http
GET /api/csrf-token
```

**Authorization**: None

**Response**:
```json
{
  "csrfToken": "abc123..."
}
```

**Headers Set**:
- `Set-Cookie`: HTTP-only CSRF token cookie

### Authentication

#### User Registration
```http
POST /api/register
```

**Authorization**: None

**Headers Required**:
- `X-CSRF-Token`: CSRF token

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "companyName": "Acme Corp"
}
```

**Rate Limit**: 3 attempts per hour per IP

**Response**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "userId": "user-123"
}
```

#### Password Reset Request
```http
POST /api/forgot-password
```

**Authorization**: None

**Headers Required**:
- `X-CSRF-Token`: CSRF token

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Rate Limit**: 5 attempts per 15 minutes per IP

**Response**:
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

#### Password Reset Completion
```http
POST /api/reset-password
```

**Authorization**: None

**Headers Required**:
- `X-CSRF-Token`: CSRF token

**Request Body**:
```json
{
  "token": "reset-token-123",
  "password": "NewSecurePassword123!"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {...}
}
```

### Common HTTP Status Codes

| Status | Description | Common Causes |
|--------|-------------|---------------|
| 200 | OK | Successful request |
| 201 | Created | Resource created successfully |
| 204 | No Content | Successful request with no response body |
| 400 | Bad Request | Invalid request parameters or body |
| 401 | Unauthorized | Authentication required or invalid |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists or conflict |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `UNAUTHORIZED` | No valid session | Login required |
| `FORBIDDEN` | Insufficient permissions | Check user role |
| `VALIDATION_ERROR` | Invalid input data | Check request format |
| `RATE_LIMITED` | Too many requests | Wait and retry |
| `CSRF_INVALID` | Invalid CSRF token | Get new token |
| `NOT_FOUND` | Resource not found | Check resource ID |
| `CONFLICT` | Resource conflict | Check existing data |

## Rate Limiting

### Authentication Endpoints
- **Login**: 5 attempts per 15 minutes per IP
- **Registration**: 3 attempts per hour per IP  
- **Password Reset**: 5 attempts per 15 minutes per IP

### Security Endpoints
- **CSP Reports**: 10 reports per minute per IP
- **Admin Endpoints**: 60 requests per minute per user
- **Security Monitoring**: 30 requests per minute per user

### General API
- **Dashboard Endpoints**: 120 requests per minute per user
- **Platform Management**: 60 requests per minute per user

## Security Headers

All API responses include security headers:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: [CSP directives]
```

## CORS Configuration

### Allowed Origins
- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

### Allowed Methods
- `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`

### Allowed Headers
- `Content-Type`, `Authorization`, `X-CSRF-Token`, `X-Requested-With`

## Pagination

### Standard Pagination Format

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalCount": 150,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Pagination Parameters
- `page`: Page number (1-based, default: 1)
- `limit`: Records per page (default: 50, max: 100)

## Filtering and Sorting

### Common Filter Parameters
- `startDate` / `endDate`: Date range filtering (ISO 8601)
- `status`: Status filtering
- `userId` / `companyId`: Entity filtering
- `eventType`: Event type filtering
- `severity`: Severity level filtering

### Sorting Parameters
- `sortBy`: Field to sort by
- `sortOrder`: `asc` or `desc` (default: `desc`)

## Response Caching

### Cache Headers
```http
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

### Cache Strategy
- **Security data**: Never cached
- **Static data**: Browser cache for 5 minutes
- **User data**: No cache for security

## API Versioning

### Current Version
- Version: `v1` (implied, no version prefix required)
- Introduced: January 2025

### Future Versioning
- Breaking changes will introduce new versions
- Format: `/api/v2/endpoint`
- Backward compatibility maintained for 12 months

## SDK and Client Libraries

### JavaScript/TypeScript Client

```javascript
// Initialize client
const client = new LiveDashClient({
  baseURL: 'https://your-domain.com',
  apiKey: 'your-api-key' // For future API key auth
});

// Get audit logs
const auditLogs = await client.admin.getAuditLogs({
  page: 1,
  limit: 50,
  eventType: 'login_attempt'
});

// Get security metrics
const metrics = await client.security.getMetrics({
  timeRange: '24h'
});
```

### tRPC Client

```javascript
import { createTRPCNext } from '@trpc/next';

const trpc = createTRPCNext({
  config() {
    return {
      url: '/api/trpc',
    };
  },
});

// Use tRPC procedures
const { data: user } = trpc.auth.getUser.useQuery();
const updateProfile = trpc.user.updateProfile.useMutation();
```

## Testing

### API Testing Tools

```bash
# Test with curl
curl -X GET "http://localhost:3000/api/admin/audit-logs" \
  -H "Cookie: next-auth.session-token=..." \
  -H "X-CSRF-Token: ..."

# Test with HTTPie
http GET localhost:3000/api/csp-metrics \
  timeRange==24h \
  Cookie:next-auth.session-token=...
```

### Integration Tests

```javascript
// Example test
describe('Admin Audit Logs API', () => {
  test('should return paginated audit logs', async () => {
    const response = await request(app)
      .get('/api/admin/audit-logs?page=1&limit=10')
      .set('Cookie', 'next-auth.session-token=...')
      .expect(200);
      
    expect(response.body.success).toBe(true);
    expect(response.body.data.auditLogs).toHaveLength(10);
    expect(response.body.data.pagination.page).toBe(1);
  });
});
```

## Related Documentation

- [Admin Audit Logs API](./admin-audit-logs-api.md)
- [CSP Metrics API](./csp-metrics-api.md)
- [Security Monitoring](./security-monitoring.md)
- [CSRF Protection](./CSRF_PROTECTION.md)
- [Batch Monitoring Dashboard](./batch-monitoring-dashboard.md)

This API reference provides comprehensive documentation for all endpoints in the LiveDash-Node application. For specific implementation details, refer to the individual documentation files for each feature area.