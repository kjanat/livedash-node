import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { processUnprocessedSessions, getAIProcessingCosts } from "../../lib/processingScheduler";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    session: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    aIProcessingRequest: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    sessionProcessingStatus: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../../lib/schedulerConfig", () => ({
  getSchedulerConfig: () => ({ enabled: true }),
}));

vi.mock("node-fetch", () => ({
  default: vi.fn(),
}));

describe("Processing Scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("processUnprocessedSessions", () => {
    it("should process sessions needing AI analysis", async () => {
      const mockSessions = [
        {
          id: "session1",
          messages: [
            { id: "msg1", content: "Hello", role: "user" },
            { id: "msg2", content: "Hi there", role: "assistant" },
          ],
        },
      ];

      const { prisma } = await import("../../lib/prisma");
      vi.mocked(prisma.session.findMany).mockResolvedValue(mockSessions);
      vi.mocked(prisma.session.update).mockResolvedValue({} as any);

      // Mock fetch for OpenAI API
      const mockFetch = await import("node-fetch");
      vi.mocked(mockFetch.default).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "chatcmpl-test",
          model: "gpt-4o",
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "Test summary",
                  sentiment: "POSITIVE",
                  category: "SUPPORT",
                  language: "en",
                }),
              },
            },
          ],
        }),
      } as any);

      await expect(processUnprocessedSessions(1)).resolves.not.toThrow();
    });

    it("should handle errors gracefully", async () => {
      const { prisma } = await import("../../lib/prisma");
      vi.mocked(prisma.session.findMany).mockRejectedValue(new Error("Database error"));

      await expect(processUnprocessedSessions(1)).resolves.not.toThrow();
    });
  });

  describe("getAIProcessingCosts", () => {
    it("should calculate processing costs correctly", async () => {
      const mockAggregation = {
        _sum: {
          totalCostEur: 10.50,
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
        },
        _count: {
          id: 25,
        },
      };

      const { prisma } = await import("../../lib/prisma");
      vi.mocked(prisma.aIProcessingRequest.aggregate).mockResolvedValue(mockAggregation);

      const result = await getAIProcessingCosts();

      expect(result).toEqual({
        totalCostEur: 10.50,
        totalRequests: 25,
        totalPromptTokens: 1000,
        totalCompletionTokens: 500,
        totalTokens: 1500,
      });
    });

    it("should handle null aggregation results", async () => {
      const mockAggregation = {
        _sum: {
          totalCostEur: null,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
        },
        _count: {
          id: 0,
        },
      };

      const { prisma } = await import("../../lib/prisma");
      vi.mocked(prisma.aIProcessingRequest.aggregate).mockResolvedValue(mockAggregation);

      const result = await getAIProcessingCosts();

      expect(result).toEqual({
        totalCostEur: 0,
        totalRequests: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
      });
    });
  });
});