/**
 * Mobile / native hosts: mirror the Ghost SDK event shape sent to POST /api/v1/telemetry/events.
 * Hash tenantId the same way as the web SDK (SHA-256 → tenant_ + 12 hex) before emit if you match web behavior.
 */
export type NexusEventType =
  | "FEATURE_OPEN"
  | "FEATURE_SUCCESS"
  | "FEATURE_FAIL"
  | "JOURNEY_START"
  | "JOURNEY_STEP"
  | "JOURNEY_COMPLETE"
  | "JOURNEY_DROP";

export interface NexusTelemetryEvent {
  eventId: string;
  tenantId: string;
  sessionId: string;
  eventType: NexusEventType;
  featureModule: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  journeyId?: string | null;
  journeyStep?: string | null;
}

export interface NexusTelemetryBatch {
  events: NexusTelemetryEvent[];
  emittedAt?: string;
}
