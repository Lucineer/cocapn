/**
 * Vector store for semantic search using sqlite-vec.
 *
 * Uses SQLite with the vec0 virtual table extension for vector similarity search.
 * Falls back gracefully if sqlite-vec is not available (e.g., ARM64 compilation issues).
 *
 * All operations are non-blocking and return safely on failure.
 */
import { join } from "path";
// ─── Vector Store ──────────────────────────────────────────────────────────────
/**
 * Vector store with graceful fallback.
 * If sqlite-vec fails to load or initialize, all methods become safe no-ops.
 */
class VectorStore {
    db = null;
    embeddingProvider;
    config;
    enabled = false;
    disableReason = null;
    initialized = false;
    constructor(config, embeddingProvider) {
        this.config = config;
        this.embeddingProvider = embeddingProvider;
    }
    async initialize() {
        if (this.initialized) {
            return {
                enabled: this.enabled,
                reason: this.disableReason || undefined,
            };
        }
        this.initialized = true;
        // Check if explicitly disabled
        if (!this.config.enabled) {
            this.enabled = false;
            this.disableReason = "Vector search disabled in config";
            return {
                enabled: false,
                reason: this.disableReason,
            };
        }
        try {
            // Try to import better-sqlite3 and sqlite-vec
            const Database = await import("better-sqlite3");
            const sqliteVec = await import("sqlite-vec");
            // Open database
            this.db = new Database.default(this.config.dbPath);
            // Load sqlite-vec extension
            this.db.loadExtension(sqliteVec.default);
            sqliteVec.install(this.db);
            // Create vec0 table for fact embeddings
            this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS fact_vectors
        USING vec0(
          id TEXT PRIMARY KEY,
          embedding float[${this.config.dimensions}]
        )
      `);
            this.enabled = true;
            return { enabled: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.enabled = false;
            this.disableReason = `sqlite-vec not available: ${message}`;
            return {
                enabled: false,
                reason: this.disableReason,
            };
        }
    }
    /**
     * Store an embedding for the given text.
     * Returns false if embedding generation or storage fails.
     */
    async store(id, text) {
        if (!this.enabled || !this.db) {
            return false;
        }
        try {
            const embedding = await this.embeddingProvider.embed(text);
            if (!embedding) {
                return false;
            }
            const stmt = this.db.prepare("INSERT OR REPLACE INTO fact_vectors (id, embedding) VALUES (?, ?)");
            stmt.run(id, JSON.stringify(embedding));
            return true;
        }
        catch (error) {
            // Silently fail to allow fallback
            return false;
        }
    }
    /**
     * Search for similar documents using vector similarity.
     * Returns empty array if vector search is disabled or fails.
     */
    async search(query, topK = 10) {
        if (!this.enabled || !this.db) {
            return [];
        }
        try {
            const embedding = await this.embeddingProvider.embed(query);
            if (!embedding) {
                return [];
            }
            const stmt = this.db.prepare(`
        SELECT
          id,
          distance
        FROM fact_vectors
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT ?
      `);
            const results = stmt.all(JSON.stringify(embedding), topK);
            return results.map((row) => ({
                id: row.id,
                score: 1 - row.distance, // Convert distance to similarity score
            }));
        }
        catch (error) {
            // Silently fail to allow fallback
            return [];
        }
    }
    /**
     * Delete an embedding by ID.
     */
    async delete(id) {
        if (!this.enabled || !this.db) {
            return;
        }
        try {
            const stmt = this.db.prepare("DELETE FROM fact_vectors WHERE id = ?");
            stmt.run(id);
        }
        catch (error) {
            // Silently fail
        }
    }
    /**
     * Check if vector store is enabled.
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Get the reason why vector store is disabled (if applicable).
     */
    getDisableReason() {
        return this.disableReason;
    }
    /**
     * Close the database connection.
     */
    close() {
        if (this.db) {
            try {
                this.db.close();
                this.db = null;
            }
            catch (error) {
                // Ignore close errors
            }
        }
    }
}
// ─── Factory ────────────────────────────────────────────────────────────────────
export async function createVectorStore(repoRoot, embeddingProvider, dimensions) {
    const dbPath = join(repoRoot, ".cocapn", "vectors.db");
    const config = {
        enabled: true,
        dbPath,
        dimensions,
    };
    const store = new VectorStore(config, embeddingProvider);
    await store.initialize();
    return store;
}
export { VectorStore };
//# sourceMappingURL=vector-store.js.map