/**
 * CSRF Provider Component
 *
 * Provides CSRF token management for the entire application.
 * Automatically fetches and manages CSRF tokens for client-side requests.
 */

"use client";

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { CSRFClient } from "../../lib/csrf-client";

interface CSRFContextType {
  token: string | null;
  loading: boolean;
  error: string | null;
  refreshToken: () => Promise<void>;
  addTokenToFetch: (options: RequestInit) => RequestInit;
  addTokenToFormData: (formData: FormData) => FormData;
  addTokenToObject: <T extends Record<string, unknown>>(
    obj: T
  ) => T & { csrfToken: string };
}

const CSRFContext = createContext<CSRFContextType | undefined>(undefined);

interface CSRFProviderProps {
  children: React.ReactNode;
}

/**
 * CSRF Provider Component
 */
export function CSRFProvider({ children }: CSRFProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch CSRF token from server
   */
  const fetchToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // First check if we already have a token in cookies
      const existingToken = CSRFClient.getToken();
      if (existingToken) {
        setToken(existingToken);
        setLoading(false);
        return;
      }

      // Fetch new token from server
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
   * Refresh token manually
   */
  const refreshToken = async () => {
    await fetchToken();
  };

  /**
   * Initialize token on mount
   */
  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  /**
   * Monitor token changes in cookies
   */
  useEffect(() => {
    const checkToken = () => {
      const currentToken = CSRFClient.getToken();
      if (currentToken !== token) {
        setToken(currentToken);
      }
    };

    // Check token every 30 seconds
    const interval = setInterval(checkToken, 30 * 1000);

    return () => clearInterval(interval);
  }, [token]);

  const contextValue: CSRFContextType = {
    token,
    loading,
    error,
    refreshToken,
    addTokenToFetch: CSRFClient.addTokenToFetch,
    addTokenToFormData: CSRFClient.addTokenToFormData,
    addTokenToObject: CSRFClient.addTokenToObject,
  };

  return (
    <CSRFContext.Provider value={contextValue}>{children}</CSRFContext.Provider>
  );
}

/**
 * Hook to use CSRF context
 */
export function useCSRFContext(): CSRFContextType {
  const context = useContext(CSRFContext);

  if (context === undefined) {
    throw new Error("useCSRFContext must be used within a CSRFProvider");
  }

  return context;
}

/**
 * Higher-order component to wrap components with CSRF protection
 */
export function withCSRF<P extends object>(Component: React.ComponentType<P>) {
  const WrappedComponent = (props: P) => (
    <CSRFProvider>
      <Component {...props} />
    </CSRFProvider>
  );

  WrappedComponent.displayName = `withCSRF(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
