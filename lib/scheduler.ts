// node-cron job to auto-refresh session data every 15 mins
import cron from "node-cron";
import { prisma } from "./prisma";
import { fetchAndParseCsv } from "./csvFetcher";

interface SessionCreateData {
    id: string;
    startTime: Date;
    companyId: string;
    [key: string]: unknown;
}

export function startScheduler() {
    cron.schedule("*/15 * * * *", async () => {
        const companies = await prisma.company.findMany();
        for (const company of companies) {
            try {
                const sessions = await fetchAndParseCsv(company.csvUrl, company.csvUsername as string | undefined, company.csvPassword as string | undefined);
                await prisma.session.deleteMany({ where: { companyId: company.id } });

                for (const session of sessions) {
                    const sessionData: SessionCreateData = {
                        ...session,
                        companyId: company.id,
                        id: session.id || session.sessionId || `sess_${Date.now()}`,
                        // Ensure startTime is not undefined
                        startTime: session.startTime || new Date()
                    };

                    // Only include fields that are properly typed for Prisma
                    await prisma.session.create({
                        data: {
                            id: sessionData.id,
                            companyId: sessionData.companyId,
                            startTime: sessionData.startTime,
                            // endTime is required in the schema, so use startTime if not available
                            endTime: session.endTime || new Date(),
                            ipAddress: session.ipAddress || null,
                            country: session.country || null,
                            language: session.language || null,
                            sentiment: typeof session.sentiment === 'number' ? session.sentiment : null,
                            messagesSent: typeof session.messagesSent === 'number' ? session.messagesSent : 0,
                            category: session.category || null
                        }
                    });
                }
                console.log(`[Scheduler] Refreshed sessions for company: ${company.name}`);
            } catch (e) {
                console.error(`[Scheduler] Failed for company: ${company.name} - ${e}`);
            }
        }
    });
}
