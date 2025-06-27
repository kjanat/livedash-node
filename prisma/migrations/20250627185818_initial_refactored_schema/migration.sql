-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "csvUrl" TEXT NOT NULL,
    "csvUsername" TEXT,
    "csvPassword" TEXT,
    "sentimentAlert" REAL,
    "dashboardOpts" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "companyId" TEXT NOT NULL,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "importId" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "country" TEXT,
    "fullTranscriptUrl" TEXT,
    "avgResponseTime" REAL,
    "initialMsg" TEXT,
    "language" TEXT,
    "messagesSent" INTEGER,
    "sentiment" TEXT,
    "escalated" BOOLEAN,
    "forwardedHr" BOOLEAN,
    "category" TEXT,
    "summary" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_importId_fkey" FOREIGN KEY ("importId") REFERENCES "SessionImport" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "externalSessionId" TEXT NOT NULL,
    "startTimeRaw" TEXT NOT NULL,
    "endTimeRaw" TEXT NOT NULL,
    "ipAddress" TEXT,
    "countryCode" TEXT,
    "language" TEXT,
    "messagesSent" INTEGER,
    "sentimentRaw" TEXT,
    "escalatedRaw" TEXT,
    "forwardedHrRaw" TEXT,
    "fullTranscriptUrl" TEXT,
    "avgResponseTimeSeconds" REAL,
    "tokens" INTEGER,
    "tokensEur" REAL,
    "category" TEXT,
    "initialMessage" TEXT,
    "rawTranscriptContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "errorMsg" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionImport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "timestamp" DATETIME,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SessionQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIProcessingRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "openaiRequestId" TEXT,
    "model" TEXT NOT NULL,
    "serviceTier" TEXT,
    "systemFingerprint" TEXT,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "cachedTokens" INTEGER,
    "audioTokensPrompt" INTEGER,
    "reasoningTokens" INTEGER,
    "audioTokensCompletion" INTEGER,
    "acceptedPredictionTokens" INTEGER,
    "rejectedPredictionTokens" INTEGER,
    "promptTokenCost" REAL NOT NULL,
    "completionTokenCost" REAL NOT NULL,
    "totalCostEur" REAL NOT NULL,
    "processingType" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "AIProcessingRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_importId_key" ON "Session"("importId");

-- CreateIndex
CREATE INDEX "Session_companyId_startTime_idx" ON "Session"("companyId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "SessionImport_externalSessionId_key" ON "SessionImport"("externalSessionId");

-- CreateIndex
CREATE INDEX "SessionImport_status_idx" ON "SessionImport"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionImport_companyId_externalSessionId_key" ON "SessionImport"("companyId", "externalSessionId");

-- CreateIndex
CREATE INDEX "Message_sessionId_order_idx" ON "Message"("sessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Message_sessionId_order_key" ON "Message"("sessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Question_content_key" ON "Question"("content");

-- CreateIndex
CREATE INDEX "SessionQuestion_sessionId_idx" ON "SessionQuestion"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionQuestion_sessionId_questionId_key" ON "SessionQuestion"("sessionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionQuestion_sessionId_order_key" ON "SessionQuestion"("sessionId", "order");

-- CreateIndex
CREATE INDEX "AIProcessingRequest_sessionId_idx" ON "AIProcessingRequest"("sessionId");

-- CreateIndex
CREATE INDEX "AIProcessingRequest_requestedAt_idx" ON "AIProcessingRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "AIProcessingRequest_model_idx" ON "AIProcessingRequest"("model");
