/**
 * MCP client — connects to cocapn's MCP server for tool integration.
 * Uses JSON-RPC over stdio (spawned as a subprocess).
 */
export declare class McpClient {
    private _serverUrl;
    constructor(serverUrl: string);
    listTools(): Promise<unknown[]>;
    callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=mcp-client.d.ts.map