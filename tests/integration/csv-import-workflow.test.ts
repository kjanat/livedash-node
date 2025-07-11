/**
 * Integration tests for CSV import workflow
 *
 * Tests the complete end-to-end flow of CSV import:
 * 1. CSV file fetching from URL
 * 2. Parsing and validation of CSV data
 * 3. Creating SessionImport records
 * 4. Error handling and retry logic
 * 5. Authentication and access control
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { runCSVImport } from "@/lib/scheduler";
import type { Company, SessionImport } from "@prisma/client";

// Mock external dependencies
vi.mock("node-fetch");

describe("CSV Import Workflow Integration Tests", () => {
  let testCompany: Company;
  const mockCsvUrl = "https://example.com/test.csv";
  const mockCsvData = `sessionId,userId,language,country,ipAddress,sentiment,messagesSent,startTime,endTime,escalated,forwardedHr,summary
session1,user1,en,US,192.168.1.1,positive,5,2024-01-15T10:00:00Z,2024-01-15T10:30:00Z,false,false,Test session summary
session2,user2,nl,NL,192.168.1.2,neutral,3,2024-01-15T11:00:00Z,2024-01-15T11:20:00Z,true,false,Another test session`;

  beforeEach(async () => {
    // Clean up test data
    await prisma.sessionImport.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.company.deleteMany({});

    // Create test company
    testCompany = await prisma.company.create({
      data: {
        name: "Test Company",
        csvUrl: mockCsvUrl,
        status: "ACTIVE",
      },
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe("Successful CSV Import", () => {
    it("should successfully import CSV data from URL", async () => {
      const fetchMock = await import("node-fetch");
      vi.mocked(fetchMock.default).mockResolvedValueOnce({
        ok: true,
        text: async () => mockCsvData,
        headers: {
          get: () => "text/csv",
        },
      } as any);

      // Run the import
      await runCSVImport(testCompany.id);

      // Verify SessionImport records were created
      const imports = await prisma.sessionImport.findMany({
        where: { companyId: testCompany.id },
        orderBy: { createdAt: "asc" },
      });

      expect(imports).toHaveLength(2);
      expect(imports[0]).toMatchObject({
        sessionId: "session1",
        userId: "user1",
        language: "en",
        country: "US",
        ipAddress: "192.168.1.1",
        sentiment: "positive",
        messagesSent: 5,
        escalated: false,
        forwardedHr: false,
        status: "PENDING",
      });

      expect(imports[1]).toMatchObject({
        sessionId: "session2",
        userId: "user2",
        language: "nl",
        country: "NL",
        ipAddress: "192.168.1.2",
        sentiment: "neutral",
        messagesSent: 3,
        escalated: true,
        forwardedHr: false,
        status: "PENDING",
      });
    });

    it("should handle CSV with authentication", async () => {
      // Update company with credentials
      await prisma.company.update({
        where: { id: testCompany.id },
        data: {
          csvUsername: "testuser",
          csvPassword: "testpass",
        },
      });

      const fetchMock = await import("node-fetch");
      vi.mocked(fetchMock.default).mockImplementation((url, options: any) => {
        // Verify auth header is present
        expect(options.headers.Authorization).toBe(
          `Basic ${Buffer.from("testuser:testpass").toString("base64")}`
        );

        return Promise.resolve({
          ok: true,
          text: async () => mockCsvData,
          headers: {
            get: () => "text/csv",
          },
        } as any);
      });

      await runCSVImport(testCompany.id);

      const imports = await prisma.sessionImport.count({
        where: { companyId: testCompany.id },
      });
      expect(imports).toBe(2);
    });

    it("should skip duplicate imports", async () => {
      // Create existing import
      await prisma.sessionImport.create({
        data: {
          sessionId: "session1",
          companyId: testCompany.id,
          userId: "user1",
          language: "en",
          country: "US",
          ipAddress: "192.168.1.1",
          sentiment: "positive",
          messagesSent: 5,
          startTime: new Date("2024-01-15T10:00:00Z"),
          endTime: new Date("2024-01-15T10:30:00Z"),
          escalated: false,
          forwardedHr: false,
          status: "PENDING",
        },
      });

      const fetchMock = await import("node-fetch");
      vi.mocked(fetchMock.default).mockResolvedValueOnce({
        ok: true,
        text: async () => mockCsvData,
        headers: {
          get: () => "text/csv",
        },
      } as any);

      await runCSVImport(testCompany.id);

      // Should only have 2 imports (1 existing + 1 new)
      const imports = await prisma.sessionImport.count({
        where: { companyId: testCompany.id },
      });
      expect(imports).toBe(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      const fetchMock = await import("node-fetch");
      vi.mocked(fetchMock.default).mockRejectedValueOnce(
        new Error("Network error")
      );

      // Should not throw
      await expect(runCSVImport(testCompany.id)).resolves.not.toThrow();

      // No imports should be created
      const imports = await prisma.sessionImport.count({
        where: { companyId: testCompany.id },
      });
      expect(imports).toBe(0);
    });

    it("should handle invalid CSV format", async () => {
      const invalidCsv = "invalid,csv,data\nwithout,proper,headers";

      const fetchMock = await import("node-fetch");
      vi.mocked(fetchMock.default).mockResolvedValueOnce({
        ok: true,
        text: async () => invalidCsv,
        headers: {
          get: () => "text/csv",
        },
      } as any);

      await runCSVImport(testCompany.id);

      // No imports should be created for invalid CSV
      const imports = await prisma.sessionImport.count({
        where: { companyId: testCompany.id },
      });
      expect(imports).toBe(0);
    });

    it("should handle HTTP errors", async () => {
      const fetchMock = await import("node-fetch");
      vi.mocked(fetchMock.default).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as any);

      await expect(runCSVImport(testCompany.id)).resolves.not.toThrow();

      const imports = await prisma.sessionImport.count({
        where: { companyId: testCompany.id },
      });
      expect(imports).toBe(0);
    });
  });

  describe("Data Validation", () => {
    it("should validate and transform date fields", async () => {
      const csvWithDates = `sessionId,userId,language,country,ipAddress,sentiment,messagesSent,startTime,endTime,escalated,forwardedHr,summary
session1,user1,en,US,192.168.1.1,positive,5,2024-01-15 10:00:00,2024-01-15 10:30:00,false,false,Test session`;

      const fetchMock = await import("node-fetch");
      vi.mocked(fetchMock.default).mockResolvedValueOnce({
        ok: true,
        text: async () => csvWithDates,
        headers: {
          get: () => "text/csv",
        },
      } as any);

      await runCSVImport(testCompany.id);

      const import1 = await prisma.sessionImport.findFirst({
        where: { sessionId: "session1" },
      });

      expect(import1?.startTime).toBeInstanceOf(Date);
      expect(import1?.endTime).toBeInstanceOf(Date);
    });

    it("should handle missing optional fields", async () => {
      const csvWithMissingFields = `sessionId,userId,language,country,ipAddress,sentiment,messagesSent,startTime,endTime,escalated,forwardedHr,summary
session1,user1,en,,,,5,2024-01-15T10:00:00Z,,,false,`;

      const fetchMock = await import("node-fetch");
      vi.mocked(fetchMock.default).mockResolvedValueOnce({
        ok: true,
        text: async () => csvWithMissingFields,
        headers: {
          get: () => "text/csv",
        },
      } as any);

      await runCSVImport(testCompany.id);

      const import1 = await prisma.sessionImport.findFirst({
        where: { sessionId: "session1" },
      });

      expect(import1).toMatchObject({
        sessionId: "session1",
        userId: "user1",
        language: "en",
        country: null,
        ipAddress: null,
        sentiment: null,
        messagesSent: 5,
        endTime: null,
        forwardedHr: false,
        summary: null,
      });
    });

    it("should normalize boolean fields", async () => {
      const csvWithBooleans = `sessionId,userId,language,country,ipAddress,sentiment,messagesSent,startTime,endTime,escalated,forwardedHr,summary
session1,user1,en,US,192.168.1.1,positive,5,2024-01-15T10:00:00Z,2024-01-15T10:30:00Z,TRUE,yes,Test
session2,user2,en,US,192.168.1.2,positive,5,2024-01-15T10:00:00Z,2024-01-15T10:30:00Z,1,Y,Test
session3,user3,en,US,192.168.1.3,positive,5,2024-01-15T10:00:00Z,2024-01-15T10:30:00Z,FALSE,no,Test
session4,user4,en,US,192.168.1.4,positive,5,2024-01-15T10:00:00Z,2024-01-15T10:30:00Z,0,N,Test`;

      const fetchMock = await import("node-fetch");
      vi.mocked(fetchMock.default).mockResolvedValueOnce({
        ok: true,
        text: async () => csvWithBooleans,
        headers: {
          get: () => "text/csv",
        },
      } as any);

      await runCSVImport(testCompany.id);

      const imports = await prisma.sessionImport.findMany({
        where: { companyId: testCompany.id },
        orderBy: { sessionId: "asc" },
      });

      expect(imports[0].escalated).toBe(true);
      expect(imports[0].forwardedHr).toBe(true);
      expect(imports[1].escalated).toBe(true);
      expect(imports[1].forwardedHr).toBe(true);
      expect(imports[2].escalated).toBe(false);
      expect(imports[2].forwardedHr).toBe(false);
      expect(imports[3].escalated).toBe(false);
      expect(imports[3].forwardedHr).toBe(false);
    });
  });

  describe("Company Status Handling", () => {
    it("should skip import for inactive companies", async () => {
      await prisma.company.update({
        where: { id: testCompany.id },
        data: { status: "INACTIVE" },
      });

      const fetchMock = await import("node-fetch");
      const fetchSpy = vi.mocked(fetchMock.default);

      await runCSVImport(testCompany.id);

      // Should not attempt to fetch CSV
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should skip import for suspended companies", async () => {
      await prisma.company.update({
        where: { id: testCompany.id },
        data: { status: "SUSPENDED" },
      });

      const fetchMock = await import("node-fetch");
      const fetchSpy = vi.mocked(fetchMock.default);

      await runCSVImport(testCompany.id);

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("Batch Import Performance", () => {
    it("should handle large CSV files efficiently", async () => {
      // Generate large CSV with 1000 rows
      const largeCSVRows = [
        "sessionId,userId,language,country,ipAddress,sentiment,messagesSent,startTime,endTime,escalated,forwardedHr,summary",
      ];

      for (let i = 0; i < 1000; i++) {
        largeCSVRows.push(
          `session${i},user${i},en,US,192.168.1.${i % 255},positive,5,2024-01-15T10:00:00Z,2024-01-15T10:30:00Z,false,false,Session ${i}`
        );
      }

      const largeCsv = largeCSVRows.join("\n");

      const fetchMock = await import("node-fetch");
      vi.mocked(fetchMock.default).mockResolvedValueOnce({
        ok: true,
        text: async () => largeCsv,
        headers: {
          get: () => "text/csv",
        },
      } as any);

      const startTime = Date.now();
      await runCSVImport(testCompany.id);
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000);

      // Verify all imports were created
      const importCount = await prisma.sessionImport.count({
        where: { companyId: testCompany.id },
      });
      expect(importCount).toBe(1000);
    });
  });
});
