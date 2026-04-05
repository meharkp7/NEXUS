import logging
import os
from datetime import datetime
from typing import Any, Optional

log = logging.getLogger(__name__)

_host = os.environ.get("CLICKHOUSE_HOST", "").strip()
_user = os.environ.get("CLICKHOUSE_USER", "default")
_password = os.environ.get("CLICKHOUSE_PASSWORD", "")
_port = int(os.environ.get("CLICKHOUSE_PORT", "8123"))

_client = None
_table_ready = False


def _client_or_none():
    global _client
    if not _host:
        return None
    if _client is not None:
        return _client
    try:
        import clickhouse_connect

        _client = clickhouse_connect.get_client(
            host=_host,
            port=_port,
            username=_user,
            password=_password,
        )
        return _client
    except Exception as e:
        log.warning("ClickHouse client unavailable: %s", e)
        return None


def ensure_table() -> None:
    global _table_ready
    if _table_ready:
        return
    c = _client_or_none()
    if not c:
        return
    c.command("CREATE DATABASE IF NOT EXISTS nexus")
    c.command(
        """
        CREATE TABLE IF NOT EXISTS nexus.telemetry_events (
            event_id String,
            tenant_id String,
            session_id String,
            event_type String,
            feature_id String,
            ts String,
            ingested_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree
        ORDER BY (tenant_id, ts)
        """
    )
    _table_ready = True


def insert_telemetry_row(row: dict[str, Any]) -> None:
    c = _client_or_none()
    if not c:
        return
    try:
        ensure_table()
        c.insert(
            "nexus.telemetry_events",
            [[
                row.get("event_id", ""),
                row.get("tenant_id", ""),
                row.get("session_id", ""),
                row.get("event_type", ""),
                row.get("feature_id", ""),
                str(row.get("timestamp", "")),
            ]],
            column_names=[
                "event_id",
                "tenant_id",
                "session_id",
                "event_type",
                "feature_id",
                "ts",
            ],
        )
    except Exception as e:
        log.debug("ClickHouse insert skipped: %s", e)


_embeddings_ready = False


def ensure_embeddings_table() -> None:
    global _embeddings_ready
    if _embeddings_ready:
        return
    c = _client_or_none()
    if not c:
        return
    c.command("CREATE DATABASE IF NOT EXISTS nexus")
    c.command(
        """
        CREATE TABLE IF NOT EXISTS nexus.telemetry_embeddings (
            tenant_id String,
            dim UInt16,
            vector Array(Float32),
            ref_event_id String,
            ingested_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree
        ORDER BY (tenant_id, ingested_at)
        """
    )
    _embeddings_ready = True


def insert_embedding_row(
    tenant_id: str,
    vector: list[float],
    ref_event_id: str = "",
) -> None:
    """Embedding-only sync path: no raw feature text, only numeric vector + tenant scope."""
    c = _client_or_none()
    if not c:
        return
    try:
        ensure_embeddings_table()
        dim = len(vector)
        c.insert(
            "nexus.telemetry_embeddings",
            [[tenant_id, dim, vector, ref_event_id]],
            column_names=["tenant_id", "dim", "vector", "ref_event_id"],
        )
    except Exception as e:
        log.debug("ClickHouse embedding insert skipped: %s", e)
