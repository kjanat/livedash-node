-- Database Schema Migrations for tRPC and Batch Processing Integration
-- Version: 2.0.0
-- Created: 2025-01-11

-- =============================================================================
-- MIGRATION VALIDATION
-- =============================================================================

-- Check if this migration has already been applied
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'AIProcessingRequest' 
        AND column_name = 'processingStatus'
    ) THEN
        RAISE NOTICE 'Migration appears to already be applied. Skipping schema changes.';
    ELSE
        RAISE NOTICE 'Applying schema migrations for tRPC and Batch Processing...';
    END IF;
END
$$;

-- =============================================================================
-- BATCH PROCESSING ENUMS (if not already created by Prisma)
-- =============================================================================

-- Create AIBatchRequestStatus enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AIBatchRequestStatus') THEN
        CREATE TYPE "AIBatchRequestStatus" AS ENUM (
            'PENDING',
            'UPLOADING', 
            'VALIDATING',
            'IN_PROGRESS',
            'FINALIZING',
            'COMPLETED',
            'PROCESSED',
            'FAILED',
            'CANCELLED'
        );
        RAISE NOTICE 'Created AIBatchRequestStatus enum';
    END IF;
END
$$;

-- Create AIRequestStatus enum if it doesn't exist  
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AIRequestStatus') THEN
        CREATE TYPE "AIRequestStatus" AS ENUM (
            'PENDING_BATCHING',
            'BATCHING_IN_PROGRESS', 
            'PROCESSING_COMPLETE',
            'PROCESSING_FAILED'
        );
        RAISE NOTICE 'Created AIRequestStatus enum';
    END IF;
END
$$;

-- =============================================================================
-- AIBATCHREQUEST TABLE
-- =============================================================================

-- Create AIBatchRequest table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AIBatchRequest') THEN
        CREATE TABLE "AIBatchRequest" (
            "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "companyId" TEXT NOT NULL,
            "openaiBatchId" TEXT NOT NULL UNIQUE,
            "inputFileId" TEXT NOT NULL,
            "outputFileId" TEXT,
            "errorFileId" TEXT,
            "status" "AIBatchRequestStatus" NOT NULL DEFAULT 'PENDING',
            "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "completedAt" TIMESTAMPTZ(6),
            "processedAt" TIMESTAMPTZ(6),
            
            CONSTRAINT "AIBatchRequest_companyId_fkey" 
                FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );
        
        -- Create indexes for AIBatchRequest
        CREATE INDEX "AIBatchRequest_companyId_status_idx" ON "AIBatchRequest"("companyId", "status");
        
        RAISE NOTICE 'Created AIBatchRequest table with indexes';
    END IF;
END
$$;

-- =============================================================================
-- AIPROCESSINGREQUEST TABLE MODIFICATIONS
-- =============================================================================

-- Add batch-related columns to AIProcessingRequest if they don't exist
DO $$
BEGIN
    -- Add processingStatus column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'AIProcessingRequest' AND column_name = 'processingStatus'
    ) THEN
        ALTER TABLE "AIProcessingRequest" 
        ADD COLUMN "processingStatus" "AIRequestStatus" NOT NULL DEFAULT 'PENDING_BATCHING';
        RAISE NOTICE 'Added processingStatus column to AIProcessingRequest';
    END IF;
    
    -- Add batchId column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'AIProcessingRequest' AND column_name = 'batchId'
    ) THEN
        ALTER TABLE "AIProcessingRequest" 
        ADD COLUMN "batchId" TEXT;
        RAISE NOTICE 'Added batchId column to AIProcessingRequest';
    END IF;
END
$$;

-- Add foreign key constraint for batchId if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'AIProcessingRequest_batchId_fkey'
    ) THEN
        ALTER TABLE "AIProcessingRequest" 
        ADD CONSTRAINT "AIProcessingRequest_batchId_fkey" 
        FOREIGN KEY ("batchId") REFERENCES "AIBatchRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        RAISE NOTICE 'Added foreign key constraint for batchId';
    END IF;
END
$$;

-- Create index for processingStatus if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'AIProcessingRequest_processingStatus_idx'
    ) THEN
        CREATE INDEX "AIProcessingRequest_processingStatus_idx" 
        ON "AIProcessingRequest"("processingStatus");
        RAISE NOTICE 'Created index on processingStatus';
    END IF;
END
$$;

-- =============================================================================
-- DATA MIGRATION FOR EXISTING RECORDS
-- =============================================================================

