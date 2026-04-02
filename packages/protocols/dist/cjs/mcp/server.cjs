"use strict";
/**
 * MCPServer — environment-agnostic MCP server.
 *
 * Accepts any MCPTransport so it can run on the local bridge (StdioTransport)
 * or inside a Cloudflare Worker (WorkerTransport). Handles the initialize
 * handshake and routes JSON-RPC method calls to registered handlers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPServer = void 0;
const types_js_1 = require("./types.cjs");
class MCPServer {
    transport = null;
    tools = new Map();
    resources = new Map();
    resourcePatterns = [];
    resourceTemplates = new Map();
    serverInfo;
    capabilities;
    initialized = false;
    constructor(options) {
        this.serverInfo = options.serverInfo;
        this.capabilities = options.capabilities ?? { tools: {} };
    }
    /** Register a tool and its handler. */
    registerTool(definition, handler) {
        this.tools.set(definition.name, { definition, handler });
    }
    /** Register a resource and its handler. */
    registerResource(definition, handler) {
        this.resources.set(definition.uri, { definition, handler });
    }
    /**
     * Register a resource pattern handler for dynamic URIs.
     * The pattern should be a prefix with a trailing "/" or "*", e.g., "brain://facts/".
     * If a URI doesn't match any exact resource, patterns are tried in order.
     */
    registerResourcePattern(patternHandler) {
        this.resourcePatterns.push(patternHandler);
    }
    /** Register a resource template. */
    registerResourceTemplate(template) {
        this.resourceTemplates.set(template.uriTemplate, template);
    }
    /** Test helper: get a tool handler by name. For testing only. */
    getToolHandlerForTest(name) {
        return this.tools.get(name)?.handler;
    }
    /** Test helper: get a resource handler by URI. For testing only. */
    getResourceHandlerForTest(uri) {
        return this.resources.get(uri)?.handler;
    }
    /** Connect a transport and start serving. */
    async connect(transport) {
        this.transport = transport;
        transport.onMessage((msg) => this.handleMessage(msg));
        transport.onError((err) => console.error("[MCPServer] transport error:", err));
        transport.onClose(() => {
            this.initialized = false;
            this.transport = null;
        });
        await transport.start();
    }
    async close() {
        await this.transport?.close();
        this.transport = null;
        this.initialized = false;
    }
    // ---------------------------------------------------------------------------
    // Message routing
    // ---------------------------------------------------------------------------
    async handleMessage(msg) {
        // Only handle requests (has id + method)
        if (!("method" in msg))
            return;
        const req = msg;
        try {
            const result = await this.dispatch(req);
            await this.reply(req.id, result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await this.replyError(req.id, types_js_1.JsonRpcErrorCode.InternalError, message);
        }
    }
    async dispatch(req) {
        switch (req.method) {
            case "initialize":
                return this.handleInitialize(req.params);
            case "tools/list":
                this.requireInitialized();
                return { tools: [...this.tools.values()].map((t) => t.definition) };
            case "tools/call":
                this.requireInitialized();
                return this.handleToolCall(req.params);
            case "resources/list":
                this.requireInitialized();
                return {
                    resources: [...this.resources.values()].map((r) => r.definition),
                    resourceTemplates: [...this.resourceTemplates.values()],
                };
            case "resources/read":
                this.requireInitialized();
                return this.handleResourceRead(req.params);
            default:
                throw Object.assign(new Error(`Method not found: ${req.method}`), { code: types_js_1.JsonRpcErrorCode.MethodNotFound });
        }
    }
    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------
    handleInitialize(params) {
        // Accept any protocol version for now; real implementation would negotiate
        void params;
        this.initialized = true;
        return {
            protocolVersion: "2024-11-05",
            capabilities: this.capabilities,
            serverInfo: this.serverInfo,
        };
    }
    async handleToolCall(params) {
        const entry = this.tools.get(params.name);
        if (!entry) {
            return {
                content: [{ type: "text", text: `Unknown tool: ${params.name}` }],
                isError: true,
            };
        }
        return entry.handler(params);
    }
    async handleResourceRead(params) {
        // Try exact match first
        const entry = this.resources.get(params.uri);
        if (entry) {
            return entry.handler(params);
        }
        // Try pattern handlers
        for (const { pattern, handler } of this.resourcePatterns) {
            if (params.uri.startsWith(pattern)) {
                return handler(params);
            }
        }
        throw Object.assign(new Error(`Resource not found: ${params.uri}`), { code: types_js_1.JsonRpcErrorCode.InvalidParams });
    }
    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------
    requireInitialized() {
        if (!this.initialized) {
            throw Object.assign(new Error("Server not initialized — client must call initialize first"), { code: types_js_1.JsonRpcErrorCode.InvalidRequest });
        }
    }
    async reply(id, result) {
        await this.transport?.send({ jsonrpc: "2.0", id, result });
    }
    async replyError(id, code, message) {
        await this.transport?.send({ jsonrpc: "2.0", id, error: { code, message } });
    }
}
exports.MCPServer = MCPServer;
//# sourceMappingURL=server.js.map