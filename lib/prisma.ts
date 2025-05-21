// Simple Prisma client setup
import { PrismaClient } from "@prisma/client";

// Add prisma to the NodeJS global type
// This approach avoids NodeJS.Global which is not available

// Prevent multiple instances of Prisma Client in development
declare const global: {
  prisma: PrismaClient | undefined;
};

// Initialize Prisma Client
const prisma = global.prisma || new PrismaClient();

// Save in global if we're in development
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export { prisma };
