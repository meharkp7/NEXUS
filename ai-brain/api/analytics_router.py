import json
import os
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from api.rbac_deps import RbacCtx, enforce_tenant_scope, require_permission
from services.analytics_engine import (
    build_adoption,
    build_dashboard,
    build_event_mix,
    build_journey_funnel,
    build_timeseries,
    merge_demo_if_empty,
)
from storage.sqlite_store import get_store

router = APIRouter(tags=["analytics"])

_MOCK_CACHE: Optional[list[dict]] = None


def _demo_rows() -> list[dict]:
    global _MOCK_CACHE
    if _MOCK_CACHE is not None:
        return _MOCK_CACHE
    path = os.path.join(os.path.dirname(__file__), "..", "mock_data", "events.json")
    path = os.path.normpath(path)
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
    except OSError:
        _MOCK_CACHE = []
        return _MOCK_CACHE
    rows = []
    for i, e in enumerate(raw):
        rows.append({
            "event_id": e.get("event_id", f"demo-{i}"),
            "tenant_id": e["tenant_id"],
            "session_id": e["session_id"],
            "event_type": e["event_type"],
            "feature_id": e["feature_id"],
            "timestamp": str(e["timestamp"]),
            "journey_id": e.get("journey_id"),
            "journey_step": e.get("journey_step"),
            "metadata": e.get("metadata"),
        })
    _MOCK_CACHE = rows
    return rows


def _rows_for_tenant(
    tenant_id: str,
    date_from: Optional[str],
    date_to: Optional[str],
) -> list[dict[str, Any]]:
    store = get_store()
    rows = store.fetch_events_for_tenant(tenant_id, date_from, date_to)
    return merge_demo_if_empty(tenant_id, rows, _demo_rows())


def _rows_for_rag(tenant_id: str) -> list[dict[str, Any]]:
    """Telemetry rows usable for TF–IDF stories. Falls back to demo corpus when DB rows exist but
    none carry feature_id (common with partial / legacy ingests), so RAG is not stuck with an empty index."""
    rows = _rows_for_tenant(tenant_id, None, None)
    if any(r.get("feature_id") for r in rows):
        return rows
    return merge_demo_if_empty(tenant_id, [], _demo_rows())


@router.get("/dashboard")
def analytics_dashboard(
    tenantId: str = Query(..., alias="tenantId"),
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None, alias="to"),
    rbac: RbacCtx = Depends(require_permission("dashboard:view_adoption_heatmaps")),
):
    enforce_tenant_scope(rbac.role, rbac.tenant_header, tenantId)
    rows = _rows_for_tenant(tenantId, from_, to)
    return build_dashboard(rows, tenant_id=tenantId)


@router.get("/adoption")
def analytics_adoption(
    tenantId: str = Query(..., alias="tenantId"),
    rbac: RbacCtx = Depends(require_permission("dashboard:view_adoption_heatmaps")),
):
    enforce_tenant_scope(rbac.role, rbac.tenant_header, tenantId)
    rows = _rows_for_tenant(tenantId, None, None)
    return build_adoption(rows)


@router.get("/journey-funnel")
def analytics_journey_funnel(
    journey: str = Query(..., description="Journey id or name"),
    tenantId: str = Query(..., alias="tenantId"),
    rbac: RbacCtx = Depends(require_permission("dashboard:view_journey_funnels")),
):
    enforce_tenant_scope(rbac.role, rbac.tenant_header, tenantId)
    rows = _rows_for_tenant(tenantId, None, None)
    return build_journey_funnel(rows, journey)


@router.get("/insights")
def analytics_insights(
    tenantId: str = Query(..., alias="tenantId"),
    rbac: RbacCtx = Depends(require_permission("ai_advisor:view_recommendations")),
):
    enforce_tenant_scope(rbac.role, rbac.tenant_header, tenantId)
    rows = _rows_for_tenant(tenantId, None, None)
    adoption = build_adoption(rows)
    insights: list[dict] = []
    for f in adoption["features"]:
        if f["status"] == "zombie":
            insights.append({
                "severity": "high",
                "text": (
                    f"'{f['label']}' shows zombie-level engagement ({f['rate']}%). "
                    "Review licensing or deprecation."
                ),
            })
        elif f["status"] == "low":
            insights.append({
                "severity": "medium",
                "text": (
                    f"'{f['label']}' is under-performing. Consider UX or enablement."
                ),
            })
    if not insights:
        insights.append({
            "severity": "info",
            "text": "No critical findings in current window; keep collecting telemetry.",
        })
    return {"insights": insights}


@router.get("/timeseries")
def analytics_timeseries(
    tenantId: str = Query(..., alias="tenantId"),
    bucket: str = Query("day"),
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None, alias="to"),
    rbac: RbacCtx = Depends(require_permission("dashboard:view_adoption_heatmaps")),
):
    enforce_tenant_scope(rbac.role, rbac.tenant_header, tenantId)
    b = bucket if bucket in ("day", "hour") else "day"
    rows = _rows_for_tenant(tenantId, from_, to)
    return build_timeseries(rows, bucket=b)


@router.get("/event-mix")
def analytics_event_mix(
    tenantId: str = Query(..., alias="tenantId"),
    rbac: RbacCtx = Depends(require_permission("dashboard:view_adoption_heatmaps")),
):
    enforce_tenant_scope(rbac.role, rbac.tenant_header, tenantId)
    rows = _rows_for_tenant(tenantId, None, None)
    return build_event_mix(rows)
