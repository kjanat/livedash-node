/**
 * CSRF Protection Utilities
 *
 * This module provides CSRF protection for the application using the csrf library.
 * It handles token generation, validation, and provides utilities for both server and client.
 */

import csrf from "csrf";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { env } from "./env";

const tokens = new csrf();

/**
 * CSRF configuration
 */
export const CSRF_CONFIG = {
  cookieName: "csrf-token",
  headerName: "x-csrf-token",
  secret: env.CSRF_SECRET,
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
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

  // Check form data for POST requests
  if (request.method === "POST") {
    try {
      const formData = request.formData();
      return formData.then((data) => data.get("csrf_token") as string | null);
    } catch {
      // If formData fails, try JSON body
      try {
        const body = request.json();
        return body.then((data) => data.csrfToken || null);
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Get CSRF token from cookies (server-side)
 */
export async function getCSRFTokenFromCookies(): Promise<string | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(CSRF_CONFIG.cookieName);
    return token?.value || null;
  } catch {
    return null;
  }
}

/**
 * Server-side utilities for API routes
 */
export class CSRFProtection {
  /**
   * Generate and set CSRF token in response
   */
  static generateTokenResponse(): {
    token: string;
    cookie: {
      name: string;
      value: string;
      options: {
        httpOnly: boolean;
        secure: boolean;
        sameSite: "lax";
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
  }

  /**
   * Validate CSRF token from request
   */
  static async validateRequest(request: NextRequest): Promise<{
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
  }

  /**
   * Extract token from request (handles different content types)
   */
  private static async getTokenFromRequest(request: NextRequest): Promise<string | null> {
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
      } else if (contentType?.includes("multipart/form-data") || contentType?.includes("application/x-www-form-urlencoded")) {
        const formData = await request.clone().formData();
        return formData.get("csrf_token") as string | null;
      }
    } catch (error) {
      // If parsing fails, return null
      console.warn("Failed to parse request body for CSRF token:", error);
    }

    return null;
  }
}

/**
 * Client-side utilities
 */
export const CSRFClient = {
  /**
   * Get CSRF token from cookies (client-side)
   */
  getToken(): string | null {
    if (typeof document === "undefined") return null;

    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === CSRF_CONFIG.cookieName) {
        return decodeURIComponent(value);
      }
    }
    return null;
  },

  /**
   * Add CSRF token to fetch options
   */
  addTokenToFetch(options: RequestInit = {}): RequestInit {
    const token = this.getToken();
    if (!token) return options;

    return {
      ...options,
      headers: {
        ...options.headers,
        [CSRF_CONFIG.headerName]: token,
      },
    };
  },

  /**
   * Add CSRF token to form data
   */
  addTokenToFormData(formData: FormData): FormData {
    const token = this.getToken();
    if (token) {
      formData.append("csrf_token", token);
    }
    return formData;
  },

  /**
   * Add CSRF token to object (for JSON requests)
   */
  addTokenToObject<T extends Record<string, unknown>>(obj: T): T & { csrfToken: string } {
    const token = this.getToken();
    return {
      ...obj,
      csrfToken: token || "",
    };
  },
};