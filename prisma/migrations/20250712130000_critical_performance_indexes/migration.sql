-- Critical Performance Indexes Migration
-- Addresses scalability bottlenecks identified in architectural analysis
-- All indexes created with CONCURRENTLY for production safety

-- =====================================================
-- 1. Security Monitoring Performance Indexes
-- =====================================================

-- Security audit log analysis with covering columns
CREATE INDEX CONCURRENTLY "SecurityAuditLog_companyId_eventType_outcome_timestamp_idx" 
ON "SecurityAuditLog" ("companyId", "eventType", "outcome", "timestamp") 
INCLUDE ("severity", "userId", "ipAddress", "country");

-- Geographic threat detection (partial index for efficiency)
CREATE INDEX CONCURRENTLY "SecurityAuditLog_geographic_threat_idx" 
ON "SecurityAuditLog" ("ipAddress", "country", "timestamp") 
WHERE "outcome" IN ('FAILURE', 'BLOCKED', 'SUSPICIOUS') 
INCLUDE ("eventType", "severity", "userId", "companyId");

-- Time-based audit analysis for compliance reporting
CREATE INDEX CONCURRENTLY "SecurityAuditLog_timestamp_companyId_covering_idx" 
ON "SecurityAuditLog" ("timestamp", "companyId") 
INCLUDE ("eventType", "outcome", "severity", "userId");

-- =====================================================
-- 2. AI Processing Request Optimizations
-- =====================================================

-- Session-based AI processing queries with covering columns
CREATE INDEX CONCURRENTLY "AIProcessingRequest_sessionId_processingStatus_requestedAt_idx" 
ON "AIProcessingRequest" ("sessionId", "processingStatus", "requestedAt");

-- Covering index for batch processing efficiency
CREATE INDEX CONCURRENTLY "AIProcessingRequest_session_companyId_processingStatus_idx" 
ON "AIProcessingRequest" ("sessionId") 
INCLUDE ("processingStatus", "batchId", "requestedAt");

-- Batch status monitoring and cost analysis
CREATE INDEX CONCURRENTLY "AIProcessingRequest_batchId_processingStatus_idx" 
ON "AIProcessingRequest" ("batchId", "processingStatus") 
WHERE "batchId" IS NOT NULL 
INCLUDE ("requestedAt", "completedAt", "tokensUsed", "cost");

-- Processing status tracking for schedulers
CREATE INDEX CONCURRENTLY "AIProcessingRequest_processingStatus_requestedAt_idx" 
ON "AIProcessingRequest" ("processingStatus", "requestedAt") 
WHERE "processingStatus" IN ('PENDING', 'PROCESSING', 'RETRY_PENDING') 
INCLUDE ("sessionId", "batchId", "retryCount");

-- =====================================================
-- 3. Session Analytics Optimizations
-- =====================================================

-- Time-range queries with sentiment filtering for dashboards
CREATE INDEX CONCURRENTLY "Session_companyId_startTime_sentiment_covering_idx" 
ON "Session" ("companyId", "startTime", "overallSentiment") 
INCLUDE ("endTime", "messagesSent", "escalated", "category");

-- Performance analysis queries for monitoring
CREATE INDEX CONCURRENTLY "Session_companyId_performance_idx" 
ON "Session" ("companyId", "avgResponseTime", "escalated") 
INCLUDE ("startTime", "messagesSent");

-- Category and language filtering for analytics
CREATE INDEX CONCURRENTLY "Session_companyId_category_language_idx" 
ON "Session" ("companyId", "category", "language") 
INCLUDE ("startTime", "endTime", "overallSentiment", "messagesSent");

-- Import tracking for processing pipeline
CREATE INDEX CONCURRENTLY "Session_importId_companyId_idx" 
ON "Session" ("importId", "companyId") 
WHERE "importId" IS NOT NULL 
INCLUDE ("startTime", "category", "overallSentiment");

-- =====================================================
-- 4. Message Processing Optimizations
-- =====================================================

-- Message timeline with role filtering (covering index)
CREATE INDEX CONCURRENTLY "Message_sessionId_timestamp_role_covering_idx" 
ON "Message" ("sessionId", "timestamp", "role") 
INCLUDE ("content");

-- Message counting and analysis queries
CREATE INDEX CONCURRENTLY "Message_sessionId_role_timestamp_idx" 
ON "Message" ("sessionId", "role", "timestamp");

-- =====================================================
-- 5. Processing Pipeline Status Tracking
-- =====================================================

-- Processing pipeline monitoring with error analysis
CREATE INDEX CONCURRENTLY "SessionProcessingStatus_stage_status_startedAt_idx" 
ON "SessionProcessingStatus" ("stage", "status", "startedAt") 
INCLUDE ("sessionId", "completedAt", "retryCount");

-- Error analysis (partial index for failed states)
CREATE INDEX CONCURRENTLY "SessionProcessingStatus_error_analysis_idx" 
ON "SessionProcessingStatus" ("status", "stage") 
WHERE "status" IN ('FAILED', 'RETRY_PENDING') 
INCLUDE ("sessionId", "errorMessage", "retryCount", "startedAt");

-- Session-specific processing status lookup
CREATE INDEX CONCURRENTLY "SessionProcessingStatus_sessionId_stage_status_idx" 
ON "SessionProcessingStatus" ("sessionId", "stage", "status") 
INCLUDE ("startedAt", "completedAt", "retryCount");

-- =====================================================
-- 6. Company and User Access Optimizations
-- =====================================================

-- User lookup by email and company (authentication)
CREATE INDEX CONCURRENTLY "User_email_companyId_active_idx" 
ON "User" ("email", "companyId") 
WHERE "active" = true 
INCLUDE ("role", "hashedPassword", "lastLoginAt");

-- Company access validation
CREATE INDEX CONCURRENTLY "User_companyId_role_active_idx" 
ON "User" ("companyId", "role", "active") 
INCLUDE ("email", "lastLoginAt");

-- Platform user authentication
CREATE INDEX CONCURRENTLY "PlatformUser_email_active_idx" 
ON "PlatformUser" ("email") 
WHERE "active" = true 
INCLUDE ("role", "hashedPassword", "lastLoginAt");

-- =====================================================
-- 7. Session Import Processing
-- =====================================================

-- Import processing status tracking
CREATE INDEX CONCURRENTLY "SessionImport_companyId_processingStatus_createdAt_idx" 
ON "SessionImport" ("companyId", "processingStatus", "createdAt") 
INCLUDE ("id", "csvUrl", "processedAt");

-- Pending imports for scheduler processing
CREATE INDEX CONCURRENTLY "SessionImport_processingStatus_createdAt_idx" 
ON "SessionImport" ("processingStatus", "createdAt") 
WHERE "processingStatus" IN ('PENDING', 'PROCESSING', 'RETRY_PENDING') 
INCLUDE ("companyId", "csvUrl", "retryCount");

-- Import completion tracking
CREATE INDEX CONCURRENTLY "SessionImport_companyId_processedAt_idx" 
ON "SessionImport" ("companyId", "processedAt") 
WHERE "processedAt" IS NOT NULL 
INCLUDE ("processingStatus", "totalSessions", "successfulSessions");