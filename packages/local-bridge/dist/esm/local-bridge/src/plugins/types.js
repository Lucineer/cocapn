/**
 * Plugin System — Core Types
 *
 * Defines the plugin manifest, skills, and permissions.
 * Plugins are published skill cartridges that extend cocapn agent capabilities.
 */
/**
 * Parse a permission string into type and scope
 */
export function parsePermission(permString) {
    // Handle multi-part types like 'fs:read' and 'fs:write'
    if (permString.startsWith('fs:read:')) {
        const scope = permString.slice(8); // Remove 'fs:read:'
        return { type: 'fs:read', scope: scope || '*' };
    }
    if (permString.startsWith('fs:write:')) {
        const scope = permString.slice(9); // Remove 'fs:write:'
        return { type: 'fs:write', scope: scope || '*' };
    }
    if (permString === 'fs:read' || permString === 'fs:read:*') {
        return { type: 'fs:read', scope: '*' };
    }
    if (permString === 'fs:write' || permString === 'fs:write:*') {
        return { type: 'fs:write', scope: '*' };
    }
    // Handle other permission types
    const parts = permString.split(':');
    const type = parts[0];
    if (!['network', 'shell', 'env', 'admin'].includes(type)) {
        throw new Error(`Invalid permission type: ${type}`);
    }
    if (type === 'admin') {
        return { type: 'admin' };
    }
    const scope = parts.slice(1).join(':');
    return { type, scope: scope || '*' };
}
/**
 * Convert permission to string format
 */
export function permissionToString(perm) {
    if (perm.type === 'admin') {
        return 'admin';
    }
    return perm.scope ? `${perm.type}:${perm.scope}` : perm.type;
}
/**
 * Check if a permission grant satisfies a permission request
 */
export function permissionSatisfies(granted, requested) {
    if (granted.type !== requested.type) {
        return false;
    }
    // Wildcard grants everything
    if (granted.scope === '*' || !granted.scope) {
        return true;
    }
    // Exact match
    if (granted.scope === requested.scope) {
        return true;
    }
    // For fs:read/fs:write, check if requested path is within granted path
    if (granted.type === 'fs:read' || granted.type === 'fs:write') {
        if (!requested.scope)
            return false;
        return requested.scope.startsWith(granted.scope);
    }
    return false;
}
/**
 * Create a plugin ID from name and version
 */
export function pluginId(name, version) {
    return `${name}@${version}`;
}
/**
 * Parse a plugin ID into name and version
 */
export function parsePluginId(id) {
    const match = id.match(/^(.+?)@(.+)$/);
    if (!match) {
        throw new Error(`Invalid plugin ID: ${id}`);
    }
    return { name: match[1], version: match[2] };
}
//# sourceMappingURL=types.js.map