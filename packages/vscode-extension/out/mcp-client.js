"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpClient = void 0;
/**
 * MCP client — connects to cocapn's MCP server for tool integration.
 * Uses JSON-RPC over stdio (spawned as a subprocess).
 */
class McpClient {
    _serverUrl;
    constructor(serverUrl) {
        this._serverUrl = serverUrl;
    }
    async listTools() {
        try {
            const resp = await fetch(`${this._serverUrl}/api/mcp/tools`);
            if (!resp.ok) {
                return [];
            }
            const data = await resp.json();
            return data.tools || [];
        }
        catch {
            return [];
        }
    }
    async callTool(name, args) {
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
exports.McpClient = McpClient;
//# sourceMappingURL=mcp-client.js.map