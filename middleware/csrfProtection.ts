/**
 * CSRF Protection Middleware
 *
 * This middleware protects against Cross-Site Request Forgery attacks by:
 * 1. Validating CSRF tokens on state-changing operations
 * 2. Generating new tokens for safe requests
 * 3. Blocking unauthorized requests
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { CSRFProtection, CSRF_CONFIG } from "../lib/csrf";

/**
 * Routes that require CSRF protection
 */
const PROTECTED_PATHS = [
  // Authentication endpoints
  "/api/auth/signin",
  "/api/auth/signout",
  "/api/register",
  "/api/forgot-password",
  "/api/reset-password",

  // Dashboard API endpoints
  "/api/dashboard",

  // Platform admin endpoints
  "/api/platform",

  // tRPC endpoints (all state-changing operations)
  "/api/trpc",
] as const;

/**
 * HTTP methods that require CSRF protection
 */
const PROTECTED_METHODS = ["POST", "PUT", "DELETE", "PATCH"] as const;

/**
 * Check if path requires CSRF protection
 */
function requiresCSRFProtection(pathname: string, method: string): boolean {
  // Only protect state-changing methods
  if (!PROTECTED_METHODS.includes(method as any)) {
    return false;
  }

  // Check if path starts with any protected path
  return PROTECTED_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * CSRF protection middleware
 */
export async function csrfProtectionMiddleware(
  request: NextRequest
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip CSRF protection for safe methods and unprotected paths
  if (!requiresCSRFProtection(pathname, method)) {
    return NextResponse.next();
  }

  // Validate CSRF token for protected requests
  const validation = await CSRFProtection.validateRequest(request);

  if (!validation.valid) {
    console.warn(
      `CSRF validation failed for ${method} ${pathname}:`,
      validation.error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Invalid or missing CSRF token",
        code: "CSRF_TOKEN_INVALID",
      },
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  return NextResponse.next();
}

/**
 * Generate CSRF token endpoint response
 */
export function generateCSRFTokenResponse(): NextResponse {
  const { token, cookie } = CSRFProtection.generateTokenResponse();

  const response = NextResponse.json({
    success: true,
    token,
  });

  // Set the CSRF token cookie
  response.cookies.set(cookie.name, cookie.value, cookie.options);

  return response;
}

/**
 * Middleware for serving CSRF tokens to clients
 */
export function csrfTokenMiddleware(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Handle CSRF token endpoint
  if (pathname === "/api/csrf-token" && request.method === "GET") {
    return generateCSRFTokenResponse();
  }

  return null;
}
