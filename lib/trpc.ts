/**
 * tRPC Server Configuration
 *
 * This file sets up the core tRPC configuration including:
 * - Server context creation with authentication
 * - Router initialization
 * - Middleware for authentication and error handling
 */

import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import superjson from "superjson";
import type { z } from "zod";
import { authOptions } from "./auth";
import { CSRFProtection } from "./csrf";
import { prisma } from "./prisma";
import { validateInput } from "./validation";

/**
 * Create context for tRPC requests
 * This runs on every request and provides:
 * - Database access
 * - User session information
 * - Request/response objects
 */
export async function createTRPCContext(opts: FetchCreateContextFnOptions) {
  const session = await getServerSession(authOptions);

  return {
    prisma,
    session,
    req: opts.req,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Initialize tRPC with superjson for date serialization
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

/**
 * Base router and middleware exports
 */
export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Authentication middleware
 * Throws error if user is not authenticated
 */
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.email) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

/**
 * Company access middleware
 * Ensures user has access to their company's data
 */
const enforceCompanyAccess = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user?.email) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const user = await ctx.prisma.user.findUnique({
    where: { email: ctx.session.user.email },
    include: { company: true },
  });

  if (!user || !user.company) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User does not have company access",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user,
      company: user.company,
    },
  });
});

/**
 * Admin access middleware
 * Ensures user has admin role
 */
const enforceAdminAccess = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user?.email) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const user = await ctx.prisma.user.findUnique({
    where: { email: ctx.session.user.email },
    include: { company: true },
  });

  if (!user || user.role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user,
      company: user.company,
    },
  });
});

/**
 * Input validation middleware
 * Automatically validates inputs using Zod schemas
 */
const createValidatedProcedure = <T>(schema: z.ZodSchema<T>) =>
  publicProcedure.input(schema).use(({ input, next }) => {
    const validation = validateInput(schema, input);
    if (!validation.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: validation.errors.join(", "),
      });
    }
    return next({ ctx: {}, input: validation.data });
  });

/**
 * Procedure variants for different access levels
 */
export const protectedProcedure = publicProcedure.use(enforceUserIsAuthed);
export const companyProcedure = publicProcedure.use(enforceCompanyAccess);
export const adminProcedure = publicProcedure.use(enforceAdminAccess);
export const validatedProcedure = createValidatedProcedure;

/**
 * CSRF protection middleware for state-changing operations
 */
const enforceCSRFProtection = t.middleware(async ({ ctx, next }) => {
  // Extract request from context
  const request = ctx.req as Request;

  // Skip CSRF validation for GET requests
  if (request.method === "GET") {
    return next({ ctx });
  }

  // Convert to NextRequest for validation
  const nextRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  }) as unknown as NextRequest;

  // Validate CSRF token
  const validation = await CSRFProtection.validateRequest(nextRequest);

  if (!validation.valid) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: validation.error || "CSRF validation failed",
    });
  }

  return next({ ctx });
});

/**
 * Rate limiting middleware for sensitive operations
 */
export const rateLimitedProcedure = publicProcedure.use(
  async ({ ctx, next }) => {
    // Rate limiting logic would go here
    // For now, just pass through
    return next({ ctx });
  }
);

/**
 * CSRF-protected procedures for state-changing operations
 */
export const csrfProtectedProcedure = publicProcedure.use(
  enforceCSRFProtection
);
export const csrfProtectedAuthProcedure =
  csrfProtectedProcedure.use(enforceUserIsAuthed);
export const csrfProtectedCompanyProcedure =
  csrfProtectedProcedure.use(enforceCompanyAccess);
export const csrfProtectedAdminProcedure =
  csrfProtectedProcedure.use(enforceAdminAccess);
