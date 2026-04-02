/**
 * McpServerRegistry — manages MCP server configurations.
 *
 * Stores server configs in ~/.cocapn/mcp-servers.json and provides
 * methods to register, list, and retrieve MCP server configurations.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
// ---------------------------------------------------------------------------
// McpServerRegistry
// ---------------------------------------------------------------------------
const CONFIG_DIR = join(homedir(), ".cocapn");
const CONFIG_FILE = join(CONFIG_DIR, "mcp-servers.json");
export class McpServerRegistry {
    configPath;
    config;
    constructor(configPath = CONFIG_FILE) {
        this.configPath = configPath;
        this.config = this.loadConfig();
    }
    /**
     * Load the configuration from disk.
     */
    loadConfig() {
        if (!existsSync(this.configPath)) {
            // Create default config
            const defaultConfig = { servers: {} };
            this.ensureConfigDir();
            writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2), "utf8");
            return defaultConfig;
        }
        try {
            const content = readFileSync(this.configPath, "utf8");
            const parsed = JSON.parse(content);
            // Validate the structure
            if (!parsed.servers || typeof parsed.servers !== "object") {
                throw new Error("Invalid config: missing or invalid 'servers' object");
            }
            return parsed;
        }
        catch (error) {
            throw new Error(`Failed to load MCP servers config from ${this.configPath}: ${error}`);
        }
    }
    /**
     * Save the configuration to disk.
     */
    saveConfig() {
        this.ensureConfigDir();
        writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf8");
    }
    /**
     * Ensure the config directory exists.
     */
    ensureConfigDir() {
        const configDir = this.configPath.substring(0, this.configPath.lastIndexOf("/"));
        if (!existsSync(configDir)) {
            mkdirSync(configDir, { recursive: true });
        }
    }
    /**
     * Register a new MCP server.
     */
    registerServer(entry) {
        if (!entry.name) {
            throw new Error("McpServerRegistry: server entry must have a name");
        }
        if (!entry.transport) {
            throw new Error("McpServerRegistry: server entry must have a transport config");
        }
        this.config.servers[entry.name] = entry;
        this.saveConfig();
    }
    /**
     * Unregister an MCP server.
     */
    unregisterServer(name) {
        if (!this.config.servers[name]) {
            return false;
        }
        delete this.config.servers[name];
        this.saveConfig();
        return true;
    }
    /**
     * Get a server configuration by name.
     */
    getServer(name) {
        return this.config.servers[name] ?? null;
    }
    /**
     * List all registered server names.
     */
    listServerNames() {
        return Object.keys(this.config.servers);
    }
    /**
     * List all server entries.
     */
    listServers() {
        return Object.values(this.config.servers);
    }
    /**
     * List only enabled servers.
     */
    listEnabledServers() {
        return Object.values(this.config.servers).filter((entry) => entry.enabled !== false);
    }
    /**
     * Update a server configuration.
     */
    updateServer(name, updates) {
        const existing = this.config.servers[name];
        if (!existing) {
            return false;
        }
        this.config.servers[name] = {
            ...existing,
            ...updates,
        };
        this.saveConfig();
        return true;
    }
    /**
     * Enable or disable a server.
     */
    setServerEnabled(name, enabled) {
        return this.updateServer(name, { enabled });
    }
    /**
     * Check if a server exists.
     */
    hasServer(name) {
        return name in this.config.servers;
    }
    /**
     * Get the number of registered servers.
     */
    getServerCount() {
        return Object.keys(this.config.servers).length;
    }
    /**
     * Clear all server configurations.
     */
    clear() {
        this.config.servers = {};
        this.saveConfig();
    }
    /**
     * Reload the configuration from disk.
     */
    reload() {
        this.config = this.loadConfig();
    }
}
// ---------------------------------------------------------------------------
// Convenience functions
// ---------------------------------------------------------------------------
/**
 * Get the default registry instance.
 */
let defaultRegistry = null;
export function getRegistry() {
    if (!defaultRegistry) {
        defaultRegistry = new McpServerRegistry();
    }
    return defaultRegistry;
}
/**
 * Register a server using the default registry.
 */
export function registerServer(entry) {
    getRegistry().registerServer(entry);
}
/**
 * List servers using the default registry.
 */
export function listServers() {
    return getRegistry().listServers();
}
/**
 * Get a server using the default registry.
 */
export function getServer(name) {
    return getRegistry().getServer(name);
}
//# sourceMappingURL=registry.js.map