/**
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
  reactStrictMode: true,
  // Allow cross-origin requests from specific origins in development
  allowedDevOrigins: ["localhost", "127.0.0.1"],

  // Comprehensive HTTP Security Headers
  headers: async () => {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: [
          // Prevent MIME type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Prevent clickjacking attacks
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Enable XSS protection for legacy browsers
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // Control referrer information
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Prevent DNS rebinding attacks
          {
            key: "X-DNS-Prefetch-Control",
            value: "off",
          },
          // Basic Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Required for Next.js dev tools and React
              "style-src 'self' 'unsafe-inline'", // Required for TailwindCSS and inline styles
              "img-src 'self' data: https:", // Allow data URIs and HTTPS images
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-ancestors 'none'", // Equivalent to X-Frame-Options: DENY
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          // Security feature permissions policy
          {
            key: "Permissions-Policy",
            value: [
              "camera=()",
              "microphone=()",
              "geolocation=()",
              "interest-cohort=()",
              "browsing-topics=()",
            ].join(", "),
          },
        ],
      },
      // HTTPS Strict Transport Security (only for production HTTPS)
      ...(process.env.NODE_ENV === "production" ? [{
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      }] : []),
    ];
  },
};

export default nextConfig;
