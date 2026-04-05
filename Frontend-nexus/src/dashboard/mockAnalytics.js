/**
 * Demonstration analytics when the AI Brain returns no rows or is unreachable.
 * Shape matches ai-brain analytics responses used by InsightDashboard.
 */
export const MOCK_LIVE = {
  dash: {
    metrics: [
      { label: "Active programs", value: "14", delta: "+2 vs prior quarter", up: true },
      { label: "Citizen sessions (7d)", value: "52.1k", delta: "+6.8% WoW", up: true },
      { label: "Avg. journey completion", value: "76%", delta: "+4 pts", up: true },
      { label: "Open compliance items", value: "6", delta: "1 due this week", up: true },
      { label: "Median API latency", value: "118 ms", delta: "−12 ms vs prior", up: true },
      { label: "Support deflection rate", value: "41%", delta: "+2 pts", up: true },
    ],
  },
  adopt: {
    features: [
      { label: "Citizen portal — dashboard", rate: 92, events: 12400, status: "healthy" },
      { label: "Permits & licensing", rate: 88, events: 9100, status: "healthy" },
      { label: "Benefits enrollment", rate: 81, events: 7600, status: "watch" },
      { label: "Document intake (OCR)", rate: 76, events: 5400, status: "healthy" },
      { label: "Case management", rate: 71, events: 4200, status: "watch" },
      { label: "Payments & receipts", rate: 94, events: 15100, status: "healthy" },
      { label: "FOIA / records request", rate: 58, events: 2100, status: "risk" },
      { label: "Grants reporting", rate: 64, events: 1800, status: "watch" },
      { label: "Vital records requests", rate: 69, events: 3300, status: "watch" },
      { label: "Housing assistance", rate: 73, events: 5100, status: "healthy" },
      { label: "Workforce / jobs board", rate: 61, events: 2900, status: "watch" },
      { label: "Open data catalog", rate: 47, events: 1200, status: "risk" },
    ],
  },
  funnel: {
    steps: [
      { step: "Start application", entry: 5200, drop: 0 },
      { step: "Identity verify", entry: 4850, drop: 350 },
      { step: "Eligibility check", entry: 4320, drop: 530 },
      { step: "Document upload", entry: 3680, drop: 640 },
      { step: "Review & submit", entry: 2980, drop: 700 },
      { step: "Under review", entry: 2410, drop: 570 },
      { step: "Confirmation", entry: 2010, drop: 400 },
    ],
    summary: {
      started: 5200,
      completed: 2010,
      completion_rate: 39,
    },
  },
  insights: {
    insights: [
      {
        severity: "high",
        text: "Drop-off at Document upload rose 8% after the Feb policy change — consider guided checklist copy.",
      },
      {
        severity: "medium",
        text: "FOIA module adoption is below peer baseline; training cohort 3 shows early lift.",
      },
      {
        severity: "low",
        text: "Payment flows maintain >99% success; no action required.",
      },
      {
        severity: "medium",
        text: "Open data catalog traffic is seasonal; align comms with budget cycle for sustained use.",
      },
    ],
  },
  ts: {
    points: [
      { t: "W1", count: 5800 },
      { t: "W2", count: 6200 },
      { t: "W3", count: 7100 },
      { t: "W4", count: 6800 },
      { t: "W5", count: 8200 },
      { t: "W6", count: 7900 },
      { t: "W7", count: 7600 },
      { t: "W8", count: 8100 },
      { t: "W9", count: 7400 },
      { t: "W10", count: 8800 },
      { t: "W11", count: 8500 },
      { t: "W12", count: 9100 },
      { t: "W13", count: 8700 },
      { t: "W14", count: 9200 },
    ],
  },
  mix: {
    mix: [
      { name: "PAGE_VIEW", value: 32 },
      { name: "FORM_SUBMIT", value: 20 },
      { name: "JOURNEY_STEP", value: 17 },
      { name: "API_CALL", value: 14 },
      { name: "FEATURE_OPEN", value: 9 },
      { name: "OTHER", value: 8 },
    ],
  },
};

export const MOCK_ACTIVITIES = [
  { id: 1, time: "09:14", actor: "System", action: "Nightly aggregation completed — 14 jurisdictions", type: "ops" },
  { id: 2, time: "08:42", actor: "Analyst (masked)", action: "Exported Q1 adoption report — RBAC audit trail ID A-88421", type: "audit" },
  { id: 3, time: "08:10", actor: "Integration", action: "Vault sync batch acknowledged (cloud ingestor)", type: "ops" },
  { id: 4, time: "07:55", actor: "Policy engine", action: "Consent banner version v2.3 rolled out to 100% traffic", type: "governance" },
  { id: 5, time: "07:20", actor: "RAG advisor", action: "LLM synthesis enabled — latency SLO check passed (p95 < 3s)", type: "ops" },
  { id: 6, time: "Yesterday", actor: "SRE", action: "ClickHouse replica lag < 200ms — SLO met", type: "ops" },
  { id: 7, time: "Yesterday", actor: "Security", action: "Gateway WAF rule pack v14 applied — zero false positives in canary", type: "governance" },
];

export const MOCK_INITIATIVES = [
  { name: "Digital service modernization", owner: "PMO", phase: "Wave 2", target: "Jun 2026", status: "On track" },
  { name: "Zero-trust gateway pilot", owner: "Security", phase: "Pilot", target: "May 2026", status: "On track" },
  { name: "Legacy permits decommission", owner: "Operations", phase: "Migration", target: "Aug 2026", status: "At risk" },
  { name: "Accessibility remediation (WCAG 2.2)", owner: "UX", phase: "Remediation", target: "Apr 2026", status: "On track" },
  { name: "Citizen mobile app beta", owner: "Digital", phase: "Beta", target: "Jul 2026", status: "On track" },
  { name: "Records redaction automation", owner: "Legal", phase: "Design", target: "Sep 2026", status: "On track" },
];

export const MOCK_RAG_ANSWER = {
  answer:
    "Demonstration response: Based on indexed telemetry narratives, the highest-impact investment area is document upload guidance — similar tenants reduced drop-off by 11% after adding inline examples and accepted file types. Secondary: expand FOIA module onboarding; cohort training correlated with +14 pts adoption in comparable programs.",
  evidence: [
    { score: 0.82, text: "JOURNEY_STEP document_upload drop_rate increased week-over-week following policy_text update." },
    { score: 0.71, text: "FOIA module events_per_user below p25 benchmark for mid-size agencies in cohort Q4." },
  ],
  llmModel: "gpt-4o-mini",
  llm: { usedLlm: true, latencyMs: 842.3, error: null, retries: 0 },
};

/** Merge API payload with mock for any empty section. */
export function fillEmptyWithMock(live) {
  if (!live) return { data: MOCK_LIVE, demo: true };
  const demo =
    !live.dash?.metrics?.length ||
    !live.adopt?.features?.length ||
    !live.ts?.points?.length ||
    !live.mix?.mix?.length;
  return {
    data: {
      dash: live.dash?.metrics?.length ? live.dash : MOCK_LIVE.dash,
      adopt: live.adopt?.features?.length ? live.adopt : MOCK_LIVE.adopt,
      funnel: live.funnel?.steps?.length ? live.funnel : MOCK_LIVE.funnel,
      insights: live.insights?.insights?.length ? live.insights : MOCK_LIVE.insights,
      ts: live.ts?.points?.length ? live.ts : MOCK_LIVE.ts,
      mix: live.mix?.mix?.length ? live.mix : MOCK_LIVE.mix,
    },
    demo,
  };
}
