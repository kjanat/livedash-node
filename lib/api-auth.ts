import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface ApiSession {
    user: {
        id: string;
        email: string;
        role: string;
        companyId: string;
        company: string;
    };
}

export async function getApiSession(req: NextApiRequest, res: NextApiResponse): Promise<ApiSession | null> {
    try {
        // Get session by making internal request to session endpoint
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
        const host = req.headers.host || 'localhost:3000';
        const sessionUrl = `${protocol}://${host}/api/auth/session`;

        // Forward all relevant headers including cookies
        const headers: Record<string, string> = {};
        if (req.headers.cookie) {
            headers['Cookie'] = Array.isArray(req.headers.cookie) ? req.headers.cookie.join('; ') : req.headers.cookie;
        }
        if (req.headers['user-agent']) {
            headers['User-Agent'] = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
        }
        if (req.headers['x-forwarded-for']) {
            headers['X-Forwarded-For'] = Array.isArray(req.headers['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers['x-forwarded-for'];
        }
        if (req.headers['x-forwarded-proto']) {
            headers['X-Forwarded-Proto'] = Array.isArray(req.headers['x-forwarded-proto']) ? req.headers['x-forwarded-proto'][0] : req.headers['x-forwarded-proto'];
        }

        console.log('Requesting session from:', sessionUrl);
        console.log('With headers:', Object.keys(headers));

        const sessionResponse = await fetch(sessionUrl, {
            method: 'GET',
            headers,
            // Use agent to handle localhost properly
            ...(host.includes('localhost') && {
                // No special agent needed for localhost in Node.js
            })
        });

        if (!sessionResponse.ok) {
            console.log('Session response not ok:', sessionResponse.status, sessionResponse.statusText);
            return null;
        }

        const sessionData: any = await sessionResponse.json();
        console.log('Session data received:', sessionData);

        if (!sessionData?.user?.email) {
            console.log('No user email in session data');
            return null;
        }

        // Get user data from database
        const user = await prisma.user.findUnique({
            where: { email: sessionData.user.email },
            include: { company: true },
        });

        if (!user) {
            console.log('User not found in database:', sessionData.user.email);
            return null;
        }

        console.log('Successfully got user:', user.email);
        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                companyId: user.companyId,
                company: user.company.name,
            },
        };
    } catch (error) {
        console.error("Error getting API session:", error);
        return null;
    }
}
