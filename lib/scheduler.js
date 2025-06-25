// Session refresh scheduler - JavaScript version
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { fetchAndStoreSessionsForAllCompanies } from "./csvFetcher.js";

const prisma = new PrismaClient();

/**
 * Refresh sessions for all companies
 */
async function refreshSessions() {
  console.log("[Scheduler] Starting session refresh...");
  try {
    await fetchAndStoreSessionsForAllCompanies();
    console.log("[Scheduler] Session refresh completed successfully.");
  } catch (error) {
    console.error("[Scheduler] Error during session refresh:", error);
  }
}

/**
 * Start the session refresh scheduler
 */
export function startScheduler() {
  // Run every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    try {
      await refreshSessions();
    } catch (error) {
      console.error("[Scheduler] Error in scheduler:", error);
    }
  });

  console.log(
    "[Scheduler] Started session refresh scheduler (runs every 15 minutes)."
  );
}
