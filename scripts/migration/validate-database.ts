/**
 * Database Validation and Health Checks
 *
 * Comprehensive validation of database schema, data integrity,
 * and readiness for the new tRPC and batch processing architecture.
 */

import { PrismaClient } from "@prisma/client";
import { migrationLogger } from "./migration-logger";

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  metrics: Record<string, number>;
}

export class DatabaseValidator {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Run comprehensive database validation
   */
  async validateDatabase(): Promise<ValidationResult> {
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: [],
      metrics: {},
    };

    try {
      migrationLogger.startStep(
        "DATABASE_VALIDATION",
        "Running comprehensive database validation"
      );

      // Test database connection
      await this.validateConnection(result);

      // Validate schema integrity
      await this.validateSchemaIntegrity(result);

      // Validate data integrity
      await this.validateDataIntegrity(result);

      // Validate indexes and performance
      await this.validateIndexes(result);

      // Validate batch processing readiness
      await this.validateBatchProcessingReadiness(result);

      // Validate tRPC readiness
      await this.validateTRPCReadiness(result);

      // Collect metrics
      await this.collectMetrics(result);

      result.success = result.errors.length === 0;

      if (result.success) {
        migrationLogger.completeStep("DATABASE_VALIDATION");
      } else {
        migrationLogger.failStep(
          "DATABASE_VALIDATION",
          new Error(`Validation failed with ${result.errors.length} errors`)
        );
      }
    } catch (error) {
      result.success = false;
      result.errors.push(
        `Database validation failed: ${(error as Error).message}`
      );
      migrationLogger.error(
        "DATABASE_VALIDATION",
        "Critical validation error",
        error as Error
      );
    } finally {
      await this.prisma.$disconnect();
    }

