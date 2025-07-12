/**
 * tRPC Provider Component
 *
 * Simplified provider for tRPC integration.
 * The tRPC client is configured in trpc-client.ts and used directly in components.
 */

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

interface TRPCProviderProps {
  children: React.ReactNode;
}

export function TRPCProvider({ children }: TRPCProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Optimize refetching behavior for better performance
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: false, // Only refetch if stale
            retry: (failureCount, error) => {
              // Smart retry logic based on error type
              if (
                error?.message?.includes("401") ||
                error?.message?.includes("403")
              ) {
                return false; // Don't retry auth errors
              }
              return failureCount < 3;
            },
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000),

            // Optimized cache times based on data type
            staleTime: 2 * 60 * 1000, // 2 minutes - data is fresh for 2 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes - keep unused data for 10 minutes

            // Performance optimizations
            networkMode: "online", // Only run queries when online
            notifyOnChangeProps: ["data", "error", "isLoading"], // Reduce re-renders
          },
          mutations: {
            // Optimize mutation behavior
            retry: 2,
            networkMode: "online",
            throwOnError: false, // Handle errors gracefully in components
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
