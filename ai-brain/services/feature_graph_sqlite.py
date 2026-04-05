"""Derive feature transition edges from SQLite when Neo4j is unavailable."""

from collections import Counter, defaultdict
from typing import Any

from storage.sqlite_store import get_store


def transition_edges_from_rows(rows: list[dict], max_edges: int = 80) -> list[dict[str, Any]]:
    by_session: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_session[r["session_id"]].append(r)
    pairs: Counter[tuple[str, str]] = Counter()
    for evs in by_session.values():
        evs.sort(key=lambda x: str(x.get("timestamp") or ""))
        for a, b in zip(evs, evs[1:]):
            fa, fb = a.get("feature_id"), b.get("feature_id")
            if fa and fb and fa != fb:
                pairs[(str(fa), str(fb))] += 1
    out = []
    for (src, tgt), w in pairs.most_common(max_edges):
        out.append({"source": src, "target": tgt, "weight": int(w)})
    return out


def transition_edges_for_tenant(tenant_id: str, max_edges: int = 80) -> list[dict[str, Any]]:
    rows = get_store().fetch_events_for_tenant(tenant_id)
    return transition_edges_from_rows(rows, max_edges=max_edges)