    return result;
  }

  private async validateConnection(result: ValidationResult): Promise<void> {
    try {
      migrationLogger.info("DB_CONNECTION", "Testing database connection");
      await this.prisma.$queryRaw`SELECT 1`;
      migrationLogger.info("DB_CONNECTION", "Database connection successful");
    } catch (error) {
      result.errors.push(
        `Database connection failed: ${(error as Error).message}`
      );
    }
  }

  private async validateSchemaIntegrity(
    result: ValidationResult
  ): Promise<void> {
    migrationLogger.info("SCHEMA_VALIDATION", "Validating schema integrity");

    try {
      // Check if all required tables exist
      const requiredTables = [
        "Company",
        "User",
        "Session",
        "SessionImport",
        "Message",
        "SessionProcessingStatus",
        "Question",
        "SessionQuestion",
        "AIBatchRequest",
        "AIProcessingRequest",
        "AIModel",
        "AIModelPricing",
        "CompanyAIModel",
        "PlatformUser",
      ];

      for (const table of requiredTables) {
        try {
          await this.prisma.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
        } catch (error) {
          result.errors.push(
            `Required table missing or inaccessible: ${table}`
          );
        }
      }

      // Check for required enums
      const requiredEnums = [
        "ProcessingStage",
        "ProcessingStatus",
        "AIBatchRequestStatus",
        "AIRequestStatus",
        "SentimentCategory",
        "SessionCategory",
      ];

      for (const enumName of requiredEnums) {
        try {
          const enumValues = await this.prisma.$queryRawUnsafe(
            `SELECT unnest(enum_range(NULL::${enumName})) as value`
          );
          if (Array.isArray(enumValues) && enumValues.length === 0) {
            result.warnings.push(`Enum ${enumName} has no values`);
          }
        } catch (error) {
          result.errors.push(`Required enum missing: ${enumName}`);
        }
      }
    } catch (error) {
      result.errors.push(
        `Schema validation failed: ${(error as Error).message}`
      );
    }
  }

  private async validateDataIntegrity(result: ValidationResult): Promise<void> {
    migrationLogger.info("DATA_INTEGRITY", "Validating data integrity");

    try {
      // Check for orphaned records
      const orphanedSessions = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count 
        FROM "Session" s 
        LEFT JOIN "Company" c ON s."companyId" = c.id 
        WHERE c.id IS NULL
      `;

      if (orphanedSessions[0]?.count > 0) {
        result.errors.push(
          `Found ${orphanedSessions[0].count} orphaned sessions`
        );
      }

      // Check for sessions without processing status
      const sessionsWithoutStatus = await this.prisma.$queryRaw<
        { count: bigint }[]
      >`
        SELECT COUNT(*) as count
        FROM "Session" s
        LEFT JOIN "SessionProcessingStatus" sps ON s.id = sps."sessionId"
        WHERE sps."sessionId" IS NULL
      `;

      if (sessionsWithoutStatus[0]?.count > 0) {
        result.warnings.push(
          `Found ${sessionsWithoutStatus[0].count} sessions without processing status`
        );
      }

      // Check for inconsistent batch processing states
      const inconsistentBatchStates = await this.prisma.$queryRaw<
        { count: bigint }[]
      >`
        SELECT COUNT(*) as count
        FROM "AIProcessingRequest" apr
        WHERE apr."batchId" IS NOT NULL 
        AND apr."processingStatus" = 'PENDING_BATCHING'
      `;

      if (inconsistentBatchStates[0]?.count > 0) {
        result.warnings.push(
          `Found ${inconsistentBatchStates[0].count} requests with inconsistent batch states`
        );
      }
    } catch (error) {
      result.errors.push(
        `Data integrity validation failed: ${(error as Error).message}`
      );
    }
  }

  private async validateIndexes(result: ValidationResult): Promise<void> {
    migrationLogger.info("INDEX_VALIDATION", "Validating database indexes");

    try {
      // Check for missing critical indexes
      const criticalIndexes = [
        { table: "Session", columns: ["companyId", "startTime"] },
        { table: "SessionProcessingStatus", columns: ["stage", "status"] },
        { table: "AIProcessingRequest", columns: ["processingStatus"] },
        { table: "AIBatchRequest", columns: ["companyId", "status"] },
      ];

      for (const indexInfo of criticalIndexes) {
        const indexExists = (await this.prisma.$queryRawUnsafe(`
          SELECT COUNT(*) as count
          FROM pg_indexes 
          WHERE tablename = '${indexInfo.table}' 
          AND indexdef LIKE '%${indexInfo.columns.join("%")}%'
        `)) as { count: string }[];

        if (parseInt(indexExists[0]?.count || "0") === 0) {
          result.warnings.push(
            `Missing recommended index on ${indexInfo.table}(${indexInfo.columns.join(", ")})`
          );
        }
      }
    } catch (error) {
      result.warnings.push(
        `Index validation failed: ${(error as Error).message}`
      );
    }
  }

  private async validateBatchProcessingReadiness(
    result: ValidationResult
  ): Promise<void> {
    migrationLogger.info(
      "BATCH_READINESS",
      "Validating batch processing readiness"
    );

    try {
      // Check if AIBatchRequest table is properly configured
      const batchTableCheck = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM "AIBatchRequest"
      `;

      // Check if AIProcessingRequest has batch-related fields
      const batchFieldsCheck = (await this.prisma.$queryRawUnsafe(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'AIProcessingRequest' 
        AND column_name IN ('processingStatus', 'batchId')
      `)) as { column_name: string }[];

      if (batchFieldsCheck.length < 2) {
        result.errors.push(
          "AIProcessingRequest table missing batch processing fields"
        );
      }

      // Check if batch status enum values are correct
      const batchStatusValues = (await this.prisma.$queryRawUnsafe(`
        SELECT unnest(enum_range(NULL::AIBatchRequestStatus)) as value
      `)) as { value: string }[];

      const requiredBatchStatuses = [
        "PENDING",
        "UPLOADING",
        "VALIDATING",
        "IN_PROGRESS",
        "FINALIZING",
        "COMPLETED",
        "PROCESSED",
        "FAILED",
        "CANCELLED",
      ];

      const missingStatuses = requiredBatchStatuses.filter(
        (status) => !batchStatusValues.some((v) => v.value === status)
      );

      if (missingStatuses.length > 0) {
        result.errors.push(
          `Missing batch status values: ${missingStatuses.join(", ")}`
        );
      }
    } catch (error) {
      result.errors.push(
        `Batch processing readiness validation failed: ${(error as Error).message}`
      );
    }
  }

  private async validateTRPCReadiness(result: ValidationResult): Promise<void> {
    migrationLogger.info("TRPC_READINESS", "Validating tRPC readiness");

    try {
      // Check if all required models are accessible
      const modelTests = [
        () => this.prisma.company.findFirst(),
        () => this.prisma.user.findFirst(),
        () => this.prisma.session.findFirst(),
        () => this.prisma.aIProcessingRequest.findFirst(),
      ];

      for (const test of modelTests) {
        try {
          await test();
        } catch (error) {
          result.warnings.push(
            `Prisma model access issue: ${(error as Error).message}`
          );
        }
      }

      // Test complex queries that tRPC will use
      try {
        await this.prisma.session.findMany({
          where: { companyId: "test" },
          include: {
            messages: true,
            processingStatus: true,
          },
          take: 1,
        });
      } catch (error) {
        // This is expected to fail with the test companyId, but should not error on structure
        if (!(error as Error).message.includes("test")) {
          result.warnings.push(
            `Complex query structure issue: ${(error as Error).message}`
          );
        }
      }
    } catch (error) {
      result.warnings.push(
        `tRPC readiness validation failed: ${(error as Error).message}`
      );
    }
  }

  private async collectMetrics(result: ValidationResult): Promise<void> {
    migrationLogger.info("METRICS_COLLECTION", "Collecting database metrics");

    try {
      // Count records in key tables
      const companiesCount = await this.prisma.company.count();
      const usersCount = await this.prisma.user.count();
      const sessionsCount = await this.prisma.session.count();
      const messagesCount = await this.prisma.message.count();
      const batchRequestsCount = await this.prisma.aIBatchRequest.count();
      const processingRequestsCount =
        await this.prisma.aIProcessingRequest.count();

      result.metrics = {
        companies: companiesCount,
        users: usersCount,
        sessions: sessionsCount,
        messages: messagesCount,
        batchRequests: batchRequestsCount,
        processingRequests: processingRequestsCount,
      };

      // Check processing status distribution
      const processingStatusCounts =
        await this.prisma.sessionProcessingStatus.groupBy({
          by: ["status"],
          _count: { status: true },
        });

      for (const statusCount of processingStatusCounts) {
        result.metrics[`processing_${statusCount.status.toLowerCase()}`] =
          statusCount._count.status;
      }

      // Check batch request status distribution
      const batchStatusCounts = await this.prisma.aIBatchRequest.groupBy({
        by: ["status"],
        _count: { status: true },
      });

      for (const statusCount of batchStatusCounts) {
        result.metrics[`batch_${statusCount.status.toLowerCase()}`] =
          statusCount._count.status;
      }
    } catch (error) {
      result.warnings.push(
        `Metrics collection failed: ${(error as Error).message}`
      );
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new DatabaseValidator();

  validator
    .validateDatabase()
    .then((result) => {
      console.log("\n=== DATABASE VALIDATION RESULTS ===");
      console.log(`Success: ${result.success ? "✅" : "❌"}`);

      if (result.errors.length > 0) {
        console.log("\n❌ ERRORS:");
        result.errors.forEach((error) => console.log(`  - ${error}`));
      }

      if (result.warnings.length > 0) {
        console.log("\n⚠️  WARNINGS:");
        result.warnings.forEach((warning) => console.log(`  - ${warning}`));
      }

      console.log("\n📊 METRICS:");
      Object.entries(result.metrics).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });

      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Validation failed:", error);
      process.exit(1);
    });
}
