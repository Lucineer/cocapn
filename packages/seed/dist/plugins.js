/**
 * Plugins — extensible plugin system for cocapn.
 *
 * Loads JS files from cocapn/plugins/*.js. Each exports a Plugin object.
 * Hooks run in load order. Plugin errors are caught and logged, never crash.
 * Zero dependencies.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
// ─── PluginLoader ──────────────────────────────────────────────────────────────
export class PluginLoader {
    plugins = [];
    log;
    constructor(log) {
        this.log = log ?? ((m) => console.info(`[cocapn:plugins] ${m}`));
    }
    async load(dir) {
        if (!existsSync(dir))
            return;
        const files = readdirSync(dir).filter(f => f.endsWith('.js')).sort();
        for (const file of files) {
            try {
                const mod = await import(pathToFileURL(join(dir, file)).href);
                const plugin = mod.default ?? mod;
                if (!plugin.name || !plugin.hooks)
                    throw new Error('Invalid plugin shape');
                this.plugins.push(plugin);
                this.log(`loaded ${plugin.name}@${plugin.version}`);
            }
            catch (err) {
                this.log(`failed to load ${file}: ${String(err)}`);
            }
        }
    }
    async runBeforeChat(message, context) {
        let ctx = context;
        for (const p of this.plugins) {
            if (!p.hooks['before-chat'])
                continue;
            try {
                ctx = await p.hooks['before-chat'](message, ctx);
            }
            catch (e) {
                this.log(`${p.name}: ${String(e)}`);
            }
        }
        return ctx;
    }
    async runAfterChat(response, context) {
        let res = response;
        for (const p of this.plugins) {
            if (!p.hooks['after-chat'])
                continue;
            try {
                res = await p.hooks['after-chat'](res, context);
            }
            catch (e) {
                this.log(`${p.name}: ${String(e)}`);
            }
        }
        return res;
    }
    getCommands() {
        const cmds = {};
        for (const p of this.plugins) {
            if (!p.hooks.command)
                continue;
            for (const [name, fn] of Object.entries(p.hooks.command)) {
                const pluginName = p.name;
                cmds[name] = async (args) => {
                    try {
                        return await fn(args);
                    }
                    catch (e) {
                        return `[${pluginName}] error: ${String(e)}`;
                    }
                };
            }
        }
        return cmds;
    }
    list() {
        return this.plugins.map(p => ({
            name: p.name, version: p.version,
            commands: p.hooks.command ? Object.keys(p.hooks.command) : [],
        }));
    }
}
//# sourceMappingURL=plugins.js.map