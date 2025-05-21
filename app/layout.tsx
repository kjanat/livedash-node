// Main app layout with basic global style
import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'LiveDash-Node',
  description:
    'Multi-tenant dashboard system for tracking chat session metrics',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 min-h-screen font-sans">
        <div className="max-w-5xl mx-auto py-8">{children}</div>
      </body>
    </html>
  );
}
