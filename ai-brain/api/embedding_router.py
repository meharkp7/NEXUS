from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from api.rbac_deps import RbacCtx, enforce_tenant_scope, require_permission
from services.clickhouse_sink import insert_embedding_row

router = APIRouter(tags=["embeddings"])


class EmbeddingItem(BaseModel):
    vector: list[float] = Field(..., min_length=4, max_length=4096)
    refEventId: str = Field(default="", max_length=128)


class EmbeddingBatchBody(BaseModel):
    tenantId: str = Field(..., min_length=1)
    items: list[EmbeddingItem] = Field(..., min_length=1, max_length=500)


@router.post("/batch")
def post_embedding_batch(
    body: EmbeddingBatchBody,
    rbac: RbacCtx = Depends(require_permission("telemetry:ingest")),
):
    """Embedding-only sync: vectors land in ClickHouse without raw event payloads."""
    enforce_tenant_scope(rbac.role, rbac.tenant_header, body.tenantId)
    accepted = 0
    for it in body.items:
        insert_embedding_row(body.tenantId, it.vector, it.refEventId or "")
        accepted += 1
    return {"tenantId": body.tenantId, "accepted": accepted, "sink": "clickhouse"}
