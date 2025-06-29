// Advanced database connection pooling configuration

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { env } from "./env.js";

// Enhanced connection pool configuration
const createConnectionPool = () => {
  // Parse DATABASE_URL to get connection parameters
  const databaseUrl = new URL(env.DATABASE_URL);

  const pool = new Pool({
    host: databaseUrl.hostname,
    port: Number.parseInt(databaseUrl.port) || 5432,
    user: databaseUrl.username,
    password: databaseUrl.password,
    database: databaseUrl.pathname.slice(1), // Remove leading slash
    ssl: databaseUrl.searchParams.get("sslmode") !== "disable",

    // Connection pool configuration
    max: env.DATABASE_CONNECTION_LIMIT, // Maximum number of connections
    min: 2, // Minimum number of connections to maintain
    idleTimeoutMillis: env.DATABASE_POOL_TIMEOUT * 1000, // Close idle connections after timeout
    connectionTimeoutMillis: 10000, // Connection timeout
    maxUses: 1000, // Maximum uses per connection before cycling
    allowExitOnIdle: true, // Allow process to exit when all connections are idle

    // Health check configuration
    query_timeout: 30000, // Query timeout
    keepAlive: true,
    keepAliveInitialDelayMillis: 30000,
  });

  // Connection pool event handlers
  pool.on("connect", () => {
    console.log(
      `Database connection established. Active connections: ${pool.totalCount}`
    );
  });

  pool.on("acquire", () => {
    console.log(
      `Connection acquired from pool. Waiting: ${pool.waitingCount}, Idle: ${pool.idleCount}`
    );
  });

  pool.on("release", () => {
    console.log(
      `Connection released to pool. Active: ${pool.totalCount - pool.idleCount}, Idle: ${pool.idleCount}`
    );
  });

  pool.on("error", (err) => {
    console.error("Database pool error:", err);
  });

  pool.on("remove", () => {
    console.log(
      `Connection removed from pool. Total connections: ${pool.totalCount}`
    );
  });

  return pool;
};

// Create adapter with connection pool
export const createEnhancedPrismaClient = () => {
  const pool = createConnectionPool();
  const adapter = new PrismaPg(pool);

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
