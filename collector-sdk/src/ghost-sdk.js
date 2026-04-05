import { createEvent, EVENT_TYPE, CHANNEL } from "./feature-taxonomy.js";
import { maskEventPII, maskTenantId } from "./masking.js";

/**
 * @typedef {object} GhostSDKConfig
 * @property {string} tenantId
 * @property {string} channel
 * @property {function(Array): Promise<void>} emitEvents — transport (AI Brain, vault gateway, or hybrid)
 * @property {boolean} [consentGranted]
 * @property {number} [flushInterval]
 * @property {number} [maxBufferSize]
 * @property {number} [cpuThreshold]
 * @property {boolean} [debug]
 */

const DEFAULT_CONFIG = {
  consentGranted: false,
  flushInterval: 5000,
  maxBufferSize: 50,
  cpuThreshold: 80,
  debug: false,
};

let _config = null;
let _maskedTenantId = null;
let _sessionId = null;
let _eventBuffer = [];
let _flushTimer = null;
let _isCircuitOpen = false;
let _activeJourneys = {};

const SESSION_KEY = "nexus_session_id";

function getOrCreateSessionId() {
  if (typeof sessionStorage === "undefined") {
    return crypto.randomUUID();
  }
  let s = sessionStorage.getItem(SESSION_KEY);
  if (!s) {
    s = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, s);
  }
  return s;
}

export async function init(config) {
  if (!config?.emitEvents || typeof config.emitEvents !== "function") {
    throw new Error(
      "[GhostSDK] init({ emitEvents }) requires emitEvents(batch) — wire to your API or vault gateway."
    );
  }
  _config = { ...DEFAULT_CONFIG, ...config };
  _maskedTenantId = await maskTenantId(_config.tenantId);
  _sessionId = getOrCreateSessionId();

  if (_config.debug) {
    console.info("[GhostSDK] Initialized", {
      maskedTenantId: _maskedTenantId,
      channel: _config.channel,
      consentGranted: _config.consentGranted,
    });
  }

  _flushTimer = setInterval(_flushBuffer, _config.flushInterval);
  window?.addEventListener("beforeunload", () => _flushBuffer(true));
}

function _checkCircuitBreaker() {
  if (_eventBuffer.length >= _config.maxBufferSize * 2) {
    _isCircuitOpen = true;
    if (_config.debug) console.warn("[GhostSDK] Circuit breaker OPEN — buffer overloaded");
    return true;
  }
  _isCircuitOpen = false;
  return false;
}

export async function capture({ eventType, featureModule, journeyId, journeyStep, metadata = {} }) {
  if (!_config?.consentGranted) {
    if (_config?.debug) console.log("[GhostSDK] Telemetry skipped — consent not granted");
    return;
  }

  if (_checkCircuitBreaker()) return;

  const rawEvent = createEvent({
    eventType,
    featureModule,
    channel: _config.channel,
    tenantId: _maskedTenantId,
    sessionId: _sessionId,
    journeyId: journeyId || null,
    journeyStep: journeyStep || null,
    metadata,
  });

  const safeEvent = await maskEventPII(rawEvent);
  _eventBuffer.push(safeEvent);

  if (_config?.debug) console.log("[GhostSDK] Captured:", safeEvent);

  if (_eventBuffer.length >= _config.maxBufferSize) {
    await _flushBuffer();
  }
}

export const trackSuccess = (featureModule, metadata) =>
  capture({ eventType: EVENT_TYPE.FEATURE_SUCCESS, featureModule, metadata });

export const trackFailure = (featureModule, metadata) =>
  capture({ eventType: EVENT_TYPE.FEATURE_FAIL, featureModule, metadata });

export const trackOpen = (featureModule, metadata) =>
  capture({ eventType: EVENT_TYPE.FEATURE_OPEN, featureModule, metadata });

export async function startJourney(journeyName) {
  const journeyId = crypto.randomUUID();
  _activeJourneys[journeyId] = {
    journey: journeyName,
    startedAt: Date.now(),
    currentStep: null,
  };

  await capture({
    eventType: EVENT_TYPE.JOURNEY_START,
    featureModule: journeyName,
    journeyId,
    metadata: { journeyName },
  });

  if (_config?.debug) console.log(`[GhostSDK] Journey started: ${journeyName} (${journeyId})`);
  return journeyId;
}

export async function trackJourneyStep(journeyId, stepName, metadata = {}) {
  if (!_activeJourneys[journeyId]) {
    console.warn(`[GhostSDK] Unknown journeyId: ${journeyId}`);
    return;
  }
  _activeJourneys[journeyId].currentStep = stepName;

  await capture({
    eventType: EVENT_TYPE.JOURNEY_STEP,
    featureModule: _activeJourneys[journeyId].journey,
    journeyId,
    journeyStep: stepName,
    metadata,
  });
}

export async function completeJourney(journeyId, metadata = {}) {
  if (!_activeJourneys[journeyId]) return;

  const duration = Date.now() - _activeJourneys[journeyId].startedAt;
  await capture({
    eventType: EVENT_TYPE.JOURNEY_COMPLETE,
    featureModule: _activeJourneys[journeyId].journey,
    journeyId,
    metadata: { ...metadata, durationMs: duration },
  });

  delete _activeJourneys[journeyId];
}

export async function dropJourney(journeyId, reason = "unknown") {
  if (!_activeJourneys[journeyId]) return;

  const { journey, currentStep, startedAt } = _activeJourneys[journeyId];
  await capture({
    eventType: EVENT_TYPE.JOURNEY_DROP,
    featureModule: journey,
    journeyId,
    journeyStep: currentStep,
    metadata: { reason, durationMs: Date.now() - startedAt },
  });

  delete _activeJourneys[journeyId];
}

async function _flushBuffer(force = false) {
  if (_eventBuffer.length === 0) return;

  const batchToSend = [..._eventBuffer];
  _eventBuffer = [];

  try {
    await _config.emitEvents(batchToSend);
    if (_config?.debug) console.log(`[GhostSDK] Flushed ${batchToSend.length} events`);
  } catch (err) {
    if (!force && _eventBuffer.length < _config.maxBufferSize) {
      _eventBuffer = [...batchToSend, ..._eventBuffer];
    }
    if (_config?.debug) console.error("[GhostSDK] Flush failed, events re-queued:", err);
  }
}

export function setConsent(granted) {
  if (!_config) return;
  _config.consentGranted = granted;
  if (!granted) {
    _eventBuffer = [];
    if (_config.debug) console.info("[GhostSDK] Consent revoked — buffer cleared");
  }
}

export function getStatus() {
  return {
    initialized: !!_config,
    consentGranted: _config?.consentGranted ?? false,
    maskedTenantId: _maskedTenantId,
    sessionId: _sessionId,
    bufferedEvents: _eventBuffer.length,
    circuitBreakerOpen: _isCircuitOpen,
    activeJourneys: Object.keys(_activeJourneys).length,
  };
}

export async function destroy() {
  if (_flushTimer) clearInterval(_flushTimer);
  await _flushBuffer(true);
  _config = null;
  _eventBuffer = [];
  _activeJourneys = {};
}

const GhostSDK = {
  init,
  capture,
  trackOpen,
  trackSuccess,
  trackFailure,
  startJourney,
  trackJourneyStep,
  completeJourney,
  dropJourney,
  setConsent,
  getStatus,
  destroy,
};

export default GhostSDK;

export { EVENT_TYPE, CHANNEL };
