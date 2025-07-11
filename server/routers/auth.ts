/**
 * Authentication tRPC Router
 *
 * Handles user authentication operations:
 * - User registration
 * - Login validation
 * - Password reset requests
 * - User profile management
 */

import {
  router,
  publicProcedure,
  protectedProcedure,
  rateLimitedProcedure,
  csrfProtectedProcedure,
  csrfProtectedAuthProcedure,
} from "@/lib/trpc";
import { TRPCError } from "@trpc/server";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  userUpdateSchema,
} from "@/lib/validation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "node:crypto";

export const authRouter = router({
  /**
   * Register a new user
   * Protected with CSRF to prevent automated account creation
   */
  register: csrfProtectedProcedure
    .input(registerSchema)
    .mutation(async ({ input, ctx }) => {
      const { email, password, company: companyName } = input;

      // Check if user already exists
      const existingUser = await ctx.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User with this email already exists",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create or find company
      let company = await ctx.prisma.company.findFirst({
        where: {
          name: {
            equals: companyName,
            mode: "insensitive",
          },
        },
      });

      if (!company) {
        company = await ctx.prisma.company.create({
          data: {
            name: companyName,
            status: "ACTIVE",
            csvUrl: `https://placeholder-${companyName.toLowerCase().replace(/\s+/g, "-")}.example.com/api/sessions.csv`,
          },
        });
      }

      // Create user
      const user = await ctx.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          companyId: company.id,
          role: "ADMIN", // First user is admin
        },
        select: {
          id: true,
          email: true,
          role: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return {
        message: "User registered successfully",
        user,
      };
    }),

  /**
   * Validate login credentials
   */
  validateLogin: publicProcedure
    .input(loginSchema)
    .query(async ({ input, ctx }) => {
      const { email, password } = input;

      const user = await ctx.prisma.user.findUnique({
        where: { email },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      if (user.company?.status !== "ACTIVE") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Company account is not active",
        });
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          company: user.company,
        },
      };
    }),

  /**
   * Request password reset
   * Protected with CSRF to prevent abuse
   */
  forgotPassword: csrfProtectedProcedure
    .input(forgotPasswordSchema)
    .mutation(async ({ input, ctx }) => {
      const { email } = input;

      const user = await ctx.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Don't reveal if email exists or not
        return {
          message:
            "If an account with that email exists, you will receive a password reset link.",
        };
      }

      // Generate cryptographically secure reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

      await ctx.prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry,
        },
      });

      // TODO: Send email with reset link
      // For now, just log the token (remove in production)
      console.log(`Password reset token for ${email}: ${resetToken}`);

      return {
        message:
          "If an account with that email exists, you will receive a password reset link.",
      };
    }),

  /**
   * Get current user profile
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { email: ctx.session.user.email! },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      company: user.company,
    };
  }),

  /**
   * Update user profile
   * Protected with CSRF and authentication
   */
  updateProfile: csrfProtectedAuthProcedure
    .input(userUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const updateData: {
        email?: string;
        name?: string;
        password?: string;
      } = {};

      if (input.email) {
        // Check if new email is already taken
        const existingUser = await ctx.prisma.user.findUnique({
          where: { email: input.email },
        });

        if (existingUser && existingUser.email !== ctx.session.user.email) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email is already taken",
          });
        }

        updateData.email = input.email;
      }

      if (input.password) {
        updateData.password = await bcrypt.hash(input.password, 12);
      }

      if (input.role) {
        // Only admins can change roles
        const currentUser = await ctx.prisma.user.findUnique({
          where: { email: ctx.session.user.email! },
        });

        if (currentUser?.role !== "ADMIN") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only admins can change user roles",
          });
        }

        updateData.role = input.role;
      }

      const updatedUser = await ctx.prisma.user.update({
        where: { email: ctx.session.user.email! },
        data: updateData,
        select: {
          id: true,
          email: true,
          role: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return {
        message: "Profile updated successfully",
        user: updatedUser,
      };
    }),

  /**
   * Reset password with token
   * Protected with CSRF to prevent abuse
   */
  resetPassword: csrfProtectedProcedure
    .input(
      z.object({
        token: z.string().min(1, "Reset token is required"),
        password: registerSchema.shape.password,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { token, password } = input;

      const user = await ctx.prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset token",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      await ctx.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
        },
      });

      return {
        message: "Password reset successfully",
      };
    }),
});
