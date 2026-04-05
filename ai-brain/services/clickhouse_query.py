import logging
import os
from collections import Counter
from typing import Any

from services.clickhouse_sink import _client_or_none, ensure_table

log = logging.getLogger(__name__)


def rollup_counts_from_event_rows(rows: list[dict], limit: int = 40) -> list[dict[str, Any]]:
    """Same shape as ClickHouse rollup query — used when CH is empty or offline (demo / SQLite corpus)."""
    c: Counter[str] = Counter()
    for r in rows:
        fid = r.get("feature_id")
        if fid:
            c[str(fid)] += 1
    return [{"feature_id": k, "cnt": int(v)} for k, v in c.most_common(limit)]


def feature_rollups_for_tenant(tenant_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """OLAP-style feature counts from ClickHouse (requires sink to have populated rows)."""
    c = _client_or_none()
    if not c:
        log.debug(
            "ClickHouse client unavailable; skipping feature rollups for tenant %s",
            tenant_id,
        )
        return []
    try:
        ensure_table()
        q = """
        SELECT feature_id, count() AS cnt
        FROM nexus.telemetry_events
        WHERE tenant_id = {tid:String}
        GROUP BY feature_id
        ORDER BY cnt DESC
        LIMIT {lim:UInt32}
        """
        result = c.query(q, parameters={"tid": tenant_id, "lim": limit})
        cols = result.column_names
        return [dict(zip(cols, row)) for row in result.result_rows]
    except Exception as e:
        log.debug("ClickHouse rollup skipped: %s", e)
        return []


def ch_available() -> bool:
    return bool(os.environ.get("CLICKHOUSE_HOST", "").strip()) and _client_or_none() is not None
