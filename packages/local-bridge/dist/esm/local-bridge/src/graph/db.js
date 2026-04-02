/**
 * Graph Database — SQLite storage for the repo knowledge graph.
 *
 * Provides efficient storage and querying of code structure:
 * - Nodes and edges stored in SQLite tables
 * - Indexes for fast lookups
 * - Impact analysis using graph traversal
 * - Dependency tracking
 */
import Database from "better-sqlite3";
import { dirname } from "path";
import { mkdirSync, existsSync } from "fs";
// ─── Graph DB ────────────────────────────────────────────────────────────────
export class GraphDB {
    db = null;
    dbPath;
    initialized = false;
    constructor(dbPath) {
        this.dbPath = dbPath;
        // Don't create database here - wait for initialize()
    }
    ensureDb() {
        if (!this.db) {
            throw new Error("GraphDB not initialized. Call initialize() first.");
        }
        return this.db;
    }
    /**
     * Initialize database schema.
     */
    async initialize() {
        if (this.initialized)
            return;
        // Ensure directory exists
        const dir = dirname(this.dbPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        // Create database connection
        this.db = new Database(this.dbPath);
        this.db.pragma("journal_mode = WAL");
        // Create nodes table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS graph_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        file TEXT NOT NULL,
        start_line INTEGER,
        end_line INTEGER,
        docs TEXT,
        signature TEXT
      );
    `);
        // Create edges table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS graph_edges (
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        type TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        PRIMARY KEY (source, target, type)
      );
    `);
        // Create indexes for fast lookups
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_nodes_file ON graph_nodes(file);
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON graph_nodes(type);
      CREATE INDEX IF NOT EXISTS idx_edges_source ON graph_edges(source);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON graph_edges(target);
      CREATE INDEX IF NOT EXISTS idx_edges_type ON graph_edges(type);
    `);
        this.initialized = true;
    }
    /**
     * Add nodes to the database.
     */
    async addNodes(nodes) {
        if (!this.initialized)
            await this.initialize();
        const db = this.ensureDb();
        const insert = db.prepare(`
      INSERT OR REPLACE INTO graph_nodes (id, type, name, file, start_line, end_line, docs, signature)
      VALUES (@id, @type, @name, @file, @startLine, @endLine, @docs, @signature)
    `);
        const insertMany = db.transaction((nodes) => {
            for (const node of nodes) {
                insert.run({
                    id: node.id,
                    type: node.type,
                    name: node.name,
                    file: node.file,
                    startLine: node.startLine ?? null,
                    endLine: node.endLine ?? null,
                    docs: node.docs ?? null,
                    signature: node.signature ?? null,
                });
            }
        });
        insertMany(nodes);
    }
    /**
     * Add edges to the database.
     */
    async addEdges(edges) {
        if (!this.initialized)
            await this.initialize();
        const db = this.ensureDb();
        const insert = db.prepare(`
      INSERT OR REPLACE INTO graph_edges (source, target, type, weight)
      VALUES (@source, @target, @type, @weight)
    `);
        const insertMany = this.db.transaction((edges) => {
            for (const edge of edges) {
                insert.run({
                    source: edge.source,
                    target: edge.target,
                    type: edge.type,
                    weight: edge.weight ?? 1.0,
                });
            }
        });
        insertMany(edges);
    }
    /**
     * Remove all nodes and edges for a specific file.
     */
    async removeByFile(file) {
        if (!this.initialized)
            await this.initialize();
        const db = this.ensureDb();
        const removeNodes = db.prepare("DELETE FROM graph_nodes WHERE file = ?");
        const removeEdges = db.prepare("DELETE FROM graph_edges WHERE source LIKE ? OR target LIKE ?");
        const transact = db.transaction(() => {
            removeNodes.run(file);
            // Remove edges where source or target is in this file
            removeEdges.run(`${file}%`, `${file}%`);
        });
        transact();
    }
    /**
     * Get files that this file imports (direct dependencies).
     */
    async getDependencies(file) {
        if (!this.initialized)
            await this.initialize();
        const db = this.ensureDb();
        const rows = db.prepare(`
      SELECT DISTINCT target
      FROM graph_edges
      WHERE source = ? AND type = 'imports'
    `).all(file);
        return rows.map((r) => r.target);
    }
    /**
     * Get files that import this file (dependents).
     */
    async getDependents(file) {
        if (!this.initialized)
            await this.initialize();
        const db = this.ensureDb();
        const rows = db.prepare(`
      SELECT DISTINCT source
      FROM graph_edges
      WHERE target = ? AND type = 'imports'
    `).all(file);
        return rows.map((r) => r.source);
    }
    /**
     * Get all nodes in a file.
     */
    async getNodesByFile(file) {
        if (!this.initialized)
            await this.initialize();
        const db = this.ensureDb();
        const rows = db.prepare(`
      SELECT id, type, name, file, start_line, end_line, docs, signature
      FROM graph_nodes
      WHERE file = ?
    `).all(file);
        return rows.map((r) => ({
            id: r.id,
            type: r.type,
            name: r.name,
            file: r.file,
            startLine: r.start_line ?? undefined,
            endLine: r.end_line ?? undefined,
            docs: r.docs ?? undefined,
            signature: r.signature ?? undefined,
        }));
    }
    /**
     * Find nodes by name pattern (SQL LIKE).
     */
    async findByName(pattern) {
        if (!this.initialized)
            await this.initialize();
        const db = this.ensureDb();
        const rows = db.prepare(`
      SELECT id, type, name, file, start_line, end_line, docs, signature
      FROM graph_nodes
      WHERE name LIKE ?
      ORDER BY file, start_line
    `).all(`%${pattern}%`);
        return rows.map((r) => ({
            id: r.id,
            type: r.type,
            name: r.name,
            file: r.file,
            startLine: r.start_line ?? undefined,
            endLine: r.end_line ?? undefined,
            docs: r.docs ?? undefined,
            signature: r.signature ?? undefined,
        }));
    }
    /**
     * Get all exported symbols.
     */
    async getExported() {
        if (!this.initialized)
            await this.initialize();
        const db = this.ensureDb();
        const rows = db.prepare(`
      SELECT id, type, name, file, start_line, end_line, docs, signature
      FROM graph_nodes
      WHERE type = 'export'
      ORDER BY file, start_line
    `).all();
        return rows.map((r) => ({
            id: r.id,
            type: r.type,
            name: r.name,
            file: r.file,
            startLine: r.start_line ?? undefined,
            endLine: r.end_line ?? undefined,
            docs: r.docs ?? undefined,
            signature: r.signature ?? undefined,
        }));
    }
    /**
     * Get all nodes in the database.
     */
    async getAllNodes() {
        if (!this.initialized)
            await this.initialize();
        const db = this.ensureDb();
        const rows = db.prepare(`
      SELECT id, type, name, file, start_line, end_line, docs, signature
      FROM graph_nodes
      ORDER BY file, start_line
    `).all();
        return rows.map((r) => ({
            id: r.id,
            type: r.type,
            name: r.name,
            file: r.file,
            startLine: r.start_line ?? undefined,
            endLine: r.end_line ?? undefined,
            docs: r.docs ?? undefined,
            signature: r.signature ?? undefined,
        }));
    }
    /**
     * Get call graph for a function (what it calls).
     */
    async getCallGraph(functionId) {
        if (!this.initialized)
            await this.initialize();
        const db = this.ensureDb();
        const rows = db.prepare(`
      SELECT DISTINCT target
      FROM graph_edges
      WHERE source = ? AND type = 'calls'
    `).all(functionId);
        return rows.map((r) => r.target);
    }
    /**
     * Get reverse call graph (what calls this function).
     */
    async getReverseCallGraph(functionId) {
        if (!this.initialized)
            await this.initialize();
        const db = this.ensureDb();
        const rows = db.prepare(`
      SELECT DISTINCT source
      FROM graph_edges
      WHERE target = ? AND type = 'calls'
    `).all(functionId);
        return rows.map((r) => r.source);
    }
    /**
     * Get impact radius: what would break if this node changes?
     * Uses BFS traversal to find all dependent nodes up to a given depth.
     */
    async getImpactRadius(nodeId, depth = 3) {
        if (!this.initialized)
            await this.initialize();
        const db = this.ensureDb();
        const result = [];
        const visited = new Set();
        const queue = [{ id: nodeId, distance: 0 }];
        // First, get the node info for the root
        const rootNode = db.prepare(`
      SELECT id, type, name, file FROM graph_nodes WHERE id = ?
    `).get(nodeId);
        if (rootNode) {
            result.push({
                id: rootNode.id,
                type: rootNode.type,
                name: rootNode.name,
                file: rootNode.file,
                distance: 0,
            });
            visited.add(nodeId);
        }
        while (queue.length > 0) {
            const current = queue.shift();
            if (current.distance >= depth)
                continue;
            // Find all nodes that depend on the current node
            const dependents = db.prepare(`
        SELECT DISTINCT e.source AS id, n.type, n.name, n.file
        FROM graph_edges e
        JOIN graph_nodes n ON e.source = n.id
        WHERE e.target = ? AND e.type IN ('imports', 'calls', 'uses', 'extends', 'implements')
      `).all(current.id);
            for (const dep of dependents) {
                if (!visited.has(dep.id)) {
                    visited.add(dep.id);
                    result.push({
                        id: dep.id,
                        type: dep.type,
                        name: dep.name,
                        file: dep.file,
                        distance: current.distance + 1,
                    });
                    queue.push({ id: dep.id, distance: current.distance + 1 });
                }
            }
        }
        return result;
    }
    /**
     * Get graph statistics.
     */
    async stats() {
        if (!this.initialized)
            await this.initialize();
        const db = this.ensureDb();
        const nodeCount = db.prepare("SELECT COUNT(*) AS count FROM graph_nodes").get();
        const edgeCount = db.prepare("SELECT COUNT(*) AS count FROM graph_edges").get();
        const fileCount = db.prepare("SELECT COUNT(DISTINCT file) AS count FROM graph_nodes").get();
        const symbolCount = db.prepare("SELECT COUNT(*) AS count FROM graph_nodes WHERE type IN ('function', 'class', 'interface', 'variable')").get();
        return {
            nodes: nodeCount.count,
            edges: edgeCount.count,
            files: fileCount.count,
            symbols: symbolCount.count,
        };
    }
    /**
     * Clear all data (useful for rebuilding).
     */
    async clear() {
        if (!this.initialized)
            await this.initialize();
        const db = this.ensureDb();
        db.exec("DELETE FROM graph_nodes");
        db.exec("DELETE FROM graph_edges");
    }
    /**
     * Close database connection.
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
//# sourceMappingURL=db.js.map