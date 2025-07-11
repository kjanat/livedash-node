/**
 * Admin tRPC Router
 *
 * Handles administrative operations:
 * - User management
 * - Company settings
 * - System administration
 */

import { router, adminProcedure } from "@/lib/trpc";
import { TRPCError } from "@trpc/server";
import { companySettingsSchema, userUpdateSchema } from "@/lib/validation";
import { z } from "zod";
import bcrypt from "bcryptjs";

export const adminRouter = router({
  /**
   * Get all users in the company
   */
  getUsers: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { page, limit, search } = input;

      const where = {
        companyId: ctx.company!.id,
        ...(search && {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            // For role, search by exact enum match
            ...(search.toUpperCase() === "ADMIN"
              ? [{ role: "ADMIN" as const }]
              : []),
            ...(search.toUpperCase() === "USER"
              ? [{ role: "USER" as const }]
              : []),
          ],
        }),
      };

      const [users, totalCount] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            name: true,
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        ctx.prisma.user.count({ where }),
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    }),

  /**
   * Create a new user
   */
  createUser: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(12),
        role: z.enum(["ADMIN", "USER", "AUDITOR"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { email, password, role } = input;

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

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await ctx.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role,
          companyId: ctx.company!.id,
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      return {
        message: "User created successfully",
        user,
      };
    }),

  /**
   * Update user details
   */
  updateUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        updates: userUpdateSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId, updates } = input;

      // Verify user belongs to same company
      const targetUser = await ctx.prisma.user.findFirst({
        where: {
          id: userId,
          companyId: ctx.company!.id,
        },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const updateData: any = {};

      if (updates.email) {
        // Check if new email is already taken
        const existingUser = await ctx.prisma.user.findUnique({
          where: { email: updates.email },
        });

        if (existingUser && existingUser.id !== userId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email is already taken",
          });
        }

        updateData.email = updates.email;
      }

      if (updates.password) {
        updateData.password = await bcrypt.hash(updates.password, 12);
      }

      if (updates.role) {
        updateData.role = updates.role;
      }

      const updatedUser = await ctx.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      return {
        message: "User updated successfully",
        user: updatedUser,
      };
    }),

  /**
   * Delete a user
   */
  deleteUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { userId } = input;

      // Verify user belongs to same company
      const targetUser = await ctx.prisma.user.findFirst({
        where: {
          id: userId,
          companyId: ctx.company!.id,
        },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Prevent deleting the last admin
      if (targetUser.role === "ADMIN") {
        const adminCount = await ctx.prisma.user.count({
          where: {
            companyId: ctx.company!.id,
            role: "ADMIN",
          },
        });

        if (adminCount <= 1) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot delete the last admin user",
          });
        }
      }

      await ctx.prisma.user.delete({
        where: { id: userId },
      });

      return {
        message: "User deleted successfully",
      };
    }),

  /**
   * Get company settings
   */
  getCompanySettings: adminProcedure.query(async ({ ctx }) => {
    const company = await ctx.prisma.company.findUnique({
      where: { id: ctx.company!.id },
    });

    if (!company) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Company not found",
      });
    }

    return {
      id: company.id,
      name: company.name,
      csvUrl: company.csvUrl,
      csvUsername: company.csvUsername,
      dashboardOpts: company.dashboardOpts,
      status: company.status,
      maxUsers: company.maxUsers,
      createdAt: company.createdAt,
    };
  }),

  /**
   * Update company settings
   */
  updateCompanySettings: adminProcedure
    .input(companySettingsSchema)
    .mutation(async ({ input, ctx }) => {
      const updateData: any = {
        name: input.name,
        csvUrl: input.csvUrl,
      };

      if (input.csvUsername !== undefined) {
        updateData.csvUsername = input.csvUsername;
      }

      if (input.csvPassword !== undefined) {
        updateData.csvPassword = input.csvPassword;
      }

      if (input.sentimentAlert !== undefined) {
        updateData.sentimentAlert = input.sentimentAlert;
      }

      if (input.dashboardOpts !== undefined) {
        updateData.dashboardOpts = input.dashboardOpts;
      }

      const updatedCompany = await ctx.prisma.company.update({
        where: { id: ctx.company!.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          csvUrl: true,
          csvUsername: true,
          dashboardOpts: true,
          status: true,
          maxUsers: true,
        },
      });

      return {
        message: "Company settings updated successfully",
        company: updatedCompany,
      };
    }),

  /**
   * Get system statistics
   */
  getSystemStats: adminProcedure.query(async ({ ctx }) => {
    const companyId = ctx.company!.id;

    const [
      totalSessions,
      totalMessages,
      totalAIRequests,
      totalCost,
      userCount,
    ] = await Promise.all([
      ctx.prisma.session.count({
        where: { companyId },
      }),
      ctx.prisma.message.count({
        where: { session: { companyId } },
      }),
      ctx.prisma.aIProcessingRequest.count({
        where: { session: { companyId } },
      }),
      ctx.prisma.aIProcessingRequest.aggregate({
        where: { session: { companyId } },
        _sum: { totalCostEur: true },
      }),
      ctx.prisma.user.count({
        where: { companyId },
      }),
    ]);

    return {
      totalSessions,
      totalMessages,
      totalAIRequests,
      totalCostEur: totalCost._sum.totalCostEur || 0,
      userCount,
    };
  }),

  /**
   * Trigger session refresh/reprocessing
   */
  refreshSessions: adminProcedure.mutation(async ({ ctx }) => {
    // Mark all sessions for reprocessing by clearing AI analysis results
    const updatedCount = await ctx.prisma.session.updateMany({
      where: {
        companyId: ctx.company!.id,
        sentiment: { not: null },
      },
      data: {
        sentiment: null,
        category: null,
        summary: null,
        language: null,
      },
    });

    // Clear related AI processing requests
    await ctx.prisma.aIProcessingRequest.deleteMany({
      where: {
        session: {
          companyId: ctx.company!.id,
        },
      },
    });

    // Clear session questions
    await ctx.prisma.sessionQuestion.deleteMany({
      where: {
        session: {
          companyId: ctx.company!.id,
        },
      },
    });

    return {
      message: `Marked ${updatedCount.count} sessions for reprocessing`,
      sessionsMarked: updatedCount.count,
    };
  }),
});
