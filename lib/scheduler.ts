// node-cron job to auto-refresh session data every 15 mins
// Note: Disabled due to Next.js compatibility issues
// import cron from "node-cron";
import { prisma } from "./prisma";
import { fetchAndParseCsv } from "./csvFetcher";

interface SessionCreateData {
  id: string;
  startTime: Date;
  companyId: string;
  [key: string]: unknown;
}

export function startScheduler() {
  // Note: Scheduler disabled due to Next.js compatibility issues
  // Use manual triggers via API endpoints instead
  console.log("Session refresh scheduler disabled - using manual triggers via API endpoints");

  // Original cron-based implementation commented out due to Next.js compatibility issues
  // The functionality is now available via the /api/admin/refresh-sessions endpoint
}
