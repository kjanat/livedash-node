import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { processQueuedImports } from "../../lib/importProcessor";
import { ProcessingStatusManager } from "../../lib/processingStatusManager";

vi.mock("../../lib/prisma", () => ({
  prisma: new PrismaClient(),
}));

vi.mock("../../lib/processingStatusManager", () => ({
  ProcessingStatusManager: {
    initializeStage: vi.fn(),
    startStage: vi.fn(),
    completeStage: vi.fn(),
    failStage: vi.fn(),
    skipStage: vi.fn(),
  },
}));

describe("Import Processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("processQueuedImports", () => {
    it("should process imports within specified limit", async () => {
      const mockSessionImports = [
        {
          id: "import1",
          companyId: "company1",
          externalSessionId: "session1",
          startTimeRaw: "2024-01-01 10:00:00",
          endTimeRaw: "2024-01-01 11:00:00",
          ipAddress: "192.168.1.1",
          countryCode: "US",
          language: "en",
          messagesSent: 5,
          sentimentRaw: "positive",
          escalatedRaw: "false",
          forwardedHrRaw: "false",
          fullTranscriptUrl: "http://example.com/transcript1",
          avgResponseTimeSeconds: 2.5,
          tokens: 100,
          tokensEur: 0.002,
          category: "SUPPORT",
          initialMessage: "Hello, I need help",
        },
      ];

      // Mock the prisma queries
      const prismaMock = {
        sessionImport: {
          findMany: vi.fn().mockResolvedValue(mockSessionImports),
        },
        session: {
          create: vi.fn().mockResolvedValue({
            id: "new-session-id",
            companyId: "company1",
            sessionId: "session1",
          }),
        },
      };

      // Replace the prisma import with our mock
      vi.doMock("../../lib/prisma", () => ({
        prisma: prismaMock,
      }));

      const result = await processQueuedImports(10);

      expect(prismaMock.sessionImport.findMany).toHaveBeenCalledWith({
        where: {
          processingStatus: {
            some: {
              stage: "CSV_IMPORT",
              status: "COMPLETED",
            },
            none: {
              stage: "SESSION_CREATION",
              status: "COMPLETED",
            },
          },
        },
        take: 10,
        orderBy: { createdAt: "asc" },
      });

      expect(result.processed).toBe(1);
      expect(result.total).toBe(1);
    });

    it("should handle processing errors gracefully", async () => {
      const mockSessionImports = [
        {
          id: "import1",
          companyId: "company1",
          externalSessionId: "session1",
          startTimeRaw: "invalid-date",
          endTimeRaw: "2024-01-01 11:00:00",
        },
      ];

      const prismaMock = {
        sessionImport: {
          findMany: vi.fn().mockResolvedValue(mockSessionImports),
        },
        session: {
          create: vi.fn().mockRejectedValue(new Error("Database error")),
        },
      };

      vi.doMock("../../lib/prisma", () => ({
        prisma: prismaMock,
      }));

      const result = await processQueuedImports(10);

      expect(ProcessingStatusManager.failStage).toHaveBeenCalled();
      expect(result.processed).toBe(0);
      expect(result.errors).toBe(1);
    });

    it("should correctly parse sentiment values", async () => {
      const testCases = [
        { sentimentRaw: "positive", expected: "POSITIVE" },
        { sentimentRaw: "negative", expected: "NEGATIVE" },
        { sentimentRaw: "neutral", expected: "NEUTRAL" },
        { sentimentRaw: "unknown", expected: "NEUTRAL" },
        { sentimentRaw: null, expected: "NEUTRAL" },
      ];

      for (const testCase of testCases) {
        const mockImport = {
          id: "import1",
          companyId: "company1",
          externalSessionId: "session1",
          sentimentRaw: testCase.sentimentRaw,
          startTimeRaw: "2024-01-01 10:00:00",
          endTimeRaw: "2024-01-01 11:00:00",
        };

        const prismaMock = {
          sessionImport: {
            findMany: vi.fn().mockResolvedValue([mockImport]),
          },
          session: {
            create: vi.fn().mockImplementation((data) => {
              expect(data.data.sentiment).toBe(testCase.expected);
              return Promise.resolve({ id: "session-id" });
            }),
          },
        };

        vi.doMock("../../lib/prisma", () => ({
          prisma: prismaMock,
        }));

        await processQueuedImports(1);
      }
    });

    it("should handle boolean string conversions", async () => {
      const mockImport = {
        id: "import1",
        companyId: "company1",
        externalSessionId: "session1",
        escalatedRaw: "true",
        forwardedHrRaw: "false",
        startTimeRaw: "2024-01-01 10:00:00",
        endTimeRaw: "2024-01-01 11:00:00",
      };

      const prismaMock = {
        sessionImport: {
          findMany: vi.fn().mockResolvedValue([mockImport]),
        },
        session: {
          create: vi.fn().mockImplementation((data) => {
            expect(data.data.escalated).toBe(true);
            expect(data.data.forwardedHr).toBe(false);
            return Promise.resolve({ id: "session-id" });
          }),
        },
      };

      vi.doMock("../../lib/prisma", () => ({
        prisma: prismaMock,
      }));

      await processQueuedImports(1);
    });

    it("should validate required fields", async () => {
      const mockImport = {
        id: "import1",
        companyId: null, // Invalid - missing required field
        externalSessionId: "session1",
        startTimeRaw: "2024-01-01 10:00:00",
        endTimeRaw: "2024-01-01 11:00:00",
      };

      const prismaMock = {
        sessionImport: {
          findMany: vi.fn().mockResolvedValue([mockImport]),
        },
        session: {
          create: vi.fn(),
        },
      };

      vi.doMock("../../lib/prisma", () => ({
        prisma: prismaMock,
      }));

      const result = await processQueuedImports(1);

      expect(ProcessingStatusManager.failStage).toHaveBeenCalledWith(
        expect.any(String),
        "SESSION_CREATION",
        expect.stringContaining("Missing required field")
      );
      expect(result.errors).toBe(1);
    });
  });
});
