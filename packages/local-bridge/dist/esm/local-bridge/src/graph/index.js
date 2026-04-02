/**
 * Repo Graph — Main facade for the repository knowledge graph.
 *
 * Combines parsing and database layers to provide a complete code structure API:
 * - Build and update the graph incrementally
 * - Query dependencies, call graphs, and impact analysis
 * - Search for symbols by name
 */
import { join, relative } from "path";
import { existsSync, readdirSync } from "fs";
import { RepoParser } from "./parser.js";
import { GraphDB } from "./db.js";
// ─── Repo Graph ───────────────────────────────────────────────────────────────
export class RepoGraph {
    parser;
    db;
    repoRoot;
    dbPath;
    initialized = false;
    constructor(repoRoot, dbPath) {
        this.repoRoot = repoRoot;
        this.dbPath = dbPath || join(repoRoot, ".cocapn", "graph.db");
        this.db = new GraphDB(this.dbPath);
        this.parser = new RepoParser(repoRoot);
    }
    /**
     * Initialize the graph database.
     */
    async initialize() {
        await this.db.initialize();
        this.initialized = true;
    }
    /**
     * Build the entire repository graph.
     * Parses all TypeScript files in the repo and populates the database.
     */
    async build() {
        if (!this.initialized)
            await this.initialize();
        console.log("[graph] Building repository knowledge graph...");
        // Clear existing data
        await this.db.clear();
        // Find all TypeScript files
        const tsFiles = this.findTypeScriptFiles(this.repoRoot);
        console.log(`[graph] Found ${tsFiles.length} TypeScript files`);
        // Parse all files
        const allNodes = [];
        const allEdges = [];
        for (const filePath of tsFiles) {
            const relPath = relative(this.repoRoot, filePath);
            try {
                const { nodes, edges } = this.parser.parseFile(filePath);
                allNodes.push(...nodes);
                allEdges.push(...edges);
            }
            catch (error) {
                console.error(`[graph] Failed to parse ${relPath}:`, error);
            }
        }
        // Insert into database
        await this.db.addNodes(allNodes);
        await this.db.addEdges(allEdges);
        const stats = await this.stats();
        console.log(`[graph] Built graph: ${stats.nodes} nodes, ${stats.edges} edges, ${stats.files} files, ${stats.symbols} symbols`);
    }
    /**
     * Update a single file in the graph (for incremental updates).
     */
    async updateFile(filePath) {
        if (!this.initialized)
            await this.initialize();
        const relPath = relative(this.repoRoot, filePath);
        // Remove old data for this file
        await this.db.removeByFile(relPath);
        // Parse the file
        const { nodes, edges } = this.parser.parseFile(filePath);
        // Insert new data
        await this.db.addNodes(nodes);
        await this.db.addEdges(edges);
    }
    /**
     * Remove a file from the graph.
     */
    async removeFile(filePath) {
        if (!this.initialized)
            await this.initialize();
        const relPath = relative(this.repoRoot, filePath);
        await this.db.removeByFile(relPath);
    }
    /**
     * Get files that this file imports (direct dependencies).
     */
    async getDependencies(file) {
        if (!this.initialized)
            await this.initialize();
        return this.db.getDependencies(file);
    }
    /**
     * Get files that import this file (dependents).
     */
    async getDependents(file) {
        if (!this.initialized)
            await this.initialize();
        return this.db.getDependents(file);
    }
    /**
     * Get call graph for a function (what it calls).
     */
    async getCallGraph(functionId) {
        if (!this.initialized)
            await this.initialize();
        return this.db.getCallGraph(functionId);
    }
    /**
     * Get reverse call graph (what calls this function).
     */
    async getReverseCallGraph(functionId) {
        if (!this.initialized)
            await this.initialize();
        return this.db.getReverseCallGraph(functionId);
    }
    /**
     * Find nodes by name pattern.
     */
    async findByName(pattern) {
        if (!this.initialized)
            await this.initialize();
        return this.db.findByName(pattern);
    }
    /**
     * Get all nodes in a file.
     */
    async findByFile(file) {
        if (!this.initialized)
            await this.initialize();
        return this.db.getNodesByFile(file);
    }
    /**
     * Get all exported symbols.
     */
    async findExported() {
        if (!this.initialized)
            await this.initialize();
        return this.db.getExported();
    }
    /**
     * Get impact radius: what would break if this node changes?
     */
    async getImpactRadius(nodeId, depth) {
        if (!this.initialized)
            await this.initialize();
        return this.db.getImpactRadius(nodeId, depth);
    }
    /**
     * Get graph statistics.
     */
    async stats() {
        if (!this.initialized)
            await this.initialize();
        return this.db.stats();
    }
    /**
     * Close the database connection.
     */
    close() {
        this.db.close();
    }
    /**
     * Get the underlying GraphDB instance (for advanced usage).
     */
    getDB() {
        return this.db;
    }
    // ─── Private Helpers ─────────────────────────────────────────────────────
    /**
     * Recursively find all TypeScript files in the repository.
     */
    findTypeScriptFiles(dir, results = []) {
        if (!existsSync(dir))
            return results;
        // Skip node_modules and .git
        const skipDirs = ["node_modules", ".git", ".cocapn", "dist", "build"];
        if (skipDirs.some((skip) => dir.endsWith(skip))) {
            return results;
        }
        try {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    this.findTypeScriptFiles(fullPath, results);
                }
                else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
                    // Skip test files for now (can add option later)
                    if (!entry.name.endsWith(".test.ts") && !entry.name.endsWith(".spec.ts")) {
                        results.push(fullPath);
                    }
                }
            }
        }
        catch (error) {
            // Skip directories we can't read
        }
        return results;
    }
}
// ─── Convenience Factory ─────────────────────────────────────────────────────
/**
 * Create and initialize a RepoGraph instance.
 */
export async function createRepoGraph(repoRoot, dbPath) {
    const graph = new RepoGraph(repoRoot, dbPath);
    await graph.initialize();
    return graph;
}
//# sourceMappingURL=index.js.map