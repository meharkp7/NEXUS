import React, { Component, useEffect, useRef } from "react";
import GhostSDK from "@nexus/collector-sdk";
import { EVENT_TYPE, FEATURE_MODULE } from "@nexus/collector-sdk";

export function withFeatureTracking(WrappedComponent, featureModule, options = {}) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component";

  class TrackingErrorBoundary extends Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
      return { hasError: true };
    }

    componentDidCatch(error) {
      GhostSDK.trackFailure(featureModule, {
        errorMessage: error.message?.slice(0, 100),
        componentName: displayName,
        ...options,
      });
    }

    render() {
      if (this.state.hasError) {
        return (
          <div style={{ padding: "16px", color: "var(--color-text-danger, red)" }}>
            Feature temporarily unavailable.
          </div>
        );
      }
      return this.props.children;
    }
  }

  function TrackedComponent(props) {
    const mountTime = useRef(Date.now());

    useEffect(() => {
      GhostSDK.trackOpen(featureModule, {
        componentName: displayName,
        journeyId: options.journeyId,
        journeyStep: options.journeyStep,
      });

      return () => {
        const sessionDuration = Date.now() - mountTime.current;
        if (sessionDuration > 2000) {
          GhostSDK.trackSuccess(featureModule, {
            sessionDurationMs: sessionDuration,
            componentName: displayName,
          });
        }
      };
    }, []);

    return (
      <TrackingErrorBoundary>
        <WrappedComponent {...props} />
      </TrackingErrorBoundary>
    );
  }

  TrackedComponent.displayName = `Tracked(${displayName})`;
  return TrackedComponent;
}

export function wrapAPICall(fn, featureModule, metadata = {}) {
  return async function intercepted(...args) {
    const startTime = Date.now();
    try {
      const result = await fn(...args);
      await GhostSDK.trackSuccess(featureModule, {
        ...metadata,
        durationMs: Date.now() - startTime,
        functionName: fn.name,
      });
      return result;
    } catch (error) {
      await GhostSDK.trackFailure(featureModule, {
        ...metadata,
        durationMs: Date.now() - startTime,
        functionName: fn.name,
        errorCode: error?.code || error?.status || "UNKNOWN",
      });
      throw error;
    }
  };
}

export const ROUTE_FEATURE_MAP = [
  { pattern: /\/loans\/apply/, module: FEATURE_MODULE.LOAN_ORIGINATION },
  { pattern: /\/loans\/review/, module: FEATURE_MODULE.LOAN_ORIGINATION },
  { pattern: /\/documents/, module: FEATURE_MODULE.DOCUMENT_MANAGEMENT },
  { pattern: /\/risk/, module: FEATURE_MODULE.RISK_ASSESSMENT },
  { pattern: /\/compliance/, module: FEATURE_MODULE.COMPLIANCE_CHECK },
  { pattern: /\/repayment/, module: FEATURE_MODULE.REPAYMENT_SCHEDULE },
  { pattern: /\/reports/, module: FEATURE_MODULE.REPORTING_DASHBOARD },
  { pattern: /\/tenants/, module: FEATURE_MODULE.TENANT_MANAGEMENT },
];

export function resolveFeatureFromRoute(pathname) {
  for (const { pattern, module } of ROUTE_FEATURE_MAP) {
    if (pattern.test(pathname)) return module;
  }
  return null;
}

export function installRouteTracker() {
  const trackRoute = () => {
    const feature = resolveFeatureFromRoute(window.location.pathname);
    if (feature) {
      GhostSDK.capture({
        eventType: EVENT_TYPE.FEATURE_OPEN,
        featureModule: feature,
        metadata: { route: window.location.pathname },
      });
    }
  };

  window.addEventListener("popstate", trackRoute);
  const origPushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    origPushState(...args);
    trackRoute();
  };
  trackRoute();
}
