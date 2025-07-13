# Security Audit Logging System

This document provides an overview of the comprehensive security audit logging system implemented in LiveDash.

## Overview

The security audit logging system provides comprehensive tracking of security-critical events, authentication activities, and administrative actions across the platform. It is designed for compliance, incident investigation, and security monitoring.

## Features

### 1. Comprehensive Event Tracking

The system logs the following event types:

-   **Authentication Events**: Login attempts, password changes, session management
-   **Authorization Events**: Permission checks, access denied events
-   **User Management**: User creation, modification, deletion, invitations
-   **Company Management**: Company suspension, settings changes
-   **Rate Limiting**: Abuse prevention and rate limit violations
-   **CSRF Protection**: Cross-site request forgery protection events
-   **Security Headers**: Security header violations
-   **Password Reset**: Password reset flows and token validation
-   **Platform Admin**: Administrative activities by platform users
-   **Data Privacy**: Data export and privacy-related events
-   **System Configuration**: System setting changes
-   **API Security**: API-related security events

### 2. Structured Logging

Each audit log entry includes:

-   **Event Type**: Categorizes the security event
-   **Action**: Specific action performed
-   **Outcome**: Success, failure, blocked, rate limited, or suspicious
-   **Severity**: Info, low, medium, high, or critical
-   **Context**: User ID, company ID, platform user ID, IP address, user agent
-   **Metadata**: Structured additional information
-   **Timestamp**: Immutable timestamp for chronological ordering

### 3. Multi-Tenant Security

-   Company-scoped audit logs ensure data isolation
-   Platform admin actions tracked separately
-   Role-based access controls for audit log viewing

### 4. Log Retention and Management

-   **Configurable Retention Policies**: Different retention periods based on event type and severity
-   **Automatic Archival**: Critical and high-severity events archived before deletion
-   **Scheduled Cleanup**: Weekly automated retention policy execution
-   **Manual Controls**: Admin interface for manual retention execution

### 5. Administrative Interface

-   **Audit Log Viewer**: Comprehensive filtering and search capabilities
-   **Retention Management**: View statistics and execute retention policies
-   **Real-time Monitoring**: Track security events as they occur

## Architecture

### Core Components

1.  **SecurityAuditLogger** (`lib/securityAuditLogger.ts`): Centralized logging service
2.  **AuditLogRetentionManager** (`lib/auditLogRetention.ts`): Retention policy management
3.  **AuditLogScheduler** (`lib/auditLogScheduler.ts`): Scheduled retention execution
4.  **Admin API** (`app/api/admin/audit-logs/`): REST API for audit log access
5.  **Admin UI** (`app/dashboard/audit-logs/`): Administrative interface

### Database Schema

The `SecurityAuditLog` model includes:

```prisma
model SecurityAuditLog {
  id              String             @id @default(uuid())
  eventType       SecurityEventType
  action          String             @db.VarChar(255)
  outcome         AuditOutcome
  severity        AuditSeverity      @default(INFO)
  userId          String?
  companyId       String?
  platformUserId  String?
  ipAddress       String?            @db.Inet
  userAgent       String?
  country         String?            @db.VarChar(3)
  metadata        Json?
  errorMessage    String?
  sessionId       String?            @db.VarChar(255)
  requestId       String?            @db.VarChar(255)
  timestamp       DateTime           @default(now()) @db.Timestamptz(6)

  // Relations and indexes...
}
```

## Usage

### Logging Security Events

```typescript
import { securityAuditLogger, AuditOutcome } from "./lib/securityAuditLogger";

// Log authentication event
await securityAuditLogger.logAuthentication("user_login_success", AuditOutcome.SUCCESS, {
  userId: "user-123",
  companyId: "company-456",
  ipAddress: "192.168.1.***",
  userAgent: "Mozilla/5.0 (masked)",
  metadata: { loginMethod: "password" },
});

// Log authorization failure
await securityAuditLogger.logAuthorization(
  "admin_access_denied",
  AuditOutcome.BLOCKED,
  {
    userId: "user-123",
    companyId: "company-456",
    metadata: { requiredRole: "ADMIN", currentRole: "USER" },
  },
  "Insufficient permissions for admin access"
);
```

### Viewing Audit Logs

Administrators can access audit logs through:

1.  **Dashboard UI**: Navigate to "Audit Logs" in the sidebar
2.  **API Access**: GET `/api/admin/audit-logs` with filtering parameters
3.  **Retention Management**: GET/POST `/api/admin/audit-logs/retention`

