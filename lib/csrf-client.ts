/**
 * Client-side CSRF Utilities
 *
 * This module provides client-side CSRF functionality without server-side imports.
 * Used by tRPC client and other client-side code.
 */

/**
 * CSRF configuration for client-side usage
 */
export const CSRF_CONFIG = {
  cookieName: "csrf-token",
  headerName: "x-csrf-token",
} as const;

/**
 * Client-side utilities
 */
export const CSRFClient = {
  /**
   * Get CSRF token from cookies (client-side)
   */
  getToken(): string | null {
    if (typeof document === "undefined") return null;

    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === CSRF_CONFIG.cookieName) {
        return decodeURIComponent(value);
      }
    }
    return null;
  },

  /**
   * Add CSRF token to fetch options
   */
  addTokenToFetch(options: RequestInit = {}): RequestInit {
    const token = this.getToken();
    if (!token) return options;

    return {
      ...options,
      headers: {
        ...options.headers,
        [CSRF_CONFIG.headerName]: token,
      },
    };
  },

  /**
   * Add CSRF token to form data
   */
  addTokenToFormData(formData: FormData): FormData {
    const token = this.getToken();
    if (token) {
      formData.append("csrf_token", token);
    }
    return formData;
  },

  /**
   * Add CSRF token to object (for JSON requests)
   */
  addTokenToObject<T extends Record<string, unknown>>(
    obj: T
  ): T & { csrfToken: string } {
    const token = this.getToken();
    return {
      ...obj,
      csrfToken: token || "",
    };
  },
};
