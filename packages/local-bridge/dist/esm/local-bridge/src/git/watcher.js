/**
 * RepoWatcher — watches the private repo for file changes using chokidar.
 *
 * Triggers debounced Git commits when files in watched directories change.
 * Respects encrypted path patterns (unencrypted secrets must never be committed).
 */
import { EventEmitter } from "events";
import chokidar from "chokidar";
const DEBOUNCE_MS = 2_000;
export class RepoWatcher extends EventEmitter {
    watcher = null;
    debounceTimer = null;
    pendingPaths = new Set();
    config;
    sync;
    watchPaths;
    constructor(watchPaths, config, sync) {
        super();
        this.watchPaths = watchPaths;
        this.config = config;
        this.sync = sync;
    }
    start() {
        this.watcher = chokidar.watch(this.watchPaths, {
            ignoreInitial: true,
            ignored: [
                /(^|[/\\])\../, // dotfiles
                /node_modules/,
                // Encrypted paths should never trigger an auto-commit (they'd be unencrypted)
                ...this.config.encryption.encryptedPaths.map((p) => new RegExp(p.replace("**", ".*").replace("*.", "\\."))),
            ],
            persistent: true,
        });
        this.watcher.on("change", (path) => this.onFileEvent(path));
        this.watcher.on("add", (path) => this.onFileEvent(path));
        this.watcher.on("unlink", (path) => this.onFileEvent(path));
        this.watcher.on("ready", () => this.emit("ready"));
    }
    async stop() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        await this.watcher?.close();
        this.watcher = null;
    }
    onFileEvent(path) {
        this.pendingPaths.add(path);
        this.emit("change", path);
        if (this.debounceTimer)
            clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            const paths = [...this.pendingPaths];
            this.pendingPaths.clear();
            if (this.config.sync.autoCommit) {
                const msg = `[cocapn] file change: ${paths.slice(0, 3).join(", ")}${paths.length > 3 ? " …" : ""}`;
                this.sync.commit(msg).catch(() => undefined);
            }
        }, DEBOUNCE_MS);
    }
}
//# sourceMappingURL=watcher.js.map