import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ProcessingScheduler } from "../../lib/processingScheduler";

vi.mock("../../lib/prisma", () => ({
  prisma: new PrismaClient(),
}));

vi.mock("../../lib/env", () => ({
  env: {
    OPENAI_API_KEY: "test-key",
    PROCESSING_BATCH_SIZE: "10",
    PROCESSING_INTERVAL_MS: "5000",
  },
}));

describe("Processing Scheduler", () => {
  let scheduler: ProcessingScheduler;

  beforeEach(() => {
    vi.clearAllMocks();
    scheduler = new ProcessingScheduler();
  });

  afterEach(() => {
    if (scheduler) {
      scheduler.stop();
    }
    vi.restoreAllMocks();
  });

  describe("Scheduler lifecycle", () => {
    it("should initialize with correct default settings", () => {
      expect(scheduler).toBeDefined();
      expect(scheduler.isRunning()).toBe(false);
    });

    it("should start and stop correctly", async () => {
      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it("should not start multiple times", () => {
      scheduler.start();
      const firstStart = scheduler.isRunning();

      scheduler.start(); // Should not start again
      const secondStart = scheduler.isRunning();

      expect(firstStart).toBe(true);
      expect(secondStart).toBe(true);

      scheduler.stop();
    });
  });

  describe("Processing pipeline stages", () => {
    it("should process transcript fetch stage", async () => {
      const mockSessions = [
        {
          id: "session1",
          import: {
            fullTranscriptUrl: "http://example.com/transcript1",
            rawTranscriptContent: null,
          },
        },
      ];

      const prismaMock = {
        session: {
          findMany: vi.fn().mockResolvedValue(mockSessions),
          update: vi.fn().mockResolvedValue({}),
        },
      };

      vi.doMock("../../lib/prisma", () => ({
        prisma: prismaMock,
      }));

      // Mock fetch for transcript content
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("Mock transcript content"),
      });

      await scheduler.processTranscriptFetch();

      expect(prismaMock.session.findMany).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        "http://example.com/transcript1"
      );
    });

    it("should process AI analysis stage", async () => {
      const mockSessions = [
        {
          id: "session1",
          transcriptContent: "User: Hello\nAssistant: Hi there!",
          sentiment: null,
          summary: null,
        },
      ];

      const prismaMock = {
        session: {
          findMany: vi.fn().mockResolvedValue(mockSessions),
          update: vi.fn().mockResolvedValue({}),
        },
        aIProcessingRequest: {
          create: vi.fn().mockResolvedValue({ id: "request1" }),
        },
      };

      vi.doMock("../../lib/prisma", () => ({
        prisma: prismaMock,
      }));

      // Mock OpenAI API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    sentiment: "POSITIVE",
                    summary: "Friendly greeting exchange",
                  }),
                },
              },
            ],
            usage: {
              prompt_tokens: 50,
              completion_tokens: 20,
              total_tokens: 70,
            },
          }),
      });

      await scheduler.processAIAnalysis();

      expect(prismaMock.session.findMany).toHaveBeenCalled();
      expect(prismaMock.aIProcessingRequest.create).toHaveBeenCalled();
    });

    it("should handle OpenAI API errors gracefully", async () => {
      const mockSessions = [
        {
          id: "session1",
          transcriptContent: "User: Hello",
        },
      ];

      const prismaMock = {
        session: {
          findMany: vi.fn().mockResolvedValue(mockSessions),
        },
        aIProcessingRequest: {
          create: vi.fn().mockResolvedValue({ id: "request1" }),
        },
      };

      vi.doMock("../../lib/prisma", () => ({
        prisma: prismaMock,
      }));

      // Mock failed OpenAI API call
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve("Rate limit exceeded"),
      });

      await expect(scheduler.processAIAnalysis()).rejects.toThrow();
    });

    it("should process question extraction stage", async () => {
      const mockSessions = [
        {
          id: "session1",
          transcriptContent:
            "User: How do I reset my password?\nAssistant: You can reset it in settings.",
        },
      ];

      const prismaMock = {
        session: {
          findMany: vi.fn().mockResolvedValue(mockSessions),
          update: vi.fn().mockResolvedValue({}),
        },
        question: {
          upsert: vi.fn().mockResolvedValue({}),
        },
        aIProcessingRequest: {
          create: vi.fn().mockResolvedValue({ id: "request1" }),
        },
      };

      vi.doMock("../../lib/prisma", () => ({
        prisma: prismaMock,
      }));

      // Mock OpenAI API for question extraction
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    questions: ["How do I reset my password?"],
                  }),
                },
              },
            ],
            usage: {
              prompt_tokens: 30,
              completion_tokens: 15,
              total_tokens: 45,
            },
          }),
      });

      await scheduler.processQuestionExtraction();

      expect(prismaMock.session.findMany).toHaveBeenCalled();
      expect(prismaMock.question.upsert).toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should handle database connection errors", async () => {
      const prismaMock = {
        session: {
          findMany: vi
            .fn()
            .mockRejectedValue(new Error("Database connection failed")),
        },
      };

      vi.doMock("../../lib/prisma", () => ({
        prisma: prismaMock,
      }));

      await expect(scheduler.processTranscriptFetch()).rejects.toThrow(
        "Database connection failed"
      );
    });

    it("should handle invalid transcript URLs", async () => {
      const mockSessions = [
        {
          id: "session1",
          import: {
            fullTranscriptUrl: "invalid-url",
            rawTranscriptContent: null,
          },
        },
      ];

      const prismaMock = {
        session: {
          findMany: vi.fn().mockResolvedValue(mockSessions),
        },
      };

      vi.doMock("../../lib/prisma", () => ({
        prisma: prismaMock,
      }));

      global.fetch = vi.fn().mockRejectedValue(new Error("Invalid URL"));

      await expect(scheduler.processTranscriptFetch()).rejects.toThrow();
    });

    it("should handle malformed JSON responses from OpenAI", async () => {
      const mockSessions = [
        {
          id: "session1",
          transcriptContent: "User: Hello",
        },
      ];

      const prismaMock = {
        session: {
          findMany: vi.fn().mockResolvedValue(mockSessions),
        },
        aIProcessingRequest: {
          create: vi.fn().mockResolvedValue({ id: "request1" }),
        },
      };

      vi.doMock("../../lib/prisma", () => ({
        prisma: prismaMock,
      }));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: "Invalid JSON response",
                },
              },
            ],
            usage: { total_tokens: 10 },
          }),
      });

      await expect(scheduler.processAIAnalysis()).rejects.toThrow();
    });
  });

  describe("Rate limiting and batching", () => {
    it("should respect batch size limits", async () => {
      const mockSessions = Array.from({ length: 25 }, (_, i) => ({
        id: `session${i}`,
        transcriptContent: `Content ${i}`,
      }));

      const prismaMock = {
        session: {
          findMany: vi.fn().mockResolvedValue(mockSessions),
        },
      };

      vi.doMock("../../lib/prisma", () => ({
        prisma: prismaMock,
      }));

      await scheduler.processAIAnalysis();

      // Should only process up to batch size (10 by default)
      expect(prismaMock.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it("should handle rate limiting gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve("Rate limit exceeded"),
      });

      await expect(scheduler.processAIAnalysis()).rejects.toThrow();

      consoleSpy.mockRestore();
    });
  });
});
