/**
 * Settings Manager — Persistent settings that survive bridge restarts.
 *
 * Settings are stored in ~/.cocapn/settings.json and can be overridden by
 * environment variables (COCAPN_*). Environment variables take precedence.
 *
 * Integration:
 * - BridgeServer reads settings on startup via SettingsManager
 * - WebSocket GET_SETTINGS returns current settings (API keys masked)
 * - WebSocket UPDATE_SETTINGS allows runtime changes
 * - Changes are persisted to disk immediately
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { EventEmitter } from "events";
// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------
const DEFAULT_SETTINGS = {
    // Bridge
    port: 3100,
    host: "localhost",
    // Cloud
    cloudMode: "local",
    workerUrl: undefined,
    apiKey: undefined,
    fleetJwtSecret: undefined,
    // AI
    defaultModel: "deepseek-chat",
    maxTokens: 4096,
    temperature: 0.7,
    // Search
    embeddingProvider: "local",
    openaiApiKey: undefined,
    hybridSearchAlpha: 0.5,
    // Skills
    autoLoadSkills: true,
    skillMemoryBudget: 100,
    maxLoadedSkills: 10,
    // Context
    defaultContextBudget: "medium",
    // Memory
    brainPath: join(homedir(), ".cocapn", "brain"),
    autoSaveMemory: true,
    // Templates
    templateDir: join(homedir(), ".cocapn", "templates"),
    registryUrl: undefined,
};
// ---------------------------------------------------------------------------
// Environment Variable Mapping
// ---------------------------------------------------------------------------
const ENV_VAR_MAPPING = {
    COCAPN_PORT: "port",
    COCAPN_HOST: "host",
    COCAPN_CLOUD_MODE: "cloudMode",
    COCAPN_WORKER_URL: "workerUrl",
    COCAPN_API_KEY: "apiKey",
    COCAPN_FLEET_JWT_SECRET: "fleetJwtSecret",
    COCAPN_DEFAULT_MODEL: "defaultModel",
    COCAPN_MAX_TOKENS: "maxTokens",
    COCAPN_TEMPERATURE: "temperature",
    COCAPN_EMBEDDING_PROVIDER: "embeddingProvider",
    COCAPN_OPENAI_API_KEY: "openaiApiKey",
    COCAPN_HYBRID_SEARCH_ALPHA: "hybridSearchAlpha",
    COCAPN_AUTO_LOAD_SKILLS: "autoLoadSkills",
    COCAPN_SKILL_MEMORY_BUDGET: "skillMemoryBudget",
    COCAPN_MAX_LOADED_SKILLS: "maxLoadedSkills",
    COCAPN_DEFAULT_CONTEXT_BUDGET: "defaultContextBudget",
    COCAPN_BRAIN_PATH: "brainPath",
    COCAPN_AUTO_SAVE_MEMORY: "autoSaveMemory",
    COCAPN_TEMPLATE_DIR: "templateDir",
    COCAPN_REGISTRY_URL: "registryUrl",
};
/**
 * Manages persistent settings with file storage and environment variable overrides.
 */
