// Cloudflare Worker entry point for LiveDash-Node
// This file handles requests when deployed to Cloudflare Workers

import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';

export interface Env {
    DB: D1Database;
    NEXTAUTH_SECRET?: string;
    NEXTAUTH_URL?: string;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        try {
            // Initialize Prisma with D1 adapter
            const adapter = new PrismaD1(env.DB);
            const prisma = new PrismaClient({ adapter });

            const url = new URL(request.url);

            // CORS headers for all responses
            const corsHeaders = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            };

            // Handle preflight requests
            if (request.method === 'OPTIONS') {
                return new Response(null, { headers: corsHeaders });
            }

            // Handle API routes
            if (url.pathname.startsWith('/api/')) {

                // Simple health check endpoint
                if (url.pathname === '/api/health') {
                    const companyCount = await prisma.company.count();
                    const sessionCount = await prisma.session.count();

                    return new Response(
                        JSON.stringify({
                            status: 'healthy',
                            database: 'connected',
                            companies: companyCount,
                            sessions: sessionCount,
                            timestamp: new Date().toISOString()
                        }),
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                ...corsHeaders
                            },
                        }
                    );
                }

                // Test metrics endpoint
                if (url.pathname === '/api/test-metrics') {
                    const sessions = await prisma.session.findMany({
                        take: 10,
                        orderBy: { startTime: 'desc' }
                    });

                    return new Response(
                        JSON.stringify({
                            message: 'LiveDash API running on Cloudflare Workers with D1',
                            recentSessions: sessions.length,
                            sessions: sessions
                        }),
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                ...corsHeaders
                            },
                        }
                    );
                }

                // For other API routes, return a placeholder response
                return new Response(
                    JSON.stringify({
                        message: 'API endpoint not implemented in worker yet',
                        path: url.pathname,
                        method: request.method,
                        note: 'This endpoint needs to be migrated from Next.js API routes'
                    }),
                    {
                        status: 501,
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders
                        },
                    }
                );
            }

            // Handle root path - simple test page
            if (url.pathname === '/') {
                try {
                    const companies = await prisma.company.findMany();
                    const recentSessions = await prisma.session.findMany({
                        take: 5,
                        orderBy: { startTime: 'desc' },
                        include: { company: { select: { name: true } } }
                    });

                    return new Response(
                        `
            <!DOCTYPE html>
            <html>
              <head>
                <title>LiveDash-Node on Cloudflare Workers</title>
                <link rel="stylesheet" type="text/css" href="https://static.integrations.cloudflare.com/styles.css">
                <style>
                  .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
                  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
                  .card { background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef; }
                  pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px; }
                  .api-list { list-style: none; padding: 0; }
                  .api-list li { margin: 8px 0; }
                  .api-list a { color: #0066cc; text-decoration: none; }
                  .api-list a:hover { text-decoration: underline; }
                  .status { color: #28a745; font-weight: bold; }
                </style>
              </head>
              <body>
                <div class="container">
                  <header>
                    <img
                      src="https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/30e0d3f6-6076-40f8-7abb-8a7676f83c00/public"
                    />
                    <h1>🎉 LiveDash-Node Successfully Connected to D1!</h1>
                    <p class="status">✓ Database Connected | ✓ Prisma Client Working | ✓ D1 Adapter Active</p>
                  </header>

                  <div class="grid">
                    <div class="card">
                      <h3>📊 Database Stats</h3>
                      <ul>
                        <li><strong>Companies:</strong> ${companies.length}</li>
                        <li><strong>Recent Sessions:</strong> ${recentSessions.length}</li>
                      </ul>
                    </div>

                    <div class="card">
                      <h3>🔗 Test API Endpoints</h3>
                      <ul class="api-list">
                        <li><a href="/api/health">/api/health</a> - Health check</li>
                        <li><a href="/api/test-metrics">/api/test-metrics</a> - Sample data</li>
                      </ul>
                    </div>
                  </div>

                  <div class="card">
                    <h3>🏢 Companies in Database</h3>
                    <pre>${companies.length > 0 ? JSON.stringify(companies, null, 2) : 'No companies found'}</pre>
                  </div>

                  <div class="card">
                    <h3>📈 Recent Sessions</h3>
                    <pre>${recentSessions.length > 0 ? JSON.stringify(recentSessions, null, 2) : 'No sessions found'}</pre>
                  </div>

                  <footer style="margin-top: 40px; text-align: center; color: #666;">
                    <small>
                      <a target="_blank" href="https://developers.cloudflare.com/d1/">Learn more about Cloudflare D1</a> |
                      <a target="_blank" href="https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-cloudflare-workers">Prisma + Workers Guide</a>
                    </small>
                  </footer>
                </div>
              </body>
            </html>
            `,
                        {
                            headers: {
                                'Content-Type': 'text/html',
                                ...corsHeaders
                            },
                        }
                    );
                } catch (dbError) {
                    return new Response(
                        `
            <!DOCTYPE html>
            <html>
              <head><title>LiveDash-Node - Database Error</title></head>
              <body>
                <h1>❌ Database Connection Error</h1>
                <p>Error: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}</p>
                <p>Check your D1 database configuration and make sure migrations have been applied.</p>
              </body>
            </html>
            `,
                        {
                            status: 500,
                            headers: { 'Content-Type': 'text/html' },
                        }
                    );
                }
            }

            // Handle all other routes
            return new Response('Not Found - This endpoint is not available in the worker deployment', {
                status: 404,
                headers: corsHeaders
            });

        } catch (error) {
            console.error('Worker error:', error);
            return new Response(
                JSON.stringify({
                    error: 'Internal Server Error',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined
                }),
                {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                }
            );
        }
    },
};
