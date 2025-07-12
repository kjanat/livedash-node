/**
 * Centralized Configuration Provider Service
 *
 * Consolidates all configuration management into a single, type-safe,
 * validated system with environment-specific overrides and runtime validation.
 */

import { z } from "zod";

/**
 * Environment types
 */
export type Environment = "development" | "test" | "production";

/**
 * Database configuration schema
 */
const DatabaseConfigSchema = z.object({
  url: z.string().url(),
  directUrl: z.string().url().optional(),
  maxConnections: z.number().min(1).default(10),
  connectionTimeout: z.number().min(1000).default(30000), // 30 seconds
  queryTimeout: z.number().min(1000).default(60000), // 60 seconds
  retryAttempts: z.number().min(0).default(3),
  retryDelay: z.number().min(100).default(1000), // 1 second
});

/**
 * Authentication configuration schema
 */
const AuthConfigSchema = z.object({
  secret: z.string().min(32),
  url: z.string().url(),
  sessionMaxAge: z
    .number()
    .min(3600)
    .default(24 * 60 * 60), // 24 hours
  providers: z.object({
    credentials: z.boolean().default(true),
    github: z.boolean().default(false),
    google: z.boolean().default(false),
  }),
});

/**
 * Security configuration schema
 */
const SecurityConfigSchema = z.object({
  csp: z.object({
    enabled: z.boolean().default(true),
    reportUri: z.string().optional(),
    reportOnly: z.boolean().default(false),
  }),
  csrf: z.object({
    enabled: z.boolean().default(true),
    tokenExpiry: z.number().min(300).default(3600), // 1 hour
  }),
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    windowMs: z
      .number()
      .min(1000)
      .default(15 * 60 * 1000), // 15 minutes
    maxRequests: z.number().min(1).default(100),
  }),
  audit: z.object({
    enabled: z.boolean().default(true),
    retentionDays: z.number().min(1).default(90),
    bufferSize: z.number().min(100).default(1000),
  }),
});

/**
 * OpenAI configuration schema
 */
const OpenAIConfigSchema = z.object({
  apiKey: z.string().min(1),
  organization: z.string().optional(),
  mockMode: z.boolean().default(false),
  defaultModel: z.string().default("gpt-3.5-turbo"),
  maxTokens: z.number().min(1).default(1000),
  temperature: z.number().min(0).max(2).default(0.1),
  batchConfig: z.object({
    enabled: z.boolean().default(true),
    maxRequestsPerBatch: z.number().min(1).max(50000).default(1000),
    statusCheckInterval: z.number().min(60000).default(60000), // 1 minute
    maxTimeout: z
      .number()
      .min(3600000)
      .default(24 * 60 * 60 * 1000), // 24 hours
  }),
});

/**
 * Scheduler configuration schema
 */
const SchedulerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  csvImport: z.object({
    enabled: z.boolean().default(true),
    interval: z.string().default("*/5 * * * *"), // Every 5 minutes
  }),
  importProcessor: z.object({
    enabled: z.boolean().default(true),
    interval: z.string().default("*/2 * * * *"), // Every 2 minutes
  }),
  sessionProcessor: z.object({
    enabled: z.boolean().default(true),
    interval: z.string().default("*/3 * * * *"), // Every 3 minutes
    batchSize: z.number().min(1).default(50),
  }),
  batchProcessor: z.object({
    enabled: z.boolean().default(true),
    createInterval: z.string().default("*/5 * * * *"), // Every 5 minutes
    statusInterval: z.string().default("*/2 * * * *"), // Every 2 minutes
    resultInterval: z.string().default("*/1 * * * *"), // Every minute
  }),
});

/**
 * Application configuration schema
 */
