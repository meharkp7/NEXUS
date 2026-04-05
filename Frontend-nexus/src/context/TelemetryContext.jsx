import React, { createContext, useContext, useEffect, useState } from "react";
import GhostSDK from "@nexus/collector-sdk";
import { CHANNEL, maskTenantId } from "@nexus/collector-sdk";
import { installRouteTracker } from "../tracking/tracking-wrapper.jsx";
import { emitEvents } from "../services/api.js";

const TelemetryContext = createContext(null);

export function TelemetryProvider({ tenantId, consentGranted, children }) {
  const [sdkStatus, setSdkStatus] = useState(null);

  useEffect(() => {
    let initialized = false;

    async function bootstrap() {
      try {
        await GhostSDK.init({
          tenantId,
          channel: CHANNEL.WEB,
          consentGranted,
          emitEvents,
          debug: import.meta.env.DEV,
        });
        installRouteTracker();
        initialized = true;
        setSdkStatus(GhostSDK.getStatus());
      } catch (e) {
        console.error("[Telemetry] GhostSDK init failed:", e);
        try {
          const mid = await maskTenantId(tenantId);
          setSdkStatus({
            initialized: false,
            consentGranted,
            maskedTenantId: mid,
            sessionId: null,
            bufferedEvents: 0,
            circuitBreakerOpen: false,
            activeJourneys: 0,
          });
        } catch {
          setSdkStatus({
            initialized: false,
            consentGranted,
            maskedTenantId: null,
            sessionId: null,
            bufferedEvents: 0,
            circuitBreakerOpen: false,
            activeJourneys: 0,
          });
        }
      }
    }

    bootstrap();

    return () => {
      if (initialized) GhostSDK.destroy();
    };
  }, [tenantId]);

  useEffect(() => {
    GhostSDK.setConsent(consentGranted);
    setSdkStatus(GhostSDK.getStatus());
  }, [consentGranted]);

  return (
    <TelemetryContext.Provider value={{ sdk: GhostSDK, sdkStatus }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const ctx = useContext(TelemetryContext);
  if (!ctx) {
    throw new Error("useTelemetry must be used within a <TelemetryProvider>");
  }
  return ctx;
}

export default TelemetryContext;
