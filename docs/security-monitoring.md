# Security Monitoring and Alerting System

## Overview

The Security Monitoring and Alerting System provides comprehensive real-time security monitoring, anomaly detection, and threat alerting for the LiveDash-Node application. It integrates with the existing audit logging system to provide proactive security monitoring and incident response capabilities.

## Architecture

### Core Components

1.  **Security Monitoring Service** (`lib/securityMonitoring.ts`)

- Real-time event processing
- Anomaly detection algorithms
- Alert generation and management
- Security score calculation
- Threat level assessment

2.  **Enhanced Security Logging** (`enhancedSecurityLog`)

- Integrates with existing audit logger
- Processes events through monitoring system
- Triggers immediate threat detection

3.  **API Endpoints** (`app/api/admin/security-monitoring/`)

- `/api/admin/security-monitoring` - Main metrics and configuration
- `/api/admin/security-monitoring/alerts` - Alert management
- `/api/admin/security-monitoring/export` - Data export
- `/api/admin/security-monitoring/threat-analysis` - Threat analysis

4.  **Dashboard UI** (`app/platform/security/page.tsx`)

- Real-time security metrics
- Active alerts management
- Threat analysis visualization
- Configuration management

## Features

### Real-time Monitoring

- **Authentication Events**: Login attempts, failures, brute force attacks
- **Rate Limiting**: Excessive request patterns, API abuse
- **Admin Activity**: Unusual administrative actions
- **Geographic Anomalies**: Logins from unusual locations
- **Temporal Anomalies**: Activity spikes outside normal patterns

### Alert Types

```typescript
enum AlertType {
  AUTHENTICATION_ANOMALY = "AUTHENTICATION_ANOMALY",
  RATE_LIMIT_BREACH = "RATE_LIMIT_BREACH",
  MULTIPLE_FAILED_LOGINS = "MULTIPLE_FAILED_LOGINS",
  SUSPICIOUS_IP_ACTIVITY = "SUSPICIOUS_IP_ACTIVITY",
  PRIVILEGE_ESCALATION = "PRIVILEGE_ESCALATION",
  DATA_BREACH_ATTEMPT = "DATA_BREACH_ATTEMPT",
  CSRF_ATTACK = "CSRF_ATTACK",
  CSP_VIOLATION_SPIKE = "CSP_VIOLATION_SPIKE",
  ACCOUNT_ENUMERATION = "ACCOUNT_ENUMERATION",
  BRUTE_FORCE_ATTACK = "BRUTE_FORCE_ATTACK",
  UNUSUAL_ADMIN_ACTIVITY = "UNUSUAL_ADMIN_ACTIVITY",
  GEOLOCATION_ANOMALY = "GEOLOCATION_ANOMALY",
  MASS_DATA_ACCESS = "MASS_DATA_ACCESS",
  SUSPICIOUS_USER_AGENT = "SUSPICIOUS_USER_AGENT",
  SESSION_HIJACKING = "SESSION_HIJACKING",
}
```

### Anomaly Detection

The system implements several anomaly detection algorithms:

1.  **Geographic Anomaly Detection**

- Detects logins from unusual countries
- Compares against historical user patterns
- Confidence scoring based on deviation

2.  **Temporal Anomaly Detection**

- Identifies activity spikes during unusual hours
- Compares current activity to historical averages
- Configurable thresholds for different event types

3.  **Behavioral Anomaly Detection**

- Multiple failed login attempts
- Rapid succession of actions
- Pattern deviation analysis

### Security Scoring

The system calculates a real-time security score (0-100) based on:

- Critical security events (weight: 25)
- Active unresolved alerts (weight: 30)
- High-severity threats (weight: 20)
- Overall event volume (weight: 15)
- System stability factors (weight: 10)

### Threat Levels

```typescript
enum ThreatLevel {
  LOW = "LOW", // Score: 85-100
  MODERATE = "MODERATE", // Score: 70-84
  HIGH = "HIGH", // Score: 50-69
  CRITICAL = "CRITICAL", // Score: 0-49
}
```

## Configuration

### Default Thresholds

```typescript
const defaultThresholds = {
  failedLoginsPerMinute: 5,
  failedLoginsPerHour: 20,
  rateLimitViolationsPerMinute: 10,
  cspViolationsPerMinute: 15,
  adminActionsPerHour: 25,
  massDataAccessThreshold: 100,
  suspiciousIPThreshold: 10,
};
```

### Alerting Configuration

```typescript
const alertingConfig = {
  enabled: true,
  channels: ["EMAIL", "WEBHOOK", "SLACK", "DISCORD", "PAGERDUTY"],
  suppressDuplicateMinutes: 10,
  escalationTimeoutMinutes: 60,
};
```

### Data Retention

```typescript
const retentionConfig = {
  alertRetentionDays: 90,
  metricsRetentionDays: 365,
};
```

## API Usage

### Get Security Metrics

```javascript
const response = await fetch(
  "/api/admin/security-monitoring?startDate=2024-01-01T00:00:00Z&endDate=2024-01-02T00:00:00Z"
);
const data = await response.json();

console.log(data.metrics.securityScore); // 0-100
console.log(data.metrics.threatLevel); // LOW, MODERATE, HIGH, CRITICAL
console.log(data.alerts); // Active alerts array
```

### Acknowledge Alert

```javascript
await fetch("/api/admin/security-monitoring/alerts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    alertId: "alert-123",
    action: "acknowledge",
  }),
});
```

### Export Security Data

