import React, { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTelemetry } from "../context/TelemetryContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import * as api from "../services/api.js";
import GhostSDK, { maskTenantId } from "@nexus/collector-sdk";
import {
  fillEmptyWithMock,
  MOCK_ACTIVITIES,
  MOCK_INITIATIVES,
  MOCK_RAG_ANSWER,
} from "./mockAnalytics.js";
import DataPlanePage from "./DataPlanePage.jsx";

/** Civic / government digital services palette — light mode, high clarity */
const C = {
  bg: "#f0f4f8",
  surface: "#ffffff",
  surface2: "#f7fafc",
  border: "#cbd5e0",
  borderStrong: "#a0aec0",
  text: "#1a202c",
  muted: "#4a5568",
  muted2: "#718096",
  navy: "#112e51",
  blue: "#205493",
  blueLight: "#e8f0f9",
  gold: "#b7791f",
  goldLight: "#faf5eb",
  success: "#276749",
  warn: "#b7791f",
  danger: "#c53030",
  chart1: "#205493",
  chart2: "#2b6cb0",
  chart3: "#2c5282",
  chart4: "#63b3ed",
  chart5: "#b7791f",
};

const PIE_COLORS = [C.chart1, C.chart2, C.chart3, C.chart4, C.chart5];

function PageHeader({ kicker, title, children }) {
  return (
    <header className="dash-animate-in mb-5 md:mb-6">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-nexus-blue">{kicker}</p>
      <h1 className="text-[1.65rem] font-extrabold tracking-tight text-nexus-navy md:text-3xl">{title}</h1>
      {children && <div className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-600">{children}</div>}
    </header>
  );
}

function useLiveData(maskedTenantId) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usingDemo, setUsingDemo] = useState(false);

  useEffect(() => {
    if (!maskedTenantId) {
      const { data: filled, demo } = fillEmptyWithMock(null);
      setData(filled);
      setUsingDemo(demo);
      setErr(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [dash, adopt, funnel, insights, ts, mix] = await Promise.all([
          api.fetchDashboardAnalytics({ maskedTenantId }),
          api.fetchAdoptionHeatmap(maskedTenantId),
          api.fetchJourneyFunnel("LOAN_APPLICATION", maskedTenantId),
          api.fetchAiInsights(maskedTenantId).catch(() => ({ insights: [] })),
          api.fetchTimeseries(maskedTenantId, "day").catch(() => ({ points: [] })),
          api.fetchEventMix(maskedTenantId).catch(() => ({ mix: [] })),
        ]);
        if (!cancelled) {
          const merged = fillEmptyWithMock({ dash, adopt, funnel, insights, ts, mix });
          setData(merged.data);
          setUsingDemo(merged.demo);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) {
          const merged = fillEmptyWithMock(null);
          setData(merged.data);
          setUsingDemo(true);
          setErr(String(e.message || e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [maskedTenantId]);

  return { data, err, loading, usingDemo };
}

function Card({ title, subtitle, children, className = "", delayClass = "" }) {
  return (
    <div
      className={`dash-card dash-animate-in rounded-xl border border-slate-300/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md md:p-6 ${delayClass} ${className}`.trim()}
    >
      {title && (
        <div className="mb-3.5">
          <div className="text-[15px] font-bold tracking-tight text-nexus-navy">{title}</div>
          {subtitle && <div className="mt-1.5 text-[13px] leading-snug text-slate-500">{subtitle}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

const tooltipStyle = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 12,
  color: C.text,
  boxShadow: "0 4px 14px rgba(17, 46, 81, 0.1)",
};

function Sidebar({ active, setActive, userName, onLogout, showSignOut }) {
  const items = [
    { id: "overview", label: "Overview" },
    { id: "adoption", label: "Adoption" },
    { id: "journeys", label: "Journeys" },
    { id: "intel", label: "Intelligence" },
    { id: "dataplane", label: "Data plane" },
    { id: "governance", label: "Governance" },
  ];
  return (
    <aside className="fixed left-0 top-0 z-20 flex h-screen w-[248px] flex-col bg-nexus-navy px-4 py-5 shadow-[4px_0_24px_rgba(17,46,81,0.12)]">
      <div className="dash-logo-mark mb-8 flex items-center gap-3 pl-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-gradient-to-br from-nexus-blue to-[#163d6b] text-[17px] font-extrabold text-white shadow-sm">
          N
        </div>
        <div>
          <div className="text-[17px] font-bold tracking-tight text-white">NEXUS</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">Insight OS</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1">
        {items.map((it) => {
          const on = active === it.id;
          return (
            <button
              key={it.id}
              type="button"
              className={`dash-nav-btn block w-full rounded-lg px-3.5 py-3 text-left text-sm transition-colors ${
                on ? "bg-white/14 font-semibold text-white" : "bg-transparent font-medium text-white/72 hover:bg-white/5"
              }`}
              onClick={() => setActive(it.id)}
            >
              {it.label}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-white/12 pt-5">
        <div className="mb-1 text-[13px] font-semibold text-white">{userName || "Signed in"}</div>
        <div className="mb-3 text-[11px] text-white/55">Insight OS workspace</div>
        {showSignOut && (
          <button
            type="button"
            onClick={onLogout}
            className="dash-nav-btn w-full cursor-pointer rounded-lg border border-white/20 bg-black/15 px-3.5 py-2.5 text-[13px] font-semibold text-white/90 hover:bg-black/25"
          >
            Sign out
          </button>
        )}
      </div>
    </aside>
  );
}

function StatusStrip() {
  return (
    <div className="dash-animate-in mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-slate-300/80 bg-white px-4 py-3.5 text-sm text-slate-600 shadow-sm md:px-5">
      <span className="flex items-center gap-2.5">
        <span className="dash-pulse-dot" />
        <strong className="text-nexus-navy">Systems operational</strong>
      </span>
      <span className="text-[13px] text-slate-500">
        Telemetry collection is active for this workspace. Charts may use sample data until your program history is
        fully ingested.
      </span>
    </div>
  );
}

function OverviewPage({ live, loading, errorMsg, usingDemo }) {
  const metrics = live?.dash?.metrics || [];
  const adopt = live?.adopt?.features?.length ? live.adopt.features : [];
  const tsPoints = (live?.ts?.points || []).map((p) => ({ name: p.t, events: p.count }));
  const mix = live?.mix?.mix || [];
  const insights = live?.insights?.insights || [];

  const adoptBars = adopt.slice(0, 10).map((f) => ({
    name: f.label?.length > 18 ? `${f.label.slice(0, 16)}…` : f.label,
    rate: f.rate,
    events: f.events,
  }));

  return (
    <div>
      <PageHeader kicker="Program operations center" title="Service performance & adoption">
        One place to monitor how digital services are used, where journeys stall, and which capabilities need attention —
        grounded in your organization&apos;s telemetry with consent and access controls applied server-side.
      </PageHeader>

      <StatusStrip />

      {errorMsg && (
        <div className="dash-animate-in dash-animate-delay-1 mb-4 rounded-lg border border-amber-200/80 bg-amber-50/90 px-[18px] py-3.5 text-[13px] leading-relaxed text-amber-900">
          <strong>Connection notice:</strong> {errorMsg}
          {usingDemo && (
            <span>
              {" "}
              Demonstration metrics are shown so layouts and charts remain reviewable; restore the API to see live
              figures.
            </span>
          )}
        </div>
      )}

      {!errorMsg && usingDemo && (
        <div className="dash-animate-in dash-animate-delay-1 mb-4 rounded-lg border border-nexus-blue/25 bg-sky-50/80 px-[18px] py-3.5 text-[13px] leading-relaxed text-nexus-navy">
          <strong>Demonstration data:</strong> Your tenant has little or no aggregated history yet. Sample program
          metrics below illustrate the full dashboard; they will be replaced automatically as telemetry accumulates.
        </div>
      )}

      {loading && !live && (
        <div className="mb-4">
          <div className="mb-2 text-sm text-slate-600">Loading intelligence layer…</div>
          <div className="dash-loading-bar max-w-[280px]" />
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m, i) => (
          <Card
            key={m.label}
            title={m.label}
            subtitle={m.delta}
            delayClass={`dash-animate-delay-${Math.min(i + 1, 5)}`}
          >
            <div className="text-3xl font-extrabold tracking-tight text-nexus-navy md:text-[30px]">{m.value}</div>
            {m.up !== undefined && (
              <div
                className={`mt-2 text-xs font-semibold ${m.up ? "text-emerald-700" : "text-red-700"}`}
              >
                {m.up ? "Trend favorable" : "Attention suggested"}
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="mb-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-[1.4fr_1fr]">
        <Card title="Event volume" subtitle="Daily buckets from stored telemetry (sessions and instrumented actions)" delayClass="dash-animate-delay-2">
          <div className="h-[280px] w-full">
            <ResponsiveContainer>
              <AreaChart data={tsPoints.length ? tsPoints : [{ name: "—", events: 0 }]}>
                <defs>
                  <linearGradient id="ovArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.blue} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: C.muted2, fontSize: 11 }} stroke={C.border} />
                <YAxis tick={{ fill: C.muted2, fontSize: 11 }} stroke={C.border} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="events" stroke={C.blue} fill="url(#ovArea)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Event mix" subtitle="Share of normalized event types across channels" delayClass="dash-animate-delay-2">
          <div className="h-[280px] w-full">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={mix.length ? mix : [{ name: "none", value: 1 }]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={86}
                  paddingAngle={2}
                >
                  {(mix.length ? mix : [{ name: "none", value: 1 }]).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mb-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-[1.2fr_1fr]">
        <Card title="Feature adoption" subtitle="Engagement index by module — compare to entitlements and training waves" delayClass="dash-animate-delay-3">
          <div className="h-[320px] w-full">
            <ResponsiveContainer>
              <BarChart data={adoptBars.length ? adoptBars : [{ name: "—", rate: 0 }]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: C.muted2, fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={128} tick={{ fill: C.muted2, fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="rate" fill={C.blue} radius={[0, 4, 4, 0]} name="Adoption %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Signals &amp; exceptions" subtitle="Rule-based highlights from the analytics engine" delayClass="dash-animate-delay-3">
          <div className="flex flex-col gap-3">
            {insights.map((ins, i) => (
              <div
                key={i}
                className={`rounded-lg border border-slate-200/80 bg-slate-50/80 p-3.5 text-[13px] leading-snug text-slate-800 transition-transform duration-200 ${
                  ins.severity === "high"
                    ? "border-l-4 border-l-red-600"
                    : ins.severity === "medium"
                      ? "border-l-4 border-l-amber-600"
                      : "border-l-4 border-l-nexus-blue"
                }`}
              >
                <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-slate-500">
                  {ins.severity}
                </span>
                <div className="mt-1.5">{ins.text}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <Card
          title="Program initiatives"
          subtitle="Portfolio milestones — not sourced from live PM tools in this reference UI"
          delayClass="dash-animate-delay-4"
        >
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-300 text-left text-slate-500">
                <th className="px-2 py-2.5 font-semibold">Initiative</th>
                <th className="px-2 py-2.5 font-semibold">Owner</th>
                <th className="px-2 py-2.5 font-semibold">Phase</th>
                <th className="px-2 py-2.5 font-semibold">Target</th>
                <th className="px-2 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_INITIATIVES.map((row) => (
                <tr key={row.name} className="dash-row-hover border-b border-slate-200">
                  <td className="px-2 py-3 font-semibold text-nexus-navy">{row.name}</td>
                  <td className="px-2 py-3 text-slate-600">{row.owner}</td>
                  <td className="px-2 py-3 text-slate-600">{row.phase}</td>
                  <td className="px-2 py-3 text-slate-600">{row.target}</td>
                  <td className="px-2 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        row.status === "At risk"
                          ? "bg-red-100 text-red-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Activity &amp; audit trail (sample)" subtitle="Representative operational log — wire to SIEM for production" delayClass="dash-animate-delay-5">
          <ul className="m-0 list-none p-0">
            {MOCK_ACTIVITIES.map((a) => (
              <li key={a.id} className="border-b border-slate-200 py-3 text-[13px] leading-snug last:border-b-0">
                <div className="mb-1 flex justify-between">
                  <span className="text-xs font-bold text-nexus-navy">{a.time}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">{a.type}</span>
                </div>
                <div className="text-slate-600">
                  <strong className="text-slate-900">{a.actor}</strong> — {a.action}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="mt-6 max-w-[900px] text-xs leading-relaxed text-slate-500">
        <strong className="text-nexus-navy">Data freshness:</strong> Aggregates typically refresh on the interval configured
        for your vault sync and cloud ingestor. Charts respect tenant isolation; export and raw row access require
        appropriate RBAC roles. For accessibility, charts support keyboard focus via the Recharts container in
        supported browsers.
      </p>
    </div>
  );
}

function AdoptionPage({ live }) {
  const rows = live?.adopt?.features?.length ? live.adopt.features : [];
  const data = rows.map((f) => ({
    name: f.label,
    rate: f.rate,
    events: f.events,
    status: f.status,
  }));
  return (
    <div>
      <PageHeader kicker="Service adoption" title="Adoption intelligence">
        Module-level engagement scores derived from instrumented events. Cross-check with license entitlements, identity
        provider groups, and training completion in your authoritative systems. Use this view to prioritize change
        management and capability releases.
      </PageHeader>
      <Card
        title="Module comparison"
        subtitle="Adoption rate (%) and raw event volume — dual axis interpretation"
        className="dash-animate-in dash-animate-delay-1 mt-2"
      >
        <div className="w-full" style={{ height: Math.max(380, data.length * 40) }}>
          <ResponsiveContainer>
            <BarChart data={data.length ? data : [{ name: "—", rate: 0, events: 0 }]} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis type="number" tick={{ fill: C.muted2 }} />
              <YAxis dataKey="name" type="category" width={160} tick={{ fill: C.muted2, fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="rate" fill={C.blue} name="Rate %" radius={[0, 3, 3, 0]} />
              <Bar dataKey="events" fill={C.gold} name="Events" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Status legend" subtitle="How to read module health flags" className="dash-animate-in dash-animate-delay-2 mt-5">
        <div className="grid grid-cols-1 gap-4 text-[13px] leading-relaxed text-slate-600 md:grid-cols-3">
          <div>
            <strong className="text-emerald-700">Healthy</strong> — At or above target adoption band for comparable
            programs.
          </div>
          <div>
            <strong className="text-amber-700">Watch</strong> — Flat or declining week-over-week; validate UX friction or
            training gaps.
          </div>
          <div>
            <strong className="text-red-700">Risk</strong> — Materially below baseline; executive escalation
            recommended.
          </div>
        </div>
      </Card>
    </div>
  );
}

function JourneysPage({ live }) {
  const steps = live?.funnel?.steps?.length
    ? live.funnel.steps.map((s) => ({ name: s.step, entry: s.entry, drop: s.drop }))
    : [];
  const sum = live?.funnel?.summary;
  return (
    <div>
      <PageHeader kicker="Citizen journeys" title="Journey analytics">
        Step cohorts built from{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-nexus-navy">JOURNEY_*</code> telemetry. Use drop
        columns to prioritize content design, API latency fixes, and eligibility rule clarity. Funnel definitions are
        versioned server-side per journey name.
      </PageHeader>
      <div className="mt-2 grid grid-cols-1 gap-[18px] lg:grid-cols-[2fr_1fr]">
        <Card title="Loan application funnel" subtitle="Users reaching each step vs. abandoning before the next" className="dash-animate-in dash-animate-delay-1">
          <div className="h-[400px] w-full">
            <ResponsiveContainer>
              <BarChart data={steps.length ? steps : [{ name: "—", entry: 0, drop: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fill: C.muted2, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                <YAxis tick={{ fill: C.muted2 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="entry" fill={C.blue} name="Reached" radius={[3, 3, 0, 0]} />
                <Bar dataKey="drop" fill={C.danger} name="Drop" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Journey summary" subtitle="Headline conversion metrics for this cohort" className="dash-animate-in dash-animate-delay-2">
          <div className="space-y-2 text-sm leading-loose text-slate-600">
            <div>
              Started: <strong className="text-lg text-nexus-navy">{sum?.started ?? "—"}</strong>
            </div>
            <div>
              Completed: <strong className="text-lg text-nexus-navy">{sum?.completed ?? "—"}</strong>
            </div>
            <div>
              Completion rate:{" "}
              <strong className="text-lg text-nexus-navy">{sum?.completion_rate ?? "—"}%</strong>
            </div>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-slate-500">
            Completion is defined when the terminal journey step fires without a timeout window violation. Adjust
            journey keys in the AI Brain to map other programs (permits, benefits, grants).
          </p>
        </Card>
      </div>
    </div>
  );
}

function IntelPage({ tenantIdForRag }) {
  const [q, setQ] = useState("Where should we invest next quarter to improve citizen completion rates?");
  const [ans, setAns] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadSample = () => {
    setAns(MOCK_RAG_ANSWER);
  };

  const run = async () => {
    if (!tenantIdForRag) {
      setAns({
        answer:
          "Your workspace tenant is still initializing. Wait a moment and try again, or confirm you are signed in with the correct tenant ID.",
        evidence: [],
      });
      return;
    }
    setBusy(true);
    try {
      const r = await api.postRagQuery(tenantIdForRag, q);
      setAns(r);
    } catch (e) {
      setAns({ answer: String(e.message || e), evidence: [] });
    } finally {
      setBusy(false);
    }
  };

  const llm = ans?.llm || {};
  const llmModel = ans?.llmModel;

  return (
    <div>
      <PageHeader kicker="Retrieval & advisory" title="Intelligence & RAG">
        Ask questions in plain language. The advisor retrieves the closest matching patterns from your program&apos;s
        telemetry narratives (server-side retrieval). Review outputs with stakeholders before acting; this is decision
        support, not automated policy.
      </PageHeader>
      {!api.getBrainApiKey() && (
        <div className="dash-animate-in dash-animate-delay-1 mb-4 rounded-xl border border-amber-300 bg-amber-50 px-[18px] py-3.5 text-sm leading-relaxed text-amber-950">
          <strong>No Brain API key in this build.</strong> Set{" "}
          <code className="rounded bg-black/[0.06] px-1.5 py-0.5">VITE_NEXUS_API_KEY</code> in{" "}
          <code className="rounded bg-black/[0.06] px-1.5 py-0.5">Frontend-nexus/.env</code> to the same value as the
          server&apos;s <code className="rounded bg-black/[0.06] px-1.5 py-0.5">NEXUS_API_KEY</code>, then restart{" "}
          <code className="rounded bg-black/[0.06] px-1.5 py-0.5">npm run dev</code>.
        </div>
      )}
      <Card
        title="Advisor query"
        subtitle="Answers are built from historical usage text tied to your tenant. Ensure the AI Brain is running and your API key is configured."
        className="dash-animate-in dash-animate-delay-1 mt-2"
      >
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          rows={4}
          className="box-border w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3.5 font-inherit text-sm leading-relaxed text-slate-900 focus:border-nexus-blue focus:outline-none focus:ring-2 focus:ring-nexus-blue/20"
        />
        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="cursor-pointer rounded-lg border-0 bg-nexus-navy px-[22px] py-2.5 text-sm font-bold text-white shadow-md hover:bg-nexus-blue disabled:cursor-wait"
          >
            {busy ? "Retrieving…" : "Run retrieval"}
          </button>
          <button
            type="button"
            onClick={loadSample}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-[18px] py-2.5 text-sm font-semibold text-nexus-blue hover:bg-slate-50"
          >
            Load sample briefing
          </button>
        </div>
        {ans && (
          <div className="dash-animate-in mt-6">
            {(llmModel || llm.usedLlm != null || llm.latencyMs != null || llm.error || llm.retries) && (
              <div className="mb-3 flex flex-wrap gap-2">
                {llmModel && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900 ring-1 ring-emerald-200/80">
                    Model: {llmModel}
                  </span>
                )}
                {llm.usedLlm === true && (
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900 ring-1 ring-sky-200/80">
                    LLM synthesis
                  </span>
                )}
                {llm.usedLlm === false && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    Retrieval-only
                  </span>
                )}
                {typeof llm.latencyMs === "number" && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {llm.latencyMs} ms
                  </span>
                )}
                {llm.retries > 0 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                    Retries: {llm.retries}
                  </span>
                )}
                {llm.error && (
                  <span
                    className="max-w-full rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-900 ring-1 ring-red-200/80"
                    title={llm.error}
                  >
                    LLM: {llm.error}
                  </span>
                )}
              </div>
            )}
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">{ans.answer}</div>
            {ans.evidence?.length > 0 && (
              <div className="mt-5 text-xs text-slate-500">
                <strong className="text-nexus-navy">Evidence snippets</strong>
                {ans.evidence.slice(0, 4).map((ev, i) => (
                  <div
                    key={i}
                    className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 leading-snug"
                  >
                    <span className="font-bold text-nexus-blue">score {ev.score}</span> — {ev.text?.slice(0, 240)}
                    {ev.text?.length > 240 ? "…" : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function GovernancePage({ sdkStatus }) {
  const [consent, setConsent] = useState(true);

  useEffect(() => {
    const tid = sdkStatus?.maskedTenantId;
    if (!tid) return;
    api
      .getTelemetryConsent(tid)
      .then((r) => {
        setConsent(r.consentGranted);
        GhostSDK.setConsent(r.consentGranted);
      })
      .catch(() => {});
  }, [sdkStatus?.maskedTenantId]);

  const rows = [
    { label: "SDK initialized", value: sdkStatus?.initialized ? "Yes" : "No", ok: !!sdkStatus?.initialized },
    { label: "Consent", value: consent ? "Granted" : "Revoked", ok: consent },
    { label: "Masked tenant", value: sdkStatus?.maskedTenantId || "—", ok: true },
    {
      label: "Session",
      value: sdkStatus?.sessionId ? `${sdkStatus.sessionId.slice(0, 10)}…` : "—",
      ok: !!sdkStatus?.sessionId,
    },
    { label: "Buffer", value: String(sdkStatus?.bufferedEvents ?? 0), ok: true },
    {
      label: "Circuit breaker",
      value: sdkStatus?.circuitBreakerOpen ? "OPEN" : "Closed",
      ok: !sdkStatus?.circuitBreakerOpen,
    },
  ];

  return (
    <div>
      <PageHeader kicker="Trust & compliance" title="Governance">
        Consent and telemetry flags sync with persistent storage via the AI Brain governance API (RBAC-aware). Document
        data categories, retention, and lawful basis in your privacy notice; this UI reflects runtime state only.
      </PageHeader>
      <div className="mt-2 grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <Card title="Collector runtime" subtitle="Ghost SDK health as observed in the browser" className="dash-animate-in dash-animate-delay-1">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex justify-between border-b border-slate-200 py-3 text-sm last:border-b-0"
            >
              <span className="text-slate-600">{r.label}</span>
              <span className={`font-semibold ${r.ok ? "text-emerald-700" : "text-red-700"}`}>{r.value}</span>
            </div>
          ))}
        </Card>
        <Card title="Telemetry consent" subtitle="End-user preference mirrored to the server when permitted by role" className="dash-animate-in dash-animate-delay-2">
          <button
            type="button"
            onClick={async () => {
              const next = !consent;
              setConsent(next);
              GhostSDK.setConsent(next);
              const tid = sdkStatus?.maskedTenantId;
              if (tid) {
                try {
                  await api.updateTelemetryConsent(tid, next);
                } catch (e) {
                  console.error(e);
                }
              }
            }}
            className={`cursor-pointer rounded-lg border-0 px-[26px] py-3 text-sm font-bold ${
              consent ? "bg-emerald-700 text-white hover:bg-emerald-800" : "bg-slate-300 text-nexus-navy hover:bg-slate-400"
            }`}
          >
            {consent ? "Revoke consent" : "Grant consent"}
          </button>
          <p className="mt-4 text-[13px] leading-relaxed text-slate-600">
            In production, restrict who can change consent using your identity provider and server-side authorization.
            Each change should be auditable.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function InsightDashboard({ skipAuth }) {
  const { sdkStatus } = useTelemetry();
  const { session, logout } = useAuth();
  const [apiTenant, setApiTenant] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (sdkStatus?.maskedTenantId) {
        if (!cancel) setApiTenant(sdkStatus.maskedTenantId);
        return;
      }
      if (session?.tenantId) {
        try {
          const m = await maskTenantId(session.tenantId);
          if (!cancel) setApiTenant(m);
        } catch {
          if (!cancel) setApiTenant(null);
        }
      } else if (!cancel) setApiTenant(null);
    })();
    return () => {
      cancel = true;
    };
  }, [sdkStatus?.maskedTenantId, session?.tenantId]);

  const { data: live, err, loading, usingDemo } = useLiveData(apiTenant);
  const [page, setPage] = useState("overview");

  return (
    <div className="dash-root min-h-screen bg-nexus-bg text-slate-900">
      <Sidebar
        active={page}
        setActive={setPage}
        userName={session?.displayName}
        onLogout={logout}
        showSignOut={!skipAuth}
      />
      <div className="ml-[248px] box-border min-h-screen max-w-[1280px] px-6 pb-14 pt-8 md:px-10">
        {page === "overview" && (
          <OverviewPage live={live} loading={loading} errorMsg={err} usingDemo={usingDemo} />
        )}
        {page === "adoption" && <AdoptionPage live={live} />}
        {page === "journeys" && <JourneysPage live={live} />}
        {page === "intel" && <IntelPage tenantIdForRag={apiTenant} />}
        {page === "dataplane" && <DataPlanePage tenantIdForApi={apiTenant} />}
        {page === "governance" && <GovernancePage sdkStatus={sdkStatus} />}
      </div>
    </div>
  );
}
