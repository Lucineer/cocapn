import * as vscode from 'vscode';
/**
 * Basic language server features using VS Code's built-in provider APIs.
 * Hover info, basic completions, and diagnostics from the cocapn agent.
 */
export declare class CocapnLanguageFeatures {
    private _serverUrl;
    private _diagnosticCollection;
    private _disposables;
    constructor(serverUrl: string);
    /**
     * Set diagnostics for a document from agent suggestions.
     */
    setDiagnostics(uri: vscode.Uri, suggestions: AgentSuggestion[]): void;
    clearDiagnostics(uri: vscode.Uri): void;
    dispose(): void;
}
export interface AgentSuggestion {
    message: string;
    severity?: 'info' | 'warning';
    range?: {
        startLine: number;
        startChar?: number;
        endLine: number;
        endChar?: number;
    };
}
//# sourceMappingURL=language-server.d.ts.map