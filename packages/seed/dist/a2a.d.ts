/**
 * A2A — agent-to-agent protocol for cocapn.
 *
 * Minimal implementation: discovery, message passing, peer management.
 * Authentication via shared secret (a2a-secret in config or header).
 * Zero dependencies. Uses only Node.js built-ins.
 */
export interface Peer {
    id: string;
    url: string;
    name: string;
    capabilities: string[];
    connectedAt: string;
}
export interface A2AMessage {
    from: string;
    to: string;
    content: string;
    type: 'greeting' | 'question' | 'knowledge-share' | 'task-request' | 'status';
    ts?: string;
}
export interface HandshakeRequest {
    id: string;
    name: string;
    url: string;
    capabilities: string[];
    secret?: string;
}
export interface A2AResponse {
    ok: boolean;
    reply?: string;
    error?: string;
}
export declare class A2AHub {
    private peers;
    private secret;
    private agentName;
    private agentUrl;
    constructor(agentName: string, agentUrl: string, secret: string);
    /** Validate a shared secret */
    authenticate(provided: string | undefined): boolean;
    /** Register a peer from a handshake */
    addPeer(req: HandshakeRequest): Peer;
    /** Remove a peer */
    removePeer(id: string): boolean;
    /** Get all known peers */
    getPeers(): Peer[];
    /** Get a specific peer */
    getPeer(id: string): Peer | undefined;
    /** Initiate a handshake with another agent */
    connect(targetUrl: string): Promise<Peer | null>;
    /** Send a message to a peer */
    sendMessage(peerId: string, content: string, type?: A2AMessage['type']): Promise<A2AResponse>;
    /** Build A2A context for system prompt */
    visitorPrompt(): string;
    /** Load secret from file */
    static loadSecret(repoDir: string): string;
}
//# sourceMappingURL=a2a.d.ts.map