# NEXUS (InsightOS)

End-to-end telemetry: **Ghost SDK** → **vault / Kafka / AI Brain** → **ClickHouse + SQLite analytics** → **RBAC-protected API** + **RAG advisor** + **React dashboard**.

## Architecture (three layers)

| Layer | Responsibility | Key paths |
|-------|----------------|-----------|
| **A — Instrumentation** | `@nexus/collector-sdk` (PII masking, buffering, `emitEvents` transport). React route/HOC helpers live in `Frontend-nexus/src/tracking/` (bundles with Vite). | `collector-sdk/` |
| **B — Data highway** | On-prem **Vault Gateway** → SQLite `raw_events` → **aggregator** → **sync** → Cloud **ingestor** → **Kafka**. Optional **mirror** from gateway to AI Brain for live UI. | `infra-gateway/` |
| **C — Intelligence** | FastAPI **AI Brain**: ingest, analytics, governance, **Kafka consumer** → SQLite + **ClickHouse**, **TF–IDF RAG**, ML pipeline. **RBAC** via `X-NEXUS-Role` when `NEXUS_RBAC_ENFORCE=true`. | `ai-brain/` |

## Run locally

### AI Brain (required for dashboard API)

```bash
cd ai-brain && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export NEXUS_KAFKA_CONSUME=false   # set true when Kafka is reachable
uvicorn api.app:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd Frontend-nexus && npm install && npm run dev
```

Copy `Frontend-nexus/.env.example` → `.env` and set:

- `VITE_INSIGHTOS_API_URL` — AI Brain (`http://localhost:8787` when using Docker Compose; use `http://localhost:8000` for a local `uvicorn` on 8000)
- `VITE_NEXUS_API_KEY` — must match server `NEXUS_API_KEY` when set
- `VITE_NEXUS_DEPLOYMENT` — `cloud` (direct to AI Brain), `on_prem` (vault gateway only), or `hybrid` (vault + brain)
- `VITE_VAULT_GATEWAY_URL` — default `http://localhost:8091`
- `VITE_NEXUS_RBAC_ROLE` / `VITE_NEXUS_RBAC_TENANT` — when server has `NEXUS_RBAC_ENFORCE=true`

### Docker (Kafka + ClickHouse + ingestor + vault + AI Brain)

```bash
cd infra-gateway
export NEXUS_API_KEY=dev-secret-key-replace-in-prod
docker compose --profile cloud --profile onprem --profile dev up -d
```

- AI Brain (Docker): `http://localhost:8787` — host port avoids clashes with other apps on `:8000` (`NEXUS_AI_BRAIN_HOST_PORT` in `infra-gateway/.env` overrides)
- Cloud ingestor: `http://localhost:8080`
- Vault gateway (on-prem ingest): `http://localhost:8091`
- ClickHouse HTTP: `http://localhost:8123`

Set gateway `NEXUS_MIRROR_TO_CLOUD=http://host.docker.internal:8787` (or `http://nexus_ai_brain:8000` from other Compose services) to mirror on-prem batches into the AI Brain.

## Notable API routes (AI Brain)

- `POST /api/v1/telemetry/events` — ingest (optional `telemetry:ingest` RBAC when enforce + `X-NEXUS-Role`)
- `GET /api/v1/analytics/dashboard|adoption|journey-funnel|insights|timeseries|event-mix`
- `POST /api/v1/rag/rag-query` — TF–IDF retrieval + optional LLM summary (`NEXUS_OPENAI_API_KEY`)
- `GET /api/v1/platform/clickhouse/feature-rollups` — OLAP feature counts (ClickHouse)
- `GET /api/v1/platform/graph/edges` — feature transitions (Neo4j or SQLite-derived)
- `POST /api/v1/embeddings/batch` — embedding-only sync into ClickHouse
- `GET /api/v1/governance/audit` — persisted audit log (consent, RAG, …)
- `PUT|GET /api/v1/governance/consent`
- `GET /api/v1/pipeline/run` — mock Neo4j + analytics demo

RBAC policy: `ai-brain/security/rbac_config.json` (aligned with `infra-gateway/security/rbac_config.json`).

## Contracts

Shared event shapes: `contracts/event_schema.json`.

## Monorepo layout

- `collector-sdk/` — publishable-style JS SDK (no React; peer-free for non-React hosts)
- `Frontend-nexus/` — Vite app, dashboard, `src/tracking/*` React instrumentation
- `ai-brain/` — Python services
- `infra-gateway/` — Compose, vault, Kafka, ClickHouse
