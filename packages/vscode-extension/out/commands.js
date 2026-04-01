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
exports.registerCommands = registerCommands;
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
function registerCommands(context, sidebar, serverUrl) {
    // Open chat
    context.subscriptions.push(vscode.commands.registerCommand('cocapn.openChat', () => {
        sidebar.show();
    }));
    // Explain this file
    context.subscriptions.push(vscode.commands.registerCommand('cocapn.explainFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No file open');
            return;
        }
        const fileName = vscode.workspace.asRelativePath(editor.document.uri);
        const text = editor.document.getText();
        await sidebar.sendWithContext('Explain this file — what does it do, what are the key functions, and how does it fit into the project?', text, fileName);
    }));
    // What changed here?
    context.subscriptions.push(vscode.commands.registerCommand('cocapn.whatChanged', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No file open');
            return;
        }
        const fileName = vscode.workspace.asRelativePath(editor.document.uri);
        try {
            const diff = cp.execSync(`git diff HEAD -- "${fileName}"`, { encoding: 'utf-8', cwd: vscode.workspace.rootPath });
            if (!diff.trim()) {
                vscode.window.showInformationMessage('No uncommitted changes in this file');
                return;
            }
            await sidebar.sendWithContext('What changed in this file? Summarize the diff and explain the intent.', diff, fileName);
        }
        catch {
            vscode.window.showErrorMessage('Could not get git diff. Is this a git repository?');
        }
    }));
    // How should I refactor this?
    context.subscriptions.push(vscode.commands.registerCommand('cocapn.refactorSuggest', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No file open');
            return;
        }
        const fileName = vscode.workspace.asRelativePath(editor.document.uri);
        const text = editor.document.getText();
        await sidebar.sendWithContext('How should I refactor this code? Look for opportunities to improve readability, reduce duplication, and simplify the structure.', text, fileName);
    }));
    // Impact analysis
    context.subscriptions.push(vscode.commands.registerCommand('cocapn.impactAnalysis', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No file open');
            return;
        }
        const fileName = vscode.workspace.asRelativePath(editor.document.uri);
        const selection = editor.selection;
        const text = selection.isEmpty
            ? editor.document.getText()
            : editor.document.getText(selection);
        await sidebar.sendWithContext('What are the implications of changing this code? Analyze the potential impact on other parts of the codebase.', text, fileName);
    }));
    // Generate tests
    context.subscriptions.push(vscode.commands.registerCommand('cocapn.generateTests', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No file open');
            return;
        }
        const fileName = vscode.workspace.asRelativePath(editor.document.uri);
        const text = editor.document.getText();
        await sidebar.sendWithContext('Generate comprehensive tests for this code. Include unit tests covering normal cases, edge cases, and error conditions.', text, fileName);
    }));
    // Show repo status
    context.subscriptions.push(vscode.commands.registerCommand('cocapn.repoStatus', async () => {
        try {
            const resp = await fetch(`${serverUrl}/api/status`);
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }
            const data = await resp.json();
            const channel = vscode.window.createOutputChannel('Cocapn Repo Status');
            channel.clear();
            channel.appendLine('=== Cocapn Agent Status ===');
            channel.appendLine(JSON.stringify(data, null, 2));
            channel.show();
            sidebar.sendMessage('Show me the repo status and any active tasks.');
        }
        catch {
            vscode.window.showErrorMessage(`Cannot reach cocapn at ${serverUrl}. Start the bridge first.`);
        }
    }));
    // Context menu: Ask about this code
    context.subscriptions.push(vscode.commands.registerCommand('cocapn.askAboutCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        const fileName = vscode.workspace.asRelativePath(editor.document.uri);
        if (!text.trim()) {
            vscode.window.showWarningMessage('Select some code first');
            return;
        }
        const question = await vscode.window.showInputBox({
            prompt: 'What do you want to know about this code?',
            placeHolder: 'e.g., What does this function do? Are there any bugs?',
        });
        if (!question) {
            return;
        }
        await sidebar.sendWithContext(question, text, fileName);
    }));
    // Context menu: Explain this function
    context.subscriptions.push(vscode.commands.registerCommand('cocapn.explainFunction', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        const fileName = vscode.workspace.asRelativePath(editor.document.uri);
        if (!text.trim()) {
            vscode.window.showWarningMessage('Select a function first');
            return;
        }
        await sidebar.sendWithContext('Explain this function in detail — what it does, its parameters, return value, and any side effects.', text, fileName);
    }));
    // Context menu: Find related code
    context.subscriptions.push(vscode.commands.registerCommand('cocapn.findRelated', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        const fileName = vscode.workspace.asRelativePath(editor.document.uri);
        if (!text.trim()) {
            vscode.window.showWarningMessage('Select some code first');
            return;
        }
        await sidebar.sendWithContext('Find code related to this. What other files, functions, or modules interact with this code? List them with brief explanations.', text, fileName);
    }));
    // Context menu: Get refactoring suggestions
    context.subscriptions.push(vscode.commands.registerCommand('cocapn.getRefactorSuggestions', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        const fileName = vscode.workspace.asRelativePath(editor.document.uri);
        if (!text.trim()) {
            vscode.window.showWarningMessage('Select some code first');
            return;
        }
        await sidebar.sendWithContext('Suggest specific refactoring improvements for this code. Prioritize by impact.', text, fileName);
    }));
}
//# sourceMappingURL=commands.js.map