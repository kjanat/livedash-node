import { fetchAndParseCsv } from "../../csvFetcher";
import { prisma } from "../../prisma";
import {
  BaseSchedulerService,
  type SchedulerConfig,
} from "./BaseSchedulerService";

/**
 * CSV Import specific configuration
 */
export interface CsvImportSchedulerConfig extends SchedulerConfig {
  batchSize: number;
  maxConcurrentImports: number;
  skipDuplicateCheck: boolean;
}

/**
 * CSV Import scheduler service
 * Handles periodic CSV data import from companies
 */
export class CsvImportSchedulerService extends BaseSchedulerService {
  private csvConfig: CsvImportSchedulerConfig;

  constructor(config: Partial<CsvImportSchedulerConfig> = {}) {
    const defaultConfig = {
      enabled: true,
      interval: "*/10 * * * *", // Every 10 minutes
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 300000, // 5 minutes timeout
      batchSize: 10,
      maxConcurrentImports: 5,
      skipDuplicateCheck: false,
      ...config,
    };

    super("CSV Import Scheduler", defaultConfig);
    this.csvConfig = defaultConfig;
  }

  /**
   * Execute CSV import task
   */
  protected async executeTask(): Promise<void> {
    console.log(`[${this.name}] Starting CSV import batch processing...`);

    let totalProcessed = 0;
    let totalImported = 0;
    let totalErrors = 0;

    // Process companies in batches to avoid memory issues
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const companies = await prisma.company.findMany({
        where: {
          status: "ACTIVE",
          csvUrl: { not: null as any }, // Only companies with CSV URLs
        },
        take: this.csvConfig.batchSize,
        skip: skip,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          csvUrl: true,
          csvUsername: true,
          csvPassword: true,
        },
      });

      if (companies.length === 0) {
        hasMore = false;
        break;
      }

      totalProcessed += companies.length;

      // Process companies with controlled concurrency
      const results = await this.processBatchWithConcurrency(companies);

      results.forEach((result) => {
        if (result.success) {
          totalImported += result.importedCount || 0;
        } else {
          totalErrors++;
          console.error(
            `[${this.name}] Failed to process company ${result.companyId}:`,
            result.error
          );
        }
      });

      skip += this.csvConfig.batchSize;

