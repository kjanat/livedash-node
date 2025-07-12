import type { Company, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Cache } from "./cache";
import { prisma } from "./prisma";
import {
  AuditOutcome,
  AuditSeverity,
  createAuditMetadata,
  SecurityEventType,
} from "./securityAuditLogger";
import { enhancedSecurityLog } from "./securityMonitoring";

// Define the shape of the JWT token
declare module "next-auth/jwt" {
  interface JWT {
    companyId?: string;
    role?: string;
    isPlatformUser?: boolean;
    platformRole?: string;
  }
}

// Define the shape of the session object
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string;
      email?: string;
      image?: string;
      companyId?: string;
      role?: string;
      isPlatformUser?: boolean;
      platformRole?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string;
    companyId?: string;
    role?: string;
    isPlatformUser?: boolean;
    platformRole?: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          await enhancedSecurityLog(
            SecurityEventType.AUTHENTICATION,
            "login_attempt",
            AuditOutcome.FAILURE,
            {
              metadata: createAuditMetadata({
                error: "missing_credentials",
                email: credentials?.email ? "[REDACTED]" : "missing",
              }),
            },
            AuditSeverity.MEDIUM,
            "Missing email or password",
            {
              attemptType: "missing_credentials",
              endpoint: "/api/auth/signin",
            }
          );
          return null;
        }

        // Try to get user from cache first
        const cachedUser = await Cache.getUserByEmail(credentials.email);
        let fullUser: (User & { company: Company }) | null = null;

        if (cachedUser) {
          // Get full user data from database if cached user found
          fullUser = await prisma.user.findUnique({
            where: { id: cachedUser.id },
            include: { company: true },
          });
        } else {
          // Cache miss - get from database and cache for next time
          fullUser = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: { company: true },
          });

          if (fullUser) {
            // Cache the user data
            await Cache.setUserByEmail(credentials.email, {
              id: fullUser.id,
              email: fullUser.email,
              name: fullUser.name || undefined,
              role: fullUser.role,
              companyId: fullUser.companyId,
            });
            await Cache.setUser(fullUser.id, {
              id: fullUser.id,
              email: fullUser.email,
              name: fullUser.name || undefined,
              role: fullUser.role,
              companyId: fullUser.companyId,
            });
          }
        }

        const user = fullUser;

        if (!user || !user.password) {
          await enhancedSecurityLog(
            SecurityEventType.AUTHENTICATION,
            "login_attempt",
            AuditOutcome.FAILURE,
            {
              metadata: createAuditMetadata({
                error: "user_not_found",
                email: "[REDACTED]",
              }),
            },
            AuditSeverity.MEDIUM,
            "User not found or no password set",
            {
              attemptType: "user_not_found",
              email: credentials.email,
              endpoint: "/api/auth/signin",
            }
          );
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          await enhancedSecurityLog(
            SecurityEventType.AUTHENTICATION,
            "login_attempt",
            AuditOutcome.FAILURE,
            {
              userId: user.id,
              companyId: user.companyId,
              metadata: createAuditMetadata({
                error: "invalid_password",
                email: "[REDACTED]",
              }),
            },
            AuditSeverity.HIGH,
            "Invalid password",
            {
              attemptType: "invalid_password",
              email: credentials.email,
              endpoint: "/api/auth/signin",
              userId: user.id,
            }
          );
          return null;
        }

        // Check if company is active
        if (user.company.status !== "ACTIVE") {
          await enhancedSecurityLog(
            SecurityEventType.AUTHENTICATION,
            "login_attempt",
            AuditOutcome.BLOCKED,
            {
              userId: user.id,
              companyId: user.companyId,
              metadata: createAuditMetadata({
                error: "company_inactive",
                companyStatus: user.company.status,
              }),
            },
            AuditSeverity.HIGH,
            `Company status is ${user.company.status}`,
            {
              attemptType: "company_inactive",
              companyStatus: user.company.status,
              endpoint: "/api/auth/signin",
            }
          );
          return null;
        }

        // Log successful authentication
        await enhancedSecurityLog(
          SecurityEventType.AUTHENTICATION,
          "login_success",
          AuditOutcome.SUCCESS,
          {
            userId: user.id,
            companyId: user.companyId,
            metadata: createAuditMetadata({
              userRole: user.role,
              companyName: user.company.name,
            }),
          },
          AuditSeverity.INFO,
          undefined,
          {
            userRole: user.role,
            companyName: user.company.name,
            endpoint: "/api/auth/signin",
          }
        );

        return {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          companyId: user.companyId,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours for regular users
  },
  cookies: {
    sessionToken: {
      name: "app-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.companyId = user.companyId;
        token.role = user.role;
        token.isPlatformUser = user.isPlatformUser;
        token.platformRole = user.platformRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.companyId = token.companyId;
        session.user.role = token.role;
        session.user.isPlatformUser = token.isPlatformUser;
        session.user.platformRole = token.platformRole;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};
