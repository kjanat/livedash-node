/**
 * CSRF Protection Integration Tests
 *
 * End-to-end tests for CSRF protection in API endpoints and middleware.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createMocks } from "node-mocks-http";
import type { NextRequest } from "next/server";
import {
  csrfProtectionMiddleware,
  csrfTokenMiddleware,
} from "../../middleware/csrfProtection";
import { generateCSRFToken } from "../../lib/csrf";

describe("CSRF Protection Integration", () => {
  describe("CSRF Token Middleware", () => {
    it("should serve CSRF token on GET /api/csrf-token", async () => {
      const { req } = createMocks({
        method: "GET",
        url: "/api/csrf-token",
      });

      const request = {
        method: "GET",
        nextUrl: { pathname: "/api/csrf-token" },
      } as NextRequest;

      const response = csrfTokenMiddleware(request);
      expect(response).not.toBeNull();

      if (response) {
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.token).toBeDefined();
        expect(typeof body.token).toBe("string");
      }
    });

    it("should return null for non-csrf-token paths", async () => {
      const request = {
        method: "GET",
        nextUrl: { pathname: "/api/other" },
      } as NextRequest;

      const response = csrfTokenMiddleware(request);
      expect(response).toBeNull();
    });
  });

  describe("CSRF Protection Middleware", () => {
    it("should allow GET requests without CSRF token", async () => {
      const request = {
        method: "GET",
        nextUrl: { pathname: "/api/dashboard" },
      } as NextRequest;

      const response = await csrfProtectionMiddleware(request);
      expect(response.status).not.toBe(403);
    });

    it("should allow HEAD requests without CSRF token", async () => {
      const request = {
        method: "HEAD",
        nextUrl: { pathname: "/api/dashboard" },
      } as NextRequest;

      const response = await csrfProtectionMiddleware(request);
      expect(response.status).not.toBe(403);
    });

    it("should allow OPTIONS requests without CSRF token", async () => {
      const request = {
        method: "OPTIONS",
        nextUrl: { pathname: "/api/dashboard" },
      } as NextRequest;

      const response = await csrfProtectionMiddleware(request);
      expect(response.status).not.toBe(403);
    });

    it("should block POST request to protected endpoint without CSRF token", async () => {
      const request = {
        method: "POST",
        nextUrl: { pathname: "/api/dashboard/sessions" },
        headers: new Headers({
          "Content-Type": "application/json",
        }),
        cookies: {
          get: () => undefined,
        },
        clone: () => ({
          json: async () => ({}),
        }),
      } as any;

      const response = await csrfProtectionMiddleware(request);
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("CSRF token");
    });

    it("should allow POST request to unprotected endpoint without CSRF token", async () => {
      const request = {
        method: "POST",
        nextUrl: { pathname: "/api/unprotected" },
      } as NextRequest;

      const response = await csrfProtectionMiddleware(request);
      expect(response.status).not.toBe(403);
    });

    it("should allow POST request with valid CSRF token", async () => {
      const token = generateCSRFToken();

      const request = {
        method: "POST",
        nextUrl: { pathname: "/api/dashboard/sessions" },
        headers: new Headers({
          "Content-Type": "application/json",
          "x-csrf-token": token,
        }),
        cookies: {
          get: () => ({ value: token }),
        },
        clone: () => ({
          json: async () => ({ csrfToken: token }),
        }),
      } as any;

      const response = await csrfProtectionMiddleware(request);
      expect(response.status).not.toBe(403);
    });

    it("should block POST request with mismatched CSRF tokens", async () => {
      const headerToken = generateCSRFToken();
      const cookieToken = generateCSRFToken();

      const request = {
        method: "POST",
        nextUrl: { pathname: "/api/dashboard/sessions" },
        headers: new Headers({
          "Content-Type": "application/json",
          "x-csrf-token": headerToken,
        }),
        cookies: {
          get: () => ({ value: cookieToken }),
        },
        clone: () => ({
          json: async () => ({ csrfToken: headerToken }),
        }),
      } as any;

      const response = await csrfProtectionMiddleware(request);
      expect(response.status).toBe(403);
    });

    it("should protect all state-changing methods", async () => {
      const methods = ["POST", "PUT", "DELETE", "PATCH"];

      for (const method of methods) {
        const request = {
          method,
          nextUrl: { pathname: "/api/trpc/test" },
          headers: new Headers({
            "Content-Type": "application/json",
          }),
          cookies: {
            get: () => undefined,
          },
          clone: () => ({
            json: async () => ({}),
          }),
        } as any;

        const response = await csrfProtectionMiddleware(request);
        expect(response.status).toBe(403);
      }
    });
  });

  describe("Protected Endpoints", () => {
    const protectedPaths = [
      "/api/auth/signin",
      "/api/register",
      "/api/forgot-password",
      "/api/reset-password",
      "/api/dashboard/sessions",
      "/api/platform/companies",
      "/api/trpc/test",
    ];

    protectedPaths.forEach((path) => {
      it(`should protect ${path} endpoint`, async () => {
        const request = {
          method: "POST",
          nextUrl: { pathname: path },
          headers: new Headers({
            "Content-Type": "application/json",
          }),
          cookies: {
            get: () => undefined,
          },
          clone: () => ({
            json: async () => ({}),
          }),
        } as any;

        const response = await csrfProtectionMiddleware(request);
        expect(response.status).toBe(403);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed requests gracefully", async () => {
      const request = {
        method: "POST",
        nextUrl: { pathname: "/api/dashboard/sessions" },
        headers: new Headers({
          "Content-Type": "application/json",
        }),
        cookies: {
          get: () => undefined,
        },
        clone: () => ({
          json: async () => {
            throw new Error("Malformed JSON");
          },
        }),
      } as any;

      const response = await csrfProtectionMiddleware(request);
      expect(response.status).toBe(403);
    });

    it("should handle missing headers gracefully", async () => {
      const request = {
        method: "POST",
        nextUrl: { pathname: "/api/dashboard/sessions" },
        headers: new Headers(),
        cookies: {
          get: () => undefined,
        },
        clone: () => ({
          json: async () => ({}),
        }),
      } as any;

      const response = await csrfProtectionMiddleware(request);
      expect(response.status).toBe(403);
    });
  });
});
