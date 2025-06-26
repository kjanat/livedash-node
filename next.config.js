/**
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
  reactStrictMode: true,
  // Allow cross-origin requests from specific origins in development
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost"
  ],
  // Disable Turbopack for now due to EISDIR error on Windows
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { fs: false, net: false, tls: false };
    }
    return config;
  },
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
    // disable the new Turbopack engine
    // This is a temporary workaround for the EISDIR error on Windows
    // Remove this once the issue is resolved in Next.js or Turbopack
    turbopack: false,
  },
};

export default nextConfig;
