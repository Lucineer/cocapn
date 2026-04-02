/**
 * Embedding providers for vector search.
 *
 * Supports:
 * - Local: @xenova/transformers (WASM, no GPU) - graceful fallback on failure
 * - OpenAI: text-embedding-3-small API
 *
 * All providers return null on failure to allow graceful degradation.
 */
// ─── Local Embedding Provider ───────────────────────────────────────────────────
/**
 * Local embedding provider using @xenova/transformers.
 * Runs in-process with WASM, no GPU needed.
 *
 * Falls back gracefully if WASM fails to load (common on ARM64).
 */
class LocalEmbeddingProvider {
    pipeline = null;
    model;
    initialized = false;
    initError = null;
    constructor(model = "Xenova/all-MiniLM-L6-v2") {
        this.model = model;
    }
    async initialize() {
        if (this.initialized) {
            return this.initError ? { success: false, error: this.initError } : { success: true };
        }
        try {
            // Dynamic import to avoid requiring the package globally
            const { pipeline } = await import("@xenova/transformers");
            this.pipeline = await pipeline("feature-extraction", this.model, {
                progress_callback: undefined, // Suppress progress logs
            });
            this.initialized = true;
            return { success: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.initError = `Local embedding provider failed: ${message}`;
            this.initialized = true;
            return { success: false, error: this.initError };
        }
    }
    async embed(text) {
        if (!this.initialized) {
            const init = await this.initialize();
            if (!init.success) {
                return null;
            }
        }
        if (!this.pipeline) {
            return null;
        }
        try {
            const output = await this.pipeline(text, {
                pooling: "mean",
                normalize: true,
            });
            // Convert tensor output to array
            const embedding = Array.from(output.data);
            return embedding;
        }
        catch (error) {
            // Silently fail to allow fallback
            return null;
        }
    }
    async embedBatch(texts) {
        const results = [];
        for (const text of texts) {
            results.push(await this.embed(text));
        }
        return results;
    }
}
// ─── OpenAI Embedding Provider ─────────────────────────────────────────────────
/**
 * OpenAI embedding provider using text-embedding-3-small.
 * Requires API key and network access.
 */
class OpenAIEmbeddingProvider {
    apiKey;
    model;
    baseUrl;
    dimensions;
    constructor(apiKey, model = "text-embedding-3-small", dimensions = 1536, baseUrl = "https://api.openai.com") {
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = baseUrl;
        this.dimensions = dimensions;
    }
    async initialize() {
        if (!this.apiKey) {
            return { success: false, error: "OpenAI API key not provided" };
        }
        return { success: true };
    }
    async embed(text) {
        try {
            const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    input: text,
                    dimensions: this.dimensions,
                }),
            });
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            const embedding = data.data?.[0]?.embedding;
            return embedding || null;
        }
        catch (error) {
            // Silently fail to allow fallback
            return null;
        }
    }
    async embedBatch(texts) {
        try {
            const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    input: texts,
                    dimensions: this.dimensions,
                }),
            });
            if (!response.ok) {
                return texts.map(() => null);
            }
            const data = await response.json();
            return data.data.map((item) => item.embedding || null);
        }
        catch (error) {
            // Silently fail to allow fallback
            return texts.map(() => null);
        }
    }
}
// ─── Factory ────────────────────────────────────────────────────────────────────
export async function createEmbeddingProvider(options) {
    if (options.provider === "openai") {
        return new OpenAIEmbeddingProvider(options.apiKey || "", options.model || "text-embedding-3-small", options.dimensions || 1536, options.baseUrl || "https://api.openai.com");
    }
    // Default to local
    return new LocalEmbeddingProvider();
}
export { LocalEmbeddingProvider, OpenAIEmbeddingProvider };
//# sourceMappingURL=embedding.js.map