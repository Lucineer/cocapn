/**
 * Plugin Loader — Load and validate plugins from directories
 *
 * Handles plugin discovery, manifest validation, dependency checking,
 * and skill registration.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pluginId, parsePermission } from './types.js';
import { createLogger } from '../logger.js';
const logger = createLogger('plugins:loader');
// ─── Version Utilities ─────────────────────────────────────────────────────────
function satisfiesVersion(version, range) {
    // Simple semver range check
    // Supports: ">=1.0.0", "^1.0.0", "~1.0.0", "1.x"
    const cleanedVersion = version.replace(/^v/, '');
    const cleanedRange = range.replace(/^v/, '');
    if (cleanedRange.startsWith('>=')) {
        const minVersion = cleanedRange.slice(2);
        return compareVersions(cleanedVersion, minVersion) >= 0;
    }
    if (cleanedRange.startsWith('^')) {
        const minVersion = cleanedRange.slice(1);
        const major = minVersion.split('.')[0];
        const versionMajor = cleanedVersion.split('.')[0];
        return versionMajor === major && compareVersions(cleanedVersion, minVersion) >= 0;
    }
    if (cleanedRange.startsWith('~')) {
        const minVersion = cleanedRange.slice(1);
        const parts = minVersion.split('.');
        const versionParts = cleanedVersion.split('.');
        return (versionParts[0] === parts[0] &&
            versionParts[1] === parts[1] &&
            compareVersions(cleanedVersion, minVersion) >= 0);
    }
    if (cleanedRange.includes('.x')) {
        const parts = cleanedRange.split('.');
        const versionParts = cleanedVersion.split('.');
        return versionParts[0] === parts[0];
    }
    // Exact match
    return cleanedVersion === cleanedRange;
}
function compareVersions(a, b) {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const partA = partsA[i] ?? 0;
        const partB = partsB[i] ?? 0;
        if (partA > partB)
            return 1;
        if (partA < partB)
            return -1;
    }
    return 0;
}
// ─── Manifest Validation ───────────────────────────────────────────────────────
function validateManifest(manifest) {
    const errors = [];
    // Required fields
    if (!manifest.name || typeof manifest.name !== 'string') {
        errors.push('Missing or invalid name');
    }
    else if (!manifest.name.startsWith('cocapn-plugin-')) {
        errors.push('Plugin name must start with "cocapn-plugin-"');
    }
    if (!manifest.version || typeof manifest.version !== 'string') {
        errors.push('Missing or invalid version');
    }
    if (!manifest.description || typeof manifest.description !== 'string') {
        errors.push('Missing or invalid description');
    }
    else if (manifest.description.length > 200) {
        errors.push('Description must be 200 characters or less');
    }
    if (!manifest.author || typeof manifest.author !== 'string') {
        errors.push('Missing or invalid author');
    }
    // Skills validation
    if (!Array.isArray(manifest.skills) || manifest.skills.length === 0) {
        errors.push('Plugin must have at least one skill');
    }
    else {
        manifest.skills.forEach((skill, idx) => {
            if (!skill.name || typeof skill.name !== 'string') {
                errors.push(`Skill ${idx}: missing or invalid name`);
            }
            if (!skill.entry || typeof skill.entry !== 'string') {
                errors.push(`Skill ${idx}: missing or invalid entry`);
            }
            if (skill.type !== 'hot' && skill.type !== 'cold') {
                errors.push(`Skill ${idx}: type must be "hot" or "cold"`);
            }
            if (skill.triggers && !Array.isArray(skill.triggers)) {
                errors.push(`Skill ${idx}: triggers must be an array`);
            }
        });
    }
    // Permissions validation
    if (!Array.isArray(manifest.permissions)) {
        errors.push('Permissions must be an array');
    }
    else {
        manifest.permissions.forEach((perm, idx) => {
            try {
                parsePermission(perm);
            }
            catch (err) {
                errors.push(`Permission ${idx}: ${err}`);
            }
        });
    }
    // Engines validation
    if (manifest.engines) {
        if (manifest.engines.node && typeof manifest.engines.node !== 'string') {
            errors.push('engines.node must be a string');
        }
        if (manifest.engines.cocapn && typeof manifest.engines.cocapn !== 'string') {
            errors.push('engines.cocapn must be a string');
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
export class PluginLoader {
    permissionManager;
    cocapnVersion;
    nodeVersion;
    constructor(permissionManager, options = {}) {
        this.permissionManager = permissionManager;
        this.cocapnVersion = options.cocapnVersion || '0.1.0';
        this.nodeVersion = options.nodeVersion || process.version.slice(1);
    }
    /**
     * Load a plugin from a directory
     */
    async load(pluginDir) {
        const errors = [];
        try {
            // Read manifest
            const manifestPath = join(pluginDir, 'cocapn-plugin.json');
            if (!existsSync(manifestPath)) {
                return { success: false, errors: ['cocapn-plugin.json not found'] };
            }
            const manifestContent = await readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestContent);
            // Validate manifest
            const validation = validateManifest(manifest);
            if (!validation.valid) {
                return { success: false, errors: validation.errors };
            }
            // Check cocapn version compatibility
            if (manifest.engines?.cocapn) {
                if (!satisfiesVersion(this.cocapnVersion, manifest.engines.cocapn)) {
                    errors.push(`Cocapn version ${this.cocapnVersion} does not satisfy requirement ${manifest.engines.cocapn}`);
                }
            }
            // Check Node version compatibility
            if (manifest.engines?.node) {
                if (!satisfiesVersion(this.nodeVersion, manifest.engines.node)) {
                    errors.push(`Node version ${this.nodeVersion} does not satisfy requirement ${manifest.engines.node}`);
                }
            }
            // Resolve plugin directory
            const resolvedPath = resolve(pluginDir);
            // Check permissions
            await this.permissionManager.load();
            const permCheck = this.permissionManager.checkPermissions(pluginId(manifest.name, manifest.version), manifest.permissions);
            const plugin = {
                manifest,
                path: resolvedPath,
                installedAt: Date.now(),
                status: permCheck.satisfied ? 'enabled' : 'error',
                error: permCheck.satisfied ? undefined : `Missing permissions: ${permCheck.missing.join(', ')}`,
                approvedPermissions: permCheck.satisfied ? manifest.permissions : [],
                id: pluginId(manifest.name, manifest.version),
            };
            if (errors.length > 0) {
                return { success: false, errors };
            }
            return { success: true, plugin, errors: [] };
        }
        catch (err) {
            logger.error('Failed to load plugin', { dir: pluginDir, error: err });
            return {
                success: false,
                errors: [err instanceof Error ? err.message : String(err)],
            };
        }
    }
    /**
     * Validate that all skill entry points exist
     */
    async validateSkillEntries(plugin) {
        const errors = [];
        for (const skill of plugin.manifest.skills) {
            const skillPath = join(plugin.path, skill.entry);
            if (!existsSync(skillPath)) {
                errors.push(`Skill entry point not found: ${skill.entry}`);
            }
            else {
                const stats = await stat(skillPath);
                if (!stats.isFile()) {
                    errors.push(`Skill entry point is not a file: ${skill.entry}`);
                }
            }
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    /**
     * Get hot skills from a plugin
     */
    getHotSkills(plugin) {
        return plugin.manifest.skills.filter(s => s.type === 'hot');
    }
    /**
     * Get cold skills from a plugin
     */
    getColdSkills(plugin) {
        return plugin.manifest.skills.filter(s => s.type === 'cold');
    }
    /**
     * Load a hot skill module
     */
    async loadHotSkill(plugin, skill) {
        if (skill.type !== 'hot') {
            throw new Error(`Cannot load cold skill as hot: ${skill.name}`);
        }
        const skillPath = join(plugin.path, skill.entry);
        try {
            // Dynamic import of the skill module
            const module = await import(`file://${skillPath}`);
            return module.default;
        }
        catch (err) {
            logger.error('Failed to load hot skill', { plugin: plugin.id, skill: skill.name, error: err });
            throw err;
        }
    }
    /**
     * Create a sandbox context for cold skill execution
     */
    createSandboxContext(plugin, skill) {
        const permissions = plugin.manifest.permissions.map(p => parsePermission(p));
        const tolerance = skill.tolerance || {};
        return {
            plugin: plugin.manifest.name,
            skill: skill.name,
            permissions,
            timeout: tolerance.timeout || 30000,
            maxMemory: 100 * 1024 * 1024, // 100MB default
            signal: AbortSignal.timeout(tolerance.timeout || 30000),
            env: {},
        };
    }
    /**
     * Scan a directory for plugins
     */
    async scanDirectory(dir) {
        const pluginDirs = [];
        if (!existsSync(dir)) {
            return pluginDirs;
        }
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory) {
                const pluginPath = join(dir, entry.name);
                const manifestPath = join(pluginPath, 'cocapn-plugin.json');
                if (existsSync(manifestPath)) {
                    pluginDirs.push(pluginPath);
                }
            }
        }
        return pluginDirs;
    }
}
//# sourceMappingURL=loader.js.map