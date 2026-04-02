/**
 * Fleet Protocol types.
 *
 * Multi-agent coordination on top of A2A protocol.
 * Extends A2A with fleet-specific messages and semantics.
 */
export const DEFAULT_FLEET_CONFIG = {
    heartbeatInterval: 30000,
    heartbeatTimeout: 90000,
    deadAgentTimeout: 180000,
    defaultTaskTimeout: 300000,
    maxConcurrentTasks: 10,
    taskRetryLimit: 3,
    autoLeaderElection: true,
    leadershipPriority: 0,
    requireEncryption: false,
    jwtTTL: 3600000,
    auditLogRetention: 7776000000, // 90 days in ms
};
// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------
export const FleetErrorCode = {
    FleetNotFound: -33001,
    AgentNotInFleet: -33002,
    InvalidRole: -33003,
    TaskNotFound: -33004,
    AssignmentFailed: -33005,
    LeaderElectionFailed: -33006,
    HeartbeatMissed: -33007,
    DeadAgentDetected: -33008,
    InvalidTopology: -33009,
    DuplicateTask: -33010,
    TimeoutExceeded: -33011,
};
//# sourceMappingURL=types.js.map