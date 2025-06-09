import NextAuth, { NextAuthConfig } from "next-auth";
import { D1Adapter } from "@auth/d1-adapter";
import Credentials from "next-auth/providers/credentials";
import * as bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

// Check if we're in a Cloudflare Workers environment
const isCloudflareWorker =
    typeof globalThis.caches !== "undefined" &&
    typeof (globalThis as any).WebSocketPair !== "undefined";

const config: NextAuthConfig = {
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
                    let prisma: PrismaClient;

                    // Initialize Prisma based on environment
                    if (isCloudflareWorker) {
                        // In Cloudflare Workers, get DB from bindings
                        const adapter = new PrismaD1((globalThis as any).DB);
                        prisma = new PrismaClient({ adapter });
                    } else {
                        // In local development, use standard Prisma
                        prisma = new PrismaClient();
                    }

                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email as string },
                        include: { company: true },
                    });

                    if (!user) {
                        await prisma.$disconnect();
                        return null;
                    }

                    const valid = await bcrypt.compare(
                        credentials.password as string,
                        user.password
                    );

                    if (!valid) {
                        await prisma.$disconnect();
                        return null;
                    }

                    const result = {
                        id: user.id,
                        email: user.email,
                        name: user.email, // Use email as name
                        role: user.role,
                        companyId: user.companyId,
                        company: user.company.name,
                    };

                    await prisma.$disconnect();
                    return result;
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

// Add D1 adapter only in Cloudflare Workers environment
if (isCloudflareWorker && (globalThis as any).DB) {
    (config as any).adapter = D1Adapter((globalThis as any).DB);
}

const { handlers } = NextAuth(config);

export const { GET, POST } = handlers;