export class SettingsManager extends EventEmitter {
    configPath;
    settings;
    changeListeners = [];
    constructor(configPath) {
        super();
        this.configPath = configPath ?? join(homedir(), ".cocapn", "settings.json");
        this.settings = { ...DEFAULT_SETTINGS };
    }
    /**
     * Get a single setting value.
     */
    get(key) {
        return this.settings[key];
    }
    /**
     * Set a single setting value and persist to disk.
     */
    set(key, value) {
        const oldValue = this.settings[key];
        // Only notify and save if value changed
        if (oldValue !== value) {
            this.settings[key] = value;
            // Notify listeners
            this.notifyChange({ [key]: value });
            // Persist to disk
            void this.save();
        }
    }
    /**
     * Get all settings (with env vars applied).
     */
    getAll() {
        return this.applyEnvOverrides({ ...this.settings });
    }
    /**
     * Load settings from file.
     */
    async load() {
        if (!existsSync(this.configPath)) {
            // Create default settings file
            await this.save();
            return;
        }
        try {
            const raw = readFileSync(this.configPath, "utf-8");
            const loaded = JSON.parse(raw);
            // Merge with defaults
            this.settings = this.mergeWithDefaults(loaded);
        }
        catch (err) {
            console.warn(`[settings] Failed to load ${this.configPath}:`, err);
            // Keep defaults
        }
    }
    /**
     * Save current settings to file.
     */
    async save() {
        try {
            const dir = dirname(this.configPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            // Save without env overrides (only persisted values)
            writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2), "utf-8");
        }
        catch (err) {
            console.error(`[settings] Failed to save ${this.configPath}:`, err);
            throw err;
        }
    }
    /**
     * Merge partial settings into current settings.
     */
    merge(partial) {
        const changes = {};
        for (const [key, value] of Object.entries(partial)) {
            const typedKey = key;
            if (value !== undefined && this.settings[typedKey] !== value) {
                this.settings[typedKey] = value;
                changes[typedKey] = value;
            }
        }
        if (Object.keys(changes).length > 0) {
            this.notifyChange(changes);
            void this.save();
        }
    }
    /**
     * Validate settings and return any errors.
     */
    validate() {
        const errors = [];
        const warnings = [];
        // Validate port
        if (this.settings.port < 1 || this.settings.port > 65535) {
            errors.push("Port must be between 1 and 65535");
        }
        // Validate temperature
        if (this.settings.temperature < 0 || this.settings.temperature > 2) {
            errors.push("Temperature must be between 0 and 2");
        }
        // Validate maxTokens
        if (this.settings.maxTokens < 1) {
            errors.push("maxTokens must be positive");
        }
        // Validate hybridSearchAlpha
        if (this.settings.hybridSearchAlpha < 0 || this.settings.hybridSearchAlpha > 1) {
            errors.push("hybridSearchAlpha must be between 0 and 1");
        }
        // Validate skillMemoryBudget
        if (this.settings.skillMemoryBudget < 1) {
            errors.push("skillMemoryBudget must be positive");
        }
        // Validate maxLoadedSkills
        if (this.settings.maxLoadedSkills < 1) {
            errors.push("maxLoadedSkills must be positive");
        }
        // Warnings for missing API keys (not errors)
        if (!this.settings.apiKey) {
            warnings.push("No API key configured — AI features will be limited");
        }
        if (this.settings.embeddingProvider === "openai" && !this.settings.openaiApiKey) {
            warnings.push("Embedding provider is 'openai' but no OpenAI API key is configured");
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }
    /**
     * Get settings as a safe string (API keys masked).
     */
    toSafeString() {
        const safe = this.maskSensitiveFields({ ...this.settings });
        return JSON.stringify(safe, null, 2);
    }
    /**
     * Register a callback for settings changes.
     */
    onDidChange(callback) {
        this.changeListeners.push(callback);
    }
    /**
     * Remove a change listener.
     */
    removeChangeListener(callback) {
        const index = this.changeListeners.indexOf(callback);
        if (index !== -1) {
            this.changeListeners.splice(index, 1);
        }
    }
    // ---------------------------------------------------------------------------
    // Private Methods
    // ---------------------------------------------------------------------------
    mergeWithDefaults(partial) {
        return {
            ...DEFAULT_SETTINGS,
            ...partial,
        };
    }
    applyEnvOverrides(settings) {
        const result = { ...settings };
        for (const [envVar, key] of Object.entries(ENV_VAR_MAPPING)) {
            const envValue = process.env[envVar];
            if (envValue !== undefined) {
                result[key] = this.parseEnvValue(envValue, key);
            }
        }
        return result;
    }
    parseEnvValue(value, key) {
        // Boolean values
        if (key === "autoLoadSkills" || key === "autoSaveMemory") {
            return (value.toLowerCase() === "true" || value === "1");
        }
        // Number values
        if (key === "port" || key === "maxTokens" || key === "temperature" ||
            key === "hybridSearchAlpha" || key === "skillMemoryBudget" || key === "maxLoadedSkills") {
            const num = parseFloat(value);
            return (isNaN(num) ? DEFAULT_SETTINGS[key] : num);
        }
        // String values (pass through)
        return value;
    }
    maskSensitiveFields(settings) {
        const masked = { ...settings };
        // Mask API keys
        if (masked.apiKey) {
            masked.apiKey = this.maskValue(masked.apiKey);
        }
        if (masked.openaiApiKey) {
            masked.openaiApiKey = this.maskValue(masked.openaiApiKey);
        }
        if (masked.fleetJwtSecret) {
            masked.fleetJwtSecret = this.maskValue(masked.fleetJwtSecret);
        }
        return masked;
    }
    maskValue(value) {
        if (value.length <= 8) {
            return "***";
        }
        return `${value.slice(0, 4)}...${value.slice(-4)}`;
    }
    notifyChange(changes) {
        const event = {
            settings: this.getAll(),
            changes,
        };
        for (const listener of this.changeListeners) {
            try {
                listener(event);
            }
            catch (err) {
                console.error("[settings] Change listener error:", err);
            }
        }
        // Also emit EventEmitter style
        this.emit("change", event);
    }
}
// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------
export { DEFAULT_SETTINGS };
//# sourceMappingURL=index.js.map