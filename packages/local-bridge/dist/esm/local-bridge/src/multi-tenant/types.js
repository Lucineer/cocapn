/**
 * Multi-tenant type definitions for brain isolation.
 *
 * Each tenant (customer/user) gets:
 *   - Isolated brain storage (namespaced by tenant ID)
 *   - Separate personality config
 *   - Separate skill set
 *   - Separate memory facts
 *   - Usage metering
 */
// ─── Plan defaults ──────────────────────────────────────────────────────────
export const PLAN_DEFAULTS = {
    free: {
        maxTokensPerDay: 50_000,
        maxConcurrentSessions: 1,
        enabledSkills: [],
        allowedOrigins: [],
    },
    pro: {
        maxTokensPerDay: 500_000,
        maxConcurrentSessions: 5,
        enabledSkills: [],
        allowedOrigins: [],
    },
    enterprise: {
        maxTokensPerDay: 0, // unlimited
        maxConcurrentSessions: 50,
        enabledSkills: [],
        allowedOrigins: [],
    },
};
//# sourceMappingURL=types.js.map