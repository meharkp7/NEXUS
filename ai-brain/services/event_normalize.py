import hashlib
import re
from datetime import datetime, timezone
from typing import Any, Optional

_TNT = re.compile(r"^TNT-[A-Z0-9]{6}$")


def kafka_tenant_id(tenant_id: str) -> str:
    if _TNT.match(tenant_id or ""):
        return tenant_id
    h = hashlib.sha256((tenant_id or "").encode()).hexdigest()[:6].upper()
    return f"TNT-{h}"


def _pick(d: dict, *keys: str) -> Any:
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return None


def normalize_incoming_event(raw: dict) -> Optional[dict[str, Any]]:
    event_id = _pick(raw, "event_id", "eventId")
    tenant_id = _pick(raw, "tenant_id", "tenantId")
    session_id = _pick(raw, "session_id", "sessionId")
    event_type = _pick(raw, "event_type", "eventType")
    feature_id = _pick(raw, "feature_id", "featureModule")
    ts = _pick(raw, "timestamp")
    journey_id = _pick(raw, "journey_id", "journeyId")
    journey_step = _pick(raw, "journey_step", "journeyStep")

    if not all([event_id, tenant_id, session_id, event_type, feature_id]):
        return None

    if not ts:
        ts = datetime.now(timezone.utc).isoformat()

    meta = raw.get("metadata")
    if meta is not None and not isinstance(meta, dict):
        meta = {"value": meta}

    full_meta = {k: v for k, v in raw.items() if k not in (
        "event_id", "eventId", "tenant_id", "tenantId", "session_id", "sessionId",
        "event_type", "eventType", "feature_id", "featureModule", "timestamp",
        "journey_id", "journeyId", "journey_step", "journeyStep", "metadata",
    )}
    if meta:
        full_meta = {**full_meta, **meta}

    return {
        "event_id": str(event_id),
        "tenant_id": str(tenant_id),
        "session_id": str(session_id),
        "event_type": str(event_type),
        "feature_id": str(feature_id),
        "timestamp": str(ts),
        "journey_id": str(journey_id) if journey_id else None,
        "journey_step": str(journey_step) if journey_step else None,
        "metadata": full_meta or None,
    }


def to_cloud_event(row: dict) -> dict:
    meta = row.get("metadata")
    if isinstance(meta, str):
        try:
            import json
            meta = json.loads(meta) if meta else None
        except json.JSONDecodeError:
            meta = None
    return {
        "event_id": row["event_id"],
        "tenant_id": kafka_tenant_id(row["tenant_id"]),
        "session_id": row["session_id"],
        "user_hash": None,
        "event_type": row["event_type"],
        "feature_id": row["feature_id"],
        "feature_module": row["feature_id"],
        "timestamp": row["timestamp"],
        "duration_ms": None,
        "deployment_type": "CLOUD",
        "geo_region": None,
        "error_code": None,
        "metadata": meta,
    }
