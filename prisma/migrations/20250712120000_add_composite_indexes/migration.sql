-- Migration: Add Composite Indexes for Performance Optimization
-- Generated at: 2025-07-12 12:00:00 UTC
-- Purpose: Add strategic composite indexes to improve query performance

-- 1. AI Processing Request optimizations
-- Most common query pattern: companyId + processingStatus + requestedAt
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AIProcessingRequest_companyId_processingStatus_requestedAt_idx" 
ON "AIProcessingRequest" ("sessionId", "processingStatus", "requestedAt");

-- Batch processing queries: companyId + batchId + processingStatus
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AIProcessingRequest_session_companyId_processingStatus_idx" 
ON "AIProcessingRequest" ("sessionId") 
INCLUDE ("processingStatus", "batchId", "requestedAt");

-- Cost analysis queries: model + success + requestedAt
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AIProcessingRequest_model_success_requestedAt_idx" 
ON "AIProcessingRequest" ("model", "success", "requestedAt");

-- Batch status tracking: batchId + processingStatus (covering index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AIProcessingRequest_batchId_processingStatus_covering_idx" 
ON "AIProcessingRequest" ("batchId", "processingStatus") 
INCLUDE ("sessionId", "requestedAt", "completedAt");

-- 2. Session optimizations for dashboard queries
-- Time-range session queries with filtering: companyId + startTime + sentiment
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_companyId_startTime_sentiment_covering_idx" 
ON "Session" ("companyId", "startTime", "sentiment") 
INCLUDE ("endTime", "category", "escalated", "messagesSent");

-- Session analytics: companyId + category + sentiment
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_companyId_category_sentiment_idx" 
ON "Session" ("companyId", "category", "sentiment", "startTime");

-- Performance queries: companyId + avgResponseTime + escalated
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_companyId_performance_idx" 
ON "Session" ("companyId", "avgResponseTime", "escalated") 
INCLUDE ("startTime", "messagesSent");

-- Geographic analysis: companyId + country + startTime
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_companyId_country_startTime_idx" 
ON "Session" ("companyId", "country", "startTime") 
INCLUDE ("sentiment", "category");

-- 3. Message optimizations for conversation analysis
-- Message timeline queries: sessionId + timestamp + role (covering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Message_sessionId_timestamp_role_covering_idx" 
ON "Message" ("sessionId", "timestamp", "role") 
INCLUDE ("content");

-- 4. Session Processing Status optimizations
-- Processing pipeline queries: stage + status + startedAt
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SessionProcessingStatus_stage_status_startedAt_idx" 
ON "SessionProcessingStatus" ("stage", "status", "startedAt") 
INCLUDE ("sessionId", "completedAt", "retryCount");

-- Error analysis: status + stage + startedAt for failed processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SessionProcessingStatus_error_analysis_idx" 
ON "SessionProcessingStatus" ("status", "stage") 
WHERE "status" IN ('FAILED', 'RETRY_PENDING') 
INCLUDE ("sessionId", "errorMessage", "retryCount", "startedAt");

-- 5. Security Audit Log optimizations
-- Admin dashboard queries: companyId + eventType + outcome + timestamp
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SecurityAuditLog_companyId_eventType_outcome_timestamp_idx" 
ON "SecurityAuditLog" ("companyId", "eventType", "outcome", "timestamp");

-- Security monitoring: severity + outcome + timestamp (covering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SecurityAuditLog_security_monitoring_idx" 
ON "SecurityAuditLog" ("severity", "outcome", "timestamp") 
INCLUDE ("eventType", "ipAddress", "userId", "companyId");

-- Geographic threat analysis: ipAddress + country + timestamp + outcome
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SecurityAuditLog_geographic_threat_idx" 
ON "SecurityAuditLog" ("ipAddress", "country", "timestamp") 
WHERE "outcome" IN ('FAILURE', 'BLOCKED', 'SUSPICIOUS') 
INCLUDE ("eventType", "severity", "userId", "companyId");

-- User activity tracking: userId + eventType + timestamp
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SecurityAuditLog_user_activity_idx" 
ON "SecurityAuditLog" ("userId", "eventType", "timestamp") 
INCLUDE ("outcome", "severity", "action");

-- 6. Company and User optimizations
-- Multi-tenant queries: status + name for company listings
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Company_status_name_idx" 
ON "Company" ("status", "name") 
INCLUDE ("createdAt", "maxUsers");

-- User management: companyId + role + email
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_companyId_role_email_idx" 
ON "User" ("companyId", "role", "email") 
INCLUDE ("name", "createdAt", "invitedAt");

-- 7. AI Model and Pricing optimizations
-- Active model queries: provider + isActive + name
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AIModel_provider_isActive_name_idx" 
ON "AIModel" ("provider", "isActive", "name") 
INCLUDE ("maxTokens", "createdAt");

-- Pricing lookups: aiModelId + effectiveFrom + effectiveUntil (covering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AIModelPricing_effective_range_covering_idx" 
ON "AIModelPricing" ("aiModelId", "effectiveFrom", "effectiveUntil") 
INCLUDE ("promptTokenCost", "completionTokenCost");

-- 8. Session Import optimizations
-- Import processing: companyId + createdAt (for chronological processing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SessionImport_companyId_createdAt_processing_idx" 
ON "SessionImport" ("companyId", "createdAt") 
WHERE "session" IS NULL  -- Only unprocessed imports
INCLUDE ("externalSessionId", "fullTranscriptUrl");

-- 9. AI Batch Request optimizations
-- Batch monitoring: companyId + status + createdAt
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AIBatchRequest_companyId_status_createdAt_idx" 
ON "AIBatchRequest" ("companyId", "status", "createdAt") 
INCLUDE ("openaiBatchId", "completedAt", "processedAt");

-- 10. Question and Session Question optimizations
-- Question analysis: sessionId + order (for sequential access)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SessionQuestion_sessionId_order_covering_idx" 
ON "SessionQuestion" ("sessionId", "order") 
INCLUDE ("questionId", "createdAt");

-- ANALYZE tables to update statistics after index creation
ANALYZE "AIProcessingRequest";
ANALYZE "Session";
ANALYZE "Message";
ANALYZE "SessionProcessingStatus";
ANALYZE "SecurityAuditLog";
ANALYZE "Company";
ANALYZE "User";
ANALYZE "AIModel";
ANALYZE "AIModelPricing";
ANALYZE "SessionImport";
ANALYZE "AIBatchRequest";
ANALYZE "SessionQuestion";