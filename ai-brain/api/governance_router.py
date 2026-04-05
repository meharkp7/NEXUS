import json

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from api.rbac_deps import RbacCtx, enforce_tenant_scope, require_permission
from storage.sqlite_store import get_store

router = APIRouter(tags=["governance"])


class ConsentBody(BaseModel):
    tenantId: str = Field(..., min_length=1)
    consentGranted: bool


@router.put("/consent")
def put_consent(
    body: ConsentBody,
    rbac: RbacCtx = Depends(require_permission("governance:toggle_telemetry_consent")),
):
    enforce_tenant_scope(rbac.role, rbac.tenant_header, body.tenantId)
    get_store().set_consent(body.tenantId, body.consentGranted)
    get_store().append_audit(
        tenant_id=body.tenantId,
        action="consent_updated",
        actor=rbac.role or "api",
        resource="telemetry_consent",
        detail=json.dumps({"consentGranted": body.consentGranted}),
    )
    return {
        "tenantId": body.tenantId,
        "consentGranted": body.consentGranted,
        "ok": True,
    }


@router.get("/consent")
def get_consent(
    tenantId: str,
    rbac: RbacCtx = Depends(require_permission("governance:view_consent_status")),
):
    enforce_tenant_scope(rbac.role, rbac.tenant_header, tenantId)
    store = get_store()
    c = store.consent_for(tenantId)
    return {
        "tenantId": tenantId,
        "consentGranted": True if c is None else c,
        "explicit": c is not None,
    }


@router.get("/audit")
def list_governance_audit(
    tenantId: str = Query(..., alias="tenantId"),
    limit: int = Query(100, ge=1, le=500),
    rbac: RbacCtx = Depends(require_permission("telemetry:view_audit_log")),
):
    enforce_tenant_scope(rbac.role, rbac.tenant_header, tenantId)
    rows = get_store().list_audit(tenantId, limit=limit)
    return {"tenantId": tenantId, "entries": rows}
