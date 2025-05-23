/**
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
  reactStrictMode: true,
  // Allow cross-origin requests from specific origins in development
  allowedDevOrigins: [
    "192.168.1.2",
    "localhost",
    "propc",
    "test123.kjanat.com",
  ],
};

export default nextConfig;
