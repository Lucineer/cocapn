/**
 * LLM Request Queue — type definitions.
 *
 * Provides QueueItem, QueueConfig, and related types for the
 * backpressure-aware request queue used by LLM providers.
 */
export const DEFAULT_QUEUE_CONFIG = {
    maxConcurrency: 5,
    maxQueueSize: 1000,
    perTenantConcurrency: 2,
    timeout: 30_000,
    retryDelay: 1_000,
    maxRetries: 2,
};
/** Known provider defaults (requests per minute) */
export const PROVIDER_RATE_LIMITS = {
    deepseek: 60,
    openai: 500,
    anthropic: 1000,
    ollama: 30,
};
//# sourceMappingURL=types.js.map