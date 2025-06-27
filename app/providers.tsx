"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // Including error handling and refetch interval for better user experience
  return (
    <SessionProvider
      // Re-fetch session every 30 minutes (reduced from 10)
      refetchInterval={30 * 60}
      refetchOnWindowFocus={false}
    >
      {children}
    </SessionProvider>
  );
}
