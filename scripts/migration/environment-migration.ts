/**
 * Environment Variable Migration Guide
 *
 * Handles migration of environment variables for the new tRPC and
 * batch processing architecture. Provides validation, transformation,
 * and documentation of required environment changes.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { migrationLogger } from "./migration-logger";

interface EnvironmentConfig {
  key: string;
  description: string;
  defaultValue?: string;
  required: boolean;
  newInVersion?: string;
  deprecated?: boolean;
  validationRegex?: string;
  example?: string;
}

interface MigrationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  added: string[];
  deprecated: string[];
  updated: string[];
}

export class EnvironmentMigration {
  private readonly newEnvironmentVariables: EnvironmentConfig[] = [
    // tRPC Configuration
    {
      key: "TRPC_ENDPOINT_URL",
      description: "Base URL for tRPC API endpoints",
      defaultValue: "http://localhost:3000/api/trpc",
      required: false,
      newInVersion: "2.0.0",
      example: "https://yourdomain.com/api/trpc",
    },
    {
      key: "TRPC_BATCH_TIMEOUT",
      description: "Timeout in milliseconds for tRPC batch requests",
      defaultValue: "30000",
      required: false,
      newInVersion: "2.0.0",
      validationRegex: "^[0-9]+$",
    },
    {
      key: "TRPC_MAX_BATCH_SIZE",
      description: "Maximum number of requests in a single tRPC batch",
      defaultValue: "100",
      required: false,
      newInVersion: "2.0.0",
      validationRegex: "^[0-9]+$",
    },

    // Batch Processing Configuration
    {
      key: "BATCH_PROCESSING_ENABLED",
      description: "Enable OpenAI Batch API processing for cost reduction",
      defaultValue: "true",
      required: false,
      newInVersion: "2.0.0",
      validationRegex: "^(true|false)$",
    },
    {
      key: "BATCH_CREATE_INTERVAL",
      description: "Cron expression for creating new batch requests",
      defaultValue: "*/5 * * * *",
      required: false,
      newInVersion: "2.0.0",
      example: "*/5 * * * * (every 5 minutes)",
    },
    {
      key: "BATCH_STATUS_CHECK_INTERVAL",
      description: "Cron expression for checking batch status",
      defaultValue: "*/2 * * * *",
      required: false,
      newInVersion: "2.0.0",
      example: "*/2 * * * * (every 2 minutes)",
    },
    {
      key: "BATCH_RESULT_PROCESSING_INTERVAL",
      description: "Cron expression for processing batch results",
      defaultValue: "*/1 * * * *",
      required: false,
      newInVersion: "2.0.0",
      example: "*/1 * * * * (every minute)",
    },
    {
      key: "BATCH_MAX_REQUESTS",
      description: "Maximum number of requests per batch",
      defaultValue: "1000",
      required: false,
      newInVersion: "2.0.0",
      validationRegex: "^[0-9]+$",
    },
    {
      key: "BATCH_TIMEOUT_HOURS",
      description: "Maximum hours to wait for batch completion",
      defaultValue: "24",
      required: false,
      newInVersion: "2.0.0",
      validationRegex: "^[0-9]+$",
    },

    // Migration Specific
    {
      key: "MIGRATION_MODE",
      description: "Migration mode: development, staging, or production",
      defaultValue: "development",
      required: false,
      newInVersion: "2.0.0",
      validationRegex: "^(development|staging|production)$",
    },
    {
      key: "MIGRATION_BACKUP_ENABLED",
      description: "Enable automatic database backups during migration",
      defaultValue: "true",
      required: false,
      newInVersion: "2.0.0",
      validationRegex: "^(true|false)$",
    },
    {
      key: "MIGRATION_ROLLBACK_ENABLED",
      description: "Enable rollback capabilities during migration",
      defaultValue: "true",
      required: false,
      newInVersion: "2.0.0",
      validationRegex: "^(true|false)$",
    },

    // Enhanced Security
    {
      key: "RATE_LIMIT_WINDOW_MS",
      description: "Rate limiting window in milliseconds",
      defaultValue: "900000",
      required: false,
      newInVersion: "2.0.0",
      validationRegex: "^[0-9]+$",
      example: "900000 (15 minutes)",
    },
    {
      key: "RATE_LIMIT_MAX_REQUESTS",
      description: "Maximum requests per rate limit window",
      defaultValue: "100",
      required: false,
      newInVersion: "2.0.0",
      validationRegex: "^[0-9]+$",
    },

    // Performance Monitoring
    {
      key: "PERFORMANCE_MONITORING_ENABLED",
      description: "Enable performance monitoring and metrics collection",
      defaultValue: "true",
      required: false,
      newInVersion: "2.0.0",
      validationRegex: "^(true|false)$",
    },
    {
      key: "METRICS_COLLECTION_INTERVAL",
      description: "Interval for collecting performance metrics (in seconds)",
      defaultValue: "60",
      required: false,
      newInVersion: "2.0.0",
      validationRegex: "^[0-9]+$",
    },
  ];

  private readonly deprecatedVariables: string[] = [
    // Add any variables that are being deprecated
    // "OLD_API_ENDPOINT",
    // "LEGACY_PROCESSING_MODE"
  ];

  /**
   * Run complete environment migration
   */
  async migrateEnvironment(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      errors: [],
      warnings: [],
      added: [],
      deprecated: [],
      updated: [],
    };

    try {
      migrationLogger.startStep(
        "ENVIRONMENT_MIGRATION",
        "Migrating environment configuration"
      );

      // Read current environment
      const currentEnv = this.readCurrentEnvironment();

      // Validate existing environment
      await this.validateExistingEnvironment(currentEnv, result);

      // Add new environment variables
      await this.addNewEnvironmentVariables(currentEnv, result);

      // Check for deprecated variables
      await this.checkDeprecatedVariables(currentEnv, result);

      // Create migration guide
      await this.createMigrationGuide(result);

      // Create example environment file
      await this.createExampleEnvironmentFile();

      result.success = result.errors.length === 0;

      if (result.success) {
        migrationLogger.completeStep("ENVIRONMENT_MIGRATION");
      } else {
        migrationLogger.failStep(
          "ENVIRONMENT_MIGRATION",
          new Error(`Migration failed with ${result.errors.length} errors`)
        );
      }
    } catch (error) {
      result.success = false;
      result.errors.push(
        `Environment migration failed: ${(error as Error).message}`
      );
      migrationLogger.error(
        "ENVIRONMENT_MIGRATION",
        "Critical migration error",
        error as Error
      );
    }

    return result;
  }

  private readCurrentEnvironment(): Record<string, string> {
    const envFiles = [".env.local", ".env.production", ".env"];
    const env: Record<string, string> = {};

    // Merge environment from multiple sources
    envFiles.forEach((filename) => {
      const filepath = join(process.cwd(), filename);
      if (existsSync(filepath)) {
        try {
          const content = readFileSync(filepath, "utf8");
          const parsed = this.parseEnvFile(content);
          Object.assign(env, parsed);
          migrationLogger.debug(
            "ENV_READER",
            `Loaded environment from ${filename}`,
            { variables: Object.keys(parsed).length }
          );
        } catch (error) {
          migrationLogger.warn("ENV_READER", `Failed to read ${filename}`, {
            error: (error as Error).message,
          });
        }
      }
    });

    // Include process environment
    Object.assign(env, process.env);

    return env;
  }

  private parseEnvFile(content: string): Record<string, string> {
    const env: Record<string, string> = {};
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").replace(/^["']|["']$/g, "");
          env[key.trim()] = value;
        }
      }
    }

    return env;
  }

  private async validateExistingEnvironment(
    currentEnv: Record<string, string>,
    result: MigrationResult
  ): Promise<void> {
    migrationLogger.info(
      "ENV_VALIDATION",
      "Validating existing environment variables"
    );

    // Check required existing variables
    const requiredExisting = [
      "DATABASE_URL",
      "NEXTAUTH_SECRET",
      "OPENAI_API_KEY",
    ];

    for (const key of requiredExisting) {
      if (!currentEnv[key]) {
        result.errors.push(`Required environment variable missing: ${key}`);
      }
    }

    // Validate new variables that might already exist
    for (const config of this.newEnvironmentVariables) {
      const value = currentEnv[config.key];
      if (value && config.validationRegex) {
        const regex = new RegExp(config.validationRegex);
        if (!regex.test(value)) {
          result.warnings.push(`Invalid format for ${config.key}: ${value}`);
        }
      }
    }
  }

  private async addNewEnvironmentVariables(
    currentEnv: Record<string, string>,
    result: MigrationResult
  ): Promise<void> {
    migrationLogger.info("ENV_ADDITION", "Adding new environment variables");

    const newEnvContent: string[] = [];
    newEnvContent.push(
      "# New environment variables for tRPC and Batch Processing"
    );
    newEnvContent.push("# Added during migration to version 2.0.0");
    newEnvContent.push("");

    let addedCount = 0;

    // Group variables by category
    const categories = {
      "tRPC Configuration": this.newEnvironmentVariables.filter((v) =>
        v.key.startsWith("TRPC_")
      ),
      "Batch Processing": this.newEnvironmentVariables.filter((v) =>
        v.key.startsWith("BATCH_")
      ),
      "Migration Settings": this.newEnvironmentVariables.filter((v) =>
        v.key.startsWith("MIGRATION_")
      ),
      "Security & Performance": this.newEnvironmentVariables.filter(
        (v) =>
          v.key.startsWith("RATE_LIMIT_") ||
          v.key.startsWith("PERFORMANCE_") ||
          v.key.startsWith("METRICS_")
      ),
    };

    for (const [category, variables] of Object.entries(categories)) {
      if (variables.length === 0) continue;

      newEnvContent.push(`# ${category}`);

      for (const config of variables) {
        if (!currentEnv[config.key]) {
          newEnvContent.push(`# ${config.description}`);
          if (config.example) {
            newEnvContent.push(`# Example: ${config.example}`);
          }
          const value = config.defaultValue || "";
          newEnvContent.push(`${config.key}=${value}`);
          newEnvContent.push("");

          result.added.push(config.key);
          addedCount++;
        } else {
          result.updated.push(config.key);
        }
      }

      newEnvContent.push("");
    }

    // Write new environment template
    if (addedCount > 0) {
      const templatePath = join(process.cwd(), ".env.migration.template");
      writeFileSync(templatePath, newEnvContent.join("\n"));
      migrationLogger.info(
        "ENV_ADDITION",
        `Created environment template with ${addedCount} new variables`,
        {
          templatePath,
        }
      );
    }
  }

  private async checkDeprecatedVariables(
    currentEnv: Record<string, string>,
    result: MigrationResult
  ): Promise<void> {
    migrationLogger.info(
      "ENV_DEPRECATION",
      "Checking for deprecated environment variables"
    );

    for (const deprecatedKey of this.deprecatedVariables) {
      if (currentEnv[deprecatedKey]) {
        result.deprecated.push(deprecatedKey);
        result.warnings.push(
          `Deprecated environment variable found: ${deprecatedKey}`
        );
      }
    }
  }

  private async createMigrationGuide(result: MigrationResult): Promise<void> {
    const guide = `
# Environment Migration Guide

This guide helps you migrate your environment configuration for the new tRPC and Batch Processing architecture.

## Migration Summary

- **New Variables Added**: ${result.added.length}
- **Variables Updated**: ${result.updated.length}
- **Variables Deprecated**: ${result.deprecated.length}
- **Errors Found**: ${result.errors.length}
- **Warnings**: ${result.warnings.length}

## Required Actions

### 1. Add New Environment Variables

${
  result.added.length > 0
    ? `
The following new environment variables need to be added to your \`.env.local\` file:

${result.added
  .map((key) => {
    const config = this.newEnvironmentVariables.find((v) => v.key === key);
    return `
#### ${key}
- **Description**: ${config?.description}
- **Default**: ${config?.defaultValue || "Not set"}
- **Required**: ${config?.required ? "Yes" : "No"}
${config?.example ? `- **Example**: ${config.example}` : ""}
`;
  })
  .join("")}
`
    : "No new environment variables need to be added."
}

