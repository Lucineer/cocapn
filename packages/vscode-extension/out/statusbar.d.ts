import * as vscode from 'vscode';
export declare class CocapnStatusBar extends vscode.Disposable {
    private _statusBarItem;
    private _serverUrl;
    private _connected;
    private _tokenCount;
    constructor(serverUrl: string);
    checkConnection(): Promise<void>;
    addTokens(count: number): void;
    setConnected(connected: boolean): void;
    private _setDisconnected;
    private _update;
    dispose(): void;
}
//# sourceMappingURL=statusbar.d.ts.map