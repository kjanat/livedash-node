/**
 * CSRF React Hooks
 *
 * Client-side hooks for managing CSRF tokens in React components.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { CSRFClient } from "../csrf";

/**
 * Hook for managing CSRF tokens
 */
export function useCSRF() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch a new CSRF token from the server
   */
  const fetchToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/csrf-token", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.token) {
        setToken(data.token);
      } else {
        throw new Error("Invalid response from CSRF endpoint");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch CSRF token";
      setError(errorMessage);
      console.error("CSRF token fetch error:", errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get token from cookies or fetch new one
   */
  const getToken = useCallback(async (): Promise<string | null> => {
    // Try to get existing token from cookies
    const existingToken = CSRFClient.getToken();
    if (existingToken) {
      setToken(existingToken);
      setLoading(false);
      return existingToken;
    }

    // If no token exists, fetch a new one
    await fetchToken();
    return CSRFClient.getToken();
  }, [fetchToken]);

  /**
   * Initialize token on mount
   */
  useEffect(() => {
    getToken();
  }, [getToken]);

  return {
    token,
    loading,
    error,
    fetchToken,
    getToken,
    refreshToken: fetchToken,
  };
}

/**
 * Hook for adding CSRF protection to fetch requests
 */
export function useCSRFFetch() {
  const { token, getToken } = useCSRF();

  /**
   * Enhanced fetch with automatic CSRF token inclusion
   */
  const csrfFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      // Ensure we have a token for state-changing requests
      const method = options.method || "GET";
      let modifiedOptions = options;
      if (["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase())) {
        const currentToken = token || (await getToken());
        if (currentToken) {
          modifiedOptions = CSRFClient.addTokenToFetch(options);
        }
      }

      return fetch(url, {
        ...modifiedOptions,
        credentials: "include", // Ensure cookies are sent
      });
    },
    [token, getToken]
  );

  return {
    csrfFetch,
    token,
    addTokenToFetch: CSRFClient.addTokenToFetch,
    addTokenToFormData: CSRFClient.addTokenToFormData,
    addTokenToObject: CSRFClient.addTokenToObject,
  };
}

/**
 * Hook for form submissions with CSRF protection
 */
export function useCSRFForm() {
  const { token, getToken } = useCSRF();

  /**
   * Submit form with CSRF protection
   */
  const submitForm = useCallback(
    async (
      url: string,
      formData: FormData,
      options: RequestInit = {}
    ): Promise<Response> => {
      // Ensure we have a token
      const currentToken = token || (await getToken());
      if (currentToken) {
        CSRFClient.addTokenToFormData(formData);
      }

      return fetch(url, {
        method: "POST",
        body: formData,
        credentials: "include",
        ...options,
      });
    },
    [token, getToken]
  );

  /**
   * Submit JSON data with CSRF protection
   */
  const submitJSON = useCallback(
    async (
      url: string,
      data: Record<string, unknown>,
      options: RequestInit = {}
    ): Promise<Response> => {
      // Ensure we have a token
      const currentToken = token || (await getToken());
      let modifiedData = data;
      if (currentToken) {
        modifiedData = CSRFClient.addTokenToObject(data);
      }

      return fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        body: JSON.stringify(modifiedData),
        credentials: "include",
        ...options,
      });
    },
    [token, getToken]
  );

  return {
    token,
    submitForm,
    submitJSON,
    addTokenToFormData: CSRFClient.addTokenToFormData,
    addTokenToObject: CSRFClient.addTokenToObject,
  };
}
