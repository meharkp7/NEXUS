/**
 * Optional OpenTelemetry Web SDK → OTLP HTTP (set VITE_OTEL_EXPORTER_OTLP_ENDPOINT, e.g. http://localhost:4318/v1/traces).
 * Uses default resource attributes; add @opentelemetry/resources only if you need custom service.name wiring.
 */
export async function initTracing() {
  const endpoint = (import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT || "").trim();
  if (!endpoint || typeof window === "undefined") return;

  try {
    const { WebTracerProvider, BatchSpanProcessor } = await import("@opentelemetry/sdk-trace-web");
    const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");

    const exporter = new OTLPTraceExporter({ url: endpoint });
    const provider = new WebTracerProvider();
    provider.addSpanProcessor(new BatchSpanProcessor(exporter));
    provider.register();
    // eslint-disable-next-line no-console
    console.info("[NEXUS] OpenTelemetry tracing enabled →", endpoint);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[NEXUS] OpenTelemetry init skipped:", e);
  }
}
