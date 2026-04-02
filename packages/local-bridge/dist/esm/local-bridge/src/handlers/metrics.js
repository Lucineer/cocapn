/**
 * Metrics Handler — WebSocket handler for token tracking and metrics
 */
/**
 * Handle TOKEN_STATS WebSocket method
 * Returns token usage statistics
 */
export async function handleTokenStats(context, sender, params) {
    const { tokenTracker } = context;
    if (!tokenTracker) {
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: false,
                error: 'Token tracker not available',
                stats: null,
            },
        });
        return;
    }
    try {
        const since = params.since ? new Date(params.since) : undefined;
        const until = params.until ? new Date(params.until) : undefined;
        const stats = tokenTracker.getStats(since, until);
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: true,
                stats,
            },
        });
    }
    catch (error) {
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                stats: null,
            },
        });
    }
}
/**
 * Handle TOKEN_EFFICIENCY WebSocket method
 * Returns efficiency trend over time
 */
export async function handleTokenEfficiency(context, sender, params) {
    const { tokenTracker } = context;
    if (!tokenTracker) {
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: false,
                error: 'Token tracker not available',
                trend: [],
            },
        });
        return;
    }
    try {
        const buckets = params.buckets || 24;
        const trend = tokenTracker.getEfficiencyTrend(buckets);
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: true,
                trend,
            },
        });
    }
    catch (error) {
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                trend: [],
            },
        });
    }
}
/**
 * Handle TOKEN_WASTE WebSocket method
 * Returns waste analysis for inefficient modules/skills
 */
export async function handleTokenWaste(context, sender) {
    const { tokenTracker } = context;
    if (!tokenTracker) {
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: false,
                error: 'Token tracker not available',
                waste: [],
            },
        });
        return;
    }
    try {
        const waste = tokenTracker.findWaste();
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: true,
                waste,
            },
        });
    }
    catch (error) {
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                waste: [],
            },
        });
    }
}
/**
 * Handle RECORD_TOKENS helper function
 * Records token usage for a message
 */
export function recordMessageTokens(tokenTracker, message, response, metadata) {
    if (!tokenTracker)
        return;
    const tokensIn = TokenTracker.estimateTokens(message);
    const tokensOut = TokenTracker.estimateTokens(response);
    tokenTracker.record({
        messageType: 'user',
        tokensIn,
        tokensOut,
        model: metadata.model,
        module: metadata.module,
        skill: metadata.skill,
        taskType: metadata.taskType || 'chat',
        duration: metadata.duration,
        success: metadata.success,
    });
}
//# sourceMappingURL=metrics.js.map