import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { processUnprocessedSessions } from "../../../../lib/processingScheduler";
import { ProcessingStatusManager } from "../../../../lib/processingStatusManager";
import { ProcessingStage } from "@prisma/client";

interface SessionUser {
  email: string;
  name?: string;
}

interface SessionData {
  user: SessionUser;
}

export async function POST(request: NextRequest) {
  const session = (await getServerSession(authOptions)) as SessionData | null;

  if (!session?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { company: true },
  });

  if (!user) {
    return NextResponse.json({ error: "No user found" }, { status: 401 });
  }

  // Check if user has ADMIN role
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    // Get optional parameters from request body
    const body = await request.json();
    const { batchSize, maxConcurrency } = body;

    // Validate parameters
    const validatedBatchSize =
      batchSize && batchSize > 0 ? parseInt(batchSize) : null;
    const validatedMaxConcurrency =
      maxConcurrency && maxConcurrency > 0 ? parseInt(maxConcurrency) : 5;

    // Check how many sessions need AI processing using the new status system
    const sessionsNeedingAI =
      await ProcessingStatusManager.getSessionsNeedingProcessing(
        ProcessingStage.AI_ANALYSIS,
        1000 // Get count only
      );

    // Filter to sessions for this company
    const companySessionsNeedingAI = sessionsNeedingAI.filter(
      (statusRecord) => statusRecord.session.companyId === user.companyId
    );

    const unprocessedCount = companySessionsNeedingAI.length;

    if (unprocessedCount === 0) {
      return NextResponse.json({
        success: true,
        message: "No sessions requiring AI processing found",
        unprocessedCount: 0,
        processedCount: 0,
      });
    }

    // Start processing (this will run asynchronously)
    const startTime = Date.now();

    // Note: We're calling the function but not awaiting it to avoid timeout
    // The processing will continue in the background
    processUnprocessedSessions(validatedBatchSize, validatedMaxConcurrency)
      .then(() => {
        console.log(
          `[Manual Trigger] Processing completed for company ${user.companyId}`
        );
      })
      .catch((error) => {
        console.error(
          `[Manual Trigger] Processing failed for company ${user.companyId}:`,
          error
        );
      });

    return NextResponse.json({
      success: true,
      message: `Started processing ${unprocessedCount} unprocessed sessions`,
      unprocessedCount,
      batchSize: validatedBatchSize || unprocessedCount,
      maxConcurrency: validatedMaxConcurrency,
      startedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Manual Trigger] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to trigger processing",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