      // Emit progress event
      this.emit("progress", {
        processed: totalProcessed,
        imported: totalImported,
        errors: totalErrors,
      });
    }

    console.log(
      `[${this.name}] Batch processing completed. ` +
        `Processed: ${totalProcessed}, Imported: ${totalImported}, Errors: ${totalErrors}`
    );

    // Emit completion metrics
    this.emit("batchCompleted", {
      totalProcessed,
      totalImported,
      totalErrors,
    });
  }

  /**
   * Process a batch of companies with controlled concurrency
   */
  private async processBatchWithConcurrency(
    companies: Array<{
      id: string;
      name: string;
      csvUrl: string | null;
      csvUsername: string | null;
      csvPassword: string | null;
    }>
  ): Promise<
    Array<{
      companyId: string;
      success: boolean;
      importedCount?: number;
      error?: Error;
    }>
  > {
    const results: Array<{
      companyId: string;
      success: boolean;
      importedCount?: number;
      error?: Error;
    }> = [];

    // Process companies in chunks to control concurrency
    const chunkSize = this.csvConfig.maxConcurrentImports;
    for (let i = 0; i < companies.length; i += chunkSize) {
      const chunk = companies.slice(i, i + chunkSize);

      const chunkResults = await Promise.allSettled(
        chunk.map((company) => this.processCompanyImport(company))
      );

      chunkResults.forEach((result, index) => {
        const company = chunk[index];
        if (result.status === "fulfilled") {
          results.push({
            companyId: company.id,
            success: true,
            importedCount: result.value,
          });
        } else {
          results.push({
            companyId: company.id,
            success: false,
            error: result.reason,
          });
        }
      });
    }

    return results;
  }

  /**
   * Process CSV import for a single company
   */
  private async processCompanyImport(company: {
    id: string;
    name: string;
    csvUrl: string | null;
    csvUsername: string | null;
    csvPassword: string | null;
  }): Promise<number> {
    if (!company.csvUrl) {
      throw new Error(`Company ${company.name} has no CSV URL configured`);
    }

    console.log(
      `[${this.name}] Processing CSV import for company: ${company.name}`
    );

    try {
      // Fetch and parse CSV data
      const rawSessionData = await fetchAndParseCsv(
        company.csvUrl,
        company.csvUsername || undefined,
        company.csvPassword || undefined
      );

      let importedCount = 0;

      // Create SessionImport records for new data
      for (const rawSession of rawSessionData) {
        try {
          // Check for duplicates if not skipping
          if (!this.csvConfig.skipDuplicateCheck) {
            const existing = await prisma.sessionImport.findFirst({
              where: {
                companyId: company.id,
                externalSessionId: rawSession.externalSessionId,
              },
            });

            if (existing) {
              console.log(
                `[${this.name}] Skipping duplicate session: ${rawSession.externalSessionId} for company: ${company.name}`
              );
              continue;
            }
          }

          // Create new session import record
          await prisma.sessionImport.create({
            data: {
              companyId: company.id,
              externalSessionId: rawSession.externalSessionId,
              startTimeRaw: rawSession.startTimeRaw,
              endTimeRaw: rawSession.endTimeRaw,
              ipAddress: rawSession.ipAddress,
              countryCode: rawSession.countryCode,
              language: rawSession.language,
              messagesSent: rawSession.messagesSent,
              sentimentRaw: rawSession.sentimentRaw,
              escalatedRaw: rawSession.escalatedRaw,
              forwardedHrRaw: rawSession.forwardedHrRaw,
              fullTranscriptUrl: rawSession.fullTranscriptUrl,
              avgResponseTimeSeconds: rawSession.avgResponseTimeSeconds,
              tokens: rawSession.tokens,
              tokensEur: rawSession.tokensEur,
              category: rawSession.category,
              initialMessage: rawSession.initialMessage,
            },
          });

          importedCount++;
        } catch (sessionError) {
          console.error(
            `[${this.name}] Failed to import session ${rawSession.externalSessionId} for company ${company.name}:`,
            sessionError
          );
          // Continue with other sessions
        }
      }

      console.log(
        `[${this.name}] Successfully imported ${importedCount} sessions for company: ${company.name}`
      );

      return importedCount;
    } catch (error) {
      console.error(
        `[${this.name}] Failed to process CSV import for company ${company.name}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get CSV import specific metrics
   */
  getCsvImportMetrics(): {
    totalCompaniesProcessed: number;
    totalSessionsImported: number;
    averageImportTime: number;
    errorRate: number;
  } {
    const baseMetrics = this.getMetrics();

    // These would be enhanced with actual tracking in a production system
    return {
      totalCompaniesProcessed: baseMetrics.successfulRuns,
      totalSessionsImported: 0, // Would track actual import counts
      averageImportTime: baseMetrics.averageRunTime,
      errorRate:
        baseMetrics.totalRuns > 0
          ? baseMetrics.failedRuns / baseMetrics.totalRuns
          : 0,
    };
  }

  /**
   * Trigger import for a specific company
   */
  async triggerCompanyImport(companyId: string): Promise<number> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        csvUrl: true,
        csvUsername: true,
        csvPassword: true,
      },
    });

    if (!company) {
      throw new Error(`Company with ID ${companyId} not found`);
    }

    return this.processCompanyImport(company);
  }

  /**
   * Update CSV-specific configuration
   */
  updateCsvConfig(newConfig: Partial<CsvImportSchedulerConfig>): void {
    this.csvConfig = { ...this.csvConfig, ...newConfig };
    this.updateConfig(newConfig);
  }

  /**
   * Get CSV-specific configuration
   */
  getCsvConfig(): CsvImportSchedulerConfig {
    return { ...this.csvConfig };
  }
}
