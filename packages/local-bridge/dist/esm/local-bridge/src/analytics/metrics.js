/**
 * Analytics Metrics Calculator — computes metrics from collected events.
 *
 * Provides token usage, efficiency trends, error rates, top items, and
 * latency percentiles.
 */
// ---------------------------------------------------------------------------
// MetricsCalculator
// ---------------------------------------------------------------------------
/**
 * Calculates analytics metrics from collected events.
 */
export class MetricsCalculator {
    collector;
    constructor(collector) {
        this.collector = collector;
    }
    // -------------------------------------------------------------------------
    // Token Metrics
    // -------------------------------------------------------------------------
    /**
     * Calculate token usage per day.
     */
    tokensPerDay(period) {
        const p = period ?? this.getDefaultPeriod();
        const report = this.collector.aggregate(p);
        // Calculate days in period
        const days = Math.max(1, (p.end - p.start) / (24 * 60 * 60 * 1000));
        return Math.round(report.tokensUsed / days);
    }
    /**
     * Calculate token usage per task.
     */
    tokensPerTask(period) {
        const p = period ?? this.getDefaultPeriod();
        const report = this.collector.aggregate(p);
        const taskCount = Object.values(report.taskBreakdown).reduce((a, b) => a + b, 0);
        return taskCount > 0 ? Math.round(report.tokensUsed / taskCount) : 0;
    }
    /**
     * Get comprehensive token metrics.
     */
    getTokenMetrics(period) {
        const p = period ?? this.getDefaultPeriod();
        const report = this.collector.aggregate(p);
        const taskCount = Object.values(report.taskBreakdown).reduce((a, b) => a + b, 0);
        const successfulTasks = Object.entries(report.taskBreakdown)
            .filter(([type]) => !type.includes("fail") && !type.includes("error"))
            .reduce((sum, [, count]) => sum + count, 0);
        const days = Math.max(1, (p.end - p.start) / (24 * 60 * 60 * 1000));
        const perDay = Math.round(report.tokensUsed / days);
        const perTask = taskCount > 0 ? Math.round(report.tokensUsed / taskCount) : 0;
        const efficiency = taskCount > 0 ? successfulTasks / taskCount : 0;
        return {
            perDay,
            perTask,
            total: report.tokensUsed,
            efficiency,
        };
    }
    /**
     * Calculate efficiency trend over time.
     * @param days Number of days to analyze (default: 7)
     * @param buckets Number of time buckets (default: days)
     */
    efficiencyTrend(days = 7, buckets = days) {
        const now = Date.now();
        const period = {
            start: now - days * 24 * 60 * 60 * 1000,
            end: now,
        };
        const events = this.collector.getEventsInPeriod(period);
        if (events.length === 0) {
            return [];
        }
        const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);
        const startTime = sortedEvents[0]?.timestamp ?? 0;
        const endTime = sortedEvents[sortedEvents.length - 1]?.timestamp ?? 0;
        const bucketSize = Math.max(1, (endTime - startTime) / buckets);
        const trend = [];
        for (let i = 0; i < buckets; i++) {
            const bucketStart = startTime + i * bucketSize;
            const bucketEnd = bucketStart + bucketSize;
            const bucketEvents = sortedEvents.filter((e) => e.timestamp >= bucketStart && e.timestamp < bucketEnd);
            if (bucketEvents.length === 0)
                continue;
            // Calculate efficiency for this bucket
            let tokens = 0;
            let tasks = 0;
            let successfulTasks = 0;
            for (const event of bucketEvents) {
                if (event.type === "token_usage") {
                    const tokensIn = event.data.tokensIn ?? 0;
                    const tokensOut = event.data.tokensOut ?? 0;
                    tokens += tokensIn + tokensOut;
                }
                if (event.type === "task_complete") {
                    tasks++;
                    if (event.data.success) {
                        successfulTasks++;
                    }
                }
            }
            const efficiency = tasks > 0 ? successfulTasks / tasks : 0;
            trend.push({
                date: new Date(bucketStart).toISOString().split("T")[0],
                efficiency,
                tokens,
                tasks,
            });
        }
        return trend;
    }
    // -------------------------------------------------------------------------
    // Error Metrics
    // -------------------------------------------------------------------------
    /**
     * Calculate error rate.
     */
    errorRate(period) {
        const p = period ?? this.getDefaultPeriod();
        const report = this.collector.aggregate(p);
        return report.totalRequests > 0 ? report.errors / report.totalRequests : 0;
    }
    /**
     * Get comprehensive error metrics.
     */
    getErrorMetrics(period) {
        const p = period ?? this.getDefaultPeriod();
        const events = this.collector.getEventsInPeriod(p);
        const errorEvents = events.filter((e) => e.type === "error");
        const totalErrors = errorEvents.length;
        const totalRequests = events.length;
        const byType = {};
        for (const event of errorEvents) {
            const errorType = event.data.errorType;
            if (errorType) {
                byType[errorType] = (byType[errorType] ?? 0) + 1;
            }
        }
        return {
            rate: totalRequests > 0 ? totalErrors / totalRequests : 0,
            totalErrors,
            totalRequests,
            byType,
        };
    }
    // -------------------------------------------------------------------------
    // Top Items
    // -------------------------------------------------------------------------
    /**
     * Get top used skills.
     */
    topSkills(count = 10, period) {
        const p = period ?? this.getDefaultPeriod();
        const report = this.collector.aggregate(p);
        return report.topSkills.slice(0, count);
    }
    /**
     * Get top matched intents.
     */
    topIntents(count = 10, period) {
        const p = period ?? this.getDefaultPeriod();
        const report = this.collector.aggregate(p);
        return report.topIntents.slice(0, count);
    }
    /**
     * Get top used modules.
     */
    topModules(count = 10, period) {
        const p = period ?? this.getDefaultPeriod();
        const report = this.collector.aggregate(p);
        return report.topModules.slice(0, count);
    }
    /**
     * Get all top items.
     */
    getTopItems(count = 10, period) {
        return {
            skills: this.topSkills(count, period),
            intents: this.topIntents(count, period),
            modules: this.topModules(count, period),
        };
    }
    // -------------------------------------------------------------------------
    // Latency Metrics
    // -------------------------------------------------------------------------
    /**
     * Calculate a percentile from a sorted array of values using linear interpolation.
     * Note: The input array will be sorted in ascending order if not already sorted.
     */
    calculatePercentile(values, percentile) {
        if (values.length === 0)
            return 0;
        if (values.length === 1)
            return values[0];
        // Sort in ascending order for percentile calculation
        const sortedValues = [...values].sort((a, b) => a - b);
        const rank = (percentile / 100) * (sortedValues.length - 1);
        const lowerIndex = Math.floor(rank);
        const upperIndex = Math.ceil(rank);
        const fraction = rank - lowerIndex;
        if (lowerIndex === upperIndex) {
            return sortedValues[lowerIndex] ?? 0;
        }
        const lowerValue = sortedValues[lowerIndex] ?? 0;
        const upperValue = sortedValues[upperIndex] ?? 0;
        return lowerValue + fraction * (upperValue - lowerValue);
    }
    /**
     * Calculate latency percentiles.
     */
    latencyPercentile(percentile, period) {
        const p = period ?? this.getDefaultPeriod();
        const events = this.collector.getEventsInPeriod(p);
        const latencies = [];
        for (const event of events) {
            const latency = event.data.latency;
            if (latency !== undefined) {
                latencies.push(latency);
            }
        }
        if (latencies.length === 0)
            return 0;
        return this.calculatePercentile(latencies, percentile);
    }
    /**
     * Get comprehensive latency metrics.
     */
    getLatencyMetrics(period) {
        const p = period ?? this.getDefaultPeriod();
        const events = this.collector.getEventsInPeriod(p);
        const latencies = [];
        for (const event of events) {
            const latency = event.data.latency;
            if (latency !== undefined) {
                latencies.push(latency);
            }
        }
        if (latencies.length === 0) {
            return {
                avg: 0,
                p50: 0,
                p95: 0,
                p99: 0,
                min: 0,
                max: 0,
            };
        }
        latencies.sort((a, b) => a - b);
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const min = latencies[0];
        const max = latencies[latencies.length - 1];
        // Use the same percentile calculation as latencyPercentile
        const p50 = this.calculatePercentile(latencies, 50);
        const p95 = this.calculatePercentile(latencies, 95);
        const p99 = this.calculatePercentile(latencies, 99);
        return {
            avg: Math.round(avg),
            p50,
            p95,
            p99,
            min,
            max,
        };
    }
    // -------------------------------------------------------------------------
    // Summary Metrics
    // -------------------------------------------------------------------------
    /**
     * Get a summary of all metrics for a period.
     */
    getSummary(period) {
        return {
            tokens: this.getTokenMetrics(period),
            errors: this.getErrorMetrics(period),
            latency: this.getLatencyMetrics(period),
            topItems: this.getTopItems(10, period),
            efficiencyTrend: this.efficiencyTrend(7, 7),
        };
    }
    // -------------------------------------------------------------------------
    // Private Helpers
    // -------------------------------------------------------------------------
    getDefaultPeriod() {
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        return {
            start: sevenDaysAgo,
            end: now,
        };
    }
}
//# sourceMappingURL=metrics.js.map