import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { extractClientIP, InMemoryRateLimiter } from "../lib/rateLimiter";

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
export function authRateLimitMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to NextAuth signin endpoint
  if (
    pathname.startsWith("/api/auth/signin") ||
    pathname.startsWith("/api/auth/callback/credentials")
  ) {
    const ip = extractClientIP(request);
    const rateLimitResult = loginRateLimiter.checkRateLimit(ip);

    if (!rateLimitResult.allowed) {
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
  }

  return NextResponse.next();
}
