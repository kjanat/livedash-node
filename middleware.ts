import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authRateLimitMiddleware } from "./middleware/authRateLimit";
import { csrfProtectionMiddleware, csrfTokenMiddleware } from "./middleware/csrfProtection";

export async function middleware(request: NextRequest) {
  // Handle CSRF token requests first
  const csrfTokenResponse = csrfTokenMiddleware(request);
  if (csrfTokenResponse) {
    return csrfTokenResponse;
  }

  // Apply auth rate limiting
  const authRateLimitResponse = authRateLimitMiddleware(request);
  if (authRateLimitResponse.status === 429) {
    return authRateLimitResponse;
  }

  // Apply CSRF protection
  const csrfResponse = await csrfProtectionMiddleware(request);
  if (csrfResponse.status === 403) {
    return csrfResponse;
  }

  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    // Apply to API routes
    "/api/:path*",
    // Exclude static files and images
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
