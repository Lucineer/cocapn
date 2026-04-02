/**
 * Permission Manager — Grant, revoke, and check plugin permissions
 *
 * Manages user-approved permissions for plugins with persistent storage.
 * Permissions are stored in ~/.cocapn/plugin-permissions.json.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parsePermission, permissionToString, permissionSatisfies } from './types.js';
import { createLogger } from '../logger.js';
const logger = createLogger('plugins:permissions');
// ─── Permission State File ─────────────────────────────────────────────────────
// Helper functions to get paths (defers homedir() call for test mocking)
function getStateDir() {
    return join(homedir(), '.cocapn');
}
function getPermissionsFile() {
    return join(getStateDir(), 'plugin-permissions.json');
}
// ─── Permission Manager ────────────────────────────────────────────────────────
export class PermissionManager {
    state = new Map();
    loaded = false;
    /**
     * Load permission state from disk
     */
    async load() {
        if (this.loaded)
            return;
        if (existsSync(getPermissionsFile())) {
            try {
                const content = await readFile(getPermissionsFile(), 'utf-8');
                this.state = JSON.parse(content);
                logger.debug('Loaded permission state', { count: Object.keys(this.state).length });
            }
            catch (err) {
                logger.warn('Failed to load permissions file, starting fresh', { error: err });
                this.state = {};
            }
        }
        this.loaded = true;
    }
    /**
     * Save permission state to disk
     */
    async save() {
        try {
            // Ensure directory exists
            if (!existsSync(getStateDir())) {
                await mkdir(getStateDir(), { recursive: true });
            }
            await writeFile(getPermissionsFile(), JSON.stringify(this.state, null, 2), 'utf-8');
            logger.debug('Saved permission state', { count: Object.keys(this.state).length });
        }
        catch (err) {
            logger.error('Failed to save permissions file', { error: err });
            throw err;
        }
    }
    /**
     * Get granted permissions for a plugin
     */
    getGrantedPermissions(pluginId) {
        return this.state[pluginId] || [];
    }
    /**
     * Check if a plugin has a specific permission granted
     */
    hasPermission(pluginId, permission) {
        const granted = this.getGrantedPermissions(pluginId);
        const permString = typeof permission === 'string' ? permission : permissionToString(permission);
        return granted.includes(permString);
    }
    /**
     * Check if granted permissions satisfy required permissions
     */
    checkPermissions(pluginId, requiredPermissions) {
        const granted = this.getGrantedPermissions(pluginId);
        const missing = [];
        for (const required of requiredPermissions) {
            const requiredPerm = parsePermission(required);
            const satisfied = granted.some(g => {
                const grantedPerm = parsePermission(g);
                return permissionSatisfies(grantedPerm, requiredPerm);
            });
            if (!satisfied) {
                missing.push(required);
            }
        }
        return {
            satisfied: missing.length === 0,
            missing,
        };
    }
    /**
     * Grant a permission to a plugin
     */
    async grantPermission(pluginId, permission) {
        await this.load();
        const permString = typeof permission === 'string' ? permission : permissionToString(permission);
        if (!this.state[pluginId]) {
            this.state[pluginId] = [];
        }
        if (!this.state[pluginId].includes(permString)) {
            this.state[pluginId].push(permString);
            await this.save();
            logger.info('Permission granted', { pluginId, permission: permString });
        }
    }
    /**
     * Grant multiple permissions to a plugin
     */
    async grantPermissions(pluginId, permissions) {
        await this.load();
        if (!this.state[pluginId]) {
            this.state[pluginId] = [];
        }
        let changed = false;
        for (const permString of permissions) {
            if (!this.state[pluginId].includes(permString)) {
                this.state[pluginId].push(permString);
                changed = true;
            }
        }
        if (changed) {
            await this.save();
            logger.info('Permissions granted', { pluginId, count: permissions.length });
        }
    }
    /**
     * Revoke a permission from a plugin
     */
    async revokePermission(pluginId, permission) {
        await this.load();
        const permString = typeof permission === 'string' ? permission : permissionToString(permission);
        if (this.state[pluginId]) {
            const idx = this.state[pluginId].indexOf(permString);
            if (idx !== -1) {
                this.state[pluginId].splice(idx, 1);
                await this.save();
                logger.info('Permission revoked', { pluginId, permission: permString });
            }
        }
    }
    /**
     * Revoke all permissions for a plugin
     */
    async revokeAll(pluginId) {
        await this.load();
        if (this.state[pluginId]) {
            delete this.state[pluginId];
            await this.save();
            logger.info('All permissions revoked', { pluginId });
        }
    }
    /**
     * Clear all permission state (useful for testing)
     */
    async clear() {
        this.state = {};
        await this.save();
    }
    /**
     * Get all plugin IDs with permissions
     */
    getPluginIds() {
        return Object.keys(this.state);
    }
    /**
     * Export permission state (for backup/migration)
     */
    export() {
        return { ...this.state };
    }
    /**
     * Import permission state (for backup/migration)
     */
    async import(state) {
        this.state = { ...state };
        await this.save();
    }
}
//# sourceMappingURL=permission-manager.js.map