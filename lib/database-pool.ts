// Advanced database connection pooling configuration

import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;

import type { Pool } from "pg";
import { env } from "./env";

// Create adapter with connection pool
export const createEnhancedPrismaClient = () => {
  // Parse DATABASE_URL to get connection parameters
  const dbUrl = new URL(env.DATABASE_URL);

  const poolConfig = {
    host: dbUrl.hostname,
    port: Number.parseInt(dbUrl.port || "5432"),
    database: dbUrl.pathname.slice(1), // Remove leading '/'
    user: dbUrl.username,
    password: decodeURIComponent(dbUrl.password),
    ssl:
      dbUrl.searchParams.get("sslmode") !== "disable"
        ? { rejectUnauthorized: false }
        : undefined,

    // Connection pool settings optimized for Neon
    max: env.DATABASE_CONNECTION_LIMIT || 15, // Maximum number of connections (reduced for Neon)
    min: 2, // Minimum connections to keep warm (prevent auto-pause)
    idleTimeoutMillis: env.DATABASE_POOL_TIMEOUT * 1000 || 30000, // Use env timeout
    connectionTimeoutMillis: 10000, // 10 seconds (increased for Neon cold starts)
    query_timeout: 15000, // 15 seconds (increased for Neon)
    statement_timeout: 15000, // 15 seconds (increased for Neon)

    // Keepalive settings to prevent Neon auto-pause
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,

    // Application name for monitoring in Neon dashboard
    application_name:
      dbUrl.searchParams.get("application_name") || "livedash-app",

    // Connection lifecycle
    allowExitOnIdle: false, // Keep minimum connections alive for Neon
  };

  const adapter = new PrismaPg(poolConfig);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });
};

// Connection pool monitoring utilities
export const getPoolStats = (pool: Pool) => {
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingQueries: pool.waitingCount,
    activeConnections: pool.totalCount - pool.idleCount,
  };
};

// Health check for the connection pool
export const checkPoolHealth = async (
  pool: Pool
): Promise<{
  healthy: boolean;
  stats: ReturnType<typeof getPoolStats>;
  error?: string;
}> => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();

    return {
      healthy: true,
      stats: getPoolStats(pool),
    };
  } catch (error) {
    return {
      healthy: false,
      stats: getPoolStats(pool),
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Graceful pool shutdown
export const shutdownPool = async (pool: Pool) => {
  console.log("Shutting down database connection pool...");
  await pool.end();
  console.log("Database connection pool shut down successfully.");
};
