import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const C = {
  navy: "#112e51",
  blue: "#205493",
  muted: "#4a5568",
  border: "#cbd5e0",
  surface: "#ffffff",
  bg: "#f0f4f8",
};

export default function LoginPage() {
  const { login } = useAuth();
  const defaultTenant = import.meta.env.VITE_TENANT_ID || "TNT-DEMO01";
  const [displayName, setDisplayName] = useState("");
  const [tenantId, setTenantId] = useState(defaultTenant);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = login(displayName, tenantId, password);
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${C.navy} 0%, #1a365d 42%, ${C.bg} 42%)`,
        fontFamily: '"Source Sans 3", system-ui, sans-serif',
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: C.surface,
          borderRadius: 16,
          boxShadow: "0 24px 48px rgba(17, 46, 81, 0.12), 0 0 0 1px rgba(17, 46, 81, 0.06)",
          padding: "40px 36px 36px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: `linear-gradient(145deg, ${C.blue} 0%, #163d6b 100%)`,
              color: "#fff",
              fontWeight: 800,
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            N
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 22, color: C.navy, letterSpacing: "-0.02em" }}>NEXUS</div>
            <div style={{ fontSize: 12, color: C.muted, letterSpacing: "0.08em", fontWeight: 600 }}>
              Insight OS
            </div>
          </div>
        </div>

        <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: C.navy }}>Sign in</h1>
        <p style={{ margin: "0 0 28px", fontSize: 15, color: C.muted, lineHeight: 1.55 }}>
          Use your program workspace credentials. Tenant ID should match how telemetry is labeled in the AI Brain.
        </p>

        <form onSubmit={onSubmit}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 8 }}>
            Full name
            <input
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jordan Rivera"
              style={{
                display: "block",
                width: "100%",
                marginTop: 8,
                padding: "12px 14px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                fontSize: 15,
                boxSizing: "border-box",
              }}
            />
          </label>

          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: C.navy,
              marginBottom: 8,
              marginTop: 18,
            }}
          >
            Tenant ID
            <input
              type="text"
              autoComplete="organization"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="TNT-DEMO01"
              style={{
                display: "block",
                width: "100%",
                marginTop: 8,
                padding: "12px 14px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                fontSize: 15,
                boxSizing: "border-box",
                fontFamily: "ui-monospace, monospace",
              }}
            />
          </label>

          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: C.navy,
              marginBottom: 8,
              marginTop: 18,
            }}
          >
            Access phrase
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Workspace passphrase"
              style={{
                display: "block",
                width: "100%",
                marginTop: 8,
                padding: "12px 14px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                fontSize: 15,
                boxSizing: "border-box",
              }}
            />
          </label>

          {error && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                borderRadius: 8,
                background: "#fff5f5",
                border: "1px solid #feb2b2",
                color: "#c53030",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 24,
              width: "100%",
              padding: "14px 20px",
              borderRadius: 10,
              border: "none",
              background: C.navy,
              color: "#fff",
              fontWeight: 700,
              fontSize: 16,
              cursor: busy ? "wait" : "pointer",
              boxShadow: "0 4px 14px rgba(17, 46, 81, 0.25)",
            }}
          >
            {busy ? "Signing in…" : "Continue to dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
