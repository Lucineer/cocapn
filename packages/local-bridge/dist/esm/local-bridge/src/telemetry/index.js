/**
 * Opt-in Telemetry — privacy-first anonymous usage tracking.
 *
 * Key privacy guarantees:
 * - Off by default — user must explicitly enable
 * - No PII (no messages, code, file contents, API keys)
 * - Anonymous session IDs
 * - Respects DO_NOT_TRACK env var
 * - All data aggregated, never individual
 * - Events stored locally in JSONL until flushed
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { homedir, platform, release, arch } from "os";
import { randomUUID } from "crypto";
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_ENDPOINT = "https://telemetry.cocapn.dev/v1/events";
const MAX_BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 60_000; // 1 minute
const SETTINGS_FILE = "settings.json";
const QUEUE_FILE = "telemetry.jsonl";
const SESSION_ID_FILE = "session-id";
const VERSION = "0.1.0";
// ---------------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------------
export class Telemetry {
    enabled;
    endpoint;
    sessionId;
    queue = [];
    queuePath;
    flushTimer;
    flushing = false;
    constructor(config) {
        const cocapnDir = join(homedir(), ".cocapn");
        this.queuePath = config?.queuePath ?? join(cocapnDir, QUEUE_FILE);
        // Determine enabled state: DO_NOT_TRACK wins, then explicit param, then settings file
        if (process.env.DO_NOT_TRACK === "1" || process.env.DO_NOT_TRACK === "true") {
            this.enabled = false;
        }
        else if (config?.enabled !== undefined) {
            this.enabled = config.enabled;
        }
        else {
            this.enabled = this.loadSetting("telemetryEnabled") === true;
        }
        this.endpoint = config?.endpoint ?? DEFAULT_ENDPOINT;
        this.sessionId = config?.sessionId ?? this.loadOrCreateSessionId(cocapnDir);
        // Load any queued events from disk
        this.loadQueue();
        // Start periodic flush if enabled
        if (this.enabled) {
            this.startFlushTimer();
        }
    }
    /**
     * Track an event. If telemetry is disabled, this is a no-op.
     */
    track(event, properties) {
        if (!this.enabled)
            return;
        // Sanitize properties — strip potential PII
        const sanitized = this.sanitizeProperties(properties ?? {});
        const telemetryEvent = {
            event,
            properties: sanitized,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            version: VERSION,
        };
        this.queue.push(telemetryEvent);
        this.persistQueue();
        // Flush immediately if batch is full
        if (this.queue.length >= MAX_BATCH_SIZE) {
            void this.flush();
        }
    }
    /**
     * Flush queued events to the endpoint. Non-blocking — errors are silently caught.
     */
    async flush() {
        if (!this.enabled || this.flushing || this.queue.length === 0)
            return;
        this.flushing = true;
        // Take up to MAX_BATCH_SIZE events
        const batch = this.queue.splice(0, MAX_BATCH_SIZE);
        try {
            const response = await fetch(this.endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ events: batch }),
            });
            if (!response.ok) {
                // Re-queue on failure — put events back at front
                this.queue.unshift(...batch);
            }
            else {
                this.persistQueue();
            }
        }
        catch {
            // Network error — re-queue events
            this.queue.unshift(...batch);
            this.persistQueue();
        }
        finally {
            this.flushing = false;
        }
    }
    /**
     * Enable telemetry and persist the setting.
     */
    enable() {
        if (this.enabled)
            return;
        this.enabled = true;
        this.saveSetting("telemetryEnabled", true);
        this.startFlushTimer();
    }
    /**
     * Disable telemetry, flush remaining events, persist setting.
     */
    async disable() {
        if (!this.enabled)
            return;
        this.enabled = false;
        this.stopFlushTimer();
        await this.flush(); // Send any remaining events
        this.queue = [];
        this.clearQueueFile();
        this.saveSetting("telemetryEnabled", false);
    }
    /**
     * Check if telemetry is enabled.
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Get the current queue length.
     */
    getQueueLength() {
        return this.queue.length;
    }
    /**
     * Stop the flush timer and clear the queue. For shutdown.
     */
    async shutdown() {
        this.stopFlushTimer();
        if (this.enabled) {
            await this.flush();
        }
    }
    // ---------------------------------------------------------------------------
    // Private
    // ---------------------------------------------------------------------------
    sanitizeProperties(props) {
        const sanitized = {};
        // Fields that are always safe
        const safeKeys = new Set([
            "version", "nodeVersion", "platform", "arch", "template",
            "model", "tokenCount", "responseTime", "skillName", "skillType",
            "pluginName", "pluginSource", "approachesTried", "winner",
            "errorType", "success",
        ]);
        for (const [key, value] of Object.entries(props)) {
            if (safeKeys.has(key)) {
                sanitized[key] = value;
            }
            // Drop unknown keys to prevent accidental PII leakage
        }
        return sanitized;
    }
    loadOrCreateSessionId(cocapnDir) {
        const path = join(cocapnDir, SESSION_ID_FILE);
        if (existsSync(path)) {
            try {
                return readFileSync(path, "utf-8").trim();
            }
            catch {
                // Fall through to create new
            }
        }
        const id = randomUUID();
        try {
            if (!existsSync(cocapnDir)) {
                mkdirSync(cocapnDir, { recursive: true });
            }
            writeFileSync(path, id, "utf-8");
        }
        catch {
            // Non-fatal if we can't persist
        }
        return id;
    }
    loadQueue() {
        if (!existsSync(this.queuePath))
            return;
        try {
            const raw = readFileSync(this.queuePath, "utf-8");
            const lines = raw.split("\n").filter((l) => l.trim().length > 0);
            for (const line of lines) {
                try {
                    this.queue.push(JSON.parse(line));
                }
                catch {
                    // Skip malformed lines
                }
            }
        }
        catch {
            // Non-fatal
        }
    }
    persistQueue() {
        try {
            const dir = dirname(this.queuePath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            const content = this.queue.map((e) => JSON.stringify(e)).join("\n");
            writeFileSync(this.queuePath, content, "utf-8");
        }
        catch {
            // Non-fatal — if we can't persist, events stay in memory
        }
    }
    clearQueueFile() {
        if (existsSync(this.queuePath)) {
            try {
                unlinkSync(this.queuePath);
            }
            catch {
                // Non-fatal
            }
        }
    }
    startFlushTimer() {
        this.stopFlushTimer();
        this.flushTimer = setInterval(() => {
            void this.flush();
        }, FLUSH_INTERVAL_MS);
    }
    stopFlushTimer() {
        if (this.flushTimer !== undefined) {
            clearInterval(this.flushTimer);
            this.flushTimer = undefined;
        }
    }
    loadSetting(key) {
        const path = join(homedir(), ".cocapn", SETTINGS_FILE);
        if (!existsSync(path))
            return undefined;
        try {
            const raw = readFileSync(path, "utf-8");
            const settings = JSON.parse(raw);
            return settings[key];
        }
        catch {
            return undefined;
        }
    }
    saveSetting(key, value) {
        const path = join(homedir(), ".cocapn", SETTINGS_FILE);
        let settings = {};
        if (existsSync(path)) {
            try {
                settings = JSON.parse(readFileSync(path, "utf-8"));
            }
            catch {
                // Use empty settings
            }
        }
        settings[key] = value;
        try {
            const dir = dirname(path);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(path, JSON.stringify(settings, null, 2), "utf-8");
        }
        catch {
            // Non-fatal
        }
    }
}
// ---------------------------------------------------------------------------
// Convenience: build common event properties
// ---------------------------------------------------------------------------
export function getSystemProperties() {
    return {
        version: VERSION,
        nodeVersion: process.version,
        platform: platform(),
        arch: arch(),
        osRelease: release(),
    };
}
//# sourceMappingURL=index.js.map