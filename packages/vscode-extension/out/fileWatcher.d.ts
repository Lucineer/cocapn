import * as vscode from 'vscode';
export declare class FileWatcher extends vscode.Disposable {
    private _serverUrl;
    private _watcher;
    private _debounceTimers;
    constructor(serverUrl: string);
    private _debounce;
    private _notify;
    dispose(): void;
}
//# sourceMappingURL=fileWatcher.d.ts.map