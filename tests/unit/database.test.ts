import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

describe("Database Configuration", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should connect to the test database", async () => {
    // Verify we can connect to the database
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
  });

  it("should use PostgreSQL as the database provider", async () => {
    // Query the database to verify it's PostgreSQL
    const result = (await prisma.$queryRaw`SELECT version()`) as any[];
    expect(result[0].version).toContain("PostgreSQL");
  });

  it("should be using the test database URL", () => {
    // Verify that DATABASE_URL is set to the test database
    expect(process.env.DATABASE_URL).toBeDefined();
    expect(process.env.DATABASE_URL).toContain("postgresql://");

    // If DATABASE_URL_TEST is set, DATABASE_URL should match it (from our test setup)
    if (process.env.DATABASE_URL_TEST) {
      expect(process.env.DATABASE_URL).toBe(process.env.DATABASE_URL_TEST);
    }
  });

  it("should have all required tables", async () => {
    // Verify all our tables exist
    const tables = (await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `) as any[];

    const tableNames = tables.map((t) => t.table_name);

    expect(tableNames).toContain("Company");
    expect(tableNames).toContain("User");
    expect(tableNames).toContain("Session");
    expect(tableNames).toContain("SessionImport");
    expect(tableNames).toContain("Message");
    expect(tableNames).toContain("Question");
    expect(tableNames).toContain("SessionQuestion");
    expect(tableNames).toContain("AIProcessingRequest");
  });

  it("should be able to create and query data", async () => {
    // Test basic CRUD operations
    const company = await prisma.company.create({
      data: {
        name: "Test Company",
        csvUrl: "https://example.com/test.csv",
      },
    });

    expect(company.id).toBeDefined();
    expect(company.name).toBe("Test Company");

    // Clean up
    await prisma.company.delete({
      where: { id: company.id },
    });
  });
});
