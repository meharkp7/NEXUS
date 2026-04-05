import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "nexus_insight_session";

const AuthContext = createContext(null);

function loadStoredSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p?.tenantId && p?.displayName) return p;
  } catch {
    /* ignore */
  }
  return null;
}

export function AuthProvider({ children }) {
  const skipAuth = import.meta.env.VITE_SKIP_AUTH === "true";
  const defaultTenant = import.meta.env.VITE_TENANT_ID || "TNT-DEMO01";

  const [session, setSession] = useState(() => {
    if (skipAuth) {
      return { displayName: "Developer", tenantId: defaultTenant };
    }
    return loadStoredSession();
  });

  const login = useCallback((displayName, tenantId, password) => {
    const tid = (tenantId || "").trim();
    const name = (displayName || "").trim();
    const secret = (import.meta.env.VITE_APP_LOGIN_SECRET || "").trim();
    if (!tid || !name) return { ok: false, error: "Enter your name and tenant ID." };
    if (secret && password !== secret) {
      return { ok: false, error: "Invalid access phrase." };
    }
    if (!secret && (!password || password.length < 4)) {
      return { ok: false, error: "Enter an access phrase (at least 4 characters) for this demo workspace." };
    }
    const next = { displayName: name, tenantId: tid };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(skipAuth ? { displayName: "Developer", tenantId: defaultTenant } : null);
  }, [defaultTenant, skipAuth]);

  const value = useMemo(
    () => ({ session, login, logout, skipAuth }),
    [session, login, logout, skipAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
