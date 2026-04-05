"""
On-prem Vault Gateway — receives browser/SDK batches, writes raw_events for aggregator.py.
Optional mirror to AI Brain (real-time dashboard) via NEXUS_MIRROR_TO_CLOUD.
"""

import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [VAULT-GW] %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DB_PATH = os.environ.get("NEXUS_DB_PATH", "/vault/nexus_vault.db")
API_KEY = os.environ.get("NEXUS_API_KEY", "").strip()
MIRROR_URL = os.environ.get("NEXUS_MIRROR_TO_CLOUD", "").strip()
MIRROR_HEADERS: dict[str, str] = {}

app = FastAPI(title="NEXUS Vault Gateway", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_key(authorization: Optional[str] = Header(None)) -> None:
    if not API_KEY:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing Authorization")
    if authorization.removeprefix("Bearer ").strip() != API_KEY:
        raise HTTPException(403, "Invalid API key")


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS raw_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT UNIQUE NOT NULL,
            tenant_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            user_hash TEXT,
            event_type TEXT NOT NULL,
            feature_id TEXT NOT NULL,
            feature_module TEXT,
            timestamp TEXT NOT NULL,
            duration_ms INTEGER,
            deployment_type TEXT DEFAULT 'ON_PREM',
            geo_region TEXT,
            error_code TEXT,
            metadata TEXT,
            is_processed INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_raw_events_processed ON raw_events(is_processed);
        """
    )
    conn.commit()


def sdk_event_to_row(e: dict[str, Any]) -> tuple:
    eid = e.get("eventId") or e.get("event_id")
    tid = e.get("tenantId") or e.get("tenant_id")
    sid = e.get("sessionId") or e.get("session_id")
    et = e.get("eventType") or e.get("event_type")
    fid = e.get("featureModule") or e.get("feature_id")
    ts = e.get("timestamp") or datetime.now(timezone.utc).isoformat()
    meta = e.get("metadata") or {}
    if not isinstance(meta, dict):
        meta = {"value": meta}
    dur = meta.get("durationMs") or meta.get("duration_ms")
    err = meta.get("errorCode") or meta.get("error_code")
    user_h = meta.get("userHash") or meta.get("user_hash")
    return (
        str(eid),
        str(tid),
        str(sid),
        str(user_h) if user_h else None,
        str(et),
        str(fid),
        str(fid),
        str(ts),
        int(dur) if dur is not None else None,
        "ON_PREM",
        None,
        str(err) if err else None,
        json.dumps(meta),
        0,
    )


class BatchIn(BaseModel):
    events: list[dict[str, Any]] = Field(default_factory=list)
    emittedAt: Optional[str] = None


@app.on_event("startup")
def startup() -> None:
    parent = os.path.dirname(DB_PATH)
    if parent:
        os.makedirs(parent, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    ensure_schema(c)
    c.close()
    log.info("Vault gateway DB ready at %s", DB_PATH)


@app.get("/health")
def health():
    return {"status": "ok", "service": "nexus-vault-gateway"}


@app.post("/api/v1/events")
def ingest(batch: BatchIn, _: None = Depends(verify_key)):
    conn = sqlite3.connect(DB_PATH)
    ensure_schema(conn)
    accepted = 0
    for e in batch.events:
        try:
            row = sdk_event_to_row(e)
            conn.execute(
                """
                INSERT OR REPLACE INTO raw_events
                (event_id, tenant_id, session_id, user_hash, event_type, feature_id,
                 feature_module, timestamp, duration_ms, deployment_type, geo_region,
                 error_code, metadata, is_processed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                row,
            )
            accepted += 1
        except Exception as ex:
            log.warning("Skip event: %s", ex)
    conn.commit()
    conn.close()

    if MIRROR_URL and batch.events:
        try:
            headers = {"Content-Type": "application/json"}
            if API_KEY:
                headers["Authorization"] = f"Bearer {API_KEY}"
            with httpx.Client(timeout=10.0) as client:
                client.post(
                    f"{MIRROR_URL.rstrip('/')}/api/v1/telemetry/events",
                    json={"events": batch.events, "emittedAt": batch.emittedAt},
                    headers=headers,
                )
            log.info("Mirrored %d events to AI Brain", len(batch.events))
        except Exception as ex:
            log.warning("Mirror to cloud failed (vault write succeeded): %s", ex)

    return {"accepted": accepted, "vault": "raw_events", "mirrored": bool(MIRROR_URL)}
