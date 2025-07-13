/**
 * Server-only CSP utilities
 * This file should never be imported by client-side code
 */

import { type NextRequest, NextResponse } from "next/server";
import type { CSPConfig } from "./csp";

/**
 * Generate a cryptographically secure nonce for CSP
 */
export function generateNonce(): string {
  // Use Web Crypto API for Edge Runtime and browser compatibility
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode.apply(null, Array.from(bytes)));
  }

  throw new Error(
    "Web Crypto API not available - this should only be called in supported environments"
  );
}

/**
 * Build Content Security Policy header value based on configuration
 */
export function buildCSP(config: CSPConfig = {}): string {
  const {
    nonce,
    isDevelopment = false,
    reportUri,
    strictMode = false,
    allowedExternalDomains = [],
  } = config;

  // Base directives for all environments
  const baseDirectives = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "upgrade-insecure-requests": true,
  };

  // Script sources - more restrictive in production
  const scriptSrc = isDevelopment
    ? ["'self'", "'unsafe-eval'", "'unsafe-inline'"]
    : nonce
      ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]
      : ["'self'"];

  // Style sources - use nonce in production when available
  // Note: We need 'unsafe-inline' for third-party libraries like Sonner that inject styles dynamically
  const styleSrc = isDevelopment
    ? ["'self'", "'unsafe-inline'"]
    : nonce
      ? ["'self'", `'nonce-${nonce}'`, "'unsafe-inline'"] // Need unsafe-inline for Sonner/Leaflet
      : ["'self'", "'unsafe-inline'"]; // Fallback for TailwindCSS

  // Image sources - allow self, data URIs, and specific trusted domains
  const imgSrc = [
    "'self'",
    "data:",
    "https://schema.org", // For structured data images
    "https://livedash.notso.ai", // Application domain
    "https://*.basemaps.cartocdn.com", // Leaflet map tiles
    "https://*.openstreetmap.org", // OpenStreetMap tiles
    ...allowedExternalDomains
      .filter((domain) => domain.startsWith("https://"))
      .map((domain) => domain),
  ].filter(Boolean);

  // Font sources - restrict to self, data URIs, and Google Fonts (for Leaflet)
  const fontSrc = ["'self'", "data:", "https://fonts.gstatic.com"];

  // Connect sources - API endpoints and trusted domains
  const connectSrc = isDevelopment
    ? ["'self'", "https:", "wss:", "ws:"] // Allow broader sources in dev for HMR
    : strictMode
      ? [
          "'self'",
          "https://api.openai.com", // OpenAI API
          "https://livedash.notso.ai", // Application API
          ...allowedExternalDomains.filter(
            (domain) =>
              domain.startsWith("https://") || domain.startsWith("wss://")
          ),
        ].filter(Boolean)
      : [
          "'self'",
          "https://api.openai.com", // OpenAI API
          "https://livedash.notso.ai", // Application API
          "https:", // Allow all HTTPS in non-strict mode
        ];

  // Media sources - restrict to self
  const mediaSrc = ["'self'"];

  // Worker sources - restrict to self
  const workerSrc = ["'self'"];

  // Child sources - restrict to self
  const childSrc = ["'self'"];

  // Manifest sources - restrict to self
  const manifestSrc = ["'self'"];

  // Build the directive object
  const directives = {
    ...baseDirectives,
    "script-src": scriptSrc,
    "style-src": styleSrc,
    "img-src": imgSrc,
    "font-src": fontSrc,
    "connect-src": connectSrc,
    "media-src": mediaSrc,
    "worker-src": workerSrc,
    "child-src": childSrc,
    "manifest-src": manifestSrc,
  };

  // Add report URI if provided
  if (reportUri) {
    directives["report-uri"] = [reportUri];
    directives["report-to"] = ["csp-endpoint"];
  }

  // Convert directives to CSP string
  const cspString = Object.entries(directives)
    .map(([directive, value]) => {
      if (value === true) return directive;
      if (Array.isArray(value)) return `${directive} ${value.join(" ")}`;
      return `${directive} ${value}`;
    })
    .join("; ");

  return cspString;
}

/**
 * Create CSP middleware for Next.js
 */
export function createCSPMiddleware(config: CSPConfig = {}) {
  return (_request: NextRequest) => {
    const nonce = generateNonce();
    const isDevelopment = process.env.NODE_ENV === "development";

    const csp = buildCSP({
      ...config,
      nonce,
      isDevelopment,
    });

    const response = NextResponse.next();

    // Set CSP header
    response.headers.set("Content-Security-Policy", csp);

    // Store nonce for use in components
    response.headers.set("X-Nonce", nonce);

    return response;
  };
}
