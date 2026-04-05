export const EVENT_TYPE = {
  FEATURE_OPEN: "FEATURE_OPEN",
  FEATURE_SUCCESS: "FEATURE_SUCCESS",
  FEATURE_FAIL: "FEATURE_FAIL",
  JOURNEY_START: "JOURNEY_START",
  JOURNEY_STEP: "JOURNEY_STEP",
  JOURNEY_DROP: "JOURNEY_DROP",
  JOURNEY_COMPLETE: "JOURNEY_COMPLETE",
  API_CALL: "API_CALL",
  BATCH_TRIGGER: "BATCH_TRIGGER",
};

export const CHANNEL = {
  WEB: "WEB",
  MOBILE: "MOBILE",
  API: "API",
  BATCH: "BATCH",
};

export const FEATURE_MODULE = {
  LOAN_ORIGINATION: "LOAN_ORIGINATION",
  DOCUMENT_MANAGEMENT: "DOCUMENT_MANAGEMENT",
  RISK_ASSESSMENT: "RISK_ASSESSMENT",
  COMPLIANCE_CHECK: "COMPLIANCE_CHECK",
  REPAYMENT_SCHEDULE: "REPAYMENT_SCHEDULE",
  UPSELL_ENGINE: "UPSELL_ENGINE",
  REPORTING_DASHBOARD: "REPORTING_DASHBOARD",
  TENANT_MANAGEMENT: "TENANT_MANAGEMENT",
};

export const JOURNEY = {
  LOAN_APPLICATION: "LOAN_APPLICATION",
  KYC_VERIFICATION: "KYC_VERIFICATION",
  DOCUMENT_UPLOAD: "DOCUMENT_UPLOAD",
  LOAN_APPROVAL: "LOAN_APPROVAL",
  DISBURSEMENT: "DISBURSEMENT",
};

export const JOURNEY_STEPS = {
  [JOURNEY.LOAN_APPLICATION]: [
    "PERSONAL_DETAILS",
    "INCOME_DETAILS",
    "EMPLOYMENT_DETAILS",
    "DOCUMENT_UPLOAD",
    "REVIEW_SUBMIT",
  ],
  [JOURNEY.KYC_VERIFICATION]: [
    "ID_UPLOAD",
    "FACE_MATCH",
    "ADDRESS_PROOF",
    "VERIFICATION_COMPLETE",
  ],
  [JOURNEY.DOCUMENT_UPLOAD]: [
    "SELECT_DOCUMENT_TYPE",
    "UPLOAD_FILE",
    "OCR_PROCESSING",
    "DOCUMENT_CONFIRMED",
  ],
};

const _FEATURE_OR_JOURNEY = new Set([
  ...Object.values(FEATURE_MODULE),
  ...Object.values(JOURNEY),
]);

export function createEvent({
  eventType,
  featureModule,
  channel,
  tenantId,
  sessionId,
  journeyId = null,
  journeyStep = null,
  metadata = {},
}) {
  if (!Object.values(EVENT_TYPE).includes(eventType)) {
    console.warn(`[NEXUS SDK] Unknown eventType: ${eventType}`);
  }
  if (!_FEATURE_OR_JOURNEY.has(featureModule)) {
    console.warn(`[NEXUS SDK] Unknown featureModule / journey: ${featureModule}`);
  }

  return {
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    eventType,
    featureModule,
    channel,
    tenantId,
    sessionId,
    journeyId,
    journeyStep,
    sdkVersion: "1.0.0",
    metadata,
  };
}
