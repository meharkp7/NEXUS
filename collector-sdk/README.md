# NEXUS collector SDK (JavaScript)

Browser / Node telemetry: feature taxonomy, PII masking, buffered emit to the AI Brain or vault gateway.

## OpenTelemetry

The InsightOS React app can export **browser traces** via OTLP when `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` is set (see `Frontend-nexus/src/tracing.js`). For backend or mobile, use the OpenTelemetry SDK for that runtime and the same service naming convention.
