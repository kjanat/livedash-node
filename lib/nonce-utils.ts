import { headers } from "next/headers";

/**
 * Get the CSP nonce from request headers (server-side only)
 */
export async function getNonce(): Promise<string | undefined> {
  try {
    const headersList = await headers();
    return headersList.get("X-Nonce") || undefined;
  } catch {
    // Headers not available (e.g., in client-side code)
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
