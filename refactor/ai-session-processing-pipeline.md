> Okay write the complete prompt for claude code to refactor the current importprocessing, and implement this api-type implementation. I wanted this to be behind
  a **/legacy/* endpoint name to denote I want to accept in future the individual/batched chat session logs through api, not having to import and process them on
  my end.

✦ Of course. This is a significant but valuable refactoring project. A detailed, well-structured prompt is key for getting a good result from a code-focused AI
  like Claude.

  Here is the complete prompt you can provide. It's designed to be comprehensive, giving the AI all the context, architectural guidance, and specific
  implementation details it needs to perform the refactor correctly.

  ---

  Prompt for Claude Code


  Project: LiveDash-Node (livedash-node-max-branch)
  Objective: Refactor our AI session processing pipeline to use the OpenAI Batch API for cost savings and higher throughput. Implement a new internal admin API
  under /api/admin/legacy/* to monitor and manage this new asynchronous workflow.


  Context:
  Our current system processes AI analysis requests (like sentiment analysis, summarization, etc.) in a synchronous or simple asynchronous loop, likely via
  processingScheduler.ts. This is inefficient and costly at scale. We are moving to OpenAI's Batch API, which is fully asynchronous and requires a stateful,
  multi-stage processing architecture.


  The term "legacy" in the API path /api/admin/legacy/* is intentional. It refers to the fact that our current method of getting data (CSV imports) is the
  "legacy" workflow. In the future, we plan to introduce a new API for clients to submit session data directly. This admin API is for monitoring the processing
  of data from our legacy import system.

  Please follow the phased plan below precisely.

  ---

  Phase 1: Database Schema Changes (`prisma/schema.prisma`)


  First, we need to update our database schema to track the state of batch jobs and the individual requests within them.

  1. Add the `AIBatchRequest` model and `AIBatchRequestStatus` enum. This table will track the status of each batch job submitted to OpenAI.



    1 // Add this new model to your schema.prisma
    2
    3 model AIBatchRequest {
    4   id              String   @id @default(cuid())
    5   companyId       String
    6   company         Company  @relation(fields: [companyId], references: [id])
    7
    8   // OpenAI specific IDs
    9   openaiBatchId   String   @unique
   10   inputFileId     String
   11   outputFileId    String?
   12   errorFileId     String?
   13
   14   // Our internal status tracking
   15   status          AIBatchRequestStatus @default(PENDING)
   16
   17   // Timestamps
   18   createdAt       DateTime @default(now())
   19   completedAt     DateTime?
   20   processedAt     DateTime? // When we finished processing the results
   21
   22   // Relation to the individual requests included in this batch
   23   processingRequests AIProcessingRequest[]
   24
   25   @@index([companyId, status])
   26 }
   27
   28 enum AIBatchRequestStatus {
   29   PENDING           // We have created the batch in our DB, preparing to send to OpenAI
   30   UPLOADING         // Uploading the .jsonl file
   31   VALIDATING        // OpenAI is validating the file
   32   IN_PROGRESS       // OpenAI is processing the batch
   33   FINALIZING        // OpenAI is finalizing the results
   34   COMPLETED         // OpenAI job is done, results are available for download
   35   PROCESSED         // We have successfully downloaded and processed all results
   36   FAILED            // The batch failed validation or expired
   37   CANCELLED         // The batch was cancelled
   38 }



  2. Update the `AIProcessingRequest` model and add the `AIRequestStatus` enum. We need to track the state of each individual request as it moves through the
  batching pipeline.



    1 // In your existing AIProcessingRequest model, add the new fields and enum.
    2
    3 model AIProcessingRequest {
    4   // ... all existing fields (id, sessionId, token counts, etc.)
    5
    6   // === ADD THESE NEW FIELDS ===
    7   processingStatus  AIRequestStatus @default(PENDING_BATCHING)
    8   batchId           String?
    9   batch             AIBatchRequest? @relation(fields: [batchId], references: [id])
   10   // ============================
   11
   12   @@index([processingStatus]) // Add this index for efficient querying
   13 }
   14
   15 enum AIRequestStatus {
   16   PENDING_BATCHING      // Default state: waiting to be picked up by the batch creator
   17   BATCHING_IN_PROGRESS  // It has been assigned to a batch that is currently running
   18   PROCESSING_COMPLETE   // The batch finished and we successfully got a result for this request
   19   PROCESSING_FAILED     // The batch finished but this specific request failed
   20 }


  After modifying the schema, please run pnpm prisma:generate.

  ---

  Phase 2: Implement the Batch Processing Schedulers


  The core of this refactor is to replace the existing logic in lib/processingScheduler.ts with a two-stage scheduler system. You can create new files for this
  logic (e.g., lib/batchCreator.ts, lib/batchPoller.ts) and integrate them into lib/schedulers.ts.


  Scheduler 1: Batch Creation (`lib/batchCreator.ts`)
  This scheduler runs periodically (e.g., every 10 minutes) to bundle pending requests into a batch.


   * Functionality:
       1. Query the database for AIProcessingRequest records with processingStatus: 'PENDING_BATCHING'.
       2. Group these requests by the AI model they need to use (e.g., gpt-4-turbo). The Batch API requires one model per batch file.
       3. For each model group:
          a.  Generate a .jsonl string. Each line must be a valid OpenAI batch request.
          b.  Crucially, use our internal `AIProcessingRequest.id` as the `custom_id` in each JSON line. This is how we will map results back.
          c.  Upload the .jsonl content to OpenAI using openai.files.create({ file: Buffer.from(jsonlContent), purpose: 'batch' }).
          d.  Create the batch job using openai.batches.create() with the returned input_file_id.
          e.  In a single database transaction:
              i.  Create a new AIBatchRequest record in our database, storing the openaiBatchId, inputFileId, and setting the initial status to VALIDATING.
              ii. Update all the AIProcessingRequest records included in this batch to set their processingStatus to BATCHING_IN_PROGRESS and link them via the
  batchId.

  Scheduler 2: Result Polling (`lib/batchPoller.ts`)
  This scheduler runs more frequently (e.g., every 2 minutes) to check for and process completed jobs.


   * Functionality:
       1. Query our database for AIBatchRequest records with a status that is still in-flight (e.g., VALIDATING, IN_PROGRESS, FINALIZING).
       2. For each active batch, call openai.batches.retrieve(batch.openaiBatchId) to get the latest status from OpenAI.
       3. Update the status of our AIBatchRequest record to match the one from OpenAI.
       4. If a batch's status becomes completed:
          a.  Update its status in our DB and store the output_file_id and error_file_id.
          b.  Download the content of the output_file_id from OpenAI.
          c.  Parse the resulting .jsonl file line by line. For each line:
              i.  Use the custom_id to find our original AIProcessingRequest record.
              ii. If the line contains a response, parse the AI content and usage data. Update our AIProcessingRequest record with this data and set its
  processingStatus to PROCESSING_COMPLETE.
              iii. If the line contains an error, log it and set the processingStatus to PROCESSING_FAILED.
          d.  Do the same for the error_file_id if it exists.
          e.  Once all results are processed, update the parent AIBatchRequest status to PROCESSED and set its processedAt timestamp.

  ---

  Phase 3: Implement the Internal Admin API

  Create a new set of internal API endpoints for monitoring and managing this process.


   * Location: app/api/admin/legacy/
   * Authentication: Protect all these endpoints with our most secure admin-level authentication middleware (e.g., from lib/platform-auth.ts). Access should be
     strictly limited.


  Endpoint 1: Get Summary
   * Route: GET /api/admin/legacy/summary
   * Description: Returns a count of all AIProcessingRequest records, grouped by processingStatus.
   * Response:


   1     { "ok": true, "summary": { "pending_batching": 15231, "batching_in_progress": 2500, "processing_complete": 85432, "processing_failed": 78 } }



  Endpoint 2: List Requests
   * Route: GET /api/admin/legacy/requests
   * Description: Retrieves a paginated list of AIProcessingRequest records, filterable by status.
   * Query Params: status (required), limit (optional), cursor (optional).
   * Response:


   1     { "ok": true, "requests": [ { "id": "...", "sessionId": "...", "status": "processing_failed", ... } ], "nextCursor": "..." }



  Endpoint 3: Re-queue Failed Requests
   * Route: POST /api/admin/legacy/requests/requeue
   * Description: Resets the status of specified failed requests back to PENDING_BATCHING so they can be re-processed in a new batch.
   * Request Body: { "requestIds": ["req_id_1", "req_id_2"] }
   * Response:

   1     { "ok": true, "requeuedCount": 2, "notFoundCount": 0 }


  ---

  Phase 4: Final Integration and Cleanup


   1. Update `server.ts` and `lib/schedulers.ts`: Disable the old processingScheduler and enable the two new schedulers (batchCreator, batchPoller). Ensure they
      are controlled by environment variables (e.g., BATCH_CREATION_ENABLED, BATCH_POLLING_ENABLED).
   2. Documentation: Add a section to CLAUDE.md or a new file in docs/ explaining the new batch processing architecture and the purpose of the admin API endpoints.
   3. Environment Variables: Add any new required environment variables to .env.example.


  Please proceed with this refactoring plan. Implement robust logging throughout the new schedulers to ensure we can debug the pipeline effectively.