### 2. Update Existing Variables

${
  result.updated.length > 0
    ? `
The following variables already exist but may need review:

${result.updated.map((key) => `- ${key}`).join("\n")}
`
    : "No existing variables need updates."
}

### 3. Handle Deprecated Variables

${
  result.deprecated.length > 0
    ? `
The following variables are deprecated and should be removed:

${result.deprecated.map((key) => `- ${key}`).join("\n")}
`
    : "No deprecated variables found."
}

## Errors and Warnings

${
  result.errors.length > 0
    ? `
### Errors (Must Fix)
${result.errors.map((error) => `- ${error}`).join("\n")}
`
    : ""
}

${
  result.warnings.length > 0
    ? `
### Warnings (Recommended Fixes)
${result.warnings.map((warning) => `- ${warning}`).join("\n")}
`
    : ""
}

## Next Steps

1. Copy the new environment variables from \`.env.migration.template\` to your \`.env.local\` file
2. Update any existing variables that need configuration changes
3. Remove deprecated variables
4. Run the environment validation: \`pnpm migration:validate-env\`
5. Test the application with new configuration

## Environment Templates

- **Development**: \`.env.migration.template\`
- **Production**: Update your production environment with the same variables
- **Staging**: Ensure staging environment matches production configuration

## Verification

After updating your environment:

\`\`\`bash
# Validate environment configuration
pnpm migration:validate-env

# Test tRPC endpoints
pnpm migration:test-trpc

# Test batch processing
pnpm migration:test-batch
\`\`\`
`;

    const guidePath = join(process.cwd(), "ENVIRONMENT_MIGRATION_GUIDE.md");
    writeFileSync(guidePath, guide);

    migrationLogger.info(
      "MIGRATION_GUIDE",
      "Created environment migration guide",
      { guidePath }
    );
  }

  private async createExampleEnvironmentFile(): Promise<void> {
    const example = `# LiveDash Node - Environment Configuration
# Copy this file to .env.local and update the values

# =============================================================================
# CORE CONFIGURATION (Required)
# =============================================================================

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/livedash"
DATABASE_URL_DIRECT="postgresql://username:password@localhost:5432/livedash"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# OpenAI API
OPENAI_API_KEY="your-openai-api-key"
OPENAI_MOCK_MODE="false"

# =============================================================================
# SCHEDULER CONFIGURATION
# =============================================================================

SCHEDULER_ENABLED="true"
CSV_IMPORT_INTERVAL="*/15 * * * *"
IMPORT_PROCESSING_INTERVAL="*/5 * * * *"
IMPORT_PROCESSING_BATCH_SIZE="50"
SESSION_PROCESSING_INTERVAL="0 * * * *"
SESSION_PROCESSING_BATCH_SIZE="0"
SESSION_PROCESSING_CONCURRENCY="5"

# =============================================================================
# tRPC CONFIGURATION (New in v2.0.0)
# =============================================================================

TRPC_ENDPOINT_URL="http://localhost:3000/api/trpc"
TRPC_BATCH_TIMEOUT="30000"
TRPC_MAX_BATCH_SIZE="100"

# =============================================================================
# BATCH PROCESSING CONFIGURATION (New in v2.0.0)
# =============================================================================

BATCH_PROCESSING_ENABLED="true"
BATCH_CREATE_INTERVAL="*/5 * * * *"
BATCH_STATUS_CHECK_INTERVAL="*/2 * * * *"
BATCH_RESULT_PROCESSING_INTERVAL="*/1 * * * *"
BATCH_MAX_REQUESTS="1000"
BATCH_TIMEOUT_HOURS="24"

# =============================================================================
# SECURITY & PERFORMANCE (New in v2.0.0)
# =============================================================================

RATE_LIMIT_WINDOW_MS="900000"
RATE_LIMIT_MAX_REQUESTS="100"
PERFORMANCE_MONITORING_ENABLED="true"
METRICS_COLLECTION_INTERVAL="60"

# =============================================================================
# MIGRATION SETTINGS (Temporary)
# =============================================================================

MIGRATION_MODE="development"
MIGRATION_BACKUP_ENABLED="true"
MIGRATION_ROLLBACK_ENABLED="true"

# =============================================================================
# DATABASE CONNECTION POOLING
# =============================================================================

DATABASE_CONNECTION_LIMIT="20"
DATABASE_POOL_TIMEOUT="10"

# =============================================================================
# DEVELOPMENT SETTINGS
# =============================================================================

NODE_ENV="development"
PORT="3000"
`;

    const examplePath = join(process.cwd(), ".env.example");
    writeFileSync(examplePath, example);

    migrationLogger.info("EXAMPLE_ENV", "Created example environment file", {
      examplePath,
    });
  }

  /**
   * Validate current environment configuration
   */
  async validateEnvironmentConfiguration(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      errors: [],
      warnings: [],
      added: [],
      deprecated: [],
      updated: [],
    };

    const currentEnv = this.readCurrentEnvironment();

    // Validate all new variables
    for (const config of this.newEnvironmentVariables) {
      const value = currentEnv[config.key];

      if (config.required && !value) {
        result.errors.push(
          `Required environment variable missing: ${config.key}`
        );
      }

      if (value && config.validationRegex) {
        const regex = new RegExp(config.validationRegex);
        if (!regex.test(value)) {
          result.errors.push(`Invalid format for ${config.key}: ${value}`);
        }
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new EnvironmentMigration();

  const command = process.argv[2];

  if (command === "validate") {
    migration
      .validateEnvironmentConfiguration()
      .then((result) => {
        console.log("\n=== ENVIRONMENT VALIDATION RESULTS ===");
        console.log(`Success: ${result.success ? "✅" : "❌"}`);

        if (result.errors.length > 0) {
          console.log("\n❌ ERRORS:");
          result.errors.forEach((error) => console.log(`  - ${error}`));
        }

        if (result.warnings.length > 0) {
          console.log("\n⚠️  WARNINGS:");
          result.warnings.forEach((warning) => console.log(`  - ${warning}`));
        }

        process.exit(result.success ? 0 : 1);
      })
      .catch((error) => {
        console.error("Validation failed:", error);
        process.exit(1);
      });
  } else {
    migration
      .migrateEnvironment()
      .then((result) => {
        console.log("\n=== ENVIRONMENT MIGRATION RESULTS ===");
        console.log(`Success: ${result.success ? "✅" : "❌"}`);
        console.log(`Added: ${result.added.length} variables`);
        console.log(`Updated: ${result.updated.length} variables`);
        console.log(`Deprecated: ${result.deprecated.length} variables`);

        if (result.errors.length > 0) {
          console.log("\n❌ ERRORS:");
          result.errors.forEach((error) => console.log(`  - ${error}`));
        }

        if (result.warnings.length > 0) {
          console.log("\n⚠️  WARNINGS:");
          result.warnings.forEach((warning) => console.log(`  - ${warning}`));
        }

        console.log("\n📋 Next Steps:");
        console.log("1. Review ENVIRONMENT_MIGRATION_GUIDE.md");
        console.log("2. Update your .env.local file with new variables");
        console.log("3. Run: pnpm migration:validate-env");

        process.exit(result.success ? 0 : 1);
      })
      .catch((error) => {
        console.error("Migration failed:", error);
        process.exit(1);
      });
  }
}
