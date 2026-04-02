/**
 * Structured logger for the local-bridge.
 *
 * Behaviour:
 *   COCAPN_LOG_FORMAT=json  → JSON-lines to stdout
 *   (default)               → human-readable "[module] level: msg  key=val …"
 *
 * Usage:
 *   import { createLogger } from "./logger.js";
 *   const log = createLogger("ws");
 *   log.info("Client connected", { clientId: "abc" });
 */
// ─── Logger class ─────────────────────────────────────────────────────────────
export class Logger {
    module;
    json;
    constructor(module) {
        this.module = module;
        this.json = process.env["COCAPN_LOG_FORMAT"] === "json";
    }
    info(msg, data) {
        this.emit("info", msg, undefined, data);
    }
    warn(msg, data) {
        this.emit("warn", msg, undefined, data);
    }
    error(msg, err, data) {
        this.emit("error", msg, err, data);
    }
    debug(msg, data) {
        this.emit("debug", msg, undefined, data);
    }
    // ── Private ──────────────────────────────────────────────────────────────────
    emit(level, msg, err, data) {
        if (this.json) {
            this.emitJson(level, msg, err, data);
        }
        else {
            this.emitHuman(level, msg, err, data);
        }
    }
    emitJson(level, msg, err, data) {
        const entry = {
            ts: new Date().toISOString(),
            level,
            module: this.module,
            msg,
            ...data,
        };
        if (err !== undefined) {
            if (err instanceof Error) {
                entry["error"] = err.message;
                if (err.stack)
                    entry["stack"] = err.stack;
            }
            else {
                entry["error"] = String(err);
            }
        }
        process.stdout.write(JSON.stringify(entry) + "\n");
    }
    emitHuman(level, msg, err, data) {
        const prefix = `[${this.module}]`;
        let line = `${prefix} ${level}: ${msg}`;
        if (data && Object.keys(data).length > 0) {
            const pairs = Object.entries(data)
                .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                .join("  ");
            line += `  ${pairs}`;
        }
        if (err !== undefined) {
            const errStr = err instanceof Error ? err.message : String(err);
            line += `  error=${errStr}`;
            if (err instanceof Error && err.stack) {
                line += `\n${err.stack}`;
            }
        }
        if (level === "error" || level === "warn") {
            process.stderr.write(line + "\n");
        }
        else {
            process.stdout.write(line + "\n");
        }
    }
}
// ─── Factory & singleton ──────────────────────────────────────────────────────
/**
 * Create a named Logger instance.
 */
export function createLogger(module) {
    return new Logger(module);
}
/**
 * Default singleton logger tagged as "bridge".
 * Import this for quick ad-hoc logging in the main process.
 */
export const logger = createLogger("bridge");
//# sourceMappingURL=logger.js.map