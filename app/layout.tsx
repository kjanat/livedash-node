// Main app layout with basic global style
import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";

export const metadata = {
  title: "LiveDash - AI-Powered Customer Conversation Analytics",
  description:
    "Transform customer conversations into actionable insights with advanced AI sentiment analysis, automated categorization, and real-time analytics.",
  keywords: [
    "customer analytics",
    "AI sentiment analysis",
    "conversation intelligence",
    "customer support analytics",
    "chat analytics",
    "customer insights"
  ],
  openGraph: {
    title: "LiveDash - AI-Powered Customer Conversation Analytics",
    description: "Transform customer conversations into actionable insights with advanced AI sentiment analysis, automated categorization, and real-time analytics.",
    type: "website",
    siteName: "LiveDash",
  },
  twitter: {
    card: "summary_large_image",
    title: "LiveDash - AI-Powered Customer Conversation Analytics",
    description: "Transform customer conversations into actionable insights with advanced AI sentiment analysis, automated categorization, and real-time analytics.",
  },
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
        {/* Skip navigation link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
