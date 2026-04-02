"use strict";
/**
 * A2AServer — receives A2A tasks from remote agents.
 *
 * Handles inbound JSON-RPC 2.0 HTTP requests at a single endpoint.
 * Works in both Node.js (via http.IncomingMessage) and Cloudflare Workers
 * (via the Fetch API Request/Response types).
 *
 * Usage:
 *   const server = new A2AServer({ agentCard, taskHandler });
 *   // In a Worker:
 *   export default { fetch: (req) => server.handleRequest(req) };
 *   // In Node.js:
 *   http.createServer((req, res) => server.handleNodeRequest(req, res));
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.A2AServer = void 0;
const types_js_1 = require("./types.cjs");
class A2AServer {
    agentCard;
    onSendTask;
    onGetTask;
    onCancelTask;
    constructor(options) {
        this.agentCard = options.agentCard;
        this.onSendTask = options.onSendTask;
        this.onGetTask = options.onGetTask ?? (() => Promise.resolve(null));
        this.onCancelTask = options.onCancelTask ?? (() => Promise.resolve(null));
    }
    /**
     * Handle a Fetch API Request (Cloudflare Workers or Node.js 18+).
     * Returns a Fetch API Response.
     */
    async handleRequest(request) {
        const url = new URL(request.url);
        // Serve agent card at the well-known path
        if (url.pathname === "/.well-known/agent.json") {
            return new Response(JSON.stringify(this.agentCard), {
                headers: { "Content-Type": "application/json" },
            });
        }
        // All other requests are JSON-RPC
        if (request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405 });
        }
        let body;
        try {
            body = await request.json();
        }
        catch {
            return this.errorResponse(null, -32700, "Parse error");
        }
        return this.dispatchRpc(body);
    }
    // ---------------------------------------------------------------------------
    // JSON-RPC dispatch
    // ---------------------------------------------------------------------------
    async dispatchRpc(req) {
        const id = req.id ?? null;
        try {
            switch (req.method) {
                case "tasks/send": {
                    const task = await this.onSendTask(req.params);
                    return this.successResponse(id, task);
                }
                case "tasks/get": {
                    const params = req.params;
                    const task = await this.onGetTask(params.id);
                    if (!task) {
                        return this.errorResponse(id, types_js_1.A2AErrorCode.TaskNotFound, "Task not found");
                    }
                    return this.successResponse(id, task);
                }
                case "tasks/cancel": {
                    const params = req.params;
                    const task = await this.onCancelTask(params.id);
                    if (!task) {
                        return this.errorResponse(id, types_js_1.A2AErrorCode.TaskNotCancelable, "Task not found or cannot be canceled");
                    }
                    return this.successResponse(id, task);
                }
                default:
                    return this.errorResponse(id, -32601, `Method not found: ${req.method}`);
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return this.errorResponse(id, -32603, message);
        }
    }
    // ---------------------------------------------------------------------------
    // Helpers for building task objects
    // ---------------------------------------------------------------------------
    static makeTask(id, status, sessionId) {
        const task = { id, status, artifacts: [], history: [] };
        if (sessionId !== undefined)
            task.sessionId = sessionId;
        return task;
    }
    // ---------------------------------------------------------------------------
    // Response helpers
    // ---------------------------------------------------------------------------
    successResponse(id, result) {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
            headers: { "Content-Type": "application/json" },
        });
    }
    errorResponse(id, code, message) {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }), {
            status: 200, // A2A spec: error responses still return 200
            headers: { "Content-Type": "application/json" },
        });
    }
}
exports.A2AServer = A2AServer;
//# sourceMappingURL=server.js.map