import os

from fastapi import Header, HTTPException

API_KEY = os.environ.get("NEXUS_API_KEY", "").strip()


def require_api_key(authorization: str | None = Header(None)) -> None:
    if not API_KEY:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization Bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if token != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
