/**
 * Plugin Installer — Local plugin management for cocapn/plugins/
 *
 * Plugins live in <project>/cocapn/plugins/<name>/ with a plugin.json manifest.
 * Each plugin can be enabled or disabled via cocapn/plugins/enabled.json.
 */
export interface PluginManifest {
    name: string;
    version: string;
    description: string;
    main?: string;
    skills?: Array<{
        name: string;
        entry: string;
        type: string;
    }>;
    permissions?: string[];
}
export interface InstalledPlugin {
    name: string;
    version: string;
    description: string;
    main: string;
    enabled: boolean;
    path: string;
}
/**
 * Get the plugins directory for a project: <projectRoot>/cocapn/plugins/
 */
export declare function getPluginDir(projectRoot?: string): string;
/**
 * Get the path to the enabled plugins state file.
 */
export declare function getEnabledFilePath(projectRoot?: string): string;
/**
 * Read the set of enabled plugin names.
 */
export declare function loadEnabledSet(projectRoot?: string): Promise<Set<string>>;
/**
 * Validate a plugin.json manifest.
 */
export declare function validateManifest(manifestPath: string): Promise<PluginManifest>;
/**
 * Install a plugin locally: create cocapn/plugins/<name>/plugin.json from a manifest.
 */
export declare function installPlugin(name: string, projectRoot?: string): Promise<InstalledPlugin>;
/**
 * Remove a plugin: delete its directory and remove from enabled set.
 */
export declare function removePlugin(name: string, projectRoot?: string): Promise<void>;
/**
 * List all installed plugins with their enabled state.
 */
export declare function listPlugins(projectRoot?: string): Promise<InstalledPlugin[]>;
/**
 * Enable a plugin.
 */
export declare function enablePlugin(name: string, projectRoot?: string): Promise<void>;
/**
 * Disable a plugin.
 */
export declare function disablePlugin(name: string, projectRoot?: string): Promise<void>;
//# sourceMappingURL=plugin-installer.d.ts.map