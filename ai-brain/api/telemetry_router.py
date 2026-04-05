import logging
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from api.deps import require_api_key
from security.rbac_engine import has_permission, rbac_enforce
from services.clickhouse_sink import insert_telemetry_row
from services.event_normalize import normalize_incoming_event, to_cloud_event
from services.kafka_forward import forward_events_batch
from storage.sqlite_store import get_store

log = logging.getLogger(__name__)

router = APIRouter(tags=["telemetry"])


def verify_telemetry_ingest(
    authorization: Optional[str] = Header(None),
    x_nexus_role: Optional[str] = Header(None, alias="X-NEXUS-Role"),
) -> None:
    require_api_key(authorization)
    if rbac_enforce() and x_nexus_role:
        if not has_permission(x_nexus_role, "telemetry:ingest"):
            raise HTTPException(
                status_code=403,
                detail="RBAC: role lacks telemetry:ingest",
            )


class TelemetryBatch(BaseModel):
    events: list[dict[str, Any]] = Field(default_factory=list)
    emittedAt: Optional[str] = None


@router.post("/events")
def post_telemetry_events(
    body: TelemetryBatch,
    background_tasks: BackgroundTasks,
    _: None = Depends(verify_telemetry_ingest),
):
    store = get_store()
    accepted = 0
    rejected = 0
    cloud_batch: list[dict[str, Any]] = []

    for raw in body.events:
        norm = normalize_incoming_event(raw)
        if not norm:
            rejected += 1
            continue
        c = store.consent_for(norm["tenant_id"])
        if c is False:
            rejected += 1
            continue
        ok = store.insert_event(**norm)
        if ok:
            accepted += 1
            cloud_batch.append(to_cloud_event(norm))
            insert_telemetry_row(norm)
        else:
            rejected += 1

    if cloud_batch:
        background_tasks.add_task(forward_events_batch, cloud_batch)

    return {
        "accepted": accepted,
        "rejected": rejected,
        "message": "Batch processed",
    }
