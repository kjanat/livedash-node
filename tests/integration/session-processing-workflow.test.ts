/**
 * Integration tests for session processing workflow
 *
 * Tests the complete end-to-end flow of session processing:
 * 1. Import processing (SessionImport → Session)
 * 2. Transcript fetching and parsing
 * 3. AI analysis (sentiment, categorization, summarization)
 * 4. Question extraction
 * 5. Batch API integration
 * 6. Error handling and retry logic
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { processSessionImports } from "@/lib/importProcessor";
import { processUnprocessedSessions } from "@/lib/processingScheduler";
import { createBatchJob, checkBatchStatuses, processCompletedBatches } from "@/lib/batchProcessor";
import { transcriptFetcher } from "@/lib/transcriptFetcher";
import { parseTranscriptMessages } from "@/lib/transcriptParser";
import type { Company, SessionImport, Session, User, AIBatchRequest } from "@prisma/client";

// Mock external dependencies
vi.mock("@/lib/transcriptFetcher");
vi.mock("openai");

describe("Session Processing Workflow Integration Tests", () => {
  let testCompany: Company;
  let testUser: User;

  const mockTranscript = `
Chat started at 10:00 AM

User: Hello, I need help with my vacation request.
Assistant: Hi! I'd be happy to help you with your vacation request. How many days are you planning to take off?
User: I want to take 10 days starting from next Monday.
Assistant: Let me check that for you. When would you like your vacation to end?
User: It should end on the Friday of the following week.
Assistant: Perfect! I've noted your vacation request for 10 days. Please submit the formal request through the HR portal.
User: Thank you! How do I access the HR portal?
Assistant: You can access the HR portal at hr.company.com using your employee credentials.
User: Great, thanks for your help!
Assistant: You're welcome! Have a great vacation!

Chat ended at 10:15 AM
`;

  beforeEach(async () => {
    // Clean up test data
    await prisma.message.deleteMany({});
    await prisma.sessionQuestion.deleteMany({});
    await prisma.question.deleteMany({});
    await prisma.aIProcessingRequest.deleteMany({});
    await prisma.aIBatchRequest.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.sessionImport.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.company.deleteMany({});

    // Create test company
    testCompany = await prisma.company.create({
      data: {
        name: "Test Company",
        csvUrl: "https://example.com/test.csv",
        status: "ACTIVE",
      },
    });

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: "test@example.com",
        password: "hashed_password",
        role: "ADMIN",
        companyId: testCompany.id,
      },
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe("Import Processing (SessionImport → Session)", () => {
    it("should process SessionImport into Session with transcript parsing", async () => {
      // Create SessionImport
      const sessionImport = await prisma.sessionImport.create({
        data: {
          sessionId: "test-session-1",
          companyId: testCompany.id,
          userId: "user123",
          language: "en",
          country: "US",
          ipAddress: "192.168.1.1",
          sentiment: "positive",
          messagesSent: 5,
          startTime: new Date("2024-01-15T10:00:00Z"),
          endTime: new Date("2024-01-15T10:15:00Z"),
          escalated: false,
          forwardedHr: false,
          summary: "User needs help with vacation request",
          fullTranscriptUrl: "https://example.com/transcript.txt",
          status: "PENDING",
        },
      });

      // Mock transcript fetching
      vi.mocked(transcriptFetcher).mockResolvedValueOnce(mockTranscript);

      // Process the import
      await processSessionImports(testCompany.id);

      // Verify Session was created
      const session = await prisma.session.findFirst({
        where: { importId: sessionImport.id },
        include: { messages: { orderBy: { order: "asc" } } },
      });

      expect(session).toBeTruthy();
      expect(session?.sessionId).toBe("test-session-1");
      expect(session?.messages).toHaveLength(10); // 5 user + 5 assistant messages

      // Verify messages were parsed correctly
      expect(session?.messages[0]).toMatchObject({
        role: "User",
        content: "Hello, I need help with my vacation request.",
        order: 0,
      });
      expect(session?.messages[1]).toMatchObject({
        role: "Assistant",
        content: "Hi! I'd be happy to help you with your vacation request. How many days are you planning to take off?",
        order: 1,
      });

      // Verify import status was updated
      const updatedImport = await prisma.sessionImport.findUnique({
        where: { id: sessionImport.id },
      });
      expect(updatedImport?.status).toBe("PROCESSED");
    });

    it("should handle imports without transcript URLs", async () => {
      const sessionImport = await prisma.sessionImport.create({
        data: {
          sessionId: "test-session-2",
          companyId: testCompany.id,
          userId: "user456",
          language: "en",
          country: "US",
          startTime: new Date("2024-01-15T11:00:00Z"),
          status: "PENDING",
        },
      });

      await processSessionImports(testCompany.id);

      const session = await prisma.session.findFirst({
        where: { importId: sessionImport.id },
      });

      expect(session).toBeTruthy();
      expect(session?.transcriptContent).toBeNull();
      expect(session?.messages).toHaveLength(0);
    });

    it("should handle transcript parsing errors gracefully", async () => {
      const sessionImport = await prisma.sessionImport.create({
        data: {
          sessionId: "test-session-3",
          companyId: testCompany.id,
          fullTranscriptUrl: "https://example.com/bad-transcript.txt",
          startTime: new Date(),
          status: "PENDING",
        },
      });

      // Mock transcript fetching to throw error
      vi.mocked(transcriptFetcher).mockRejectedValueOnce(new Error("Network error"));

      await processSessionImports(testCompany.id);

      // Session should still be created but without transcript
      const session = await prisma.session.findFirst({
        where: { importId: sessionImport.id },
      });

      expect(session).toBeTruthy();
      expect(session?.transcriptContent).toBeNull();

      // Import should be marked as processed with error
      const updatedImport = await prisma.sessionImport.findUnique({
        where: { id: sessionImport.id },
      });
      expect(updatedImport?.status).toBe("ERROR");
    });
  });

  describe("AI Analysis Processing", () => {
    let testSession: Session;

    beforeEach(async () => {
      // Create a session ready for AI processing
      testSession = await prisma.session.create({
        data: {
          sessionId: "test-session-ai",
          companyId: testCompany.id,
          startTime: new Date(),
          messages: {
            create: [
              { role: "User", content: "I need 10 days of vacation", order: 0 },
              { role: "Assistant", content: "I'll help you with that", order: 1 },
            ],
          },
        },
      });
    });

    it("should create batch job for unprocessed sessions", async () => {
      // Create multiple sessions for batch processing
      const sessions = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          prisma.session.create({
            data: {
              sessionId: `batch-session-${i}`,
              companyId: testCompany.id,
              startTime: new Date(),
              transcriptContent: mockTranscript,
            },
          })
        )
      );

      // Mock OpenAI batch API
      const openai = await import("openai");
      vi.mocked(openai.default.prototype.batches.create).mockResolvedValueOnce({
        id: "batch_abc123",
        object: "batch",
        endpoint: "/v1/chat/completions",
        errors: null,
        input_file_id: "file-abc123",
        completion_window: "24h",
        status: "validating",
        created_at: Date.now() / 1000,
      } as any);

      // Create batch job
      await createBatchJob(testCompany.id);

      // Verify batch request was created
      const batchRequest = await prisma.aIBatchRequest.findFirst({
        where: { companyId: testCompany.id },
      });

      expect(batchRequest).toBeTruthy();
      expect(batchRequest?.openaiBatchId).toBe("batch_abc123");
      expect(batchRequest?.status).toBe("SUBMITTED");

      // Verify sessions are linked to batch
      const linkedSessions = await prisma.session.count({
        where: {
          companyId: testCompany.id,
          batchRequestId: batchRequest?.id,
        },
      });
      expect(linkedSessions).toBe(5);
    });

    it("should check and update batch statuses", async () => {
      // Create a batch request
      const batchRequest = await prisma.aIBatchRequest.create({
        data: {
          companyId: testCompany.id,
          openaiBatchId: "batch_xyz789",
          inputFileId: "file-input",
          status: "SUBMITTED",
        },
      });

      // Mock OpenAI batch status check
      const openai = await import("openai");
      vi.mocked(openai.default.prototype.batches.retrieve).mockResolvedValueOnce({
        id: "batch_xyz789",
        status: "completed",
        output_file_id: "file-output",
        completed_at: Date.now() / 1000,
      } as any);

      // Check batch status
      await checkBatchStatuses(testCompany.id);

      // Verify batch status was updated
      const updatedBatch = await prisma.aIBatchRequest.findUnique({
        where: { id: batchRequest.id },
      });

      expect(updatedBatch?.status).toBe("COMPLETED");
      expect(updatedBatch?.outputFileId).toBe("file-output");
      expect(updatedBatch?.completedAt).toBeTruthy();
    });

    it("should process completed batch results", async () => {
      // Create completed batch with linked sessions
      const batchRequest = await prisma.aIBatchRequest.create({
        data: {
          companyId: testCompany.id,
          openaiBatchId: "batch_completed",
          inputFileId: "file-input",
          outputFileId: "file-output",
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      // Link session to batch
      await prisma.session.update({
        where: { id: testSession.id },
        data: { batchRequestId: batchRequest.id },
      });

      // Mock batch results file
      const mockBatchResults = [
        {
          custom_id: testSession.id,
          response: {
            status_code: 200,
            body: {
              choices: [{
                message: {
                  content: JSON.stringify({
                    sentiment: "POSITIVE",
                    category: "LEAVE_VACATION",
                    summary: "User requesting 10 days vacation",
                    questions: [
                      "How do I access the HR portal?",
                      "When should my vacation end?"
                    ],
                  }),
                },
              }],
              usage: {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
              },
            },
          },
        },
      ].map(r => JSON.stringify(r)).join("\n");

      // Mock OpenAI file content retrieval
      const openai = await import("openai");
      vi.mocked(openai.default.prototype.files.content).mockResolvedValueOnce({
        text: async () => mockBatchResults,
      } as any);

      // Process batch results
      await processCompletedBatches(testCompany.id);

      // Verify session was updated with AI results
      const updatedSession = await prisma.session.findUnique({
        where: { id: testSession.id },
        include: {
          sessionQuestions: {
            include: { question: true },
            orderBy: { order: "asc" },
          },
        },
      });

      expect(updatedSession?.sentiment).toBe("POSITIVE");
      expect(updatedSession?.category).toBe("LEAVE_VACATION");
      expect(updatedSession?.summary).toBe("User requesting 10 days vacation");
      expect(updatedSession?.sessionQuestions).toHaveLength(2);

      // Verify questions were extracted
      const questions = updatedSession?.sessionQuestions.map(sq => sq.question.content);
      expect(questions).toContain("How do I access the HR portal?");
      expect(questions).toContain("When should my vacation end?");

      // Verify AI processing request was recorded
      const aiRequest = await prisma.aIProcessingRequest.findFirst({
        where: { sessionId: testSession.id },
      });

      expect(aiRequest).toBeTruthy();
      expect(aiRequest?.promptTokens).toBe(100);
      expect(aiRequest?.completionTokens).toBe(50);
      expect(aiRequest?.success).toBe(true);

      // Verify batch was marked as processed
      const processedBatch = await prisma.aIBatchRequest.findUnique({
        where: { id: batchRequest.id },
      });
      expect(processedBatch?.status).toBe("PROCESSED");
    });
  });

  describe("Error Handling and Retry Logic", () => {
    it("should retry failed AI processing", async () => {
      const session = await prisma.session.create({
        data: {
          sessionId: "retry-session",
          companyId: testCompany.id,
          startTime: new Date(),
          transcriptContent: "Test content",
          processingRetries: 1, // Already failed once
        },
      });

      // Mock successful batch creation on retry
      const openai = await import("openai");
      vi.mocked(openai.default.prototype.batches.create).mockResolvedValueOnce({
        id: "batch_retry",
        status: "validating",
      } as any);

      await createBatchJob(testCompany.id);

      // Verify session retry count was incremented
      const updatedSession = await prisma.session.findUnique({
        where: { id: session.id },
      });
      expect(updatedSession?.processingRetries).toBe(2);
    });

    it("should skip sessions that exceeded retry limit", async () => {
      const session = await prisma.session.create({
        data: {
          sessionId: "max-retry-session",
          companyId: testCompany.id,
          startTime: new Date(),
          transcriptContent: "Test content",
          processingRetries: 3, // Max retries reached
        },
      });

      await createBatchJob(testCompany.id);

      // Session should not be included in batch
      const batchRequest = await prisma.aIBatchRequest.findFirst({
        where: { companyId: testCompany.id },
      });

      const linkedSession = await prisma.session.findFirst({
        where: {
          id: session.id,
          batchRequestId: batchRequest?.id,
        },
      });

      expect(linkedSession).toBeNull();
    });
  });

  describe("Complete End-to-End Workflow", () => {
    it("should process from CSV import to AI analysis completion", async () => {
      // Step 1: Create SessionImport
      const sessionImport = await prisma.sessionImport.create({
        data: {
          sessionId: "e2e-session",
          companyId: testCompany.id,
          userId: "user-e2e",
          language: "en",
          country: "US",
          startTime: new Date("2024-01-15T10:00:00Z"),
          endTime: new Date("2024-01-15T10:15:00Z"),
          fullTranscriptUrl: "https://example.com/transcript.txt",
          status: "PENDING",
        },
      });

      // Step 2: Process import (mock transcript)
      vi.mocked(transcriptFetcher).mockResolvedValueOnce(mockTranscript);
      await processSessionImports(testCompany.id);

      // Verify Session created
      const session = await prisma.session.findFirst({
        where: { sessionId: "e2e-session" },
      });
      expect(session).toBeTruthy();
      expect(session?.messages).toHaveLength(10);

      // Step 3: Create batch for AI processing
      const openai = await import("openai");
      vi.mocked(openai.default.prototype.batches.create).mockResolvedValueOnce({
        id: "batch_e2e",
        status: "validating",
      } as any);

      await createBatchJob(testCompany.id);

      // Step 4: Simulate batch completion
      const batchRequest = await prisma.aIBatchRequest.findFirst({
        where: { companyId: testCompany.id },
      });

      await prisma.aIBatchRequest.update({
        where: { id: batchRequest!.id },
        data: {
          status: "COMPLETED",
          outputFileId: "file-e2e-output",
          completedAt: new Date(),
        },
      });

      // Step 5: Process batch results
      const mockResults = [{
        custom_id: session!.id,
        response: {
          status_code: 200,
          body: {
            choices: [{
              message: {
                content: JSON.stringify({
                  sentiment: "POSITIVE",
                  category: "LEAVE_VACATION",
                  summary: "User successfully requested vacation time",
                  questions: ["How do I access the HR portal?"],
                }),
              },
            }],
            usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
          },
        },
      }];

      vi.mocked(openai.default.prototype.files.content).mockResolvedValueOnce({
        text: async () => mockResults.map(r => JSON.stringify(r)).join("\n"),
      } as any);

      await processCompletedBatches(testCompany.id);

      // Final verification
      const finalSession = await prisma.session.findUnique({
        where: { id: session!.id },
        include: {
          messages: true,
          sessionQuestions: { include: { question: true } },
          aiProcessingRequests: true,
        },
      });

      expect(finalSession?.sentiment).toBe("POSITIVE");
      expect(finalSession?.category).toBe("LEAVE_VACATION");
      expect(finalSession?.summary).toBe("User successfully requested vacation time");
      expect(finalSession?.sessionQuestions).toHaveLength(1);
      expect(finalSession?.aiProcessingRequests).toHaveLength(1);
      expect(finalSession?.aiProcessingRequests[0].success).toBe(true);
    });
  });
});