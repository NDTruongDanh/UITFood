/**
 * Minimal domain-metrics shim for the Catalog service (no-ops until
 * service-level OpenTelemetry is wired). Keeps the monolith call sites intact.
 */
export function recordAiSearchBackfill(..._args: unknown[]): void {}
export function recordAiSearchEmbeddingJob(..._args: unknown[]): void {}
export function recordAiSearchStaleEmbeddings(..._args: unknown[]): void {}
