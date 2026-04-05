// In dev, default to same-origin `/api/...` so Vite proxies to the AI Brain (avoids 404s if the
// browser was pointed at the wrong host). Production builds use the configured origin.
const configuredBrain = import.meta.env.VITE_INSIGHTOS_API_URL || "";
const useDevProxy =
  import.meta.env.DEV && import.meta.env.VITE_DEV_API_PROXY !== "false";
const BRAIN_URL = useDevProxy
  ? ""
  : configuredBrain || "http://localhost:8787";
const VAULT_URL =
  import.meta.env.VITE_VAULT_GATEWAY_URL || "http://localhost:8091";

export function getBrainApiKey() {
  return (import.meta.env.VITE_NEXUS_API_KEY || "").trim();
}

const DEPLOYMENT =
  (import.meta.env.VITE_NEXUS_DEPLOYMENT || "cloud").toLowerCase();

const RBAC_ROLE = (import.meta.env.VITE_NEXUS_RBAC_ROLE || "").trim();
const RBAC_TENANT = (import.meta.env.VITE_NEXUS_RBAC_TENANT || "").trim();

function buildHeaders(extra = {}) {
  const h = {
    "Content-Type": "application/json",
    "X-InsightOS-SDK-Version": "1.0.0",
    ...extra,
  };
  const apiKey = getBrainApiKey();
  if (apiKey) {
    h.Authorization = `Bearer ${apiKey}`;
  }
  if (RBAC_ROLE) {
    h["X-NEXUS-Role"] = RBAC_ROLE;
  }
  if (RBAC_TENANT) {
    h["X-NEXUS-Tenant"] = RBAC_TENANT;
  }
  return h;
}

async function postBrainEvents(events, emittedAt) {
  const response = await fetch(`${BRAIN_URL}/api/v1/telemetry/events`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ events, emittedAt }),
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`[NEXUS] AI Brain emit failed: ${response.status} ${t}`);
  }
}

async function postVaultEvents(events, emittedAt) {
  const response = await fetch(`${VAULT_URL}/api/v1/events`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ events, emittedAt }),
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`[NEXUS] Vault gateway failed: ${response.status} ${t}`);
  }
}

export async function emitEvents(events) {
  if (!events || events.length === 0) return;
  const emittedAt = new Date().toISOString();

  if (DEPLOYMENT === "on_prem") {
    await postVaultEvents(events, emittedAt);
    return;
  }
  if (DEPLOYMENT === "hybrid") {
    await postVaultEvents(events, emittedAt).catch((e) =>
      console.warn("[NEXUS] Vault (optional):", e)
    );
    await postBrainEvents(events, emittedAt);
    return;
  }
  await postBrainEvents(events, emittedAt);
}

export async function fetchDashboardAnalytics({ maskedTenantId, dateFrom, dateTo }) {
  const params = new URLSearchParams({
    tenantId: maskedTenantId,
    ...(dateFrom && { from: dateFrom }),
    ...(dateTo && { to: dateTo }),
  });
  const response = await fetch(
    `${BRAIN_URL}/api/v1/analytics/dashboard?${params}`,
    { headers: buildHeaders() }
  );
  if (!response.ok) throw new Error(`[NEXUS] Dashboard failed: ${response.status}`);
  return response.json();
}

export async function fetchAdoptionHeatmap(maskedTenantId) {
  const response = await fetch(
    `${BRAIN_URL}/api/v1/analytics/adoption?tenantId=${encodeURIComponent(maskedTenantId)}`,
    { headers: buildHeaders() }
  );
  if (!response.ok) throw new Error("[NEXUS] Adoption failed");
  return response.json();
}

export async function fetchJourneyFunnel(journeyName, maskedTenantId) {
  const response = await fetch(
    `${BRAIN_URL}/api/v1/analytics/journey-funnel?journey=${encodeURIComponent(journeyName)}&tenantId=${encodeURIComponent(maskedTenantId)}`,
    { headers: buildHeaders() }
  );
  if (!response.ok) throw new Error("[NEXUS] Funnel failed");
  return response.json();
}

