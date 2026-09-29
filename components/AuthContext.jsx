"use client";

import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [activeUser, setActiveUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadActiveUser() {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) return;

        const user = await response.json();
        if (!cancelled) setActiveUser(user);
      } catch {
        // The user remains unauthenticated if the session cannot be loaded.
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    loadActiveUser();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ activeUser, setActiveUser, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
