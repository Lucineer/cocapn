import * as vscode from 'vscode';

export class CocapnStatusBar extends vscode.Disposable {
  private _statusBarItem: vscode.StatusBarItem;
  private _serverUrl: string;
  private _connected: boolean = false;
  private _tokenCount: number = 0;

  constructor(serverUrl: string) {
    super(() => this.dispose());
    this._serverUrl = serverUrl;

    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this._statusBarItem.command = 'cocapn.openChat';
    this._statusBarItem.name = 'Cocapn';
    this._update();
    this._statusBarItem.show();
  }

  public async checkConnection(): Promise<void> {
    try {
      const resp = await fetch(`${this._serverUrl}/api/status`, {
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        const data = await resp.json() as Record<string, unknown>;
        this._connected = true;
        const name = (data.agentName as string) || 'cocapn';
        const memCount = (data.memoryCount as number) || 0;
        this._statusBarItem.text = `$(hubot) ${name} $(circle-filled) ${memCount} memories`;
        this._statusBarItem.tooltip = `Cocapn: Connected — ${name}\n${memCount} memory entries`;
      } else {
        this._setDisconnected();
      }
    } catch {
      this._setDisconnected();
    }
    this._update();
  }

  public addTokens(count: number): void {
    this._tokenCount += count;
    this._update();
  }

  public setConnected(connected: boolean): void {
    this._connected = connected;
    this._update();
  }

  private _setDisconnected(): void {
    this._connected = false;
    this._statusBarItem.text = '$(hubot) cocapn $(circle-slash)';
    this._statusBarItem.tooltip = 'Cocapn: Disconnected — click to open chat';
  }

  private _update(): void {
    this._statusBarItem.show();
  }

  public override dispose(): void {
    this._statusBarItem.dispose();
  }
}
