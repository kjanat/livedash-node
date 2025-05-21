// Main app layout with basic global style
import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "./providers";

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
    <html lang="en">
      <body className="bg-gray-100 min-h-screen font-sans">
        <Providers>
          <div className="max-w-5xl mx-auto py-8">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
