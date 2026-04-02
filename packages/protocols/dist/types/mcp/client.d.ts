/**
 * MCPClient — environment-agnostic MCP client.
 *
 * Performs the initialize handshake then exposes typed methods for
 * listing tools, calling tools, listing resources, and reading resources.
 * Works with any MCPTransport.
 */
import type { MCPTransport } from "./transport.js";
import type { McpCallToolParams, McpCallToolResult, McpCapabilities, McpClientInfo, McpInitializeResult, McpReadResourceResult, McpResource, McpTool } from "./types.js";
export interface McpClientOptions {
    clientInfo: McpClientInfo;
    capabilities?: McpCapabilities;
}
export declare class MCPClient {
    private transport;
    private nextId;
    private pending;
    private readonly clientInfo;
    private readonly capabilities;
    private serverInfo;
    constructor(options: McpClientOptions);
    /** Connect to an MCP server via the given transport and perform the handshake. */
    connect(transport: MCPTransport): Promise<McpInitializeResult>;
    close(): Promise<void>;
    listTools(): Promise<McpTool[]>;
    callTool(params: McpCallToolParams): Promise<McpCallToolResult>;
    listResources(): Promise<McpResource[]>;
    readResource(uri: string): Promise<McpReadResourceResult>;
    private request;
    private handleMessage;
}
//# sourceMappingURL=client.d.ts.map