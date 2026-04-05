import logging
import os
from typing import Any

import httpx

log = logging.getLogger(__name__)

CLOUD_INGEST_URL = os.environ.get(
    "NEXUS_CLOUD_INGEST_URL",
    "http://localhost:8080/api/v1/events",
)
CLOUD_API_KEY = os.environ.get("NEXUS_API_KEY", "")


def forward_events_batch(events: list[dict[str, Any]]) -> None:
    if not events or not CLOUD_API_KEY:
        return
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {CLOUD_API_KEY}",
    }
    body = {"events": events, "sdk_version": "1.0.0"}
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(CLOUD_INGEST_URL, json=body, headers=headers)
            r.raise_for_status()
        log.info("Forwarded %d event(s) to cloud ingestor.", len(events))
    except Exception as e:
        log.warning("Kafka/cloud forward skipped or failed: %s", e)
