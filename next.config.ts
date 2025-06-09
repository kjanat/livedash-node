import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();

// /**
//  * @type {import('next').NextConfig}
//  **/
// const nextConfig = {
//   reactStrictMode: true,

//   // Allow cross-origin requests from specific origins in development
//   allowedDevOrigins: [
//     "192.168.1.2",
//     "localhost",
//     "propc",
//     "test123.kjanat.com",
//   ],

//     // Cloudflare Pages optimization
//     trailingSlash: false,

//     // Environment variables that should be available to the client
//     env: {
//         AUTH_URL: process.env.AUTH_URL,
//     },

//     // Experimental features for Cloudflare compatibility
//     experimental: {
//         // Future experimental features can be added here
//     },

//     // Image optimization - Cloudflare has its own image optimization
//     images: {
//         unoptimized: true,
//     },
// };

// export default nextConfig;
