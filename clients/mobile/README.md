# Mobile & native clients

- Use the JSON contract in `nexus-contract.ts` for payloads to the AI Brain `POST /api/v1/telemetry/events` (or your on-prem vault gateway).
- For **embedding-only** egress to the cloud, call `POST /api/v1/embeddings/batch` with `Authorization: Bearer <NEXUS_API_KEY>` and a body `{ "tenantId": "...", "items": [{ "vector": [0.1, ...], "refEventId": "optional" }] }`.
- OpenTelemetry: native apps should export traces to your collector; align `service.name` with backend SLO dashboards.
