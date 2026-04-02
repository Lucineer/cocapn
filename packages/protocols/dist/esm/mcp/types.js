/**
 * MCP (Model Context Protocol) types based on JSON-RPC 2.0.
 * These types are environment-agnostic and work in both Node.js and Cloudflare Workers.
 */
// Standard JSON-RPC error codes
export const JsonRpcErrorCode = {
    ParseError: -32700,
    InvalidRequest: -32600,
    MethodNotFound: -32601,
    InvalidParams: -32602,
    InternalError: -32603,
};
//# sourceMappingURL=types.js.map