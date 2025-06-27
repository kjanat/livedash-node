// Vitest test setup
import { vi } from "vitest";

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Set test environment variables
process.env.NEXTAUTH_SECRET = "test-secret";
process.env.NEXTAUTH_URL = "http://localhost:3000";

// Use test database for all database operations during tests
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

// Mock node-fetch for transcript fetcher tests
vi.mock("node-fetch", () => ({
  default: vi.fn(),
}));
