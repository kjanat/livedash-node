import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";
import { processUnprocessedSessions } from "../../../lib/processingScheduler";
import { ProcessingStatusManager } from "../../../lib/processingStatusManager";
import { ProcessingStage } from "@prisma/client";

interface SessionUser {
  email: string;
  name?: string;
}

interface SessionData {
  user: SessionUser;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = (await getServerSession(
    req,
    res,
    authOptions
  )) as SessionData | null;

  if (!session?.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { company: true },
  });

  if (!user) {
    return res.status(401).json({ error: "No user found" });
  }

  // Check if user has ADMIN role
  if (user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    // Get optional parameters from request body
    const { batchSize, maxConcurrency } = req.body;

    // Validate parameters
    const validatedBatchSize = batchSize && batchSize > 0 ? parseInt(batchSize) : null;
    const validatedMaxConcurrency = maxConcurrency && maxConcurrency > 0 ? parseInt(maxConcurrency) : 5;

    // Check how many sessions need AI processing using the new status system
    const sessionsNeedingAI = await ProcessingStatusManager.getSessionsNeedingProcessing(
      ProcessingStage.AI_ANALYSIS,
      1000 // Get count only
    );

    // Filter to sessions for this company
    const companySessionsNeedingAI = sessionsNeedingAI.filter(
      statusRecord => statusRecord.session.companyId === user.companyId
    );

    const unprocessedCount = companySessionsNeedingAI.length;

    if (unprocessedCount === 0) {
      return res.json({
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
        console.log(`[Manual Trigger] Processing completed for company ${user.companyId}`);
      })
      .catch((error) => {
        console.error(`[Manual Trigger] Processing failed for company ${user.companyId}:`, error);
      });

    return res.json({
      success: true,
      message: `Started processing ${unprocessedCount} unprocessed sessions`,
      unprocessedCount,
      batchSize: validatedBatchSize || unprocessedCount,
      maxConcurrency: validatedMaxConcurrency,
      startedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error("[Manual Trigger] Error:", error);
    return res.status(500).json({
      error: "Failed to trigger processing",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
