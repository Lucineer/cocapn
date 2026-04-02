/**
 * Analytics Handlers — WebSocket handlers for analytics operations.
 *
 * Provides ANALYTICS_STATS and ANALYTICS_EXPORT WebSocket methods.
 */
/**
 * Handle ANALYTICS_STATS WebSocket method
 * Returns analytics summary including token metrics, error rates, and top items
 */
export async function handleAnalyticsStats(context, sender, params) {
    const analytics = context.analytics;
    if (!analytics) {
        await sender({
            jsonrpc: "2.0",
            id: null,
            result: {
                success: false,
                error: "Analytics not available",
                stats: null,
            },
        });
        return;
    }
    try {
        let period;
        if (params.since || params.until) {
            period = {
                start: params.since ? new Date(params.since).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000,
                end: params.until ? new Date(params.until).getTime() : Date.now(),
            };
        }
        const summary = analytics.getSummary(period);
        await sender({
            jsonrpc: "2.0",
            id: null,
            result: {
                success: true,
                stats: summary,
            },
        });
    }
    catch (error) {
        await sender({
            jsonrpc: "2.0",
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
 * Handle ANALYTICS_EXPORT WebSocket method
 * Exports analytics data in JSON, CSV, or Markdown format
 */
export async function handleAnalyticsExport(context, sender, params) {
    const analytics = context.analytics;
    if (!analytics) {
        await sender({
            jsonrpc: "2.0",
            id: null,
            result: {
                success: false,
                error: "Analytics not available",
                export: null,
            },
        });
        return;
    }
    try {
        let period;
        if (params.since || params.until) {
            period = {
                start: params.since ? new Date(params.since).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000,
                end: params.until ? new Date(params.until).getTime() : Date.now(),
            };
        }
        const result = analytics.export({
            format: params.format,
            period,
            includeMetrics: params.includeMetrics ?? true,
        });
        await sender({
            jsonrpc: "2.0",
            id: null,
            result: {
                success: true,
                export: {
                    format: result.format,
                    content: result.content,
                    timestamp: result.timestamp,
                },
            },
        });
    }
    catch (error) {
        await sender({
            jsonrpc: "2.0",
            id: null,
            result: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                export: null,
            },
        });
    }
}
/**
 * Handle ANALYTICS_EVENTS WebSocket method
 * Returns raw events matching the given filter
 */
export async function handleAnalyticsEvents(context, sender, params) {
    const analytics = context.analytics;
    if (!analytics) {
        await sender({
            jsonrpc: "2.0",
            id: null,
            result: {
                success: false,
                error: "Analytics not available",
                events: [],
            },
        });
        return;
    }
    try {
        const filter = {};
        if (params.types && params.types.length > 0) {
            filter.types = params.types;
        }
        if (params.since) {
            filter.since = new Date(params.since).getTime();
        }
        if (params.until) {
            filter.until = new Date(params.until).getTime();
        }
        if (params.sessionId) {
            filter.sessionId = params.sessionId;
        }
        if (params.limit) {
            filter.limit = params.limit;
        }
        const events = analytics.collector.getEvents(filter);
        await sender({
            jsonrpc: "2.0",
            id: null,
            result: {
                success: true,
                events,
            },
        });
    }
    catch (error) {
        await sender({
            jsonrpc: "2.0",
            id: null,
            result: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                events: [],
            },
        });
    }
}
/**
 * Track helper function - records an analytics event
 */
export function trackAnalyticsEvent(analytics, type, data, sessionId) {
    if (!analytics)
        return;
    try {
        analytics.track(type, data, sessionId);
    }
    catch (error) {
        // Silently fail to avoid disrupting main flow
        console.error(`[analytics] Failed to track event:`, error);
    }
}
/**
 * Track chat event helper
 */
export function trackChatEvent(analytics, data, sessionId) {
    trackAnalyticsEvent(analytics, "chat", data, sessionId);
}
/**
 * Track skill load event helper
 */
export function trackSkillLoadEvent(analytics, data, sessionId) {
    trackAnalyticsEvent(analytics, "skill_load", data, sessionId);
}
/**
 * Track error event helper
 */
export function trackErrorEvent(analytics, data, sessionId) {
    trackAnalyticsEvent(analytics, "error", data, sessionId);
}
/**
 * Track task completion event helper
 */
export function trackTaskCompleteEvent(analytics, data, sessionId) {
    trackAnalyticsEvent(analytics, "task_complete", data, sessionId);
}
//# sourceMappingURL=analytics.js.map