```javascript
// Export alerts as CSV
const response = await fetch(
  "/api/admin/security-monitoring/export?format=csv&type=alerts&startDate=2024-01-01T00:00:00Z&endDate=2024-01-02T00:00:00Z"
);
const csvData = await response.text();

// Export metrics as JSON
const response = await fetch(
  "/api/admin/security-monitoring/export?format=json&type=metrics&startDate=2024-01-01T00:00:00Z&endDate=2024-01-02T00:00:00Z"
);
const jsonData = await response.json();
```

### Perform Threat Analysis

```javascript
const analysis = await fetch("/api/admin/security-monitoring/threat-analysis", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ipAddress: "192.168.1.***",
    timeRange: {
      start: "2024-01-01T00:00:00Z",
      end: "2024-01-02T00:00:00Z",
    },
  }),
});

const data = await analysis.json();
console.log(data.ipThreatAnalysis.threatLevel);
console.log(data.ipThreatAnalysis.riskFactors);
console.log(data.ipThreatAnalysis.recommendations);
```

## Integration with Existing Systems

### Enhanced Security Logging

Replace existing `securityAuditLogger.log()` calls with `enhancedSecurityLog()`:

```typescript
// Before
await securityAuditLogger.logAuthentication(
  "login_attempt",
  AuditOutcome.FAILURE,
  context,
  "Invalid password"
);

// After
await enhancedSecurityLog(
  SecurityEventType.AUTHENTICATION,
  "login_attempt",
  AuditOutcome.FAILURE,
  context,
  AuditSeverity.HIGH,
  "Invalid password",
  {
    attemptType: "invalid_password",
    endpoint: "/api/auth/signin",
  }
);
```

### Rate Limiting Integration

The system automatically integrates with existing rate limiting middleware:

```typescript
// middleware/authRateLimit.ts
await enhancedSecurityLog(
  SecurityEventType.RATE_LIMITING,
  "auth_rate_limit_exceeded",
  AuditOutcome.RATE_LIMITED,
  context,
  AuditSeverity.HIGH,
  "Authentication rate limit exceeded"
);
```

## Dashboard Features

### Security Overview

- Real-time security score (0-100)
- Current threat level indicator
- Active alerts count
- Security events summary

### Alert Management

- View active and historical alerts
- Filter by severity and type
- Acknowledge alerts with tracking
- Detailed alert context and metadata

### Threat Analysis

- Geographic distribution of events
- Top threat types and patterns
- User risk scoring
- IP threat level analysis

### Configuration Management

- Adjust detection thresholds
- Configure alerting channels
- Set data retention policies
- Export capabilities

## Performance Considerations

### Memory Management

- Event buffer limited to 1 hour of data
- Automatic cleanup of old alerts (configurable)
- Efficient in-memory storage for real-time analysis

### Database Impact

- Leverages existing audit log indexes
- Optimized queries for time-range filtering
- Background processing to avoid blocking operations

### Scalability

- Stateless architecture (except for buffering)
- Horizontal scaling support
- Configurable processing intervals

## Security Considerations

### Access Control

- Platform admin authentication required
- Role-based access to security endpoints
- Audit logging of all monitoring activities

### Data Privacy

- Sensitive data redaction in logs
- IP address anonymization options
- Configurable data retention periods

### Alert Suppression

- Duplicate alert suppression (configurable window)
- Rate limiting on alert generation
- Escalation policies for critical threats

## Monitoring and Maintenance

### Health Checks

- Monitor service availability
- Check alert generation pipeline
- Verify data export functionality

### Regular Tasks

- Review and adjust thresholds quarterly
- Analyze false positive rates
- Update threat detection patterns
- Clean up old alert data

### Performance Metrics

- Alert response time
- False positive/negative rates
- System resource usage
- User engagement with alerts

## Future Enhancements

### Planned Features

1.  **Machine Learning Integration**

- Behavioral pattern recognition
- Adaptive threshold adjustment
- Predictive threat modeling

2.  **Advanced Analytics**

- Threat intelligence integration
- Cross-correlation analysis
- Risk trend analysis

3.  **Integration Enhancements**

- SIEM system connectors
- Webhook customization
- Mobile app notifications

4.  **Automated Response**

- IP blocking automation
- Account suspension workflows
- Incident response orchestration

## Troubleshooting

### Common Issues

**High False Positive Rate**

- Review and adjust detection thresholds
- Analyze user behavior patterns
- Consider geographical variations

**Missing Alerts**

- Check service configuration
- Verify audit log integration
- Review threshold settings

**Performance Issues**

- Monitor memory usage
- Adjust cleanup intervals
- Optimize database queries

**Export Failures**

- Check file permissions
- Verify date range validity
- Monitor server resources

### Debugging

Enable debug logging:

```typescript
securityMonitoring.updateConfig({
  alerting: {
    enabled: true,
    debugMode: true,
  },
});
```

Check alert generation:

```typescript
const alerts = securityMonitoring.getActiveAlerts();
console.log("Active alerts:", alerts.length);
```

## Testing

### Unit Tests

- Alert generation logic
- Anomaly detection algorithms
- Configuration management
- Data export functionality

### Integration Tests

- API endpoint security
- Database integration
- Real-time event processing
- Alert acknowledgment flow

### Load Testing

- High-volume event processing
- Concurrent alert generation
- Database performance under load
- Memory usage patterns

Run tests:

```bash
pnpm test tests/unit/security-monitoring.test.ts
pnpm test tests/integration/security-monitoring-api.test.ts
```
