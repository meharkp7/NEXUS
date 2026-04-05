import logging

from fastapi import APIRouter, Depends, Query

from api.analytics_router import _rows_for_tenant
from api.rbac_deps import RbacCtx, enforce_tenant_scope, require_permission
from services.clickhouse_query import (
    ch_available,
    feature_rollups_for_tenant,
    rollup_counts_from_event_rows,
)
from services.feature_graph_sqlite import transition_edges_for_tenant
from services.graph_neo4j import neo4j_transition_edges

log = logging.getLogger(__name__)
router = APIRouter(tags=["platform"])


@router.get("/clickhouse/feature-rollups")
def clickhouse_feature_rollups(
    tenantId: str = Query(..., alias="tenantId"),
    limit: int = Query(40, ge=1, le=200),
    rbac: RbacCtx = Depends(require_permission("dashboard:view_adoption_heatmaps")),
):
    enforce_tenant_scope(rbac.role, rbac.tenant_header, tenantId)
    ch_ok = ch_available()
    rows = feature_rollups_for_tenant(tenantId, limit=limit) if ch_ok else []
    data_source = "clickhouse"
    if not rows:
        if ch_ok:
            log.debug(
                "ClickHouse rollup query returned no rows for tenant %s; falling back to SQLite",
                tenantId,
            )
        merged = _rows_for_tenant(tenantId, None, None)
        rows = rollup_counts_from_event_rows(merged, limit=limit)
        data_source = "sqlite" if rows else "none"
        if data_source == "none":
            log.debug(
                "No rollup rows available for tenant %s from ClickHouse or SQLite",
                tenantId,
            )
    return {
        "tenantId": tenantId,
        "source": data_source,
        "available": ch_ok,
        "rows": rows,
    }


@router.get("/graph/edges")
def graph_feature_edges(
    tenantId: str = Query(..., alias="tenantId"),
    limit: int = Query(
        80,
        ge=1,
        le=200,
        description="Maximum number of graph edges to return",
    ),
    rbac: RbacCtx = Depends(require_permission("dashboard:view_adoption_heatmaps")),
):
    enforce_tenant_scope(rbac.role, rbac.tenant_header, tenantId)
    neo = neo4j_transition_edges(max_edges=limit)
    if neo is not None:
        log.debug("Returning %d Neo4j graph edges for tenant %s", len(neo), tenantId)
        return {"tenantId": tenantId, "source": "neo4j", "edges": neo}
    edges = transition_edges_for_tenant(tenantId, max_edges=limit)
    if not edges:
        log.debug("No SQLite graph edges available for tenant %s", tenantId)
    else:
        log.debug(
            "Returning %d SQLite-derived graph edges for tenant %s",
            len(edges),
            tenantId,
        )
    return {"tenantId": tenantId, "source": "sqlite_sessions", "edges": edges}