-- Update existing AIProcessingRequest records to have default processing status
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE "AIProcessingRequest" 
    SET "processingStatus" = 'PROCESSING_COMPLETE'
    WHERE "processingStatus" IS NULL AND "success" = true;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % successful records to PROCESSING_COMPLETE', updated_count;
    
    UPDATE "AIProcessingRequest" 
    SET "processingStatus" = 'PROCESSING_FAILED'
    WHERE "processingStatus" IS NULL AND "success" = false;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % failed records to PROCESSING_FAILED', updated_count;
    
    UPDATE "AIProcessingRequest" 
    SET "processingStatus" = 'PENDING_BATCHING'
    WHERE "processingStatus" IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % remaining records to PENDING_BATCHING', updated_count;
END
$$;

-- =============================================================================
-- PERFORMANCE OPTIMIZATIONS
-- =============================================================================

-- Create additional performance indexes for batch processing queries
DO $$
BEGIN
    -- Index for finding requests ready for batching
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'AIProcessingRequest_batching_ready_idx'
    ) THEN
        CREATE INDEX "AIProcessingRequest_batching_ready_idx" 
        ON "AIProcessingRequest"("processingStatus", "requestedAt") 
        WHERE "processingStatus" = 'PENDING_BATCHING';
        RAISE NOTICE 'Created index for batching ready requests';
    END IF;
    
    -- Index for batch status monitoring
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'AIBatchRequest_status_created_idx'
    ) THEN
        CREATE INDEX "AIBatchRequest_status_created_idx" 
        ON "AIBatchRequest"("status", "createdAt");
        RAISE NOTICE 'Created index for batch status monitoring';
    END IF;
    
    -- Composite index for session processing status queries (enhanced for tRPC)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'SessionProcessingStatus_compound_idx'
    ) THEN
        CREATE INDEX "SessionProcessingStatus_compound_idx" 
        ON "SessionProcessingStatus"("sessionId", "stage", "status", "startedAt");
        RAISE NOTICE 'Created compound index for session processing status';
    END IF;
    
    -- Index for session filtering in tRPC endpoints
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'Session_trpc_filtering_idx'
    ) THEN
        CREATE INDEX "Session_trpc_filtering_idx" 
        ON "Session"("companyId", "startTime", "sentiment", "category") 
        WHERE "sentiment" IS NOT NULL;
        RAISE NOTICE 'Created index for tRPC session filtering';
    END IF;
END
$$;

-- =============================================================================
-- VALIDATION CHECKS
-- =============================================================================

-- Validate that all expected tables exist
DO $$
DECLARE
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    table_name TEXT;
BEGIN
    FOR table_name IN SELECT unnest(ARRAY[
        'AIBatchRequest',
        'AIProcessingRequest', 
        'Session',
        'SessionProcessingStatus',
        'Company',
        'User'
    ]) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = table_name
        ) THEN
            missing_tables := missing_tables || table_name;
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Missing required tables: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE 'All required tables present';
    END IF;
END
$$;

-- Validate that all expected columns exist
DO $$
DECLARE
    missing_columns TEXT[] := ARRAY[]::TEXT[];
    validation_failed BOOLEAN := false;
BEGIN
    -- Check AIProcessingRequest batch columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'AIProcessingRequest' AND column_name = 'processingStatus'
    ) THEN
        missing_columns := missing_columns || 'AIProcessingRequest.processingStatus';
        validation_failed := true;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'AIProcessingRequest' AND column_name = 'batchId'
    ) THEN
        missing_columns := missing_columns || 'AIProcessingRequest.batchId';
        validation_failed := true;
    END IF;
    
    -- Check AIBatchRequest columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'AIBatchRequest' AND column_name = 'openaiBatchId'
    ) THEN
        missing_columns := missing_columns || 'AIBatchRequest.openaiBatchId';
        validation_failed := true;
    END IF;
    
    IF validation_failed THEN
        RAISE EXCEPTION 'Missing required columns: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE 'All required columns present';
    END IF;
END
$$;

-- =============================================================================
-- STATISTICS UPDATE
-- =============================================================================

-- Update table statistics for query optimization
DO $$
BEGIN
    ANALYZE "AIBatchRequest";
    ANALYZE "AIProcessingRequest";
    ANALYZE "Session";
    ANALYZE "SessionProcessingStatus";
    RAISE NOTICE 'Updated table statistics for query optimization';
END
$$;

-- =============================================================================
-- MIGRATION COMPLETION LOG
-- =============================================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'SCHEMA MIGRATION COMPLETED SUCCESSFULLY';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'Version: 2.0.0';
    RAISE NOTICE 'Date: %', CURRENT_TIMESTAMP;
    RAISE NOTICE 'Migration: tRPC and Batch Processing Integration';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'New Features:';
    RAISE NOTICE '- OpenAI Batch API support (50%% cost reduction)';
    RAISE NOTICE '- Enhanced processing status tracking'; 
    RAISE NOTICE '- Optimized indexes for tRPC endpoints';
    RAISE NOTICE '- Improved query performance';
    RAISE NOTICE '=============================================================================';
END
$$;