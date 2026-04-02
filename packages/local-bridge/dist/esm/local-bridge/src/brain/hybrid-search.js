/**
 * Hybrid search combining inverted index (keyword) and vector (semantic) search.
 *
 * Merges results from both sources using weighted scoring:
 *   score = α * keyword_score + (1-α) * semantic_score
 *
 * Falls back to keyword-only if vector search is unavailable.
 */
// ─── Hybrid Search ─────────────────────────────────────────────────────────────
/**
 * Hybrid search combining inverted index and vector store.
 * Falls back to keyword-only if vector search is disabled.
 */
class HybridSearch {
    invertedIndex;
    vectorStore;
    constructor(invertedIndex, vectorStore) {
        this.invertedIndex = invertedIndex;
        this.vectorStore = vectorStore;
    }
    /**
     * Search using both keyword and semantic search.
     * Merges results using weighted scoring.
     */
    async search(query, options = {}) {
        const { alpha = 0.6, topK = 10, minScore = 0.1, } = options;
        // Get keyword results
        const keywordResults = this.invertedIndex.search(query);
        // Get semantic results (if available)
        let semanticResults = [];
        if (this.vectorStore && this.vectorStore.isEnabled()) {
            try {
                semanticResults = await this.vectorStore.search(query, topK * 2);
            }
            catch (error) {
                // Silently fail to keyword-only
                semanticResults = [];
            }
        }
        // Normalize scores to 0-1 range
        const maxKeywordScore = Math.max(...keywordResults.map(r => r.score), 1);
        const maxSemanticScore = Math.max(...semanticResults.map(r => r.score), 1);
        // Merge results
        const merged = new Map();
        // Add keyword results
        for (const result of keywordResults) {
            const normalizedScore = result.score / maxKeywordScore;
            merged.set(result.id, {
                id: result.id,
                score: alpha * normalizedScore,
                source: "keyword",
            });
        }
        // Add semantic results
        for (const result of semanticResults) {
            const normalizedScore = result.score / maxSemanticScore;
            const existing = merged.get(result.id);
            if (existing) {
                // Merge: weighted sum
                existing.score = existing.score + (1 - alpha) * normalizedScore;
                existing.source = "both";
            }
            else {
                merged.set(result.id, {
                    id: result.id,
                    score: (1 - alpha) * normalizedScore,
                    source: "semantic",
                });
            }
        }
        // Filter by minimum score and sort
        const results = Array.from(merged.values())
            .filter(r => r.score >= minScore)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
        return results;
    }
    /**
     * Check if hybrid search is enabled (vector store available).
     */
    isHybridEnabled() {
        return this.vectorStore !== null && this.vectorStore.isEnabled();
    }
}
// ─── Factory ────────────────────────────────────────────────────────────────────
export function createHybridSearch(invertedIndex, vectorStore) {
    return new HybridSearch(invertedIndex, vectorStore);
}
export { HybridSearch };
//# sourceMappingURL=hybrid-search.js.map