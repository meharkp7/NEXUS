import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.analytics_router import router as analytics_router
from api.embedding_router import router as embedding_router
from api.governance_router import router as governance_router
from api.pipeline_router import router as pipeline_router
from api.platform_router import router as platform_router
from api.rag_router import router as rag_router
from api.telemetry_router import router as telemetry_router

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    stop = asyncio.Event()
    task: Optional[asyncio.Task] = None
    if os.environ.get("NEXUS_KAFKA_CONSUME", "false").lower() in ("1", "true", "yes"):
        try:
            from ingestion.kafka_bridge import kafka_bridge_task

            task = asyncio.create_task(kafka_bridge_task(stop))
            log.info("Kafka → SQLite bridge task started.")
        except Exception as e:
            log.warning("Kafka bridge could not start: %s", e)
    yield
    stop.set()
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="NEXUS InsightOS API",
    description="Telemetry, analytics, RBAC, Kafka consumer, ClickHouse sink, RAG advisor.",
    version="1.1.0",
    docs_url="/api/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(telemetry_router, prefix="/api/v1/telemetry")
app.include_router(analytics_router, prefix="/api/v1/analytics")
app.include_router(governance_router, prefix="/api/v1/governance")
app.include_router(platform_router, prefix="/api/v1/platform")
app.include_router(embedding_router, prefix="/api/v1/embeddings")
app.include_router(rag_router, prefix="/api/v1/rag")
app.include_router(pipeline_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok", "service": "nexus-ai-brain"}


@app.get("/")
def root():
    return {
        "service": "NEXUS InsightOS API",
        "version": "1.1.0",
        "docs": "/api/docs",
        "health": "/health",
        "endpoints": {
            "telemetry": "POST /api/v1/telemetry/events",
            "dashboard": "GET /api/v1/analytics/dashboard",
            "adoption": "GET /api/v1/analytics/adoption",
            "journey_funnel": "GET /api/v1/analytics/journey-funnel",
            "insights": "GET /api/v1/analytics/insights",
            "timeseries": "GET /api/v1/analytics/timeseries",
            "event_mix": "GET /api/v1/analytics/event-mix",
            "rag": "POST /api/v1/rag/rag-query",
            "consent_put": "PUT /api/v1/governance/consent",
            "consent_get": "GET /api/v1/governance/consent",
            "audit_log": "GET /api/v1/governance/audit",
            "platform_ch": "GET /api/v1/platform/clickhouse/feature-rollups",
            "platform_graph": "GET /api/v1/platform/graph/edges",
            "embeddings_batch": "POST /api/v1/embeddings/batch",
            "pipeline_run": "GET /api/v1/pipeline/run",
        },
    }
