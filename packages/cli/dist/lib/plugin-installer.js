/**
 * Plugin Installer — Local plugin management for cocapn/plugins/
 *
 * Plugins live in <project>/cocapn/plugins/<name>/ with a plugin.json manifest.
 * Each plugin can be enabled or disabled via cocapn/plugins/enabled.json.
 */
import { mkdir, rm, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
/**
 * Get the plugins directory for a project: <projectRoot>/cocapn/plugins/
 */
export function getPluginDir(projectRoot = process.cwd()) {
    return join(projectRoot, "cocapn", "plugins");
}
/**
 * Get the path to the enabled plugins state file.
 */
export function getEnabledFilePath(projectRoot = process.cwd()) {
    return join(projectRoot, "cocapn", "plugins", "enabled.json");
}
/**
 * Read the set of enabled plugin names.
 */
export async function loadEnabledSet(projectRoot = process.cwd()) {
    const path = getEnabledFilePath(projectRoot);
    if (!existsSync(path))
        return new Set();
    try {
        const raw = await readFile(path, "utf-8");
        const arr = JSON.parse(raw);
        return new Set(arr);
    }
    catch {
        return new Set();
    }
}
/**
 * Write the set of enabled plugin names.
 */
async function saveEnabledSet(enabled, projectRoot) {
    const path = getEnabledFilePath(projectRoot);
    await writeFile(path, JSON.stringify([...enabled], null, 2), "utf-8");
}
/**
 * Validate a plugin.json manifest.
 */
export async function validateManifest(manifestPath) {
    if (!existsSync(manifestPath)) {
        throw new Error(`plugin.json not found at ${manifestPath}`);
    }
    const raw = await readFile(manifestPath, "utf-8");
    const data = JSON.parse(raw);
    if (!data["name"] || typeof data["name"] !== "string") {
        throw new Error("Invalid manifest: missing or invalid 'name'");
    }
    if (!data["version"] || typeof data["version"] !== "string") {
        throw new Error("Invalid manifest: missing or invalid 'version'");
    }
    if (!data["description"] || typeof data["description"] !== "string") {
        throw new Error("Invalid manifest: missing or invalid 'description'");
    }
    return {
        name: data["name"],
        version: data["version"],
        description: data["description"],
        main: data["main"] || "index.js",
        skills: data["skills"],
        permissions: data["permissions"],
    };
}
/**
 * Install a plugin locally: create cocapn/plugins/<name>/plugin.json from a manifest.
 */
export async function installPlugin(name, projectRoot = process.cwd()) {
    const pluginDir = getPluginDir(projectRoot);
    await mkdir(pluginDir, { recursive: true });
    const targetDir = join(pluginDir, name);
    const manifestPath = join(targetDir, "plugin.json");
    if (existsSync(manifestPath)) {
        throw new Error(`Plugin already installed: ${name}`);
    }
    await mkdir(targetDir, { recursive: true });
    // Create a minimal manifest
    const manifest = {
        name,
        version: "0.1.0",
        description: `Plugin: ${name}`,
        main: "index.js",
    };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    // Enable by default
    const enabled = await loadEnabledSet(projectRoot);
    enabled.add(name);
    await saveEnabledSet(enabled, projectRoot);
    return {
        name,
        version: manifest.version,
        description: manifest.description,
        main: manifest.main,
        enabled: true,
        path: targetDir,
    };
}
/**
 * Remove a plugin: delete its directory and remove from enabled set.
 */
export async function removePlugin(name, projectRoot = process.cwd()) {
    const targetDir = join(getPluginDir(projectRoot), name);
    if (!existsSync(targetDir)) {
        throw new Error(`Plugin not installed: ${name}`);
    }
    await rm(targetDir, { recursive: true, force: true });
    const enabled = await loadEnabledSet(projectRoot);
    enabled.delete(name);
    await saveEnabledSet(enabled, projectRoot);
}
/**
 * List all installed plugins with their enabled state.
 */
export async function listPlugins(projectRoot = process.cwd()) {
    const pluginDir = getPluginDir(projectRoot);
    if (!existsSync(pluginDir)) {
        return [];
    }
    const enabled = await loadEnabledSet(projectRoot);
    const entries = await readdir(pluginDir, { withFileTypes: true });
    const plugins = [];
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const manifestPath = join(pluginDir, entry.name, "plugin.json");
        if (!existsSync(manifestPath))
            continue;
        try {
            const manifest = await validateManifest(manifestPath);
            plugins.push({
                name: manifest.name,
                version: manifest.version,
                description: manifest.description,
                main: manifest.main,
                enabled: enabled.has(manifest.name),
                path: join(pluginDir, entry.name),
            });
        }
        catch {
            // Skip invalid manifests
        }
    }
    return plugins;
}
/**
 * Enable a plugin.
 */
export async function enablePlugin(name, projectRoot = process.cwd()) {
    const targetDir = join(getPluginDir(projectRoot), name);
    if (!existsSync(targetDir)) {
        throw new Error(`Plugin not installed: ${name}`);
    }
    const enabled = await loadEnabledSet(projectRoot);
    enabled.add(name);
    await saveEnabledSet(enabled, projectRoot);
}
/**
 * Disable a plugin.
 */
export async function disablePlugin(name, projectRoot = process.cwd()) {
    const targetDir = join(getPluginDir(projectRoot), name);
    if (!existsSync(targetDir)) {
        throw new Error(`Plugin not installed: ${name}`);
    }
    const enabled = await loadEnabledSet(projectRoot);
    enabled.delete(name);
    await saveEnabledSet(enabled, projectRoot);
}
//# sourceMappingURL=plugin-installer.js.map