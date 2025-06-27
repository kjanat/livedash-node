-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "SentimentCategory" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "SessionCategory" AS ENUM ('SCHEDULE_HOURS', 'LEAVE_VACATION', 'SICK_LEAVE_RECOVERY', 'SALARY_COMPENSATION', 'CONTRACT_HOURS', 'ONBOARDING', 'OFFBOARDING', 'WORKWEAR_STAFF_PASS', 'TEAM_CONTACTS', 'PERSONAL_QUESTIONS', 'ACCESS_LOGIN', 'SOCIAL_QUESTIONS', 'UNRECOGNIZED_OTHER');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'ERROR');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "csvUrl" TEXT NOT NULL,
    "csvUsername" TEXT,
    "csvPassword" TEXT,
    "sentimentAlert" DOUBLE PRECISION,
    "dashboardOpts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "companyId" TEXT NOT NULL,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "importId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "country" TEXT,
    "fullTranscriptUrl" TEXT,
    "avgResponseTime" DOUBLE PRECISION,
    "initialMsg" TEXT,
    "language" TEXT,
    "messagesSent" INTEGER,
    "sentiment" "SentimentCategory",
    "escalated" BOOLEAN,
    "forwardedHr" BOOLEAN,
    "category" "SessionCategory",
    "summary" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionImport" (
    "id" TEXT NOT NULL,
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
    "avgResponseTimeSeconds" DOUBLE PRECISION,
    "tokens" INTEGER,
    "tokensEur" DOUBLE PRECISION,
    "category" TEXT,
    "initialMessage" TEXT,
    "rawTranscriptContent" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMsg" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3),
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionQuestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIProcessingRequest" (
    "id" TEXT NOT NULL,
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
    "promptTokenCost" DOUBLE PRECISION NOT NULL,
    "completionTokenCost" DOUBLE PRECISION NOT NULL,
    "totalCostEur" DOUBLE PRECISION NOT NULL,
    "processingType" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AIProcessingRequest_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_importId_fkey" FOREIGN KEY ("importId") REFERENCES "SessionImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionImport" ADD CONSTRAINT "SessionImport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionQuestion" ADD CONSTRAINT "SessionQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionQuestion" ADD CONSTRAINT "SessionQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIProcessingRequest" ADD CONSTRAINT "AIProcessingRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
