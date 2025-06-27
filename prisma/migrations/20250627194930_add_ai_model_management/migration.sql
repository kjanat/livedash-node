-- CreateTable
CREATE TABLE "AIModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "maxTokens" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIModelPricing" (
    "id" TEXT NOT NULL,
    "aiModelId" TEXT NOT NULL,
    "promptTokenCost" DOUBLE PRECISION NOT NULL,
    "completionTokenCost" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIModelPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAIModel" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "aiModelId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAIModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIModel_name_key" ON "AIModel"("name");

-- CreateIndex
CREATE INDEX "AIModel_provider_isActive_idx" ON "AIModel"("provider", "isActive");

-- CreateIndex
CREATE INDEX "AIModelPricing_aiModelId_effectiveFrom_idx" ON "AIModelPricing"("aiModelId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "AIModelPricing_effectiveFrom_effectiveUntil_idx" ON "AIModelPricing"("effectiveFrom", "effectiveUntil");

-- CreateIndex
CREATE INDEX "CompanyAIModel_companyId_isDefault_idx" ON "CompanyAIModel"("companyId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAIModel_companyId_aiModelId_key" ON "CompanyAIModel"("companyId", "aiModelId");

-- AddForeignKey
ALTER TABLE "AIModelPricing" ADD CONSTRAINT "AIModelPricing_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "AIModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAIModel" ADD CONSTRAINT "CompanyAIModel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAIModel" ADD CONSTRAINT "CompanyAIModel_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "AIModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
