-- Custom migration for PostgreSQL-specific data integrity constraints
-- These constraints cannot be expressed in Prisma schema directly

-- Ensure only one default AI model per company
CREATE UNIQUE INDEX "unique_default_ai_model_per_company" 
ON "CompanyAIModel" ("companyId") 
WHERE "isDefault" = true;

-- Ensure positive token counts in AI processing requests
ALTER TABLE "AIProcessingRequest" 
ADD CONSTRAINT "positive_prompt_tokens" CHECK ("promptTokens" >= 0);

ALTER TABLE "AIProcessingRequest" 
ADD CONSTRAINT "positive_completion_tokens" CHECK ("completionTokens" >= 0);

ALTER TABLE "AIProcessingRequest" 
ADD CONSTRAINT "positive_total_tokens" CHECK ("totalTokens" >= 0);

-- Ensure positive costs
ALTER TABLE "AIProcessingRequest" 
ADD CONSTRAINT "positive_prompt_cost" CHECK ("promptTokenCost" >= 0);

ALTER TABLE "AIProcessingRequest" 
ADD CONSTRAINT "positive_completion_cost" CHECK ("completionTokenCost" >= 0);

ALTER TABLE "AIProcessingRequest" 
ADD CONSTRAINT "positive_total_cost" CHECK ("totalCostEur" >= 0);

-- Ensure session times are logical
ALTER TABLE "Session" 
ADD CONSTRAINT "logical_session_times" CHECK ("endTime" >= "startTime");

-- Ensure positive response times
ALTER TABLE "Session" 
ADD CONSTRAINT "positive_response_time" CHECK ("avgResponseTime" IS NULL OR "avgResponseTime" >= 0);

-- Ensure positive message counts
ALTER TABLE "Session" 
ADD CONSTRAINT "positive_message_count" CHECK ("messagesSent" IS NULL OR "messagesSent" >= 0);

ALTER TABLE "SessionImport" 
ADD CONSTRAINT "positive_message_count_import" CHECK ("messagesSent" IS NULL OR "messagesSent" >= 0);

-- Ensure positive response times in imports
ALTER TABLE "SessionImport" 
ADD CONSTRAINT "positive_response_time_import" CHECK ("avgResponseTimeSeconds" IS NULL OR "avgResponseTimeSeconds" >= 0);

-- Ensure positive token values in imports
ALTER TABLE "SessionImport" 
ADD CONSTRAINT "positive_tokens_import" CHECK ("tokens" IS NULL OR "tokens" >= 0);

ALTER TABLE "SessionImport" 
ADD CONSTRAINT "positive_tokens_eur_import" CHECK ("tokensEur" IS NULL OR "tokensEur" >= 0);

-- Ensure positive message order
ALTER TABLE "Message" 
ADD CONSTRAINT "positive_message_order" CHECK ("order" >= 0);

-- Ensure positive retry counts
ALTER TABLE "SessionProcessingStatus" 
ADD CONSTRAINT "positive_retry_count" CHECK ("retryCount" >= 0);

-- Ensure logical processing times
ALTER TABLE "SessionProcessingStatus" 
ADD CONSTRAINT "logical_processing_times" CHECK ("completedAt" IS NULL OR "startedAt" IS NULL OR "completedAt" >= "startedAt");

-- Ensure logical AI request times
ALTER TABLE "AIProcessingRequest" 
ADD CONSTRAINT "logical_ai_request_times" CHECK ("completedAt" IS NULL OR "completedAt" >= "requestedAt");

-- Ensure logical pricing date ranges
ALTER TABLE "AIModelPricing" 
ADD CONSTRAINT "logical_pricing_dates" CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom");

-- Ensure positive max tokens for AI models
ALTER TABLE "AIModel" 
ADD CONSTRAINT "positive_max_tokens" CHECK ("maxTokens" IS NULL OR "maxTokens" > 0);

-- Ensure logical user reset token expiry
ALTER TABLE "User" 
ADD CONSTRAINT "logical_reset_token_expiry" CHECK ("resetTokenExpiry" IS NULL OR "resetToken" IS NOT NULL);

-- Add partial index for failed processing sessions (PostgreSQL-specific optimization)
CREATE INDEX CONCURRENTLY "sessions_failed_processing" 
ON "SessionProcessingStatus" ("sessionId") 
WHERE "status" = 'FAILED';

-- Add partial index for pending processing sessions
CREATE INDEX CONCURRENTLY "sessions_pending_processing" 
ON "SessionProcessingStatus" ("stage", "status") 
WHERE "status" = 'PENDING';