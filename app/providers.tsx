"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // Including error handling and refetch interval for better user experience
  return (
    <SessionProvider
      // Re-fetch session every 10 minutes
      refetchInterval={10 * 60}
      refetchOnWindowFocus={true}
    >
      {children}
    </SessionProvider>
  );
}
