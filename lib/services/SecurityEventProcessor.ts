import { SECURITY_MONITORING, TIME } from "../constants";
import {
  type AuditLogContext,
  type AuditOutcome,
  AuditSeverity,
  type SecurityEventType,
} from "../securityAuditLogger";
import { BoundedBuffer } from "../utils/BoundedBuffer";

export interface SecurityEventData {
  timestamp: Date;
  eventType: SecurityEventType;
  context: AuditLogContext;
  outcome: AuditOutcome;
  severity: AuditSeverity;
}

/**
 * Handles security event processing and buffering
 * Single Responsibility: Event collection and storage
 */
export class SecurityEventProcessor {
  private eventBuffer: BoundedBuffer<SecurityEventData>;

  constructor() {
    this.eventBuffer = new BoundedBuffer<SecurityEventData>({
      maxSize: SECURITY_MONITORING.EVENT_BUFFER_MAX_SIZE,
      retentionTime: SECURITY_MONITORING.EVENT_RETENTION_HOURS * TIME.HOUR,
      cleanupThreshold: 0.9,
    });
  }

  /**
   * Add security event to buffer
   */
  addEvent(
    eventType: SecurityEventType,
    outcome: AuditOutcome,
    context: AuditLogContext,
    severity: AuditSeverity = AuditSeverity.INFO
  ): void {
    this.eventBuffer.push({
      timestamp: new Date(),
      eventType,
      context,
      outcome,
      severity,
    });
  }

  /**
   * Get events within time range
   */
  getEventsWithinTime(timeRangeMs: number): SecurityEventData[] {
    return this.eventBuffer.getWithinTime(timeRangeMs);
  }

  /**
   * Get recent events for analysis
   */
  getRecentEvents(): SecurityEventData[] {
    return this.eventBuffer.getWithinTime(
      SECURITY_MONITORING.THREAT_DETECTION_WINDOW
    );
  }

  /**
   * Manual cleanup of old events
   */
  cleanup(): void {
    this.eventBuffer.cleanup();
  }

  /**
   * Get current buffer statistics
   */
  getStats(): {
    bufferSize: number;
    eventsCount: number;
  } {
    const recentEvents = this.getRecentEvents();
    return {
      bufferSize: SECURITY_MONITORING.EVENT_BUFFER_MAX_SIZE,
      eventsCount: recentEvents.length,
    };
  }
}
