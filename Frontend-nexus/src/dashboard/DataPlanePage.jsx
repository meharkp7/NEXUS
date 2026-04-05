import React, { useEffect, useState } from "react";
import * as api from "../services/api.js";
import FeatureGraphD3 from "./FeatureGraphD3.jsx";

const EMPTY_EDGES = [];

function SectionNotice({ variant, children }) {
  const styles =
    variant === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : variant === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-slate-200 bg-slate-50 text-slate-700";
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export default function DataPlanePage({ tenantIdForApi }) {
  const [ch, setCh] = useState(null);
  const [graph, setGraph] = useState(null);
  const [audit, setAudit] = useState(null);
  const [errors, setErrors] = useState({ ch: null, graph: null, audit: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantIdForApi) {
      setCh(null);
      setGraph(null);
      setAudit(null);
      setErrors({ ch: null, graph: null, audit: null });
      setLoading(false);
      return undefined;
    }
    let cancel = false;
    setLoading(true);
    setErrors({ ch: null, graph: null, audit: null });

    const load = async (label, fn, setter) => {
      try {
        const data = await fn();
        if (!cancel) setter(data);
      } catch (e) {
        if (!cancel) {
          const msg = String(e.message || e);
          setErrors((prev) => ({ ...prev, [label]: msg }));
          setter(null);
        }
      }
    };

    (async () => {
      await Promise.all([
        load("ch", () => api.fetchClickhouseRollups(tenantIdForApi), setCh),
        load("graph", () => api.fetchGraphEdges(tenantIdForApi), setGraph),
        load("audit", () => api.fetchGovernanceAudit(tenantIdForApi, 60), setAudit),
      ]);
      if (!cancel) setLoading(false);
    })();

    return () => {
      cancel = true;
    };
  }, [tenantIdForApi]);

  return (
    <div className="max-w-6xl space-y-8">
      <header className="border-b border-slate-200 pb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-nexus-blue">Platform</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-nexus-navy">Data plane</h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-600">
          Feature rollups (ClickHouse when configured, otherwise the same SQLite + demo corpus as the main dashboard),
          session-derived transition graph, and governance audit — aligned with your masked tenant id.
        </p>
        {tenantIdForApi && (
          <p className="mt-3 font-mono text-xs text-slate-500">
            Tenant: <span className="text-nexus-navy">{tenantIdForApi}</span>
          </p>
        )}
      </header>

      {!tenantIdForApi && (
        <SectionNotice variant="warn">
          <strong className="font-semibold">Tenant context not ready.</strong> Open the main dashboard until the SDK or
          sign-in resolves a masked tenant id, then return here.
        </SectionNotice>
      )}

      {tenantIdForApi && loading && (
        <SectionNotice>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-nexus-blue" />
            Loading platform data…
          </span>
        </SectionNotice>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-nexus-navy">Feature rollups</h2>
        <p className="mt-1 text-sm text-slate-500">
          {ch ? (
            <>
              Data source:{" "}
              <strong className="text-slate-700">
                {ch.source === "clickhouse"
                  ? "ClickHouse"
                  : ch.source === "sqlite"
                    ? "SQLite / demo corpus"
                    : "none"}
              </strong>
              <span className="text-slate-400"> · </span>
              ClickHouse configured: <strong>{ch.available ? "yes" : "no"}</strong>
            </>
          ) : errors.ch ? (
            <span className="text-red-700">Request failed — see notice below.</span>
          ) : (
            "—"
          )}
        </p>
        {errors.ch && (
          <div className="mt-3">
            <SectionNotice variant="error">
              <strong className="font-semibold">Rollups:</strong> {errors.ch}
            </SectionNotice>
          </div>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-semibold">feature_id</th>
                <th className="py-2 font-semibold">count</th>
              </tr>
            </thead>
            <tbody>
              {(ch?.rows || []).length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-slate-400">
                    No rollup rows for this tenant. If the main dashboard shows charts, refresh this page after pulling
                    latest Brain — rollups now reuse the same demo merge as analytics.
                  </td>
                </tr>
              ) : (
                ch.rows.map((row) => (
                  <tr key={row.feature_id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-mono text-slate-800">{row.feature_id}</td>
                    <td className="py-2 text-slate-700">{row.cnt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-nexus-navy">Feature graph</h2>
        <p className="mt-1 text-sm text-slate-500">
          {graph ? (
            <>
              Source: <strong className="text-slate-700">{graph.source}</strong>
              <span className="text-slate-400"> · </span>
              {(graph.edges?.length ?? 0)} edges (successive feature ids within a session)
            </>
          ) : errors.graph ? (
            <span className="text-red-700">Request failed — see notice below.</span>
          ) : tenantIdForApi && !loading ? (
            "No graph payload."
          ) : (
            "—"
          )}
        </p>
        {errors.graph && (
          <div className="mt-3">
            <SectionNotice variant="error">
              <strong className="font-semibold">Graph:</strong> {errors.graph}
            </SectionNotice>
          </div>
        )}
        <div className="mt-4">
          <FeatureGraphD3 edges={graph?.edges ?? EMPTY_EDGES} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-nexus-navy">Audit log</h2>
        <p className="mt-1 text-sm text-slate-500">Consent changes, RAG queries, and other governed actions.</p>
        {errors.audit && (
          <div className="mt-3">
            <SectionNotice variant="error">
              <strong className="font-semibold">Audit:</strong> {errors.audit}
            </SectionNotice>
          </div>
        )}
        <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto text-sm">
          {(audit?.entries || []).length === 0 ? (
            <li className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-slate-500">
              No audit entries for this tenant yet. Run a RAG query on the Intelligence tab or toggle consent under
              Governance to populate the log.
            </li>
          ) : (
            audit.entries.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
              >
                <span className="font-semibold text-nexus-navy">{e.action}</span>
                <span className="text-slate-400"> · </span>
                {e.created_at}
                {e.actor && (
                  <>
                    <span className="text-slate-400"> · </span>
                    {e.actor}
                  </>
                )}
                {e.detail && (
                  <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] text-slate-500">{e.detail}</pre>
                )}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
