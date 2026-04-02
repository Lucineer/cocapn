/**
 * Analytics Module — event tracking, metrics, and exports.
 *
 * Main entry point for the analytics system.
 *
 * Example usage:
 * ```ts
 * import { Analytics } from "./analytics/index.js";
 *
 * const analytics = new Analytics({ dbPath: "./analytics.db" });
 *
 * // Track events
 * analytics.track("chat", { messageLength: 100, success: true });
 *
 * // Get metrics
 * const summary = analytics.getSummary();
 *
 * // Export data
 * const report = analytics.exportMarkdown();
 * ```
 */
export { AnalyticsCollector } from "./collector.js";
export { MetricsCalculator } from "./metrics.js";
export { AnalyticsExporter } from "./exporter.js";
import { AnalyticsCollector } from "./collector.js";
import { MetricsCalculator } from "./metrics.js";
import { AnalyticsExporter } from "./exporter.js";
/**
 * Main Analytics class — combines collector, metrics, and exporter.
 */
export class Analytics {
    collector;
    metrics;
    exporter;
    constructor(options = {}) {
        this.collector = new AnalyticsCollector(options);
        this.metrics = new MetricsCalculator(this.collector);
        this.exporter = new AnalyticsExporter(this.collector, this.metrics);
    }
    /**
     * Track an analytics event (delegates to collector).
     */
    track(type, data, sessionId) {
        return this.collector.track(type, data, sessionId);
    }
    /**
     * Get a summary of all metrics.
     */
    getSummary(period) {
        return this.metrics.getSummary(period);
    }
    /**
     * Export analytics data.
     */
    export(options) {
        return this.exporter.export(options);
    }
    /**
     * Export as JSON.
     */
    exportJSON(period) {
        const options = { format: "json" };
        if (period !== undefined) {
            options.period = period;
        }
        return this.exporter.exportJSON(options).content;
    }
    /**
     * Export as CSV.
     */
    exportCSV(period) {
        const options = { format: "csv" };
        if (period !== undefined) {
            options.period = period;
        }
        return this.exporter.exportCSV(options).content;
    }
    /**
     * Export as Markdown.
     */
    exportMarkdown(period) {
        const options = { format: "markdown" };
        if (period !== undefined) {
            options.period = period;
        }
        return this.exporter.exportMarkdown(options).content;
    }
    /**
     * Close the analytics system.
     */
    close() {
        this.collector.close();
    }
    /**
     * Rotate old events.
     */
    rotateOldEvents() {
        return this.collector.rotateOldEvents();
    }
}
//# sourceMappingURL=index.js.map