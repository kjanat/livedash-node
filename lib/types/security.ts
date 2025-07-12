/**
 * Security-related type definitions
 */

export interface SecurityEvent {
  id: string;
  type: string;
  timestamp: Date;
  severity: ThreatLevel;
  source: string;
  metadata?: Record<string, unknown>;
}

export enum ThreatLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  level: ThreatLevel;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, unknown>;
}