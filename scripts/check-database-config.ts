#!/usr/bin/env tsx
// Database configuration checker for Neon optimization

import { checkDatabaseConnection } from "../lib/prisma.js";
import { withRetry } from "../lib/database-retry.js";

async function checkDatabaseConfig() {
  console.log("🔍 Database Configuration Checker\n");

  // Check environment variables
  console.log("📋 Environment Configuration:");
  console.log(
    `  DATABASE_URL: ${process.env.DATABASE_URL ? "✅ Set" : "❌ Missing"}`
  );
  console.log(
    `  USE_ENHANCED_POOLING: ${process.env.USE_ENHANCED_POOLING || "false"}`
  );
  console.log(
    `  DATABASE_CONNECTION_LIMIT: ${process.env.DATABASE_CONNECTION_LIMIT || "default"}`
  );
  console.log(
    `  DATABASE_POOL_TIMEOUT: ${process.env.DATABASE_POOL_TIMEOUT || "default"}`
  );

  // Parse DATABASE_URL for connection details
  if (process.env.DATABASE_URL) {
    try {
      const dbUrl = new URL(process.env.DATABASE_URL);
      console.log(`  Database Host: ${dbUrl.hostname}`);
      console.log(`  Database Port: ${dbUrl.port || "5432"}`);
      console.log(`  Database Name: ${dbUrl.pathname.slice(1)}`);

      // Check for Neon-specific optimizations
      const searchParams = dbUrl.searchParams;
      console.log(
        `  SSL Mode: ${searchParams.get("sslmode") || "not specified"}`
      );
      console.log(
        `  Connection Limit: ${searchParams.get("connection_limit") || "not specified"}`
      );
      console.log(
        `  Pool Timeout: ${searchParams.get("pool_timeout") || "not specified"}`
      );
    } catch (error) {
      console.log(
        `  ❌ Invalid DATABASE_URL format: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  // Check scheduler intervals
  console.log("\n⏰ Scheduler Configuration:");
  console.log(
    `  CSV Import: ${process.env.CSV_IMPORT_INTERVAL || "*/15 * * * *"}`
  );
  console.log(
    `  Import Processing: ${process.env.IMPORT_PROCESSING_INTERVAL || "*/5 * * * *"}`
  );
  console.log(
    `  Session Processing: ${process.env.SESSION_PROCESSING_INTERVAL || "0 * * * *"}`
  );

  // Test database connectivity
  console.log("\n🔌 Database Connectivity Test:");

  try {
    console.log("  Testing basic connection...");
    const isConnected = await checkDatabaseConnection();
    console.log(
      `  Basic connection: ${isConnected ? "✅ Success" : "❌ Failed"}`
    );

    if (isConnected) {
      console.log("  Testing connection with retry logic...");
      const retryResult = await withRetry(
        async () => {
          const result = await checkDatabaseConnection();
          if (!result) throw new Error("Connection check failed");
          return result;
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
        },
        "connectivity test"
      );
      console.log(
        `  Retry connection: ${retryResult ? "✅ Success" : "❌ Failed"}`
      );
    }
  } catch (error) {
    console.log(
      `  ❌ Connection test failed: ${error instanceof Error ? error.message : error}`
    );
  }

  // Recommendations
  console.log("\n💡 Recommendations:");

  if (
    !process.env.USE_ENHANCED_POOLING ||
    process.env.USE_ENHANCED_POOLING === "false"
  ) {
    console.log("  🔧 Enable enhanced pooling: USE_ENHANCED_POOLING=true");
  }

  if (
    !process.env.DATABASE_CONNECTION_LIMIT ||
    Number.parseInt(process.env.DATABASE_CONNECTION_LIMIT) > 15
  ) {
    console.log(
      "  🔧 Optimize connection limit for Neon: DATABASE_CONNECTION_LIMIT=15"
    );
  }

  if (
    !process.env.DATABASE_POOL_TIMEOUT ||
    Number.parseInt(process.env.DATABASE_POOL_TIMEOUT) < 30
  ) {
    console.log(
      "  🔧 Increase pool timeout for cold starts: DATABASE_POOL_TIMEOUT=30"
    );
  }

  // Check for Neon-specific URL parameters
  if (process.env.DATABASE_URL) {
    const dbUrl = new URL(process.env.DATABASE_URL);
    if (!dbUrl.searchParams.get("sslmode")) {
      console.log("  🔧 Add SSL mode to DATABASE_URL: ?sslmode=require");
    }
    if (!dbUrl.searchParams.get("connection_limit")) {
      console.log(
        "  🔧 Add connection limit to DATABASE_URL: &connection_limit=15"
      );
    }
  }

  console.log("\n✅ Configuration check complete!");
}

// Run the checker
checkDatabaseConfig().catch((error) => {
  console.error("💥 Configuration check failed:", error);
  process.exit(1);
});
