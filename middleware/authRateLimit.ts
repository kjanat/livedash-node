import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { extractClientIP, InMemoryRateLimiter } from "../lib/rateLimiter";
import {
  securityAuditLogger,
  AuditOutcome,
  createAuditMetadata,
  SecurityEventType,
  AuditSeverity,
} from "../lib/securityAuditLogger";
import { enhancedSecurityLog } from "../lib/securityMonitoring";

// Rate limiting for login attempts
const loginRateLimiter = new InMemoryRateLimiter({
  maxAttempts: 5, // 5 login attempts
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxEntries: 10000,
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
});

/**
 * Apply rate limiting to authentication endpoints
 */
export async function authRateLimitMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to NextAuth signin endpoint
  if (
    pathname.startsWith("/api/auth/signin") ||
    pathname.startsWith("/api/auth/callback/credentials")
  ) {
    const ip = extractClientIP(request);
    const userAgent = request.headers.get("user-agent") || undefined;
    const rateLimitResult = loginRateLimiter.checkRateLimit(ip);

    if (!rateLimitResult.allowed) {
      // Log rate limiting event with enhanced monitoring
      await enhancedSecurityLog(
        SecurityEventType.RATE_LIMITING,
        "auth_rate_limit_exceeded",
        AuditOutcome.RATE_LIMITED,
        {
          ipAddress: ip,
          userAgent,
          metadata: createAuditMetadata({
            endpoint: pathname,
            resetTime: rateLimitResult.resetTime,
            maxAttempts: 5,
            windowMs: 15 * 60 * 1000,
          }),
        },
        AuditSeverity.HIGH,
        "Authentication rate limit exceeded",
        {
          endpoint: pathname,
          rateLimitType: "authentication",
          threshold: 5,
          windowMinutes: 15,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error: "Too many login attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((rateLimitResult.resetTime! - Date.now()) / 1000)
            ),
          },
        }
      );
    }

    // Log successful rate limit check for monitoring
    await enhancedSecurityLog(
      SecurityEventType.RATE_LIMITING,
      "auth_rate_limit_check",
      AuditOutcome.SUCCESS,
      {
        ipAddress: ip,
        userAgent,
        metadata: createAuditMetadata({
          endpoint: pathname,
          attemptsRemaining: 5 - (rateLimitResult as any).currentCount || 0,
        }),
      },
      AuditSeverity.INFO,
      undefined,
      {
        endpoint: pathname,
        rateLimitType: "authentication_check",
      }
    );
  }

  return NextResponse.next();
}
