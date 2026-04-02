"use strict";
/**
 * WorkerTransport — MCP transport for Cloudflare Workers.
 *
 * Communicates using the Fetch API and the WebSocket API available in
 * the Workers runtime. Does NOT use Node.js built-ins (no `process`, `stream`, etc.).
 *
 * Connection model: the Worker acts as a WebSocket client connecting to the
 * local bridge's WebSocket server (or another Worker's Durable Object WebSocket).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerTransport = void 0;
const transport_js_1 = require("./transport.cjs");
class WorkerTransport extends transport_js_1.BaseTransport {
    url;
    headers;
    ws = null;
    constructor(options) {
        super();
        this.url = options.url;
        this.headers = options.headers ?? {};
    }
    async start() {
        // Workers WebSocket API: use fetch with Upgrade header
        const response = await fetch(this.url, {
            headers: {
                Upgrade: "websocket",
                ...this.headers,
            },
        });
        // Cloudflare Workers returns the WebSocket from the response
        const ws = response.webSocket;
        if (!ws) {
            throw new Error(`WorkerTransport: server at ${this.url} did not return a WebSocket upgrade`);
        }
        this.ws = ws;
        ws.addEventListener("message", (event) => {
            const data = typeof event.data === "string" ? event.data : "";
            try {
                const parsed = JSON.parse(data);
                this.notifyMessage(parsed).catch((err) => {
                    this.notifyError(err instanceof Error ? err : new Error(String(err)));
                });
            }
            catch {
                this.notifyError(new Error(`WorkerTransport: failed to parse message: ${data}`));
            }
        });
        ws.addEventListener("error", () => {
            this.notifyError(new Error("WorkerTransport: WebSocket error"));
        });
        ws.addEventListener("close", () => {
            this.ws = null;
            this.notifyClose();
        });
        // accept() is a Cloudflare Workers WebSocket extension, not in the standard lib
        ws.accept();
    }
    async send(message) {
        if (!this.ws) {
            throw new Error("WorkerTransport: not connected — call start() first");
        }
        this.ws.send(JSON.stringify(message));
    }
    async close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
exports.WorkerTransport = WorkerTransport;
//# sourceMappingURL=worker-transport.js.map