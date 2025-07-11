"use client";

import { createContext, type ReactNode, useContext } from "react";

interface NonceContextType {
  nonce?: string;
}

const NonceContext = createContext<NonceContextType>({});

export function NonceProvider({
  children,
  nonce,
}: {
  children: ReactNode;
  nonce?: string;
}) {
  return (
    <NonceContext.Provider value={{ nonce }}>{children}</NonceContext.Provider>
  );
}

export function useNonce() {
  const context = useContext(NonceContext);
  return context.nonce;
}

export function useCSPNonce() {
  return useNonce();
}
