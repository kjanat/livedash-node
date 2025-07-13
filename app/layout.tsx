// Main app layout with basic global style
import "./globals.css";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { NonceProvider } from "@/lib/nonce-context";
import { getNonce } from "@/lib/nonce-utils";
import { Providers } from "./providers";

export const metadata = {
  title: "LiveDash - AI-Powered Customer Conversation Analytics",
  description:
    "Transform customer conversations into actionable insights with advanced AI sentiment analysis, automated categorization, and real-time analytics. Turn every conversation into competitive intelligence.",
  keywords: [
    "customer analytics",
    "AI sentiment analysis",
    "conversation intelligence",
    "customer support analytics",
    "chat analytics",
    "customer insights",
    "conversation analytics",
    "customer experience analytics",
    "sentiment tracking",
    "AI customer intelligence",
    "automated categorization",
    "real-time analytics",
    "customer conversation dashboard",
  ],
  authors: [{ name: "Notso AI" }],
  creator: "Notso AI",
  publisher: "Notso AI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXTAUTH_URL || "https://livedash.notso.ai"
  ),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "LiveDash - AI-Powered Customer Conversation Analytics",
    description:
      "Transform customer conversations into actionable insights with advanced AI sentiment analysis, automated categorization, and real-time analytics. Turn every conversation into competitive intelligence.",
    type: "website",
    siteName: "LiveDash",
    url: "/",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LiveDash - AI-Powered Customer Conversation Analytics Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LiveDash - AI-Powered Customer Conversation Analytics",
    description:
      "Transform customer conversations into actionable insights with advanced AI sentiment analysis, automated categorization, and real-time analytics.",
    creator: "@notsoai",
    site: "@notsoai",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon-192.svg",
  },
  manifest: "/manifest.json",
  other: {
    "msapplication-TileColor": "#2563eb",
    "theme-color": "#ffffff",
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const nonce = await getNonce();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LiveDash",
    description:
      "Transform customer conversations into actionable insights with advanced AI sentiment analysis, automated categorization, and real-time analytics.",
    url: process.env.NEXTAUTH_URL || "https://livedash.notso.ai",
    author: {
      "@type": "Organization",
      name: "Notso AI",
    },
    applicationCategory: "Business Analytics Software",
    operatingSystem: "Web Browser",
    offers: {
      "@type": "Offer",
      category: "SaaS",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "150",
    },
    featureList: [
      "AI-powered sentiment analysis",
      "Automated conversation categorization",
      "Real-time analytics dashboard",
      "Multi-language support",
      "Custom AI model integration",
      "Enterprise-grade security",
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          nonce={nonce}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe use for JSON-LD structured data with CSP nonce
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-background text-foreground min-h-screen font-sans antialiased">
        {/* Skip navigation link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
        <NonceProvider nonce={nonce}>
          <Providers>{children}</Providers>
        </NonceProvider>
        <Toaster />
      </body>
    </html>
  );
}