export async function fetchAiInsights(maskedTenantId) {
  const response = await fetch(
    `${BRAIN_URL}/api/v1/analytics/insights?tenantId=${encodeURIComponent(maskedTenantId)}`,
    { headers: buildHeaders() }
  );
  if (!response.ok) throw new Error("[NEXUS] Insights failed");
  return response.json();
}

export async function fetchTimeseries(maskedTenantId, bucket = "day") {
  const response = await fetch(
    `${BRAIN_URL}/api/v1/analytics/timeseries?tenantId=${encodeURIComponent(maskedTenantId)}&bucket=${bucket}`,
    { headers: buildHeaders() }
  );
  if (!response.ok) throw new Error("[NEXUS] Timeseries failed");
  return response.json();
}

export async function fetchEventMix(maskedTenantId) {
  const response = await fetch(
    `${BRAIN_URL}/api/v1/analytics/event-mix?tenantId=${encodeURIComponent(maskedTenantId)}`,
    { headers: buildHeaders() }
  );
  if (!response.ok) throw new Error("[NEXUS] Event mix failed");
  return response.json();
}

export async function postRagQuery(maskedTenantId, question) {
  const response = await fetch(`${BRAIN_URL}/api/v1/rag/rag-query`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ tenantId: maskedTenantId, question }),
  });
  if (!response.ok) {
    let detail = "";
    try {
      const j = JSON.parse(await response.text());
      if (typeof j?.detail === "string") detail = j.detail;
    } catch {
      /* ignore */
    }
    const hint =
      response.status === 403
        ? " (403: mismatch VITE_NEXUS_API_KEY vs Brain NEXUS_API_KEY, or clear VITE_NEXUS_RBAC_ROLE if Brain has RBAC off; if RBAC on, use a role with ai_advisor e.g. NEXUS_PRODUCT_MANAGER)"
        : "";
    throw new Error(
      `[NEXUS] RAG failed: ${response.status}${detail ? ` — ${detail}` : ""}${hint}`
    );
  }
  return response.json();
}

export async function updateTelemetryConsent(maskedTenantId, consentGranted) {
  const response = await fetch(`${BRAIN_URL}/api/v1/governance/consent`, {
    method: "PUT",
    headers: buildHeaders(),
    body: JSON.stringify({ tenantId: maskedTenantId, consentGranted }),
  });
  if (!response.ok) throw new Error(`[NEXUS] Consent update failed: ${response.status}`);
  return response.json();
}

export async function getTelemetryConsent(maskedTenantId) {
  const response = await fetch(
    `${BRAIN_URL}/api/v1/governance/consent?tenantId=${encodeURIComponent(maskedTenantId)}`,
    { headers: buildHeaders() }
  );
  if (!response.ok) throw new Error("[NEXUS] Consent fetch failed");
  return response.json();
}

export async function fetchGovernanceAudit(maskedTenantId, limit = 80) {
  const response = await fetch(
    `${BRAIN_URL}/api/v1/governance/audit?tenantId=${encodeURIComponent(maskedTenantId)}&limit=${limit}`,
    { headers: buildHeaders() }
  );
  if (!response.ok) throw new Error(`[NEXUS] Audit log failed: ${response.status}`);
  return response.json();
}

export async function fetchClickhouseRollups(maskedTenantId) {
  const response = await fetch(
    `${BRAIN_URL}/api/v1/platform/clickhouse/feature-rollups?tenantId=${encodeURIComponent(maskedTenantId)}`,
    { headers: buildHeaders() }
  );
  if (!response.ok) throw new Error(`[NEXUS] ClickHouse rollups failed: ${response.status}`);
  return response.json();
}

export async function fetchGraphEdges(maskedTenantId, limit = 80) {
  const response = await fetch(
    `${BRAIN_URL}/api/v1/platform/graph/edges?tenantId=${encodeURIComponent(maskedTenantId)}&limit=${limit}`,
    { headers: buildHeaders() }
  );
  if (!response.ok) throw new Error(`[NEXUS] Graph edges failed: ${response.status}`);
  return response.json();
}

export function getDeploymentInfo() {
  const brainDisplay = BRAIN_URL || configuredBrain || "http://localhost:8787";
  return { deployment: DEPLOYMENT, vaultUrl: VAULT_URL, brainUrl: brainDisplay };
}
