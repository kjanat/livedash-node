import { z } from "zod";

// Password validation with strong requirements
const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters long")
  .regex(/^(?=.*[a-z])/, "Password must contain at least one lowercase letter")
  .regex(/^(?=.*[A-Z])/, "Password must contain at least one uppercase letter")
  .regex(/^(?=.*\d)/, "Password must contain at least one number")
  .regex(
    /^(?=.*[@$!%*?&])/,
    "Password must contain at least one special character (@$!%*?&)"
  );

// Email validation
const emailSchema = z
  .string()
  .email("Invalid email format")
  .max(255, "Email must be less than 255 characters")
  .toLowerCase();

// Company name validation
const companyNameSchema = z
  .string()
  .min(1, "Company name is required")
  .max(100, "Company name must be less than 100 characters")
  .regex(/^[a-zA-Z0-9\s\-_.]+$/, "Company name contains invalid characters");

// User registration schema
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  company: companyNameSchema,
});

// User login schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// Password reset request schema
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// Password reset schema
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema,
});

// Session filter schema
export const sessionFilterSchema = z.object({
  search: z.string().max(100).optional(),
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]).optional(),
  category: z
    .enum([
      "SCHEDULE_HOURS",
      "LEAVE_VACATION",
      "SICK_LEAVE_RECOVERY",
      "SALARY_COMPENSATION",
      "CONTRACT_HOURS",
      "ONBOARDING",
      "OFFBOARDING",
      "WORKWEAR_STAFF_PASS",
      "TEAM_CONTACTS",
      "PERSONAL_QUESTIONS",
      "ACCESS_LOGIN",
      "SOCIAL_QUESTIONS",
      "UNRECOGNIZED_OTHER",
    ])
    .optional(),
  language: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortKey: z
    .enum(["startTime", "category", "language", "sentiment", "sessionId"])
    .default("startTime"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// Company settings schema
export const companySettingsSchema = z.object({
  name: companyNameSchema,
  csvUrl: z.string().url("Invalid CSV URL"),
  csvUsername: z.string().max(100).optional(),
  csvPassword: z.string().max(100).optional(),
  sentimentAlert: z.number().min(0).max(1).optional(),
  dashboardOpts: z.object({}).passthrough().optional(),
});

// User management schema
export const userUpdateSchema = z.object({
  email: emailSchema.optional(),
  role: z.enum(["ADMIN", "USER", "AUDITOR"]).optional(),
  password: passwordSchema.optional(),
});

// Metrics query schema
export const metricsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  companyId: z.string().uuid().optional(),
});

// Helper function to validate and sanitize input
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map(
        (err) => `${err.path.join(".")}: ${err.message}`
      );
      return { success: false, errors };
    }
    return { success: false, errors: ["Invalid input"] };
  }
}

// Rate limiting helper types
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
}

export const rateLimitConfigs = {
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 requests per 15 minutes
  registration: { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 registrations per hour
  api: { windowMs: 15 * 60 * 1000, maxRequests: 100 }, // 100 API requests per 15 minutes
} as const;
