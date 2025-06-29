// Enhanced Prisma client setup with connection pooling
import { PrismaClient } from "@prisma/client";
import { createEnhancedPrismaClient } from "./database-pool.js";
import { env } from "./env.js";

// Add prisma to the NodeJS global type
declare const global: {
  prisma: PrismaClient | undefined;
};

// Connection pooling configuration
const createPrismaClient = () => {
  // Use enhanced pooling in production or when explicitly enabled
  const useEnhancedPooling =
    process.env.NODE_ENV === "production" ||
    process.env.USE_ENHANCED_POOLING === "true";

  if (useEnhancedPooling) {
    console.log("Using enhanced database connection pooling with PG adapter");
    return createEnhancedPrismaClient();
  }

  // Default Prisma client with basic configuration
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });
};

// Initialize Prisma Client with singleton pattern
const prisma = global.prisma || createPrismaClient();

// Save in global if we're in development to prevent multiple instances
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

// Graceful shutdown handling
const gracefulShutdown = async () => {
  console.log("Gracefully disconnecting from database...");
  await prisma.$disconnect();
  process.exit(0);
};

// Handle process termination signals
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// Connection health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
};

export { prisma };