const AppConfigSchema = z.object({
  name: z.string().default("LiveDash"),
  version: z.string().default("1.0.0"),
  environment: z.enum(["development", "test", "production"]),
  baseUrl: z.string().url(),
  port: z.number().min(1).max(65535).default(3000),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  features: z.object({
    enableMetrics: z.boolean().default(true),
    enableAnalytics: z.boolean().default(true),
    enableCaching: z.boolean().default(true),
    enableCompression: z.boolean().default(true),
  }),
});

/**
 * Email configuration schema
 */
const EmailConfigSchema = z.object({
  enabled: z.boolean().default(false),
  smtp: z.object({
    host: z.string().optional(),
    port: z.number().min(1).max(65535).default(587),
    secure: z.boolean().default(false),
    user: z.string().optional(),
    password: z.string().optional(),
  }),
  from: z.string().email().default("noreply@livedash.com"),
  templates: z.object({
    passwordReset: z.string().default("password-reset"),
    userInvitation: z.string().default("user-invitation"),
  }),
});

/**
 * Complete application configuration schema
 */
const ConfigSchema = z.object({
  app: AppConfigSchema,
  database: DatabaseConfigSchema,
  auth: AuthConfigSchema,
  security: SecurityConfigSchema,
  openai: OpenAIConfigSchema,
  scheduler: SchedulerConfigSchema,
  email: EmailConfigSchema,
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * Configuration provider class
 */
class ConfigProvider {
  private config: AppConfig | null = null;
  private isInitialized = false;

  /**
   * Initialize configuration from environment variables
   */
  initialize(): AppConfig {
    if (this.isInitialized && this.config) {
      return this.config;
    }

    try {
      const rawConfig = this.extractFromEnvironment();
      this.config = ConfigSchema.parse(rawConfig);
      this.isInitialized = true;

      // Log configuration status (without sensitive data)
      this.logConfigStatus();

      return this.config;
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? `Configuration validation failed: ${error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
          : `Configuration initialization failed: ${error}`;

      throw new Error(message);
    }
  }

  /**
   * Get current configuration (initialize if needed)
   */
  get(): AppConfig {
    if (!this.isInitialized || !this.config) {
      return this.initialize();
    }
    return this.config;
  }

  /**
   * Get specific configuration section
   */
  getSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return this.get()[section];
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof AppConfig["app"]["features"]): boolean {
    return this.get().app.features[feature];
  }

  /**
   * Get environment-specific configuration
   */
  forEnvironment(env: Environment): Partial<AppConfig> {
    const overrides: Record<Environment, any> = {
      development: {
        app: {
          logLevel: "debug",
          features: {
            enableMetrics: true,
            enableAnalytics: false,
            enableCaching: false,
            enableCompression: false,
          },
        },
        security: {
          csp: { reportOnly: true },
          rateLimit: { maxRequests: 1000 },
        },
        openai: {
          mockMode: true,
        },
      },
      test: {
        app: {
          logLevel: "warn",
          features: {
            enableMetrics: false,
            enableAnalytics: false,
            enableCaching: false,
            enableCompression: false,
          },
        },
        scheduler: {
          enabled: false,
        },
        email: {
          enabled: false,
        },
      },
      production: {
        app: {
          logLevel: "error",
          features: {
            enableMetrics: true,
            enableAnalytics: true,
            enableCaching: true,
            enableCompression: true,
          },
        },
        security: {
          csp: { reportOnly: false },
          audit: { retentionDays: 365 },
        },
        openai: {
          mockMode: false,
        },
      },
    };

    return overrides[env] || {};
  }

  /**
   * Extract configuration from environment variables
   */
  private extractFromEnvironment(): Partial<AppConfig> {
    const env = process.env;
    const environment = (env.NODE_ENV as Environment) || "development";

    return {
      app: {
        name: env.APP_NAME || "LiveDash",
        version: env.APP_VERSION || "1.0.0",
        environment,
        baseUrl: env.NEXTAUTH_URL || "http://localhost:3000",
        port: Number.parseInt(env.PORT || "3000", 10),
        logLevel: (env.LOG_LEVEL as any) || "info",
        features: {
          enableMetrics: env.ENABLE_METRICS !== "false",
          enableAnalytics: env.ENABLE_ANALYTICS !== "false",
          enableCaching: env.ENABLE_CACHING !== "false",
          enableCompression: env.ENABLE_COMPRESSION !== "false",
        },
      },
      database: {
        url: env.DATABASE_URL || "",
        directUrl: env.DATABASE_URL_DIRECT,
        maxConnections: Number.parseInt(env.DB_MAX_CONNECTIONS || "10", 10),
        connectionTimeout: Number.parseInt(
          env.DB_CONNECTION_TIMEOUT || "30000",
          10
        ),
        queryTimeout: Number.parseInt(env.DB_QUERY_TIMEOUT || "60000", 10),
        retryAttempts: Number.parseInt(env.DB_RETRY_ATTEMPTS || "3", 10),
        retryDelay: Number.parseInt(env.DB_RETRY_DELAY || "1000", 10),
      },
      auth: {
        secret: env.NEXTAUTH_SECRET || "",
        url: env.NEXTAUTH_URL || "http://localhost:3000",
        sessionMaxAge: Number.parseInt(env.AUTH_SESSION_MAX_AGE || "86400", 10),
        providers: {
          credentials: env.AUTH_CREDENTIALS_ENABLED !== "false",
          github: env.AUTH_GITHUB_ENABLED === "true",
          google: env.AUTH_GOOGLE_ENABLED === "true",
        },
      },
      security: {
        csp: {
          enabled: env.CSP_ENABLED !== "false",
          reportUri: env.CSP_REPORT_URI,
          reportOnly: env.CSP_REPORT_ONLY === "true",
        },
        csrf: {
          enabled: env.CSRF_ENABLED !== "false",
          tokenExpiry: Number.parseInt(env.CSRF_TOKEN_EXPIRY || "3600", 10),
        },
        rateLimit: {
          enabled: env.RATE_LIMIT_ENABLED !== "false",
          windowMs: Number.parseInt(env.RATE_LIMIT_WINDOW_MS || "900000", 10),
          maxRequests: Number.parseInt(
            env.RATE_LIMIT_MAX_REQUESTS || "100",
            10
          ),
        },
        audit: {
          enabled: env.AUDIT_ENABLED !== "false",
          retentionDays: Number.parseInt(env.AUDIT_RETENTION_DAYS || "90", 10),
          bufferSize: Number.parseInt(env.AUDIT_BUFFER_SIZE || "1000", 10),
        },
      },
      openai: {
        apiKey: env.OPENAI_API_KEY || "",
        organization: env.OPENAI_ORGANIZATION,
        mockMode: env.OPENAI_MOCK_MODE === "true",
        defaultModel: env.OPENAI_DEFAULT_MODEL || "gpt-3.5-turbo",
        maxTokens: Number.parseInt(env.OPENAI_MAX_TOKENS || "1000", 10),
        temperature: Number.parseFloat(env.OPENAI_TEMPERATURE || "0.1"),
        batchConfig: {
          enabled: env.OPENAI_BATCH_ENABLED !== "false",
          maxRequestsPerBatch: Number.parseInt(
            env.OPENAI_BATCH_MAX_REQUESTS || "1000",
            10
          ),
          statusCheckInterval: Number.parseInt(
            env.OPENAI_BATCH_STATUS_INTERVAL || "60000",
            10
          ),
          maxTimeout: Number.parseInt(
            env.OPENAI_BATCH_MAX_TIMEOUT || "86400000",
            10
          ),
        },
      },
      scheduler: {
        enabled: env.SCHEDULER_ENABLED !== "false",
        csvImport: {
          enabled: env.CSV_IMPORT_SCHEDULER_ENABLED !== "false",
          interval: env.CSV_IMPORT_INTERVAL || "*/5 * * * *",
        },
        importProcessor: {
          enabled: env.IMPORT_PROCESSOR_ENABLED !== "false",
          interval: env.IMPORT_PROCESSOR_INTERVAL || "*/2 * * * *",
        },
        sessionProcessor: {
          enabled: env.SESSION_PROCESSOR_ENABLED !== "false",
          interval: env.SESSION_PROCESSOR_INTERVAL || "*/3 * * * *",
          batchSize: Number.parseInt(
            env.SESSION_PROCESSOR_BATCH_SIZE || "50",
            10
          ),
        },
        batchProcessor: {
          enabled: env.BATCH_PROCESSOR_ENABLED !== "false",
          createInterval: env.BATCH_CREATE_INTERVAL || "*/5 * * * *",
          statusInterval: env.BATCH_STATUS_INTERVAL || "*/2 * * * *",
          resultInterval: env.BATCH_RESULT_INTERVAL || "*/1 * * * *",
        },
      },
      email: {
        enabled: env.EMAIL_ENABLED === "true",
        smtp: {
          host: env.SMTP_HOST,
          port: Number.parseInt(env.SMTP_PORT || "587", 10),
          secure: env.SMTP_SECURE === "true",
          user: env.SMTP_USER,
          password: env.SMTP_PASSWORD,
        },
        from: env.EMAIL_FROM || "noreply@livedash.com",
        templates: {
          passwordReset: env.EMAIL_TEMPLATE_PASSWORD_RESET || "password-reset",
          userInvitation:
            env.EMAIL_TEMPLATE_USER_INVITATION || "user-invitation",
        },
      },
    };
  }

  /**
   * Log configuration status without sensitive information
   */
  private logConfigStatus(): void {
    if (!this.config) return;

    const status = {
      environment: this.config.app.environment,
      features: this.config.app.features,
      scheduler: {
        enabled: this.config.scheduler.enabled,
        modules: {
          csvImport: this.config.scheduler.csvImport.enabled,
          importProcessor: this.config.scheduler.importProcessor.enabled,
          sessionProcessor: this.config.scheduler.sessionProcessor.enabled,
          batchProcessor: this.config.scheduler.batchProcessor.enabled,
        },
      },
      security: {
        cspEnabled: this.config.security.csp.enabled,
        csrfEnabled: this.config.security.csrf.enabled,
        rateLimitEnabled: this.config.security.rateLimit.enabled,
        auditEnabled: this.config.security.audit.enabled,
      },
      services: {
        emailEnabled: this.config.email.enabled,
        openaiMockMode: this.config.openai.mockMode,
        batchProcessingEnabled: this.config.openai.batchConfig.enabled,
      },
    };

    console.log(
      "[Config] Application configuration loaded:",
      JSON.stringify(status, null, 2)
    );
  }

  /**
   * Validate configuration at runtime
   */
  validate(): { valid: boolean; errors: string[] } {
    try {
      this.get();
      return { valid: true, errors: [] };
    } catch (error) {
      const errors =
        error instanceof z.ZodError
          ? error.issues.map((e) => `${e.path.join(".")}: ${e.message}`)
          : [String(error)];

      return { valid: false, errors };
    }
  }

  /**
   * Reset configuration (useful for testing)
   */
  reset(): void {
    this.config = null;
    this.isInitialized = false;
  }
}

/**
 * Global configuration provider instance
 */
export const configProvider = new ConfigProvider();

/**
 * Convenience function to get configuration
 */
export const getConfig = () => configProvider.get();

/**
 * Convenience function to get specific configuration section
 */
export const getConfigSection = <K extends keyof AppConfig>(
  section: K
): AppConfig[K] => configProvider.getSection(section);

/**
 * Convenience function to check if feature is enabled
 */
export const isFeatureEnabled = (
  feature: keyof AppConfig["app"]["features"]
): boolean => configProvider.isFeatureEnabled(feature);
