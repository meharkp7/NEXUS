import json
import os
from collections import defaultdict
from typing import Any, Optional

FEATURE_LABELS = {
    "LOAN_ORIGINATION": "Loan Origination",
    "DOCUMENT_MANAGEMENT": "Document Management",
    "RISK_ASSESSMENT": "Risk Assessment",
    "COMPLIANCE_CHECK": "Compliance Check",
    "REPAYMENT_SCHEDULE": "Repayment Schedule",
    "REPORTING_DASHBOARD": "Reporting Dashboard",
    "TENANT_MANAGEMENT": "Tenant Management",
    "UPSELL_ENGINE": "Upsell Engine",
    "KYC": "KYC",
    "LOAN": "Loan",
    "LOAN_APPLICATION": "Loan Application",
}


def _parse_meta(row: dict) -> dict:
    m = row.get("metadata")
    if m is None:
        return {}
    if isinstance(m, dict):
        return m
    try:
        return json.loads(m) if m else {}
    except json.JSONDecodeError:
        return {}


def _label(fid: str) -> str:
    return FEATURE_LABELS.get(fid, fid.replace("_", " ").title())


def build_adoption(rows: list[dict]) -> dict[str, Any]:
    by_feature: dict[str, dict[str, int]] = defaultdict(
        lambda: defaultdict(int)
    )
    for r in rows:
        fid = r["feature_id"]
        et = r["event_type"]
        by_feature[fid][et] += 1
        by_feature[fid]["_total"] += 1

    out = []
    for fid, counts in sorted(by_feature.items(), key=lambda x: -x[1]["_total"]):
        total = counts["_total"]
        opens = counts.get("FEATURE_OPEN", 0)
        success = counts.get("FEATURE_SUCCESS", 0)
        fail = counts.get("FEATURE_FAIL", 0)
        denom = opens + success + fail or total or 1
        rate = min(100, round(100 * (success + 0.5 * opens) / denom))
        if rate >= 75:
            status = "high"
        elif rate >= 40:
            status = "healthy"
        elif rate >= 10:
            status = "low"
        else:
            status = "zombie"
        trend = -5 if fail > success and fail > 2 else (8 if success > fail else 0)
        out.append({
            "id": fid.lower().replace("_", ""),
            "feature_id": fid,
            "label": _label(fid),
            "rate": rate,
            "events": total,
            "trend": trend,
            "status": status,
        })
    return {"features": out}


def build_dashboard(
    rows: list[dict],
    *,
    tenant_id: str,
) -> dict[str, Any]:
    adoption = build_adoption(rows)
    total_events = len(rows)
    features_touched = len({r["feature_id"] for r in rows})
    zombies = sum(1 for f in adoption["features"] if f["status"] == "zombie")

    sessions: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        sessions[r["session_id"]].append(r)
    journey_ok = 0
    for evs in sessions.values():
        feats = [x["feature_id"] for x in sorted(evs, key=lambda x: x["timestamp"])]
        if "KYC" in feats and "LOAN" in feats:
            try:
                if feats.index("KYC") < feats.index("LOAN"):
                    journey_ok += 1
            except ValueError:
                pass
    jr = round(100 * journey_ok / len(sessions), 1) if sessions else 0.0

    return {
        "tenantId": tenant_id,
        "metrics": [
            {"label": "Total Events", "value": f"{total_events:,}", "delta": "live", "up": True},
            {"label": "Features Active", "value": str(features_touched), "delta": "distinct", "up": True},
            {"label": "Zombie Features", "value": str(zombies), "delta": "risk" if zombies else "ok", "up": zombies == 0},
            {"label": "Journey Rate", "value": f"{jr}%", "delta": "KYC→LOAN", "up": jr >= 50},
        ],
        "adoption": adoption["features"],
    }


