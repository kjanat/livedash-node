import { type NextRequest, NextResponse } from "next/server";
import { buildCSP, generateNonce } from "@/lib/csp-server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware entirely for static assets and Next.js internals
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.includes(".") ||
    pathname.startsWith("/favicon")
  ) {
    // Skip CSP for API routes except CSP report endpoint
    if (pathname === "/api/csp-report") {
      // Allow CSP report endpoint to proceed with CSP headers
    } else {
      return NextResponse.next();
    }
  }

  const response = NextResponse.next();
  const nonce = generateNonce();
  const isDevelopment = process.env.NODE_ENV === "development";

  // Build CSP with nonce and report URI
  const csp = buildCSP({
    nonce,
    isDevelopment,
    reportUri: "/api/csp-report",
    enforceMode: true,
    strictMode: !isDevelopment, // Enable strict mode in production
    reportingLevel: "violations",
  });

  // Set enhanced security headers
  response.headers.set("Content-Security-Policy", csp);

  // Modern CSP violation reporting
  response.headers.set(
    "Report-To",
    JSON.stringify({
      group: "csp-endpoint",
      max_age: 86400,
      endpoints: [{ url: "/api/csp-report" }],
      include_subdomains: true,
    })
  );

  // Store nonce for components to use
  response.headers.set("X-Nonce", nonce);

  // Enhanced security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");

  // Permissions Policy - more restrictive than before
  response.headers.set(
    "Permissions-Policy",
    [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "interest-cohort=()",
      "browsing-topics=()",
      "display-capture=()",
      "fullscreen=(self)",
      "web-share=(self)",
      "clipboard-read=()",
      "clipboard-write=(self)",
      "payment=()",
      "usb=()",
      "bluetooth=()",
      "midi=()",
      "accelerometer=()",
      "gyroscope=()",
      "magnetometer=()",
      // Removed ambient-light as it's deprecated
      "encrypted-media=()",
      "autoplay=(self)",
    ].join(", ")
  );

  // HSTS only in production
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Additional security headers
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - API routes (except /api/csp-report)
     * - Next.js internals (_next)
     * - Static files (anything with a file extension)
     * - Favicon
     */
    {
      source: "/((?!_next|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
