/**
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
  reactStrictMode: true,
  // Allow cross-origin requests from specific origins in development
  allowedDevOrigins: ["localhost", "127.0.0.1"],

  // Note: Security headers are now handled by middleware.ts for enhanced CSP with nonce support
};

export default nextConfig;
