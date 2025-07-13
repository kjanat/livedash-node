import { type NextRequest, NextResponse } from "next/server";
import { buildCSP, generateNonce } from "@/lib/csp-server";

export function middleware(request: NextRequest) {
  // Skip CSP for API routes (except CSP report endpoint)
  if (
    request.nextUrl.pathname.startsWith("/api") &&
    !request.nextUrl.pathname.startsWith("/api/csp-report")
  ) {
    return NextResponse.next();
  }

  // Skip CSP for static assets
  if (
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/favicon") ||
    request.nextUrl.pathname.includes(".")
  ) {
    return NextResponse.next();
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
      "ambient-light=()",
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
     * Match all request paths except for the ones starting with:
     * - api (API routes, handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)",
  ],
};
