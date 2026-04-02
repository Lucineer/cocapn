/**
 * Deploy configuration loader
 *
 * Reads cocapn.json from project root and merges with:
 * - cocapn.{env}.json (environment-specific overrides)
 * - ~/.cocapn/deploy-settings.json (user settings)
 * - Default values
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
const DEFAULT_COMPATIBILITY_DATE = "2024-12-05";
const DEFAULT_REGION = "auto";
/**
 * Load deploy configuration from project directory
 */
export function loadDeployConfig(projectDir, env = "production") {
    // Load base configuration
    const configPath = join(projectDir, "cocapn.json");
    if (!existsSync(configPath)) {
        throw new Error(`Missing cocapn.json in ${projectDir}. Run 'cocapn init' first.`);
    }
    let config = JSON.parse(readFileSync(configPath, "utf-8"));
    // Validate required fields
    validateDeployConfig(config);
    // Load environment-specific overrides
    const envConfigPath = join(projectDir, `cocapn.${env}.json`);
    if (existsSync(envConfigPath)) {
        const envConfig = JSON.parse(readFileSync(envConfigPath, "utf-8"));
        config = mergeDeep(config, envConfig);
    }
    // Load user settings
    const settingsPath = join(homedir(), ".cocapn", "deploy-settings.json");
    if (existsSync(settingsPath)) {
        const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
        if (settings.cloudflare_account_id && !config.deploy.account_id) {
            config.deploy.account_id = settings.cloudflare_account_id;
        }
        if (settings.default_region && config.deploy.region === DEFAULT_REGION) {
            config.deploy.region = settings.default_region;
        }
    }
    // Apply defaults
    applyDefaults(config);
    return config;
}
/**
 * Load secrets from ~/.cocapn/secrets.json
 */
export function loadSecrets(account) {
    const secretsPath = join(homedir(), ".cocapn", "secrets.json");
    if (!existsSync(secretsPath)) {
        return {};
    }
    const secrets = JSON.parse(readFileSync(secretsPath, "utf-8"));
    if (!secrets.accounts || !secrets.accounts[account]) {
        return {};
    }
    const accountSecrets = secrets.accounts[account];
    // Return decrypted secrets (for now, assume decrypted)
    // In production, this would decrypt using age-encryption
    return accountSecrets.secrets || {};
}
/**
 * Validate deploy configuration
 */
function validateDeployConfig(config) {
    if (!config.name) {
        throw new Error("Missing required field: name");
    }
    if (!config.template) {
        throw new Error("Missing required field: template");
    }
    if (!config.deploy) {
        throw new Error("Missing required field: deploy");
    }
    if (!config.deploy.account) {
        throw new Error("Missing required field: deploy.account");
    }
    if (!config.deploy.vars) {
        config.deploy.vars = {};
    }
    if (!config.deploy.secrets) {
        config.deploy.secrets = { required: [], optional: [] };
    }
}
/**
 * Apply default values
 */
function applyDefaults(config) {
    if (!config.deploy.region) {
        config.deploy.region = DEFAULT_REGION;
    }
    if (!config.deploy.compatibility_date) {
        config.deploy.compatibility_date = DEFAULT_COMPATIBILITY_DATE;
    }
    if (!config.deploy.compatibility_flags) {
        config.deploy.compatibility_flags = ["nodejs_compat"];
    }
    if (!config.version) {
        config.version = "1.0.0";
    }
    // Default vars
    config.deploy.vars = {
        BRIDGE_MODE: "cloud",
        TEMPLATE: config.template,
        ...config.deploy.vars,
    };
}
/**
 * Deep merge two objects
 */
function mergeDeep(target, source) {
    const output = { ...target };
    for (const key in source) {
        const sourceValue = source[key];
        const targetValue = target[key];
        if (sourceValue &&
            typeof sourceValue === "object" &&
            !Array.isArray(sourceValue) &&
            targetValue &&
            typeof targetValue === "object" &&
            !Array.isArray(targetValue)) {
            output[key] = mergeDeep(targetValue, sourceValue);
        }
        else {
            output[key] = sourceValue;
        }
    }
    return output;
}
/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(config, env) {
    return config.deploy.environments?.[env];
}
//# sourceMappingURL=deploy-config.js.map