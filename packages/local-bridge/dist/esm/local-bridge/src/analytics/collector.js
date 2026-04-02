/**
 * Analytics Event Collector — tracks and stores analytics events.
 *
 * Uses SQLite (better-sqlite3) for persistent event storage with automatic
 * rotation of old events (keeps last 30 days by default).
 */
import Database from "better-sqlite3";
// ---------------------------------------------------------------------------
// AnalyticsCollector
// ---------------------------------------------------------------------------
/**
 * Collects and manages analytics events with SQLite persistence.
 */
export class AnalyticsCollector {
    db;
    retentionDays;
    nextId = 0;
    constructor(options = {}) {
        this.retentionDays = options.retentionDays ?? 30;
        const dbPath = options.dbPath ?? ":memory:";
        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        this.initializeSchema();
        // Load next ID from database
        const row = this.db.prepare("SELECT MAX(id) as maxId FROM events").get();
        if (row?.maxId !== null) {
            this.nextId = row.maxId + 1;
        }
        // Rotate old events on startup
        this.rotateOldEvents();
    }
    // -------------------------------------------------------------------------
    // Schema Management
    // -------------------------------------------------------------------------
    /**
     * Initialize the database schema.
     */
    initializeSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        data TEXT NOT NULL,
        sessionId TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_session ON events(sessionId);
    `);
    }
    // -------------------------------------------------------------------------
    // Event Recording
    // -------------------------------------------------------------------------
    /**
     * Track an analytics event.
     * @returns The event ID
     */
    track(type, data, sessionId) {
        const id = this.nextId++;
        const timestamp = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO events (id, type, timestamp, data, sessionId)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(id, type, timestamp, JSON.stringify(data), sessionId ?? null);
        return `event-${id}`;
    }
    /**
     * Track a chat message event.
     */
    trackChat(data, sessionId) {
        return this.track("chat", data, sessionId);
    }
    /**
     * Track a skill load event.
     */
    trackSkillLoad(data, sessionId) {
        return this.track("skill_load", data, sessionId);
    }
    /**
     * Track a skill use event.
     */
    trackSkillUse(data, sessionId) {
        return this.track("skill_use", data, sessionId);
    }
    /**
     * Track a tree search event.
     */
    trackTreeSearch(data, sessionId) {
        return this.track("tree_search", data, sessionId);
    }
    /**
     * Track a token usage event.
     */
    trackTokenUsage(data, sessionId) {
        return this.track("token_usage", data, sessionId);
    }
    /**
     * Track an error event.
     */
    trackError(data, sessionId) {
        return this.track("error", data, sessionId);
    }
    /**
     * Track a module install event.
     */
    trackModuleInstall(data, sessionId) {
        return this.track("module_install", data, sessionId);
    }
    /**
     * Track a task completion event.
     */
    trackTaskComplete(data, sessionId) {
        return this.track("task_complete", data, sessionId);
    }
    // -------------------------------------------------------------------------
    // Event Querying
    // -------------------------------------------------------------------------
    /**
     * Get events matching the given filter.
     */
    getEvents(filter) {
        let query = "SELECT * FROM events WHERE 1=1";
        const params = [];
        if (filter?.types && filter.types.length > 0) {
            const placeholders = filter.types.map(() => "?").join(",");
            query += ` AND type IN (${placeholders})`;
            params.push(...filter.types);
        }
        if (filter?.since !== undefined) {
            query += " AND timestamp >= ?";
            params.push(filter.since);
        }
        if (filter?.until !== undefined) {
            query += " AND timestamp <= ?";
            params.push(filter.until);
        }
        if (filter?.sessionId !== undefined) {
            query += " AND sessionId = ?";
            params.push(filter.sessionId);
        }
        query += " ORDER BY timestamp DESC";
        if (filter?.limit !== undefined) {
            query += " LIMIT ?";
            params.push(filter.limit);
        }
        const rows = this.db.prepare(query).all(...params);
        return rows.map((row) => ({
            id: `event-${row.id}`,
            type: row.type,
            timestamp: row.timestamp,
            data: JSON.parse(row.data),
            ...(row.sessionId !== null ? { sessionId: row.sessionId } : {}),
        }));
    }
    /**
     * Get events for a specific time period.
     */
    getEventsInPeriod(period) {
        return this.getEvents({
            since: period.start,
            until: period.end,
        });
    }
    /**
     * Get events by type.
     */
    getEventsByType(type, limit) {
        return this.getEvents({ types: [type], limit });
    }
    // -------------------------------------------------------------------------
    // Aggregation
    // -------------------------------------------------------------------------
    /**
     * Generate a usage report for a time period.
     */
    aggregate(period) {
        const events = this.getEventsInPeriod(period);
        if (events.length === 0) {
            return this.emptyReport(period);
        }
        // Count by type
        const byType = new Map();
        // Track skills
        const skills = new Map();
        // Track intents
        const intents = new Map();
        // Track modules
        const modules = new Map();
        // Track errors
        let errorCount = 0;
        const errorTypes = new Map();
        // Track tokens
        let tokensUsed = 0;
        let tokensWasted = 0;
        // Track latency
        const latencies = [];
        // Track active sessions
        const sessions = new Set();
        // Track tasks
        const tasks = new Map();
        for (const event of events) {
            // Count by type
            byType.set(event.type, (byType.get(event.type) ?? 0) + 1);
            // Track sessions
            if (event.sessionId) {
                sessions.add(event.sessionId);
            }
            // Type-specific processing
            switch (event.type) {
                case "skill_use": {
                    const skillName = event.data.skillName;
                    if (skillName) {
                        skills.set(skillName, (skills.get(skillName) ?? 0) + 1);
                    }
                    break;
                }
                case "skill_load": {
                    const skillName = event.data.skillName;
                    if (skillName) {
                        skills.set(skillName, (skills.get(skillName) ?? 0) + 1);
                    }
                    break;
                }
                case "chat": {
                    const intent = event.data.intent;
                    if (intent) {
                        intents.set(intent, (intents.get(intent) ?? 0) + 1);
                    }
                    const latency = event.data.latency;
                    if (latency !== undefined) {
                        latencies.push(latency);
                    }
                    break;
                }
                case "module_install": {
                    const moduleName = event.data.moduleName;
                    if (moduleName) {
                        modules.set(moduleName, (modules.get(moduleName) ?? 0) + 1);
                    }
                    break;
                }
                case "error": {
                    errorCount++;
                    const errorType = event.data.errorType;
                    if (errorType) {
                        errorTypes.set(errorType, (errorTypes.get(errorType) ?? 0) + 1);
                    }
                    break;
                }
                case "token_usage": {
                    const tokensIn = event.data.tokensIn ?? 0;
                    const tokensOut = event.data.tokensOut ?? 0;
                    tokensUsed += tokensIn + tokensOut;
                    // Estimate waste (e.g., if failed tasks consumed tokens)
                    const success = event.data.success ?? true;
                    if (!success) {
                        tokensWasted += tokensIn + tokensOut;
                    }
                    break;
                }
                case "task_complete": {
                    const taskType = event.data.taskType;
                    if (taskType) {
                        tasks.set(taskType, (tasks.get(taskType) ?? 0) + 1);
                    }
                    const duration = event.data.duration;
                    if (duration !== undefined) {
                        latencies.push(duration);
                    }
                    break;
                }
            }
        }
        // Calculate averages
        const avgLatency = latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : 0;
        // Build top lists
        const topSkills = this.buildTopList(skills, 10);
        const topIntents = this.buildTopList(intents, 10);
        const topModules = this.buildTopList(modules, 10);
        // Build task breakdown
        const taskBreakdown = {};
        tasks.forEach((count, type) => {
            taskBreakdown[type] = count;
        });
        return {
            period,
            totalRequests: events.length,
            tokensUsed,
            tokensWasted,
            topSkills,
            topIntents,
            topModules,
            errors: errorCount,
            avgLatency,
            activeUsers: sessions.size,
            taskBreakdown,
        };
    }
    // -------------------------------------------------------------------------
    // Maintenance
    // -------------------------------------------------------------------------
    /**
     * Rotate old events (delete events older than retention period).
     */
    rotateOldEvents() {
        const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
        const stmt = this.db.prepare("DELETE FROM events WHERE timestamp < ?");
        const result = stmt.run(cutoff);
        return result.changes;
    }
    /**
     * Get event count statistics.
     */
    getStats() {
        const totalRow = this.db.prepare("SELECT COUNT(*) as count FROM events").get();
        const typeRows = this.db.prepare("SELECT type, COUNT(*) as count FROM events GROUP BY type").all();
        const oldestRow = this.db.prepare("SELECT MIN(timestamp) as oldest FROM events").get();
        const newestRow = this.db.prepare("SELECT MAX(timestamp) as newest FROM events").get();
        const eventsByType = {};
        for (const row of typeRows) {
            eventsByType[row.type] = row.count;
        }
        return {
            totalEvents: totalRow.count,
            eventsByType,
            oldestEvent: oldestRow.oldest,
            newestEvent: newestRow.newest,
        };
    }
    /**
     * Clear all events.
     */
    clear() {
        this.db.prepare("DELETE FROM events").run();
        this.nextId = 0;
    }
    /**
     * Close the database connection.
     */
    close() {
        this.db.close();
    }
    // -------------------------------------------------------------------------
    // Private Helpers
    // -------------------------------------------------------------------------
    buildTopList(items, limit) {
        return Array.from(items.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }
    emptyReport(period) {
        return {
            period,
            totalRequests: 0,
            tokensUsed: 0,
            tokensWasted: 0,
            topSkills: [],
            topIntents: [],
            topModules: [],
            errors: 0,
            avgLatency: 0,
            activeUsers: 0,
            taskBreakdown: {},
        };
    }
}
//# sourceMappingURL=collector.js.map