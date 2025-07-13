import { headers } from "next/headers";

/**
 * Get the CSP nonce from request headers (server-side only)
 */
export async function getNonce(): Promise<string | undefined> {
  try {
    const headersList = await headers();
    const nonce = headersList.get("X-Nonce");

    // Log for debugging hydration issues
    if (!nonce && process.env.NODE_ENV === "development") {
      console.warn(
        "No nonce found in headers - this may cause hydration mismatches"
      );
    }

    return nonce || undefined;
  } catch (error) {
    // Headers not available (e.g., in client-side code)
    if (process.env.NODE_ENV === "development") {
      console.warn("Failed to get headers for nonce:", error);
    }
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
