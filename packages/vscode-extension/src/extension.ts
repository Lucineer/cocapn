import * as vscode from 'vscode';
import { CocapnSidebar } from './sidebar';
import { CocapnStatusBar } from './statusbar';
import { registerCommands } from './commands';
import { FileWatcher } from './fileWatcher';

let sidebar: CocapnSidebar;
let statusBar: CocapnStatusBar;
let fileWatcher: FileWatcher | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('cocapn');
  const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

  // Sidebar chat panel
  sidebar = new CocapnSidebar(context.extensionUri, serverUrl);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('cocapn.chatView', sidebar)
  );

  // Status bar
  statusBar = new CocapnStatusBar(serverUrl);
  context.subscriptions.push(statusBar);

  // Commands
  registerCommands(context, sidebar, serverUrl);

  // File watcher
  if (config.get<boolean>('autoWatch', true)) {
    fileWatcher = new FileWatcher(serverUrl);
    context.subscriptions.push(fileWatcher);
  }

  // Initial status check
  statusBar.checkConnection();
}

export function deactivate(): void {
  // Cleanup handled by disposables in context.subscriptions
}
