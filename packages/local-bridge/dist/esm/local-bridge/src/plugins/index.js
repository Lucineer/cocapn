/**
 * Plugin System — Main Entry Point
 *
 * Ties together all plugin subsystems:
 * - Permission management
 * - Plugin loading and validation
 * - Hot/cold skill execution
 * - Registry client
 * - Sandbox execution
 *
 * This is the main API for interacting with the plugin system.
 */
import { join } from 'node:path';
import { homedir } from 'node:os';
import { PluginLoader } from './loader.js';
import { PermissionManager } from './permission-manager.js';
import { PluginRegistryClient } from './registry-client.js';
import { PluginSandbox } from './sandbox.js';
import { createLogger } from '../logger.js';
const logger = createLogger('plugins');
// ─── Default Configuration ─────────────────────────────────────────────────────
const DEFAULT_OPTIONS = {
    pluginDir: join(homedir(), '.cocapn', 'plugins'),
    stateDir: join(homedir(), '.cocapn'),
    defaultTimeout: 30000,
    defaultMemory: 100 * 1024 * 1024, // 100MB
    registryUrl: 'https://registry.cocapn.ai',
};
// ─── Plugin System ─────────────────────────────────────────────────────────────
export class PluginSystem {
    options;
    permissionManager;
    registryClient;
    loader;
    sandbox;
    plugins = new Map();
    hotSkills = new Map();
    constructor(options = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.permissionManager = new PermissionManager();
        this.registryClient = new PluginRegistryClient(this.options.registryUrl);
        this.loader = new PluginLoader(this.permissionManager, {
            cocapnVersion: '0.1.0',
            nodeVersion: process.version.slice(1),
        });
        this.sandbox = new PluginSandbox();
    }
    /**
     * Initialize the plugin system
     * - Loads permission state
     * - Scans for installed plugins
     * - Loads hot skills
     */
    async initialize() {
        logger.info('Initializing plugin system...');
        // Load permission state
        await this.permissionManager.load();
        // Scan for installed plugins
        await this.scanInstalledPlugins();
        // Load hot skills from enabled plugins
        await this.loadHotSkills();
        logger.info('Plugin system initialized', { count: this.plugins.size });
    }
    /**
     * Scan the plugin directory for installed plugins
     */
    async scanInstalledPlugins() {
        const { existsSync } = await import('node:fs');
        const { readdir } = await import('node:fs/promises');
        if (!existsSync(this.options.pluginDir)) {
            return;
        }
        const entries = await readdir(this.options.pluginDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const pluginPath = join(this.options.pluginDir, entry.name);
                await this.loadPlugin(pluginPath);
            }
        }
    }
    /**
     * Load a plugin from a directory
     */
    async loadPlugin(pluginPath) {
        const result = await this.loader.load(pluginPath);
        if (result.success && result.plugin) {
            const plugin = result.plugin;
            this.plugins.set(plugin.id, plugin);
            logger.info('Plugin loaded', { id: plugin.id, status: plugin.status });
            return plugin;
        }
        else {
            logger.warn('Failed to load plugin', { path: pluginPath, errors: result.errors });
            return null;
        }
    }
    /**
     * Load all hot skills from enabled plugins
     */
    async loadHotSkills() {
        for (const plugin of this.plugins.values()) {
            if (plugin.status !== 'enabled')
                continue;
            const hotSkills = this.loader.getHotSkills(plugin);
            for (const skill of hotSkills) {
                try {
                    const skillModule = await this.loader.loadHotSkill(plugin, skill);
                    const key = `${plugin.manifest.name}:${skill.name}`;
                    this.hotSkills.set(key, { skill: skillModule, plugin: plugin.id });
                    logger.debug('Hot skill loaded', { key });
                }
                catch (err) {
                    logger.error('Failed to load hot skill', { skill: skill.name, error: err });
                }
            }
        }
    }
    /**
     * Execute a cold skill in the sandbox
     */
    async executeColdSkill(pluginId, skillName, input) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        if (plugin.status !== 'enabled') {
            throw new Error(`Plugin not enabled: ${pluginId}`);
        }
        const skill = plugin.manifest.skills.find(s => s.name === skillName);
        if (!skill) {
            throw new Error(`Skill not found: ${skillName}`);
        }
        if (skill.type !== 'cold') {
            throw new Error(`Skill is not cold: ${skillName}`);
        }
        const context = this.loader.createSandboxContext(plugin, skill);
        return this.sandbox.execute(plugin.path, skill.entry, input, context);
    }
    /**
     * Get a hot skill by name
     */
    getHotSkill(pluginName, skillName) {
        const key = `${pluginName}:${skillName}`;
        const entry = this.hotSkills.get(key);
        return entry?.skill ?? null;
    }
    /**
     * Search the registry for plugins
     */
    async search(query, category) {
        const response = await this.registryClient.search({ query, category });
        return response.plugins;
    }
    /**
     * Get plugin details from registry
     */
    async getPluginInfo(name) {
        const info = await this.registryClient.get(name);
        return info;
    }
    /**
     * Install a plugin from the registry
     */
    async installPlugin(name, version) {
        logger.info('Installing plugin', { name, version });
        const plugin = await this.registryClient.install(name, version);
        // Load and register the plugin
        await this.loadPlugin(plugin.path);
        // Check permissions and prompt if needed
        const permCheck = this.permissionManager.checkPermissions(plugin.id, plugin.manifest.permissions);
        if (!permCheck.satisfied) {
            logger.warn('Plugin requires additional permissions', {
                plugin: name,
                missing: permCheck.missing,
            });
            plugin.status = 'error';
            plugin.error = `Missing permissions: ${permCheck.missing.join(', ')}`;
        }
        return plugin;
    }
    /**
     * Uninstall a plugin
     */
    async uninstallPlugin(name, version) {
        const targetVersion = version || '*';
        if (targetVersion === '*') {
            for (const [id, plugin] of this.plugins) {
                if (plugin.manifest.name === name) {
                    await this.unloadPlugin(id);
                    await this.registryClient.uninstall(name, plugin.manifest.version);
                }
            }
        }
        else {
            const id = version ? `${name}@${version}` : this.findLatestPluginVersion(name);
            if (id) {
                await this.unloadPlugin(id);
                await this.registryClient.uninstall(name, version);
            }
        }
    }
    /**
     * Unload a plugin from memory
     */
    async unloadPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin)
            return;
        // Remove hot skills
        for (const skill of plugin.manifest.skills) {
            if (skill.type === 'hot') {
                const key = `${plugin.manifest.name}:${skill.name}`;
                this.hotSkills.delete(key);
            }
        }
        this.plugins.delete(pluginId);
        logger.info('Plugin unloaded', { id: pluginId });
    }
    /**
     * Enable a plugin
     */
    async enablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        const permCheck = this.permissionManager.checkPermissions(pluginId, plugin.manifest.permissions);
        if (!permCheck.satisfied) {
            throw new Error(`Missing permissions: ${permCheck.missing.join(', ')}`);
        }
        plugin.status = 'enabled';
        plugin.error = undefined;
        // Load hot skills
        const hotSkills = this.loader.getHotSkills(plugin);
        for (const skill of hotSkills) {
            try {
                const skillModule = await this.loader.loadHotSkill(plugin, skill);
                const key = `${plugin.manifest.name}:${skill.name}`;
                this.hotSkills.set(key, { skill: skillModule, plugin: plugin.id });
            }
            catch (err) {
                logger.error('Failed to load hot skill', { skill: skill.name, error: err });
            }
        }
        logger.info('Plugin enabled', { id: pluginId });
    }
    /**
     * Disable a plugin
     */
    async disablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        plugin.status = 'disabled';
        // Remove hot skills
        for (const skill of plugin.manifest.skills) {
            if (skill.type === 'hot') {
                const key = `${plugin.manifest.name}:${skill.name}`;
                this.hotSkills.delete(key);
            }
        }
        logger.info('Plugin disabled', { id: pluginId });
    }
    /**
     * List all plugins
     */
    listPlugins() {
        return Array.from(this.plugins.values());
    }
    /**
     * Get a plugin by ID
     */
    getPlugin(pluginId) {
        return this.plugins.get(pluginId);
    }
    /**
     * Find the latest version of a plugin
     */
    findLatestPluginVersion(name) {
        const versions = [];
        for (const [id, plugin] of this.plugins) {
            if (plugin.manifest.name === name) {
                versions.push(id);
            }
        }
        if (versions.length === 0)
            return null;
        // Sort by version (descending)
        versions.sort((a, b) => {
            const verA = a.split('@')[1];
            const verB = b.split('@')[1];
            return verB.localeCompare(verA, undefined, { numeric: true });
        });
        return versions[0];
    }
    /**
     * Get plugin statistics
     */
    getStats() {
        let enabled = 0;
        let disabled = 0;
        let errors = 0;
        let hotSkills = 0;
        let coldSkills = 0;
        for (const plugin of this.plugins.values()) {
            if (plugin.status === 'enabled')
                enabled++;
            else if (plugin.status === 'disabled')
                disabled++;
            else if (plugin.status === 'error')
                errors++;
            for (const skill of plugin.manifest.skills) {
                if (skill.type === 'hot')
                    hotSkills++;
                else
                    coldSkills++;
            }
        }
        return {
            total: this.plugins.size,
            enabled,
            disabled,
            errors,
            hotSkills,
            coldSkills,
        };
    }
    /**
     * Get the permission manager
     */
    getPermissionManager() {
        return this.permissionManager;
    }
    /**
     * Get the registry client
     */
    getRegistryClient() {
        return this.registryClient;
    }
    /**
     * Shutdown the plugin system
     */
    async shutdown() {
        logger.info('Shutting down plugin system...');
        this.hotSkills.clear();
        this.plugins.clear();
        await this.permissionManager.save();
        logger.info('Plugin system shut down');
    }
}
// ─── Re-exports ────────────────────────────────────────────────────────────────
export * from './types.js';
export { PluginLoader } from './loader.js';
export { PermissionManager } from './permission-manager.js';
export { PluginRegistryClient } from './registry-client.js';
export { PluginSandbox } from './sandbox.js';
//# sourceMappingURL=index.js.map