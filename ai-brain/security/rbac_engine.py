import json
import os
from functools import lru_cache
from typing import Optional

_BASE = os.path.dirname(os.path.abspath(__file__))
_CONFIG_PATH = os.environ.get("NEXUS_RBAC_CONFIG", os.path.join(_BASE, "rbac_config.json"))


@lru_cache(maxsize=1)
def _load() -> dict:
    with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def rbac_enforce() -> bool:
    return os.environ.get("NEXUS_RBAC_ENFORCE", "false").lower() in ("1", "true", "yes")


def role_permissions(role: str) -> tuple[set[str], set[str]]:
    data = _load()
    roles = data.get("roles", {})
    if role not in roles:
        return set(), set()
    r = roles[role]
    perms = set(r.get("permissions", []))
    forbidden = set(r.get("forbidden", []))
    return perms, forbidden


def has_permission(role: str, permission: str) -> bool:
    perms, forbidden = role_permissions(role)
    if permission in forbidden:
        return False
    if "*" in perms:
        return True
    return permission in perms


def tenant_admin_may_access_tenant(role: str, caller_tenant: Optional[str], resource_tenant: str) -> bool:
    if role != "NEXUS_TENANT_ADMIN":
        return True
    if not caller_tenant:
        return False
    return caller_tenant == resource_tenant
