/**
 * Auth.js v5 compatibility layer for Pages Router API routes
 * This provides the authOptions object for backward compatibility
 * with getServerSession from next-auth/next
 */

import { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
            include: { company: true },
          });

          if (!user) {
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.email,
            role: user.role,
            companyId: user.companyId,
            company: user.company.name,
          };
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }: any) => {
      if (user) {
        token.role = user.role;
        token.companyId = user.companyId;
        token.company = user.company;
      }
      return token;
    },
    session: async ({ session, token }: any) => {
      if (token && session.user) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.companyId = token.companyId;
        session.user.company = token.company;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
};
