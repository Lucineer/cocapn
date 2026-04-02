/**
 * Sender — encapsulates WebSocket frame serialization.
 *
 * Extracted from server.ts so handlers don't need to call ws.send(JSON.stringify(...))
 * directly. Also makes testing easier — inject a mock Sender.
 */
import { WebSocket } from "ws";
export function createSender() {
    return {
        typed(ws, payload) {
            ws.send(JSON.stringify(payload));
        },
        result(ws, id, result) {
            ws.send(JSON.stringify({ jsonrpc: "2.0", id, result }));
        },
        error(ws, id, code, message) {
            ws.send(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }));
        },
        broadcast(wss, payload) {
            const raw = JSON.stringify(payload);
            for (const client of wss.clients) {
                if (client.readyState === WebSocket.OPEN)
                    client.send(raw);
            }
        },
    };
}
//# sourceMappingURL=send.js.map