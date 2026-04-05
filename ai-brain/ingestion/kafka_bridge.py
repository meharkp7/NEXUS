import asyncio
import json
import logging
import os
from typing import Any, Optional

from aiokafka import AIOKafkaConsumer

from services.clickhouse_sink import insert_telemetry_row
from services.event_normalize import normalize_incoming_event
from storage.sqlite_store import get_store

log = logging.getLogger(__name__)


def _kafka_to_sdk_shape(msg: dict[str, Any]) -> dict[str, Any]:
    return {
        "eventId": msg.get("event_id"),
        "tenantId": msg.get("tenant_id"),
        "sessionId": msg.get("session_id"),
        "eventType": msg.get("event_type"),
        "featureModule": msg.get("feature_id"),
        "timestamp": msg.get("timestamp"),
        "metadata": msg.get("metadata") or {},
        "journeyId": (msg.get("metadata") or {}).get("journeyId"),
        "journeyStep": (msg.get("metadata") or {}).get("journeyStep"),
    }


async def kafka_bridge_task(stop: asyncio.Event) -> None:
    if os.environ.get("NEXUS_KAFKA_CONSUME", "false").lower() not in ("1", "true", "yes"):
        log.info("NEXUS_KAFKA_CONSUME disabled — skipping Kafka bridge.")
        return

    brokers = os.environ.get("NEXUS_KAFKA_BROKERS", "localhost:9092")
    pattern = os.environ.get("NEXUS_KAFKA_SUBSCRIBE_PATTERN", r"nexus\.events\..+")
    group = os.environ.get("NEXUS_KAFKA_GROUP", "nexus-ai-brain-consumer")

    while not stop.is_set():
        consumer: Optional[AIOKafkaConsumer] = None
        try:
            consumer = AIOKafkaConsumer(
                bootstrap_servers=brokers,
                group_id=group,
                enable_auto_commit=True,
                auto_offset_reset="earliest",
            )
            consumer.subscribe(pattern=pattern)
            await consumer.start()
            log.info("Kafka consumer subscribed pattern=%s brokers=%s", pattern, brokers)

            async for msg in consumer:
                if stop.is_set():
                    break
                try:
                    payload = json.loads(msg.value.decode("utf-8"))
                    raw = _kafka_to_sdk_shape(payload)
                    norm = normalize_incoming_event(raw)
                    if not norm:
                        continue
                    ok = get_store().insert_event(**norm)
                    if ok:
                        insert_telemetry_row(norm)
                except Exception as e:
                    log.warning("Kafka message handling error: %s", e)

        except asyncio.CancelledError:
            break
        except Exception as e:
            log.warning("Kafka consumer loop error: %s — retry in 5s", e)
            try:
                await asyncio.wait_for(stop.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                pass
        finally:
            if consumer:
                try:
                    await consumer.stop()
                except Exception:
                    pass

        if stop.is_set():
            break

    log.info("Kafka bridge stopped.")
