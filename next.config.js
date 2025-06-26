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
};

export default nextConfig;
