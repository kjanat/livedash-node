/**
 * CSRF Protection Utilities
 *
 * This module provides CSRF protection for the application using the csrf library.
 * It handles token generation, validation, and provides utilities for both server and client.
 */

import csrf from "csrf";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { clientEnv } from "./env-client";

const tokens = new csrf();

/**
 * CSRF configuration
 */
export const CSRF_CONFIG = {
  cookieName: "csrf-token",
  headerName: "x-csrf-token",
  secret: clientEnv.CSRF_SECRET,
  cookie: {
    httpOnly: true,
    secure: clientEnv.NODE_ENV === "production",
    sameSite:
      clientEnv.NODE_ENV === "production"
        ? ("strict" as const)
        : ("lax" as const),
    maxAge: 60 * 60 * 24, // 24 hours
  },
} as const;

/**
 * Generate a new CSRF token
 */
export function generateCSRFToken(): string {
  const secret = tokens.secretSync();
  const token = tokens.create(secret);
  return `${secret}:${token}`;
}

/**
 * Verify a CSRF token
 */
export function verifyCSRFToken(token: string, secret?: string): boolean {
  try {
    if (token.includes(":")) {
      const [tokenSecret, tokenValue] = token.split(":");
      return tokens.verify(tokenSecret, tokenValue);
    }

    if (secret) {
      return tokens.verify(secret, token);
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extract CSRF token from request
 */
export function extractCSRFToken(request: NextRequest): string | null {
  // Check header first
  const headerToken = request.headers.get(CSRF_CONFIG.headerName);
  if (headerToken) {
    return headerToken;
  }

  // Note: For form data and JSON body, we need async handling
  // This function will be made async or handled by the caller

  return null;
}

/**
 * Get CSRF token from cookies (server-side)
 */
export async function getCSRFTokenFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(CSRF_CONFIG.cookieName);
    return token?.value || null;
  } catch {
    return null;
  }
}

/**
 * Server-side utilities for API routes
 */
export const CSRFProtection = {
  /**
   * Generate and set CSRF token in response
   */
  generateTokenResponse(): {
    token: string;
    cookie: {
      name: string;
      value: string;
      options: {
        httpOnly: boolean;
        secure: boolean;
        sameSite: "lax" | "strict";
        maxAge: number;
        path: string;
      };
    };
  } {
    const token = generateCSRFToken();

    return {
      token,
      cookie: {
        name: CSRF_CONFIG.cookieName,
        value: token,
        options: {
          ...CSRF_CONFIG.cookie,
          path: "/",
        },
      },
    };
  },

  /**
   * Validate CSRF token from request
   */
  async validateRequest(request: NextRequest): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      // Skip CSRF validation for GET, HEAD, OPTIONS
      if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        return { valid: true };
      }

      // Get token from request
      const requestToken = await this.getTokenFromRequest(request);
      if (!requestToken) {
        return {
          valid: false,
          error: "CSRF token missing from request",
        };
      }

      // Get stored token from cookies
      const cookieToken = request.cookies.get(CSRF_CONFIG.cookieName)?.value;
      if (!cookieToken) {
        return {
          valid: false,
          error: "CSRF token missing from cookies",
        };
      }

      // Verify tokens match
      if (requestToken !== cookieToken) {
        return {
          valid: false,
          error: "CSRF token mismatch",
        };
      }

      // Verify token is valid
      if (!verifyCSRFToken(requestToken)) {
        return {
          valid: false,
          error: "Invalid CSRF token",
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `CSRF validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },

  /**
   * Extract token from request (handles different content types)
   */
  async getTokenFromRequest(request: NextRequest): Promise<string | null> {
    // Check header first
    const headerToken = request.headers.get(CSRF_CONFIG.headerName);
    if (headerToken) {
      return headerToken;
    }

    // Check form data or JSON body
    try {
      const contentType = request.headers.get("content-type");

      if (contentType?.includes("application/json")) {
        const body = await request.clone().json();
        return body.csrfToken || body.csrf_token || null;
      }
      if (
        contentType?.includes("multipart/form-data") ||
        contentType?.includes("application/x-www-form-urlencoded")
      ) {
        const formData = await request.clone().formData();
        return formData.get("csrf_token") as string | null;
      }
    } catch (error) {
      // If parsing fails, return null
      console.warn("Failed to parse request body for CSRF token:", error);
    }

    return null;
  },
};

// Client-side utilities moved to ./csrf-client.ts to avoid server-side import issues
