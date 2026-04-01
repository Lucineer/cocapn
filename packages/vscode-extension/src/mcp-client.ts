import * as vscode from 'vscode';

/**
 * MCP client — connects to cocapn's MCP server for tool integration.
 * Uses JSON-RPC over stdio (spawned as a subprocess).
 */
export class McpClient {
  private _serverUrl: string;

  constructor(serverUrl: string) {
    this._serverUrl = serverUrl;
  }

  async listTools(): Promise<unknown[]> {
    try {
      const resp = await fetch(`${this._serverUrl}/api/mcp/tools`);
      if (!resp.ok) {
        return [];
      }
      const data = await resp.json() as { tools?: unknown[] };
      return data.tools || [];
    } catch {
      return [];
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const resp = await fetch(`${this._serverUrl}/api/mcp/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, arguments: args }),
    });
    if (!resp.ok) {
      throw new Error(`MCP call failed: ${resp.status}`);
    }
    return resp.json();
  }
}
