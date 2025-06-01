// Prisma client setup with support for Cloudflare D1
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

// Add prisma to the NodeJS global type
// This approach avoids NodeJS.Global which is not available

// Prevent multiple instances of Prisma Client in development
declare const global: {
  prisma: PrismaClient | undefined;
};

// Check if we're running in Cloudflare Workers environment
const isCloudflareWorker = typeof globalThis.DB !== "undefined";

// Initialize Prisma Client
let prisma: PrismaClient;

if (isCloudflareWorker) {
  // In Cloudflare Workers, use D1 adapter
  const adapter = new PrismaD1(globalThis.DB);
  prisma = new PrismaClient({ adapter });
} else {
  // In Next.js/Node.js, use regular SQLite
  prisma = global.prisma || new PrismaClient();

  // Save in global if we're in development
  if (process.env.NODE_ENV !== "production") {
    global.prisma = prisma;
  }
}

export { prisma };
