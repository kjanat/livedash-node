/**
 * tRPC Client Configuration
 *
 * This file sets up the tRPC client for use in React components.
 * Provides type-safe API calls with automatic serialization.
 */

import { httpBatchLink } from "@trpc/client";
import { createTRPCNext } from "@trpc/next";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers/_app";
import { CSRFClient } from "./csrf-client";

function getBaseUrl() {
  if (typeof window !== "undefined") {
    // browser should use relative path
    return "";
  }

  if (process.env.VERCEL_URL) {
    // reference for vercel.com
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.RENDER_INTERNAL_HOSTNAME) {
    // reference for render.com
    return `http://${process.env.RENDER_INTERNAL_HOSTNAME}:${process.env.PORT}`;
  }

  // assume localhost
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Main tRPC client instance
 */
export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      links: [
        httpBatchLink({
          /**
           * If you want to use SSR, you need to use the server's full URL
           * @link https://trpc.io/docs/ssr
           **/
          url: `${getBaseUrl()}/api/trpc`,

          /**
           * Transformer for data serialization
           */
          transformer: superjson,

          /**
           * Set custom request headers on every request from tRPC
           * @link https://trpc.io/docs/v10/header
           */
          headers() {
            const headers: Record<string, string> = {};

            // Add CSRF token for state-changing operations
            const csrfToken = CSRFClient.getToken();
            if (csrfToken) {
              headers["x-csrf-token"] = csrfToken;
            }

            return headers;
          },

          /**
           * Custom fetch implementation to include credentials
           */
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: "include",
            });
          },
        }),
      ],
      /**
       * Query client configuration
       * @link https://trpc.io/docs/v10/react-query-integration
       */
      queryClientConfig: {
        defaultOptions: {
          queries: {
            // Stale time of 30 seconds
            staleTime: 30 * 1000,
            // Cache time of 5 minutes
            gcTime: 5 * 60 * 1000,
            // Retry failed requests up to 3 times
            retry: 3,
            // Retry delay that increases exponentially
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            // Retry mutations once on network errors
            retry: 1,
          },
        },
      },
    };
  },
  /**
   * Whether tRPC should await queries when server rendering pages
   * @link https://trpc.io/docs/nextjs#ssr-boolean-default-false
   */
  ssr: false,
  transformer: superjson,
});

/**
 * Type helper for tRPC router
 */
export type TRPCRouter = typeof trpc;
