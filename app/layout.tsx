// Main app layout with basic global style
import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";

export const metadata = {
  title: "LiveDash-Node",
  description:
    "Multi-tenant dashboard system for tracking chat session metrics",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon-192.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
