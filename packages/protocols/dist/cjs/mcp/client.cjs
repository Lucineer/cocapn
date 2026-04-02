"use strict";
/**
 * MCPClient — environment-agnostic MCP client.
 *
 * Performs the initialize handshake then exposes typed methods for
 * listing tools, calling tools, listing resources, and reading resources.
 * Works with any MCPTransport.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPClient = void 0;
class MCPClient {
    transport = null;
    nextId = 1;
    pending = new Map();
    clientInfo;
    capabilities;
    serverInfo = null;
    constructor(options) {
        this.clientInfo = options.clientInfo;
        this.capabilities = options.capabilities ?? {};
    }
    /** Connect to an MCP server via the given transport and perform the handshake. */
    async connect(transport) {
        this.transport = transport;
        transport.onMessage((msg) => this.handleMessage(msg));
        transport.onError((err) => {
            // Reject all pending requests on transport error
            for (const [, pending] of this.pending) {
                pending.reject(err);
            }
            this.pending.clear();
        });
        transport.onClose(() => {
            const err = new Error("MCPClient: transport closed");
            for (const [, pending] of this.pending) {
                pending.reject(err);
            }
            this.pending.clear();
            this.transport = null;
        });
        await transport.start();
        this.serverInfo = await this.request("initialize", {
            protocolVersion: "2024-11-05",
            capabilities: this.capabilities,
            clientInfo: this.clientInfo,
        });
        return this.serverInfo;
    }
    async close() {
        await this.transport?.close();
        this.transport = null;
    }
    // ---------------------------------------------------------------------------
    // MCP API methods
    // ---------------------------------------------------------------------------
    async listTools() {
        const result = await this.request("tools/list", {});
        return result.tools;
    }
    async callTool(params) {
        return this.request("tools/call", params);
    }
    async listResources() {
        const result = await this.request("resources/list", {});
        return result.resources;
    }
    async readResource(uri) {
        return this.request("resources/read", { uri });
    }
    // ---------------------------------------------------------------------------
    // Internal request/response machinery
    // ---------------------------------------------------------------------------
    async request(method, params) {
        if (!this.transport) {
            throw new Error("MCPClient: not connected — call connect() first");
        }
        const id = this.nextId++;
        const message = { jsonrpc: "2.0", id, method, params };
        return new Promise((resolve, reject) => {
            this.pending.set(id, {
                resolve: (result) => resolve(result),
                reject,
            });
            this.transport.send(message).catch(reject);
        });
    }
    handleMessage(msg) {
        // Only process responses (has id, no method)
        if (!("id" in msg) || "method" in msg)
            return;
        const response = msg;
        const pending = this.pending.get(response.id);
        if (!pending)
            return;
        this.pending.delete(response.id);
        if ("error" in response) {
            pending.reject(new Error(`MCP error ${response.error.code}: ${response.error.message}`));
        }
        else {
            pending.resolve(response.result);
        }
    }
}
exports.MCPClient = MCPClient;
//# sourceMappingURL=client.js.map