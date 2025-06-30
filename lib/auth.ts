import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";

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
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { company: true },
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        // Check if company is active
        if (user.company.status !== "ACTIVE") {
          return null;
        }

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
        sameSite: "lax",
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
