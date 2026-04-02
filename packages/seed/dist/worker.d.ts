/**
 * Cloudflare Worker — edge deployment for cocapn seed.
 *
 * Serves the web UI and proxies /api/chat to the user's LLM provider.
 * Uses KV for memory persistence (instead of JSON file).
 *
 * Secrets (set via `wrangler secret put`):
 *   DEEPSEEK_API_KEY
 *   OPENAI_API_KEY
 */
interface Env {
    DEEPSEEK_API_KEY?: string;
    OPENAI_API_KEY?: string;
    PROVIDER: string;
    MODEL: string;
    MEMORY: KVNamespace;
}
declare const _default: ExportedHandler<Env>;
export default _default;
//# sourceMappingURL=worker.d.ts.map