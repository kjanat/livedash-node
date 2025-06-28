import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

// Define the shape of the JWT token for platform users
declare module "next-auth/jwt" {
  interface JWT {
    isPlatformUser?: boolean;
    platformRole?: string;
  }
}

// Define the shape of the session object for platform users
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string;
      email?: string;
      image?: string;
      isPlatformUser?: boolean;
      platformRole?: string;
      companyId?: string;
      role?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string;
    isPlatformUser?: boolean;
    platformRole?: string;
    companyId?: string;
    role?: string;
  }
}

export const platformAuthOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Platform Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const platformUser = await prisma.platformUser.findUnique({
          where: { email: credentials.email },
        });

        if (!platformUser) return null;

        const valid = await bcrypt.compare(credentials.password, platformUser.password);
        if (!valid) return null;

        return {
          id: platformUser.id,
          email: platformUser.email,
          name: platformUser.name,
          isPlatformUser: true,
          platformRole: platformUser.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours for platform users (more secure)
  },
  cookies: {
    sessionToken: {
      name: `platform-auth.session-token`,
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
        token.isPlatformUser = user.isPlatformUser;
        token.platformRole = user.platformRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.isPlatformUser = token.isPlatformUser;
        session.user.platformRole = token.platformRole;
      }
      return session;
    },
  },
  pages: {
    signIn: "/platform/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};