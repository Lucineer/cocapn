/**
 * Fleet Protocol types.
 *
 * Multi-agent coordination on top of A2A protocol.
 * Extends A2A with fleet-specific messages and semantics.
 */
import type { TaskMessage } from '../a2a/types.js';
export interface FleetConfig {
    heartbeatInterval: number;
    heartbeatTimeout: number;
    deadAgentTimeout: number;
    defaultTaskTimeout: number;
    maxConcurrentTasks: number;
    taskRetryLimit: number;
    autoLeaderElection: boolean;
    leadershipPriority: number;
    requireEncryption: boolean;
    jwtTTL: number;
    auditLogRetention: number;
}
export declare const DEFAULT_FLEET_CONFIG: FleetConfig;
export type FleetRole = 'leader' | 'worker' | 'specialist';
export type AgentStatus = 'idle' | 'busy' | 'offline' | 'degraded';
export interface AgentCapabilities {
    skills: string[];
    modules?: string[] | undefined;
    compute?: {
        cpu?: string;
        memory?: string;
    } | undefined;
    leadershipPriority?: number;
}
export interface FleetAgent {
    id: string;
    name: string;
    role: FleetRole;
    skills: string[];
    status: AgentStatus;
    instanceUrl: string;
    lastHeartbeat: number;
    currentTask?: string;
    load: number;
    successRate: number;
    uptime: number;
}
export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed';
export type TaskType = string;
export type TaskPriority = number;
export interface FleetTask {
    id: string;
    parentId?: string;
    fleetId: string;
    assignedTo?: string;
    status: TaskStatus;
    type: TaskType;
    payload: any;
    result?: any;
    priority: TaskPriority;
    createdAt: number;
    completedAt?: number;
    startedAt?: number;
    timeout: number;
    retryCount: number;
    maxRetries?: number;
    onTimeout: TimeoutAction;
}
export type TimeoutAction = 'warn' | 'retry' | 'escalate' | 'abort';
export type DecompositionType = 'parallel' | 'sequential' | 'map-reduce';
export type MergeStrategy = 'concat' | 'vote' | 'quorum' | 'custom';
export interface ParallelStrategy {
    type: 'parallel';
    subtasks: Subtask[];
    mergeStrategy: MergeStrategy;
}
export interface SequentialStage {
    name: string;
    assignedTo?: string;
    outputTo: string;
}
export interface SequentialStrategy {
    type: 'sequential';
    stages: SequentialStage[];
}
export interface MapReduceStrategy {
    type: 'map-reduce';
    mapper: {
        input: TaskMessage;
        mapFunction: string;
    };
    reducer: {
        reduceFunction: string;
        outputFormat: 'summary' | 'detailed' | 'raw';
    };
}
export type DecompositionStrategy = ParallelStrategy | SequentialStrategy | MapReduceStrategy;
export interface Subtask {
    id: string;
    description: string;
    input: TaskMessage;
    requiredSkills?: string[] | undefined;
    timeout: number;
    priority: TaskPriority;
    onTimeout?: TimeoutAction | undefined;
}
export interface Assignment {
    assignedTo: string;
    assignedAt: string;
    deadline: string;
}
export type FleetMessageType = 'task-assign' | 'task-progress' | 'task-result' | 'task-error' | 'heartbeat' | 'leader-changed' | 'agent-joined' | 'agent-left' | 'query';
export interface FleetMessage {
    id: string;
    from: string;
    to: string;
    type: FleetMessageType;
    payload: any;
    timestamp: number;
    metadata: {
        priority: number;
        ttl?: number;
        correlationId?: string;
        [key: string]: unknown;
    };
}
export interface TaskAssignmentMessage extends FleetMessage {
    type: 'task-assign';
    payload: {
        subtaskId: string;
        subtask: Subtask;
        assignment: Assignment;
    };
}
export interface ProgressUpdateMessage extends FleetMessage {
    type: 'task-progress';
    payload: {
        subtaskId: string;
        progress: number;
        status: 'working' | 'blocked' | 'complete' | 'failed';
        message?: string;
        partialResult?: any;
    };
}
export interface ResultSubmissionMessage extends FleetMessage {
    type: 'task-result';
    payload: {
        subtaskId: string;
        result: {
            status: 'success' | 'failure' | 'partial';
            output: TaskMessage;
            artifacts: any[];
            metrics: {
                duration: number;
                tokensUsed: number;
                steps: number;
            };
        };
    };
}
export interface HeartbeatMessage extends FleetMessage {
    type: 'heartbeat';
    payload: {
        agentStatus: {
            status: AgentStatus;
            currentTaskId?: string;
            load: number;
        };
    };
}
export interface ErrorEscalationMessage extends FleetMessage {
    type: 'task-error';
    payload: {
        subtaskId: string;
        error: {
            code: string;
            message: string;
            stack?: string;
            recoverable: boolean;
            escalationLevel: 'warn' | 'retry' | 'escalate' | 'abort';
        };
    };
}
export type FleetTopology = 'star' | 'mesh' | 'hierarchical';
export interface Fleet {
    id: string;
    name: string;
    leaderId: string;
    agents: FleetAgent[];
    tasks: FleetTask[];
    topology: FleetTopology;
    createdAt: number;
}
export interface FleetRegistration {
    fleetId: string;
    agentId: string;
    role: FleetRole;
    capabilities: AgentCapabilities;
    endpoint: string;
    lastSeen: number;
    status: AgentStatus;
}
export interface TaskDedup {
    fingerprint: string;
    assignedTo: string[];
    status: 'pending' | 'complete';
}
export interface FleetJWTPayload {
    sub: string;
    iss: string;
    aud: string;
    iat: number;
    exp: number;
    fleet: {
        fleetId: string;
        role: FleetRole;
        permissions: string[];
    };
}
export interface AuditLog {
    id: string;
    fleetId: string;
    timestamp: number;
    actor: string;
    action: string;
    target: string;
    details: Record<string, unknown>;
}
export declare const FleetErrorCode: {
    readonly FleetNotFound: -33001;
    readonly AgentNotInFleet: -33002;
    readonly InvalidRole: -33003;
    readonly TaskNotFound: -33004;
    readonly AssignmentFailed: -33005;
    readonly LeaderElectionFailed: -33006;
    readonly HeartbeatMissed: -33007;
    readonly DeadAgentDetected: -33008;
    readonly InvalidTopology: -33009;
    readonly DuplicateTask: -33010;
    readonly TimeoutExceeded: -33011;
};
export interface FleetError {
    code: keyof typeof FleetErrorCode;
    message: string;
    details?: unknown;
}
export interface FleetClientConfig {
    agentId: string;
    agentCard: {
        name: string;
        description: string;
        url: string;
        version: string;
    };
    capabilities: AgentCapabilities;
    desiredFleetId?: string;
    preferredRole?: FleetRole;
    admiralUrl: string;
    onTaskAssigned?: (task: FleetTask) => Promise<void>;
    onMessage?: (message: FleetMessage) => void;
}
export interface FleetClientState {
    fleetId?: string;
    role?: FleetRole;
    leaderId?: string;
    peers: FleetAgent[];
    jwt?: string;
    connected: boolean;
    currentTasks: Set<string>;
}
export interface AgentScore {
    agentId: string;
    score: number;
    reasons: string[];
}
export interface TaskSplitResult {
    subtasks: Subtask[];
    mergeStrategy: MergeStrategy;
    estimatedDuration: number;
}
export interface MergeResult {
    success: boolean;
    result?: any;
    errors: string[];
}
//# sourceMappingURL=types.d.ts.map