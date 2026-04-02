/**
 * MCPServer — environment-agnostic MCP server.
 *
 * Accepts any MCPTransport so it can run on the local bridge (StdioTransport)
 * or inside a Cloudflare Worker (WorkerTransport). Handles the initialize
 * handshake and routes JSON-RPC method calls to registered handlers.
 */
import type { MCPTransport } from "./transport.js";
import type { McpCapabilities, McpCallToolParams, McpCallToolResult, McpReadResourceResult, McpResource, McpResourceTemplate, McpServerInfo, McpTool } from "./types.js";
export type ToolHandler = (params: McpCallToolParams) => Promise<McpCallToolResult>;
export interface ReadResourceParams {
    uri: string;
}
export type ResourceHandler = (params: ReadResourceParams) => Promise<McpReadResourceResult>;
/**
 * Pattern-based resource handler.
 * The pattern is a prefix with a trailing wildcard, e.g., "brain://facts/".
 * The handler receives the full URI and should extract the dynamic part.
 */
export interface ResourcePatternHandler {
    pattern: string;
    handler: ResourceHandler;
}
export interface McpServerOptions {
    serverInfo: McpServerInfo;
    capabilities?: McpCapabilities;
}
export declare class MCPServer {
    private transport;
    private tools;
    private resources;
    private resourcePatterns;
    private resourceTemplates;
    private readonly serverInfo;
    private readonly capabilities;
    private initialized;
    constructor(options: McpServerOptions);
    /** Register a tool and its handler. */
    registerTool(definition: McpTool, handler: ToolHandler): void;
    /** Register a resource and its handler. */
    registerResource(definition: McpResource, handler: ResourceHandler): void;
    /**
     * Register a resource pattern handler for dynamic URIs.
     * The pattern should be a prefix with a trailing "/" or "*", e.g., "brain://facts/".
     * If a URI doesn't match any exact resource, patterns are tried in order.
     */
    registerResourcePattern(patternHandler: ResourcePatternHandler): void;
    /** Register a resource template. */
    registerResourceTemplate(template: McpResourceTemplate): void;
    /** Test helper: get a tool handler by name. For testing only. */
    getToolHandlerForTest(name: string): ToolHandler | undefined;
    /** Test helper: get a resource handler by URI. For testing only. */
    getResourceHandlerForTest(uri: string): ResourceHandler | undefined;
    /** Connect a transport and start serving. */
    connect(transport: MCPTransport): Promise<void>;
    close(): Promise<void>;
    private handleMessage;
    private dispatch;
    private handleInitialize;
    private handleToolCall;
    private handleResourceRead;
    private requireInitialized;
    private reply;
    private replyError;
}
//# sourceMappingURL=server.d.ts.map