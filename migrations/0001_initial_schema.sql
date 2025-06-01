-- Initial database schema for LiveDash-Node
-- This combines the init migration and transcript_content addition

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "csvUrl" TEXT NOT NULL,
    "csvUsername" TEXT,
    "csvPassword" TEXT,
    "sentimentAlert" REAL,
    "dashboardOpts" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "country" TEXT,
    "language" TEXT,
    "messagesSent" INTEGER,
    "sentiment" REAL,
    "escalated" BOOLEAN,
    "forwardedHr" BOOLEAN,
    "fullTranscriptUrl" TEXT,
    "transcriptContent" TEXT,
    "avgResponseTime" REAL,
    "tokens" INTEGER,
    "tokensEur" REAL,
    "category" TEXT,
    "initialMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
