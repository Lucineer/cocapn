/**
 * DebounceTimer — debounce rapid calls into a single delayed execution.
 *
 * Uses a pattern where:
 *   - Each call resets the timer
 *   - Execution happens after delay_ms of no new calls
 *   - The pending function can be flushed immediately
 *
 * Common use case: batch multiple rapid file edits into a single git commit.
 */
// ─── DebounceTimer ─────────────────────────────────────────────────────────────
export class DebounceTimer {
    options;
    timerId = null;
    pending = false;
    constructor(options) {
        this.options = options;
    }
    /**
     * Schedule the function to run after delay_ms.
     * If already scheduled, resets the timer (debounce effect).
     */
    schedule() {
        // Clear any existing timer
        if (this.timerId !== null) {
            clearTimeout(this.timerId);
        }
        this.pending = true;
        this.timerId = setTimeout(() => {
            this.pending = false;
            this.timerId = null;
            this.options.fn();
        }, this.options.delayMs);
    }
    /**
     * Immediately execute the pending function if scheduled.
     * Does nothing if no function is pending.
     */
    async flush() {
        if (this.timerId !== null) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
        if (this.pending) {
            this.pending = false;
            await this.options.fn();
        }
    }
    /**
     * Cancel any pending execution without running the function.
     */
    cancel() {
        if (this.timerId !== null) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
        this.pending = false;
    }
    /** Returns true if a function execution is currently scheduled */
    isScheduled() {
        return this.pending;
    }
    /** Clear any pending timers (call before dropping reference) */
    dispose() {
        this.cancel();
    }
}
//# sourceMappingURL=debounce.js.map