def build_journey_funnel(
    rows: list[dict],
    journey_name: str,
) -> dict[str, Any]:
    """Build funnel from JOURNEY_* events and journey_id / journey_step columns."""
    matched: list[dict] = []
    for r in rows:
        jid = r.get("journey_id") or ""
        meta = _parse_meta(r)
        jn = meta.get("journeyName", "")
        if jid == journey_name or jn == journey_name:
            matched.append(r)
        elif r["event_type"].startswith("JOURNEY_") and (
            journey_name in (r.get("feature_id") or "")
        ):
            matched.append(r)

    if not matched:
        for r in rows:
            if r["event_type"].startswith("JOURNEY"):
                matched.append(r)

    by_session: dict[str, list[dict]] = defaultdict(list)
    for r in matched:
        by_session[r["session_id"]].append(r)

    session_steps: dict[str, list[str]] = {}
    for sid, evs in by_session.items():
        ordered = sorted(evs, key=lambda x: x["timestamp"])
        steps: list[str] = []
        for e in ordered:
            step = e.get("journey_step")
            if not step:
                step = _parse_meta(e).get("journeyStep")
            if step and (not steps or steps[-1] != step):
                steps.append(step)
        if steps:
            session_steps[sid] = steps

    step_order: list[str] = []
    for steps in session_steps.values():
        for s in steps:
            if s not in step_order:
                step_order.append(s)

    if not step_order:
        return {
            "journey": journey_name,
            "steps": [],
            "summary": {
                "started": 0,
                "completed": 0,
                "completion_rate": 0.0,
                "message": "No journey steps recorded; emit JOURNEY_STEP with journeyId.",
            },
        }

    funnel_steps = []
    prev_count = len(session_steps)
    for i, step in enumerate(step_order):
        reached = sum(1 for steps in session_steps.values() if step in steps)
        idx = step_order.index(step)
        at_or_after = sum(
            1
            for steps in session_steps.values()
            if len(steps) > idx and steps[idx] == step
        )
        entry = reached if i == 0 else min(reached, prev_count)
        drop = max(0, prev_count - entry)
        funnel_steps.append({
            "step": _label(step) if step.isupper() else step,
            "step_key": step,
            "entry": entry,
            "drop": drop,
        })
        prev_count = entry

    started = len(by_session)
    completed = sum(
        1
        for evs in by_session.values()
        if any(x["event_type"] == "JOURNEY_COMPLETE" for x in evs)
    )
    return {
        "journey": journey_name,
        "steps": funnel_steps,
        "summary": {
            "started": started,
            "completed": completed,
            "completion_rate": round(100 * completed / started, 1) if started else 0.0,
        },
    }


def merge_demo_if_empty(
    tenant_id: str,
    rows: list[dict],
    demo_rows: Optional[list[dict]],
) -> list[dict]:
    if rows:
        return rows
    if not demo_rows:
        return []
    matching = [r for r in demo_rows if r.get("tenant_id") == tenant_id]
    if matching:
        return matching
    # Empty DB + no tenant-specific demo: clone bundled corpus for this tenant (dev / RAG smoke tests).
    # Disable in production with NEXUS_DEMO_FALLBACK=false.
    if os.environ.get("NEXUS_DEMO_FALLBACK", "true").lower() in ("1", "true", "yes"):
        return [{**dict(r), "tenant_id": tenant_id} for r in demo_rows]
    return []


def build_timeseries(rows: list[dict], bucket: str = "day") -> dict[str, Any]:
    buckets: dict[str, int] = defaultdict(int)
    for r in rows:
        ts = r.get("timestamp") or ""
        if bucket == "hour" and len(ts) >= 13:
            key = ts[:13]
        elif len(ts) >= 10:
            key = ts[:10]
        else:
            key = ts or "unknown"
        buckets[key] += 1
    ordered = sorted(buckets.items(), key=lambda x: x[0])
    return {
        "bucket": bucket,
        "points": [{"t": k, "count": v} for k, v in ordered],
    }


def build_event_mix(rows: list[dict]) -> dict[str, Any]:
    c: dict[str, int] = defaultdict(int)
    for r in rows:
        c[r["event_type"]] += 1
    total = sum(c.values()) or 1
    mix = [
        {"name": k, "value": v, "pct": round(100 * v / total, 1)}
        for k, v in sorted(c.items(), key=lambda x: -x[1])
    ]
    return {"mix": mix, "total": total}
