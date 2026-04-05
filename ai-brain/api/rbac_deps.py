from typing import NamedTuple, Optional

from fastapi import Header, HTTPException

from api.deps import require_api_key
from security.rbac_engine import has_permission, rbac_enforce, tenant_admin_may_access_tenant


class RbacCtx(NamedTuple):
    role: Optional[str]
    tenant_header: Optional[str]


def require_permission(permission: str):
    def dep(
        authorization: Optional[str] = Header(None),
        x_nexus_role: Optional[str] = Header(None, alias="X-NEXUS-Role"),
        x_nexus_tenant: Optional[str] = Header(None, alias="X-NEXUS-Tenant"),
    ) -> RbacCtx:
        require_api_key(authorization)
        if rbac_enforce() and x_nexus_role:
            if not has_permission(x_nexus_role, permission):
                raise HTTPException(
                    status_code=403,
                    detail=f"RBAC: role lacks permission '{permission}'",
                )
        return RbacCtx(x_nexus_role, x_nexus_tenant)

    return dep


def enforce_tenant_scope(
    role: Optional[str],
    caller_tenant_header: Optional[str],
    query_tenant_id: str,
) -> None:
    if not rbac_enforce() or not role:
        return
    if not tenant_admin_may_access_tenant(role, caller_tenant_header, query_tenant_id):
        raise HTTPException(
            status_code=403,
            detail="RBAC: NEXUS_TENANT_ADMIN may only access X-NEXUS-Tenant scope",
        )
