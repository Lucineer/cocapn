/**
 * Queue Handler — handles QUEUE_STATUS typed messages.
 *
 * Protocol:
 *   Input:  { type: "QUEUE_STATUS", id }
 *   Output: { type: "QUEUE_STATUS", id, status, health, tenantStatus? }
 *
 * Also handles QUEUE_CANCEL to cancel a queued request.
 */
export async function handleQueueStatus(ws, _clientId, msg, ctx) {
    const queue = ctx.requestQueue;
    if (!queue) {
        ws.send(JSON.stringify({
            type: "QUEUE_STATUS",
            id: msg.id,
            error: "Queue not available",
        }));
        return;
    }
    const status = queue.getStatus();
    const health = queue.getHealth();
    const tenantId = msg["tenantId"];
    const tenantStatus = tenantId ? queue.getTenantStatus(tenantId) : undefined;
    ws.send(JSON.stringify({
        type: "QUEUE_STATUS",
        id: msg.id,
        status,
        health,
        ...(tenantStatus ? { tenantStatus } : {}),
    }));
}
export async function handleQueueCancel(ws, _clientId, msg, ctx) {
    const queue = ctx.requestQueue;
    if (!queue) {
        ws.send(JSON.stringify({
            type: "QUEUE_CANCEL",
            id: msg.id,
            error: "Queue not available",
        }));
        return;
    }
    const itemId = msg["itemId"];
    if (!itemId) {
        ws.send(JSON.stringify({
            type: "QUEUE_CANCEL",
            id: msg.id,
            error: "Missing itemId",
        }));
        return;
    }
    const cancelled = await queue.cancel(itemId);
    ws.send(JSON.stringify({
        type: "QUEUE_CANCEL",
        id: msg.id,
        cancelled,
    }));
}
//# sourceMappingURL=queue.js.map