import React from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { TelemetryProvider } from "./context/TelemetryContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";

export default function App() {
  const { session, skipAuth } = useAuth();

  if (!session) {
    return <LoginPage />;
  }

  return (
    <TelemetryProvider tenantId={session.tenantId} consentGranted>
      <Dashboard skipAuth={skipAuth} />
    </TelemetryProvider>
  );
}
