import bundleAnalyzer from "@next/bundle-analyzer";

// Enable bundle analyzer when ANALYZE=true
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/**
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
  reactStrictMode: true,
  // Allow cross-origin requests from specific origins in development
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.2"],

  // Disable ESLint during build (using Biome for linting)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Note: Security headers are now handled by middleware.ts for enhanced CSP with nonce support

  // Bundle optimization settings (swcMinify is now default and deprecated option removed)

  // Compress responses
  compress: true,

  // Optimize images
  images: {
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Turbopack configuration (moved from experimental.turbo)
  turbopack: {
    rules: {
      // Optimize for specific file types
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },

  // Experimental features for performance
  experimental: {
    // Optimize CSS handling - disabled due to critters dependency
    optimizeCss: false,
    // Enable partial prerendering for better performance
    ppr: false, // Can be enabled when stable
    // Optimize package imports
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
    ],
  },

  // Webpack configuration optimizations
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev) {
      // Enable tree shaking for better bundle size
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
      };

      // Optimize chunk splitting
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        chunks: "all",
        cacheGroups: {
          // Create separate chunks for vendor libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
            priority: 10,
          },
          // Separate chunk for UI components
          ui: {
            test: /[\\/]node_modules[\\/](@radix-ui|lucide-react)[\\/]/,
            name: "ui-components",
            chunks: "all",
            priority: 20,
          },
          // Separate chunk for data visualization
          charts: {
            test: /[\\/]node_modules[\\/](recharts|d3)[\\/]/,
            name: "charts",
            chunks: "all",
            priority: 20,
          },
          // Common utilities chunk
          utils: {
            test: /[\\/]node_modules[\\/](date-fns|clsx|class-variance-authority)[\\/]/,
            name: "utils",
            chunks: "all",
            priority: 15,
          },
        },
      };
    }

    // Client-side optimizations
    if (!isServer) {
      // Resolve fallbacks for Node.js modules not available in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },

  // Output configuration
  output: "standalone",

  // Disable source maps in production for smaller bundles
  productionBrowserSourceMaps: false,

  // PoweredByHeader for security
  poweredByHeader: false,
};

export default withBundleAnalyzer(nextConfig);
