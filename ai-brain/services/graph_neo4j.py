import logging
from typing import Any, Optional

log = logging.getLogger(__name__)


def neo4j_transition_edges(max_edges: int = 120) -> Optional[list[dict[str, Any]]]:
    try:
        from graph.neo4j_client import Neo4jClient
    except Exception as e:
        log.debug("Neo4j import skipped: %s", e)
        return None
    try:
        client = Neo4jClient()
    except Exception as e:
        log.debug("Neo4j unavailable: %s", e)
        return None
    try:
        q = """
        MATCH (a:Feature)-[r:TRANSITION]->(b:Feature)
        RETURN a.id AS source, b.id AS target, r.count AS weight
        ORDER BY r.count DESC
        LIMIT $lim
        """
        rows = client.execute(q, {"lim": max_edges})
        return [
            {
                "source": r["source"],
                "target": r["target"],
                "weight": int(r["weight"] or 0),
            }
            for r in rows
        ]
    except Exception as e:
        log.warning("Neo4j graph read failed: %s", e)
        return None
    finally:
        try:
            client.close()
        except Exception:
            pass
