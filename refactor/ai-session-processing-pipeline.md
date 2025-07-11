# Refactor AI Session Processing Pipeline

> This is a significant but valuable refactoring project. A detailed, well-structured prompt is key for getting a good result from a code-focused AI like Claude.
> **Project:** _LiveDash-Node_ (`~/Projects/livedash-node-max-branch`)
> **Objective:** _Refactor our AI session processing pipeline to use the OpenAI Batch API for cost savings and higher throughput. Implement a new internal admin API under /api/admin/legacy/* to monitor and manage this new asynchronous workflow._
> **Assignee:** Claude Code

## Context

Our current system processes AI analysis requests (like sentiment analysis, summarization, etc.) in a synchronous or simple asynchronous loop, likely via [processingScheduler.ts](../lib/processingScheduler.ts). This is inefficient and costly at scale. We are moving to OpenAI's Batch API, which is fully asynchronous and requires a stateful, multi-stage processing architecture.

The term "legacy" in the API path `/api/admin/legacy/*` is intentional. It refers to the fact that our current method of getting data (CSV imports) is the "legacy" workflow. In the future, we plan to introduce a new API for clients to submit session data directly. This admin API is for monitoring the processing of data from our legacy import system.

Please follow the phased plan below precisely.

---

## Phase 1: Database Schema Changes (`prisma/schema.prisma`)

First, we need to update our database schema to track the state of batch jobs and the individual requests within them.

1.  Add the `AIBatchRequest` model and `AIBatchRequestStatus` enum. This table will track the status of each batch job submitted to OpenAI.

    ```prisma
    // Add this new model to your schema.prisma
    model AIBatchRequest {
        id              String   @id @default(cuid())
        companyId       String
        company         Company  @relation(fields: [companyId], references: [id])

        // OpenAI specific IDs
        openaiBatchId   String   @unique
        inputFileId     String
        outputFileId    String?
        errorFileId     String?

        // Our internal status tracking
        status          AIBatchRequestStatus @default(PENDING)

        // Timestamps
        createdAt       DateTime @default(now())
        completedAt     DateTime?
        processedAt     DateTime? // When we finished processing the results

        // Relation to the individual requests included in this batch
        processingRequests AIProcessingRequest[]
        @@index([companyId, status])
    }

    enum AIBatchRequestStatus {
        PENDING           // We have created the batch in our DB, preparing to send to OpenAI
        UPLOADING         // Uploading the .jsonl file
        VALIDATING        // OpenAI is validating the file
        IN_PROGRESS       // OpenAI is processing the batch
        FINALIZING        // OpenAI is finalizing the results
        COMPLETED         // OpenAI job is done, results are available for download
        PROCESSED         // We have successfully downloaded and processed all results
        FAILED            // The batch failed validation or expired
        CANCELLED         // The batch was cancelled
    }
    ```

2.  Update the `AIProcessingRequest` model and add the `AIRequestStatus` enum. We need to track the state of each individual request as it moves through the batching pipeline.

    ```prisma
    // In your existing AIProcessingRequest model, add the new fields and enum.

    model AIProcessingRequest {
        // ... all existing fields (id, sessionId, token counts, etc.)
        // === ADD THESE NEW FIELDS ===
        processingStatus  AIRequestStatus @default(PENDING_BATCHING)
        batchId           String?
        batch             AIBatchRequest? @relation(fields: [batchId], references: [id])
        // ============================
        @@index([processingStatus]) // Add this index for efficient querying
    }

    enum AIRequestStatus {
        PENDING_BATCHING      // Default state: waiting to be picked up by the batch creator
        BATCHING_IN_PROGRESS  // It has been assigned to a batch that is currently running
        PROCESSING_COMPLETE   // The batch finished and we successfully got a result for this request
        PROCESSING_FAILED     // The batch finished but this specific request failed
    }
    ```

After modifying the schema, please run `pnpm prisma:generate`.

---

## Phase 2: Implement the Batch Processing Schedulers

The core of this refactor is to replace the existing logic in `lib/processingScheduler.ts` with a two-stage scheduler system. You can create new files for this logic (e.g., `lib/batchCreator.ts`, `lib/batchPoller.ts`) and integrate them into `lib/schedulers.ts`.

### Scheduler 1: Batch Creation (`lib/batchCreator.ts`)

This scheduler runs periodically (e.g., every 10 minutes) to bundle pending requests into a batch.

Functionality:

1.  Query the database for `AIProcessingRequest` records with `processingStatus`: `PENDING_BATCHING`.
2.  Group these requests by the AI model they need to use (e.g., `gpt-4-turbo`). The Batch API requires one model per batch file.
3.  For each model group:
    1.  Generate a `.jsonl` string. Each line must be a valid OpenAI batch request.
    2.  Crucially, use our internal `AIProcessingRequest.id` as the `custom_id` in each JSON line. This is how we will map results back.
    3.  Upload the `.jsonl` content to OpenAI using `openai.files.create({ file: Buffer.from(jsonlContent), purpose: 'batch' })`.
    4.  Create the batch job using `openai.batches.create()` with the returned `input_file_id`.
    5.  In a single database transaction:
        1.  Create a new `AIBatchRequest` record in our database, storing the `openaiBatchId`, `inputFileId`, and setting the initial status to `VALIDATING`.
        2.  Update all the `AIProcessingRequest` records included in this batch to set their `processingStatus` to `BATCHING_IN_PROGRESS` and link them via the `batchId`.

### Scheduler 2: Result Polling (`lib/batchPoller.ts`)

This scheduler runs more frequently (e.g., every 2 minutes) to check for and process completed jobs.

Functionality:

1.  Query our database for `AIBatchRequest` records with a status that is still in-flight (e.g., `VALIDATING`, `IN_PROGRESS`, `FINALIZING`).
2.  For each active batch, call `openai.batches.retrieve(batch.openaiBatchId)` to get the latest status from OpenAI.
3.  Update the status of our `AIBatchRequest` record to match the one from OpenAI.
4.  If a batch's status becomes completed:
    1.  Update its status in our DB and store the `output_file_id` and `error_file_id`.
    2.  Download the content of the `output_file_id` from OpenAI.
    3.  Parse the resulting .jsonl file line by line. For each line:
        1.  Use the `custom_id` to find our original `AIProcessingRequest` record.
        2.  If the line contains a response, parse the AI content and usage data. Update our `AIProcessingRequest` record with this data and set its `processingStatus` to `PROCESSING_COMPLETE`.
        3.  If the line contains an error, log it and set the `processingStatus` to `PROCESSING_FAILED`.
    4.  Do the same for the `error_file_id` if it exists.
    5.  Once all results are processed, update the parent `AIBatchRequest` status to `PROCESSED` and set its `processedAt` timestamp.

---

## Phase 3: Implement the Internal Admin API

Create a new set of internal API endpoints for monitoring and managing this process.

*   Location: `app/api/admin/legacy/`
*   Authentication: Protect all these endpoints with our most secure admin-level authentication middleware (e.g., from `lib/platform-auth.ts`). Access should be strictly limited.

### Endpoint 1: Get Summary

*   Route: `GET` `/api/admin/legacy/summary`
*   Description: Returns a count of all `AIProcessingRequest` records, grouped by `processingStatus`.
*   Response:

    ```json
    {
      "ok": true,
      "summary": {
        "pending_batching": 15231,
        "batching_in_progress": 2500,
        "processing_complete": 85432,
        "processing_failed": 78
      }
    }
    ```

### Endpoint 2: List Requests

*   Route: `GET` `/api/admin/legacy/requests`
*   Description: Retrieves a paginated list of `AIProcessingRequest` records, filterable by `status`.
*   Query Params: `status` (required), `limit` (optional), `cursor` (optional).
*   Response:

    ```json
    {
      "ok": true,
      "requests": [
        {
          "id": "...",
          "sessionId": "...",
          "status": "processing_failed", ...
        }
      ],
      "nextCursor": "..."
    }
    ```

### Endpoint 3: Re-queue Failed Requests

*   Route: `POST` `/api/admin/legacy/requests/requeue`
*   Description: Resets the status of specified failed requests back to `PENDING_BATCHING` so they can be re-processed in a new batch.
*   Request Body:

    ```json
    {
      "requestIds": ["req_id_1", "req_id_2", ...]
    }
    ```

*   Response:

    ```json
    {
      "ok": true,
      "requeuedCount": 2,
      "notFoundCount": 0
    }
    ```

---

### Phase 4: Final Integration and Cleanup

1.  Update `server.ts` and `lib/schedulers.ts`: Disable the old `processingScheduler` and enable the two new schedulers (`batchCreator`, `batchPoller`). Ensure they are controlled by environment variables (e.g., `BATCH_CREATION_ENABLED`, `BATCH_POLLING_ENABLED`).
2.  Documentation: Add a section to `CLAUDE.md` or a new file in `docs/` explaining the new batch processing architecture and the purpose of the admin API endpoints.
3.  Environment Variables: Add any new required environment variables to `.env.example`.

Please proceed with this refactoring plan. Implement robust logging throughout the new schedulers to ensure we can debug the pipeline effectively.
