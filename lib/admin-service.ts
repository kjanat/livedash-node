import { getServerSession } from "next-auth";
import { authOptions } from "../app/api/auth/[...nextauth]/route"; // Adjust path as needed
import { prisma } from "./prisma";
import { processUnprocessedSessions } from "./processingSchedulerNoCron";

export async function getAdminUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Not logged in");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email as string },
    include: { company: true },
  });

  if (!user) {
    throw new Error("No user found");
  }

  if (user.role !== "admin") {
    throw new Error("Admin access required");
  }

  return user;
}

export async function triggerSessionProcessing(batchSize?: number, maxConcurrency?: number) {
  const unprocessedCount = await prisma.session.count({
    where: {
      processed: false,
      messages: { some: {} }, // Must have messages
    },
  });

  if (unprocessedCount === 0) {
    return { message: "No unprocessed sessions found", unprocessedCount: 0, processedCount: 0 };
  }

  processUnprocessedSessions(batchSize, maxConcurrency)
    .then(() => {
      console.log(`[Manual Trigger] Processing completed`);
    })
    .catch((error) => {
      console.error(`[Manual Trigger] Processing failed:`, error);
    });

  return { message: `Started processing ${unprocessedCount} unprocessed sessions`, unprocessedCount };
}