### Filtering Options

-   Event type (authentication, authorization, etc.)
-   Outcome (success, failure, blocked, etc.)
-   Severity level (info, low, medium, high, critical)
-   Date range
-   User ID
-   Pagination support

## Configuration

### Environment Variables

```bash
# Enable/disable audit logging (default: true)
AUDIT_LOGGING_ENABLED=true

# Enable/disable retention scheduler (default: true)
AUDIT_LOG_RETENTION_ENABLED=true

# Retention schedule (cron format, default: 2 AM every Sunday)
AUDIT_LOG_RETENTION_SCHEDULE="0 2 * * 0"

# Dry run mode for retention (default: false)
AUDIT_LOG_RETENTION_DRY_RUN=false
```

### Default Retention Policies

1.  **Critical Events**: 7 years retention with archival
2.  **High Severity Events**: 3 years retention with archival
3.  **Authentication Events**: 2 years retention with archival
4.  **Platform Admin Events**: 3 years retention with archival
5.  **User Management Events**: 2 years retention with archival
6.  **General Events**: 1 year retention without archival

## Security Considerations

### Data Protection

-   **IP Address Storage**: Client IP addresses stored for geographic analysis
-   **Sensitive Data Redaction**: Passwords, tokens, and emails marked as `[REDACTED]`
-   **Metadata Sanitization**: Complex objects sanitized to prevent data leakage

### Access Controls

-   **Admin-Only Access**: Only users with `ADMIN` role can view audit logs
-   **Company Isolation**: Users can only view logs for their own company
-   **Platform Separation**: Platform admin logs tracked separately

### Performance

-   **Async Logging**: All logging operations are asynchronous to avoid blocking
-   **Error Handling**: Logging failures don't affect application functionality
-   **Indexed Queries**: Database indexes optimize common query patterns
-   **Batch Operations**: Retention policies use batch operations for efficiency

## Compliance Features

### Audit Standards

-   **Immutable Records**: Audit logs cannot be modified after creation
-   **Chronological Ordering**: Precise timestamps for event sequencing
-   **Non-Repudiation**: User actions clearly attributed and timestamped
-   **Comprehensive Coverage**: All security-relevant events logged

### Reporting

-   **Event Statistics**: Summary statistics by event type, severity, and time period
-   **Export Capabilities**: Structured data export for compliance reporting
-   **Retention Tracking**: Detailed logging of retention policy execution

## Monitoring and Alerting

### System Health

-   **Scheduler Status**: Monitor retention scheduler health
-   **Error Tracking**: Log retention and audit logging errors
-   **Performance Metrics**: Track logging performance and database impact

### Security Monitoring

-   **Failed Authentication Patterns**: Track repeated login failures
-   **Privilege Escalation**: Monitor administrative action patterns
-   **Suspicious Activity**: Identify unusual access patterns

## Troubleshooting

### Common Issues

1.  **Audit Logging Disabled**: Check `AUDIT_LOGGING_ENABLED` environment variable
2.  **Retention Not Running**: Verify `AUDIT_LOG_RETENTION_ENABLED` and scheduler status
3.  **Access Denied**: Ensure user has `ADMIN` role for audit log access
4.  **Performance Issues**: Review retention policies and database indexes

### Debug Information

-   Check application logs for scheduler startup messages
-   Monitor database query performance for audit log operations
-   Review retention policy validation warnings

## Best Practices

### Implementation

1.  **Always use the centralized logger**: Don't bypass the `securityAuditLogger`
2.  **Include relevant context**: Provide user, company, and IP information
3.  **Use appropriate severity levels**: Follow the severity assignment guidelines
4.  **Sanitize sensitive data**: Use `createAuditMetadata()` for safe metadata

### Operations

1.  **Regular retention review**: Monitor retention statistics and adjust policies
2.  **Archive critical data**: Ensure important logs are archived before deletion
3.  **Monitor storage usage**: Track audit log database growth
4.  **Test restoration**: Verify archived data can be restored when needed

## Future Enhancements

### Planned Features

-   **Real-time Alerting**: Immediate notifications for critical security events
-   **Advanced Analytics**: ML-based anomaly detection and pattern recognition
-   **Export Formats**: Additional export formats for compliance reporting
-   **External Integration**: SIEM and security tool integrations

### Performance Optimizations

-   **Log Partitioning**: Database partitioning for improved query performance
-   **Compression**: Log compression for storage efficiency
-   **Streaming**: Real-time log streaming for external systems
