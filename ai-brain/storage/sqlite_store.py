import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Optional

DEFAULT_DB = os.environ.get("NEXUS_TELEMETRY_DB", "data/telemetry.db")


class SqliteStore:
    def __init__(self, path: str = DEFAULT_DB):
        self._path = path
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        self._local = threading.local()
        self._init_schema()

    def _conn(self) -> sqlite3.Connection:
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = sqlite3.connect(self._path, check_same_thread=False)
            self._local.conn.row_factory = sqlite3.Row
        return self._local.conn

    @contextmanager
    def cursor(self):
        conn = self._conn()
        cur = conn.cursor()
        try:
            yield cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()

    def _init_schema(self) -> None:
        with self.cursor() as c:
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS telemetry_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT UNIQUE NOT NULL,
                    tenant_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    feature_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    journey_id TEXT,
                    journey_step TEXT,
                    metadata TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
                """
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_te_tenant ON telemetry_events(tenant_id)"
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_te_session ON telemetry_events(session_id)"
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_te_ts ON telemetry_events(timestamp)"
            )
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS tenant_consent (
                    tenant_id TEXT PRIMARY KEY,
                    consent_granted INTEGER NOT NULL DEFAULT 1,
                    updated_at TEXT NOT NULL
                )
                """
            )
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tenant_id TEXT NOT NULL,
                    actor TEXT,
                    action TEXT NOT NULL,
                    resource TEXT,
                    detail TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
                """
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id)"
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at)"
            )

    def insert_event(
        self,
        *,
        event_id: str,
        tenant_id: str,
        session_id: str,
        event_type: str,
        feature_id: str,
        timestamp: str,
        journey_id: Optional[str] = None,
        journey_step: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> bool:
        try:
            with self.cursor() as c:
                c.execute(
                    """
                    INSERT INTO telemetry_events
                    (event_id, tenant_id, session_id, event_type, feature_id,
                     timestamp, journey_id, journey_step, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        event_id,
                        tenant_id,
                        session_id,
                        event_type,
                        feature_id,
                        timestamp,
                        journey_id,
                        journey_step,
                        json.dumps(metadata) if metadata is not None else None,
                    ),
                )
            return True
        except sqlite3.IntegrityError:
            return False

    def consent_for(self, tenant_id: str) -> Optional[bool]:
        with self.cursor() as c:
            row = c.execute(
                "SELECT consent_granted FROM tenant_consent WHERE tenant_id = ?",
                (tenant_id,),
            ).fetchone()
        if row is None:
            return None
        return bool(row["consent_granted"])

    def set_consent(self, tenant_id: str, granted: bool) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self.cursor() as c:
            c.execute(
                """
                INSERT INTO tenant_consent (tenant_id, consent_granted, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(tenant_id) DO UPDATE SET
                    consent_granted = excluded.consent_granted,
                    updated_at = excluded.updated_at
                """,
                (tenant_id, 1 if granted else 0, now),
            )

    def fetch_events_for_tenant(
        self,
        tenant_id: str,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        q = "SELECT * FROM telemetry_events WHERE tenant_id = ?"
        params: list[Any] = [tenant_id]
        if date_from:
            q += " AND timestamp >= ?"
            params.append(date_from)
        if date_to:
            q += " AND timestamp <= ?"
            params.append(date_to)
        q += " ORDER BY timestamp ASC"
        with self.cursor() as c:
            rows = c.execute(q, params).fetchall()
        return [dict(r) for r in rows]

    def fetch_all_events(self, limit: int = 50_000) -> list[dict[str, Any]]:
        with self.cursor() as c:
            rows = c.execute(
                "SELECT * FROM telemetry_events ORDER BY timestamp ASC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def append_audit(
        self,
        *,
        tenant_id: str,
        action: str,
        actor: Optional[str] = None,
        resource: Optional[str] = None,
        detail: Optional[str] = None,
    ) -> None:
        with self.cursor() as c:
            c.execute(
                """
                INSERT INTO audit_log (tenant_id, actor, action, resource, detail)
                VALUES (?, ?, ?, ?, ?)
                """,
                (tenant_id, actor, action, resource, detail),
            )

    def list_audit(
        self, tenant_id: str, limit: int = 100
    ) -> list[dict[str, Any]]:
        with self.cursor() as c:
            rows = c.execute(
                """
                SELECT id, tenant_id, actor, action, resource, detail, created_at
                FROM audit_log
                WHERE tenant_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (tenant_id, limit),
            ).fetchall()
        return [dict(r) for r in rows]


_store: Optional[SqliteStore] = None
_store_lock = threading.Lock()


def get_store() -> SqliteStore:
    global _store
    with _store_lock:
        if _store is None:
            _store = SqliteStore()
        return _store
