/*
  Warnings:

  - You are about to drop the column `transcriptContent` on the `Session` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "country" TEXT,
    "language" TEXT,
    "messagesSent" INTEGER,
    "sentiment" REAL,
    "sentimentCategory" TEXT,
    "escalated" BOOLEAN,
    "forwardedHr" BOOLEAN,
    "fullTranscriptUrl" TEXT,
    "avgResponseTime" REAL,
    "tokens" INTEGER,
    "tokensEur" REAL,
    "category" TEXT,
    "initialMsg" TEXT,
    "processed" BOOLEAN,
    "questions" TEXT,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("avgResponseTime", "category", "companyId", "country", "createdAt", "endTime", "escalated", "forwardedHr", "fullTranscriptUrl", "id", "initialMsg", "ipAddress", "language", "messagesSent", "processed", "questions", "sentiment", "sentimentCategory", "startTime", "summary", "tokens", "tokensEur") SELECT "avgResponseTime", "category", "companyId", "country", "createdAt", "endTime", "escalated", "forwardedHr", "fullTranscriptUrl", "id", "initialMsg", "ipAddress", "language", "messagesSent", "processed", "questions", "sentiment", "sentimentCategory", "startTime", "summary", "tokens", "tokensEur" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
