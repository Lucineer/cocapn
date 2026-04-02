/**
 * Template Registry — manages cocapn templates (list, get, install, validate)
 *
 * Templates are packaged with a cocapn-template.json manifest and can be
 * installed from local cache or fetched from GitHub.
 */
import { readFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
// Template cache directory relative to this file
const TEMPLATE_CACHE_DIR = join(__dirname, "../../../templates");
export class TemplateRegistry {
    cacheDir;
    constructor(cacheDir = TEMPLATE_CACHE_DIR) {
        this.cacheDir = cacheDir;
        this.ensureCacheDir();
    }
    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------
    /**
     * List all available templates from local cache
     */
    listTemplates() {
        const summaries = [];
        if (!existsSync(this.cacheDir)) {
            return summaries;
        }
        const entries = readdirSync(this.cacheDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith(".json")) {
                continue;
            }
            try {
                const manifestPath = join(this.cacheDir, entry.name);
                const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
                if (this.isTemplateManifest(manifest)) {
                    summaries.push({
                        name: manifest.name,
                        displayName: manifest.displayName,
                        description: manifest.description,
                        emoji: manifest.emoji,
                        domains: manifest.domains,
                    });
                }
            }
            catch (err) {
                console.warn(`[template] Failed to read ${entry.name}:`, err);
            }
        }
        return summaries.sort((a, b) => a.name.localeCompare(b.name));
    }
    /**
     * Get full template manifest by name
     */
    async getTemplate(name) {
        const manifestPath = join(this.cacheDir, `${name}.json`);
        if (!existsSync(manifestPath)) {
            return null;
        }
        try {
            const content = readFileSync(manifestPath, "utf8");
            const manifest = JSON.parse(content);
            if (this.isTemplateManifest(manifest)) {
                return manifest;
            }
            return null;
        }
        catch (err) {
            console.error(`[template] Failed to load ${name}:`, err);
            return null;
        }
    }
    /**
     * Install a template by applying its configuration
     */
    async installTemplate(name, options = {}) {
        const manifest = await this.getTemplate(name);
        if (!manifest) {
            throw new Error(`Template not found: ${name}`);
        }
        // Validate fork selection if provided
        if (options.fork) {
            const fork = manifest.forks?.find((f) => f.id === options.fork);
            if (!fork) {
                throw new Error(`Invalid fork "${options.fork}" for template ${name}`);
            }
        }
        const targetDir = options.targetDir ?? process.cwd();
        // Apply template configuration
        // For now, we just validate the template and its fork
        // Actual installation logic would write cocapn.yml files, copy personality, etc.
        const validation = this.validateTemplate(manifest);
        if (!validation.valid) {
            throw new Error(`Template validation failed:\n${validation.errors.join("\n")}`);
        }
        console.log(`[template] Installing ${name}...`);
        console.log(`  Name: ${manifest.displayName}`);
        console.log(`  Description: ${manifest.description}`);
        if (options.fork && manifest.forks) {
            const fork = manifest.forks.find((f) => f.id === options.fork);
            if (fork) {
                console.log(`  Fork: ${fork.label}`);
                console.log(`    ${fork.description}`);
            }
        }
        // TODO: Implement actual installation:
        // - Write cocapn.yml with merged config
        // - Copy personality file
        // - Configure modules
        // - Apply fork overrides if selected
    }
    /**
     * Validate a template manifest
     */
    validateTemplate(manifest) {
        const errors = [];
        if (!manifest || typeof manifest !== "object") {
            return { valid: false, errors: ["Manifest is not an object"] };
        }
        const m = manifest;
        // Required fields
        if (typeof m.name !== "string" || !/^[a-z][a-z0-9-]*$/.test(m.name)) {
            errors.push('name must be a kebab-case string starting with a letter');
        }
        if (typeof m.version !== "string" || !/^\d+\.\d+\.\d+$/.test(m.version)) {
            errors.push('version must be a semver string (e.g., "1.0.0")');
        }
        if (typeof m.displayName !== "string") {
            errors.push('displayName must be a string');
        }
        if (typeof m.description !== "string") {
            errors.push('description must be a string');
        }
        if (!Array.isArray(m.domains) || m.domains.length === 0) {
            errors.push('domains must be a non-empty array');
        }
        else {
            for (const domain of m.domains) {
                if (typeof domain !== "string" || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
                    errors.push(`Invalid domain: ${domain}`);
                }
            }
        }
        if (typeof m.emoji !== "string") {
            errors.push('emoji must be a string');
        }
        if (typeof m.author !== "string") {
            errors.push('author must be a string');
        }
        // Optional fields
        if (m.repository !== undefined && typeof m.repository !== "string") {
            errors.push('repository must be a string if provided');
        }
        if (m.features !== undefined) {
            if (!Array.isArray(m.features)) {
                errors.push('features must be an array if provided');
            }
            else {
                for (const feature of m.features) {
                    if (typeof feature !== "string" || !/^[a-z][a-z0-9-]*$/.test(feature)) {
                        errors.push(`Invalid feature: ${feature}`);
                    }
                }
            }
        }
        if (m.modules !== undefined) {
            if (!Array.isArray(m.modules)) {
                errors.push('modules must be an array if provided');
            }
        }
        // Validate forks
        if (m.forks !== undefined) {
            if (!Array.isArray(m.forks)) {
                errors.push('forks must be an array if provided');
            }
            else {
                for (const fork of m.forks) {
                    const forkErrors = this.validateFork(fork);
                    errors.push(...forkErrors);
                }
            }
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    /**
     * Create a new template from current config
     */
    createTemplateFromConfig(name, config) {
        return {
            name,
            version: "1.0.0",
            displayName: config.displayName || name.charAt(0).toUpperCase() + name.slice(1),
            description: config.description || `Cocapn template: ${name}`,
            domains: config.domains || [`${name}.ai`],
            emoji: config.emoji || "🤖",
            author: config.author || "Unknown",
            repository: config.repository,
            features: config.features || [],
            modules: config.modules || [],
            personality: config.personality,
            config: config.config,
            forks: config.forks || undefined,
        };
    }
    // ---------------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------------
    ensureCacheDir() {
        if (!existsSync(this.cacheDir)) {
            try {
                mkdirSync(this.cacheDir, { recursive: true });
            }
            catch (err) {
                console.warn(`[template] Could not create cache dir: ${this.cacheDir}`, err);
            }
        }
    }
    validateFork(fork) {
        const errors = [];
        if (!fork || typeof fork !== "object") {
            errors.push('Fork must be an object');
            return errors;
        }
        const f = fork;
        if (typeof f.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(f.id)) {
            errors.push(`Fork id must be a kebab-case string: ${f.id}`);
        }
        if (typeof f.label !== "string") {
            errors.push(`Fork label must be a string: ${f.id}`);
        }
        if (typeof f.description !== "string") {
            errors.push(`Fork description must be a string: ${f.id}`);
        }
        if (f.features !== undefined && !Array.isArray(f.features)) {
            errors.push(`Fork features must be an array: ${f.id}`);
        }
        if (f.personality !== undefined && typeof f.personality !== "object") {
            errors.push(`Fork personality must be an object: ${f.id}`);
        }
        return errors;
    }
    isTemplateManifest(obj) {
        if (!obj || typeof obj !== "object") {
            return false;
        }
        const m = obj;
        return (typeof m.name === "string" &&
            typeof m.version === "string" &&
            typeof m.displayName === "string" &&
            typeof m.description === "string" &&
            Array.isArray(m.domains) &&
            typeof m.emoji === "string" &&
            typeof m.author === "string");
    }
}
//# sourceMappingURL=registry.js.map