import * as vscode from 'vscode';
export declare class CocapnSidebar implements vscode.WebviewViewProvider {
    static readonly viewType = "cocapn.chatView";
    private _view?;
    private _serverUrl;
    private _extensionUri;
    private _messages;
    constructor(extensionUri: vscode.Uri, serverUrl: string);
    resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void;
    show(): void;
    sendWithContext(prompt: string, contextText: string, fileName: string): Promise<void>;
    sendMessage(text: string): Promise<void>;
    private _handleChat;
    private _postMessage;
    private _getHtml;
}
//# sourceMappingURL=sidebar.d.ts.map