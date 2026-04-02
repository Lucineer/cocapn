/**
 * Loads and merges bridge configuration from:
 *   1. Defaults (DEFAULT_CONFIG)
 *   2. cocapn/config.yml in the private repo root
 *   3. Environment variables (COCAPN_PORT, COCAPN_MODE, etc.)
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { DEFAULT_CONFIG } from "./types.js";
const BRIDGE_MODES = new Set(["local", "hybrid", "cloud"]);
function isBridgeMode(v) {
    return typeof v === "string" && BRIDGE_MODES.has(v);
}
/**
 * Load config from a private repo root directory.
 * Returns a fully-resolved BridgeConfig with all defaults applied.
 */
export function loadConfig(repoRoot) {
    const yamlPath = join(repoRoot, "cocapn", "config.yml");
    let fileConfig = {};
    if (existsSync(yamlPath)) {
        try {
            const raw = readFileSync(yamlPath, "utf8");
            fileConfig = parseYaml(raw) ?? {};
        }
        catch (err) {
            console.warn(`[bridge] Failed to parse ${yamlPath}:`, err);
        }
    }
    return mergeConfig(DEFAULT_CONFIG, fileConfig);
}
function mergeConfig(defaults, file) {
    const fileConfig = file;
    const mode = isBridgeMode(fileConfig.config?.mode)
        ? fileConfig.config.mode
        : defaults.config.mode;
    const port = typeof process.env["COCAPN_PORT"] === "string"
        ? parseInt(process.env["COCAPN_PORT"], 10)
        : typeof fileConfig.config?.port === "number"
            ? fileConfig.config.port
            : defaults.config.port;
    const tunnel = process.env["COCAPN_TUNNEL"] ?? fileConfig.config?.tunnel;
    return {
        soul: fileConfig.soul ?? defaults.soul,
        config: {
            mode: isBridgeMode(process.env["COCAPN_MODE"])
                ? process.env["COCAPN_MODE"]
                : mode,
            port: Number.isFinite(port) ? port : defaults.config.port,
            tunnel,
        },
        memory: {
            facts: fileConfig.memory?.facts ?? defaults.memory.facts,
            procedures: fileConfig.memory?.procedures ?? defaults.memory.procedures,
            relationships: fileConfig.memory?.relationships ?? defaults.memory.relationships,
        },
        encryption: {
            publicKey: fileConfig.encryption?.publicKey ?? defaults.encryption.publicKey,
            recipients: fileConfig.encryption?.recipients ?? defaults.encryption.recipients,
            encryptedPaths: fileConfig.encryption?.encryptedPaths ??
                defaults.encryption.encryptedPaths,
        },
        sync: {
            interval: fileConfig.sync?.interval ?? defaults.sync.interval,
            memoryInterval: fileConfig.sync?.memoryInterval ?? defaults.sync.memoryInterval,
            autoCommit: fileConfig.sync?.autoCommit ?? defaults.sync.autoCommit,
            autoPush: fileConfig.sync?.autoPush ?? defaults.sync.autoPush,
        },
    };
}
//# sourceMappingURL=loader.js.map