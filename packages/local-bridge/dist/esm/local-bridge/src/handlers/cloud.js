/**
 * Cloud Operation Handlers
 *
 * WebSocket message handlers for cloud worker integration:
 * - CLOUD_STATUS: Get cloud connection status
 * - CLOUD_SUBMIT_TASK: Submit task to cloud worker
 * - CLOUD_TASK_RESULT: Get task result from cloud worker
 */
// ─── Get Cloud Connector Helper ────────────────────────────────────────────────
/**
 * Get the CloudConnector instance from the handler context.
 * Returns undefined if cloud is not configured.
 */
function getCloudConnector(ctx) {
    // The CloudConnector is stored on the bridge instance
    const bridge = ctx.bridge;
    if (!bridge)
        return undefined;
    // Try to get the connector from the bridge
    return bridge.cloudConnector;
}
// ─── Handlers ───────────────────────────────────────────────────────────────────
/**
 * Handle CLOUD_STATUS message.
 * Returns the current cloud connection status.
 */
export async function handleCloudStatus(ws, clientId, _msg, ctx) {
    const connector = getCloudConnector(ctx);
    const sender = ctx.sender;
    if (!connector) {
        sender.error(ws, null, 'Cloud connector not available');
        return;
    }
    try {
        const status = await connector.getStatus();
        sender.result(ws, null, {
            type: 'CLOUD_STATUS',
            status,
        });
    }
    catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        sender.error(ws, null, `Failed to get cloud status: ${error}`);
    }
}
/**
 * Handle CLOUD_SUBMIT_TASK message.
 * Submits a task to the cloud worker.
 */
export async function handleCloudSubmitTask(ws, clientId, msg, ctx) {
    const connector = getCloudConnector(ctx);
    const sender = ctx.sender;
    if (!connector) {
        sender.error(ws, null, 'Cloud connector not available');
        return;
    }
    const message = msg;
    if (!message.taskType) {
        sender.error(ws, null, 'Missing taskType');
        return;
    }
    try {
        // Check hybrid mode routing
        const shouldRunLocally = connector.shouldRunLocally({
            type: message.taskType,
            payload: message.payload,
        });
        if (shouldRunLocally) {
            sender.result(ws, null, {
                type: 'CLOUD_SUBMIT_TASK',
                routed: 'local',
                message: 'Task routed to local execution',
            });
            return;
        }
        // Submit to cloud
        const task = {
            type: message.taskType,
            payload: message.payload,
        };
        if (message.waitForCompletion) {
            const result = await connector.submitTaskAndWait(task, {
                pollInterval: message.pollInterval,
                timeout: message.timeout,
            });
            sender.result(ws, null, {
                type: 'CLOUD_SUBMIT_TASK',
                routed: 'cloud',
                result,
            });
        }
        else {
            const submitResult = await connector.submitTask(task);
            sender.result(ws, null, {
                type: 'CLOUD_SUBMIT_TASK',
                routed: 'cloud',
                taskId: submitResult.taskId,
                status: submitResult.status,
            });
        }
    }
    catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        sender.error(ws, null, `Task submission failed: ${error}`);
    }
}
/**
 * Handle CLOUD_TASK_RESULT message.
 * Gets the result of a previously submitted task.
 */
export async function handleCloudTaskResult(ws, clientId, msg, ctx) {
    const connector = getCloudConnector(ctx);
    const sender = ctx.sender;
    if (!connector) {
        sender.error(ws, null, 'Cloud connector not available');
        return;
    }
    const message = msg;
    if (!message.taskId) {
        sender.error(ws, null, 'Missing taskId');
        return;
    }
    try {
        const result = await connector.getTaskResult(message.taskId);
        sender.result(ws, null, {
            type: 'CLOUD_TASK_RESULT',
            result,
        });
    }
    catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        sender.error(ws, null, `Failed to get task result: ${error}`);
    }
}
//# sourceMappingURL=cloud.js.map