/**
 * MCP (Model Context Protocol) types based on JSON-RPC 2.0.
 * These types are environment-agnostic and work in both Node.js and Cloudflare Workers.
 */
export type JsonRpcId = string | number | null;
export interface JsonRpcRequest {
    jsonrpc: "2.0";
    id: JsonRpcId;
    method: string;
    params?: unknown;
}
export interface JsonRpcNotification {
    jsonrpc: "2.0";
    method: string;
    params?: unknown;
}
export interface JsonRpcSuccessResponse {
    jsonrpc: "2.0";
    id: JsonRpcId;
    result: unknown;
}
export interface JsonRpcErrorResponse {
    jsonrpc: "2.0";
    id: JsonRpcId;
    error: JsonRpcError;
}
export interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}
export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;
export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;
export declare const JsonRpcErrorCode: {
    readonly ParseError: -32700;
    readonly InvalidRequest: -32600;
    readonly MethodNotFound: -32601;
    readonly InvalidParams: -32602;
    readonly InternalError: -32603;
};
export interface McpCapabilities {
    tools?: Record<string, unknown>;
    resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
    };
    prompts?: Record<string, unknown>;
    sampling?: Record<string, unknown>;
    logging?: Record<string, unknown>;
}
export interface McpClientInfo {
    name: string;
    version: string;
}
export interface McpServerInfo {
    name: string;
    version: string;
}
export interface McpInitializeParams {
    protocolVersion: string;
    capabilities: McpCapabilities;
    clientInfo: McpClientInfo;
}
export interface McpInitializeResult {
    protocolVersion: string;
    capabilities: McpCapabilities;
    serverInfo: McpServerInfo;
}
export interface McpToolParameter {
    type: string;
    description?: string;
    enum?: unknown[];
    items?: McpToolParameter;
    properties?: Record<string, McpToolParameter>;
    required?: string[];
}
export interface McpToolAnnotation {
    audience: Array<"user" | "assistant">;
    priority: number;
}
export interface McpTool {
    name: string;
    description?: string;
    title?: string;
    inputSchema: {
        type: "object";
        properties?: Record<string, McpToolParameter>;
        required?: string[];
    };
    outputSchema?: Record<string, unknown>;
    annotations?: McpToolAnnotation;
}
export interface McpCallToolParams {
    name: string;
    arguments?: Record<string, unknown>;
}
export interface McpToolResultContent {
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
}
export interface McpCallToolResult {
    content: McpToolResultContent[];
    isError?: boolean;
}
export interface McpResource {
    uri: string;
    name: string;
    title?: string;
    description?: string;
    mimeType?: string;
}
export interface McpResourceTemplate {
    uriTemplate: string;
    name: string;
    title?: string;
    description?: string;
    mimeType?: string;
}
export interface McpResourceContent {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
}
export interface McpReadResourceResult {
    contents: McpResourceContent[];
}
export interface McpPrompt {
    name: string;
    description?: string;
    arguments?: Array<{
        name: string;
        description?: string;
        required?: boolean;
    }>;
}
export interface McpPromptMessage {
    role: "user" | "assistant";
    content: {
        type: "text" | "image" | "resource";
        text?: string;
        data?: string;
        mimeType?: string;
    };
}
export interface McpGetPromptResult {
    description?: string;
    messages: McpPromptMessage[];
}
export interface McpTransportMessage {
    /** Raw JSON string of the JSON-RPC message */
    raw: string;
    /** Parsed JSON-RPC message */
    parsed: JsonRpcMessage;
}
//# sourceMappingURL=types.d.ts.map