import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authRateLimitMiddleware } from "./middleware/authRateLimit";

export function middleware(request: NextRequest) {
  // Apply auth rate limiting
  const authRateLimitResponse = authRateLimitMiddleware(request);
  if (authRateLimitResponse.status === 429) {
    return authRateLimitResponse;
  }

  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    // Apply to auth API routes
    "/api/auth/:path*",
    // Exclude static files and images
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};