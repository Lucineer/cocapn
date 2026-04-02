"use strict";
/**
 * MCPTransport interface — abstracts the wire transport for MCP messages.
 *
 * Implementations:
 *   - StdioTransport: for local bridge, communicates via process stdin/stdout
 *   - WorkerTransport: for Cloudflare Workers, communicates via fetch/WebSocket
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTransport = void 0;
/**
 * Base class providing handler registration boilerplate.
 * Concrete transports extend this and call the protected notify* methods.
 */
class BaseTransport {
    messageHandlers = [];
    errorHandlers = [];
    closeHandlers = [];
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }
    onError(handler) {
        this.errorHandlers.push(handler);
    }
    onClose(handler) {
        this.closeHandlers.push(handler);
    }
    async notifyMessage(message) {
        for (const handler of this.messageHandlers) {
            await handler(message);
        }
    }
    notifyError(error) {
        for (const handler of this.errorHandlers) {
            handler(error);
        }
    }
    notifyClose() {
        for (const handler of this.closeHandlers) {
            handler();
        }
    }
}
exports.BaseTransport = BaseTransport;
//# sourceMappingURL=transport.js.map