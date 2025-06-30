// Database connection health monitoring endpoint
import { type NextRequest, NextResponse } from "next/server";
import { checkDatabaseConnection, prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Check if user has admin access (you may want to add proper auth here)
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Basic database connectivity check
    const isConnected = await checkDatabaseConnection();

    if (!isConnected) {
      return NextResponse.json(
        {
          status: "unhealthy",
          database: {
            connected: false,
            error: "Database connection failed",
          },
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Get basic metrics
    const metrics = await Promise.allSettled([
      // Count total sessions
      prisma.session.count(),
      // Count processing status records
      prisma.sessionProcessingStatus.count(),
      // Count total AI requests
      prisma.aIProcessingRequest.count(),
    ]);

    const [sessionsResult, statusResult, aiRequestsResult] = metrics;

    return NextResponse.json({
      status: "healthy",
      database: {
        connected: true,
        connectionType:
          process.env.USE_ENHANCED_POOLING === "true"
            ? "enhanced_pooling"
            : "standard",
      },
      metrics: {
        totalSessions:
          sessionsResult.status === "fulfilled"
            ? sessionsResult.value
            : "error",
        processingRecords:
          statusResult.status === "fulfilled" ? statusResult.value : "error",
        recentAIRequests:
          aiRequestsResult.status === "fulfilled"
            ? aiRequestsResult.value
            : "error",
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        enhancedPooling: process.env.USE_ENHANCED_POOLING === "true",
        connectionLimit: process.env.DATABASE_CONNECTION_LIMIT || "default",
        poolTimeout: process.env.DATABASE_POOL_TIMEOUT || "default",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
