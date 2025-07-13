import { headers } from "next/headers";

/**
 * Get the CSP nonce from request headers (server-side only)
 */
export async function getNonce(): Promise<string | undefined> {
  try {
    const headersList = await headers();
    const nonce = headersList.get("X-Nonce");

    // Don't warn about missing nonce as it's expected for static assets
    // The middleware only adds nonce for non-static routes
    return nonce || undefined;
  } catch {
    // Headers not available (e.g., in client-side code)
    // This is expected and not an error
    return undefined;
  }
}

/**
 * Create script props with nonce for CSP compliance
 */
export function createScriptProps(nonce?: string) {
  return nonce ? { nonce } : {};
}

/**
 * Create style props with nonce for CSP compliance
 */
export function createStyleProps(nonce?: string) {
  return nonce ? { nonce } : {};
}
