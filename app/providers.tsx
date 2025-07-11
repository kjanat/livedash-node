"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { TRPCProvider } from "@/components/providers/TRPCProvider";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  // Including error handling and refetch interval for better user experience
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider
        // Re-fetch session every 30 minutes (reduced from 10)
        refetchInterval={30 * 60}
        refetchOnWindowFocus={false}
      >
        <TRPCProvider>{children}</TRPCProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
