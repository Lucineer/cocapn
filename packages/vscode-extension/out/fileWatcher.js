"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileWatcher = void 0;
const vscode = __importStar(require("vscode"));
class FileWatcher extends vscode.Disposable {
    _serverUrl;
    _watcher;
    _debounceTimers = new Map();
    constructor(serverUrl) {
        super(() => this.dispose());
        this._serverUrl = serverUrl;
        this._watcher = vscode.workspace.createFileSystemWatcher('**/*', false, // create
        false, // change
        false // delete
        );
        this._watcher.onDidCreate((uri) => this._notify('create', uri));
        this._watcher.onDidChange((uri) => this._debounce('change', uri));
        this._watcher.onDidDelete((uri) => this._notify('delete', uri));
    }
    _debounce(event, uri) {
        const key = uri.fsPath;
        const existing = this._debounceTimers.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        this._debounceTimers.set(key, setTimeout(() => {
            this._debounceTimers.delete(key);
            this._notify(event, uri);
        }, 2000));
    }
    async _notify(event, uri) {
        const relPath = vscode.workspace.asRelativePath(uri);
        // Skip internal paths
        if (relPath.startsWith('node_modules/') || relPath.startsWith('.git/')) {
            return;
        }
        try {
            await fetch(`${this._serverUrl}/api/file-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event, path: relPath }),
            });
        }
        catch {
            // Silently ignore — agent might not be running
        }
    }
    dispose() {
        this._watcher.dispose();
        for (const timer of this._debounceTimers.values()) {
            clearTimeout(timer);
        }
        this._debounceTimers.clear();
    }
}
exports.FileWatcher = FileWatcher;
//# sourceMappingURL=fileWatcher.js.map