/**
 * A2A — agent-to-agent protocol for cocapn.
 *
 * Minimal implementation: discovery, message passing, peer management.
 * Authentication via shared secret (a2a-secret in config or header).
 * Zero dependencies. Uses only Node.js built-ins.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// ─── A2A Hub ───────────────────────────────────────────────────────────────────
export class A2AHub {
    peers = new Map();
    secret;
    agentName;
    agentUrl;
    constructor(agentName, agentUrl, secret) {
        this.agentName = agentName;
        this.agentUrl = agentUrl;
        this.secret = secret;
    }
    /** Validate a shared secret */
    authenticate(provided) {
        if (!this.secret)
            return true;
        return provided === this.secret;
    }
    /** Register a peer from a handshake */
    addPeer(req) {
        const peer = {
            id: req.id,
            url: req.url,
            name: req.name,
            capabilities: req.capabilities ?? [],
            connectedAt: new Date().toISOString(),
        };
        this.peers.set(req.id, peer);
        return peer;
    }
    /** Remove a peer */
    removePeer(id) {
        return this.peers.delete(id);
    }
    /** Get all known peers */
    getPeers() {
        return [...this.peers.values()];
    }
    /** Get a specific peer */
    getPeer(id) {
        return this.peers.get(id);
    }
    /** Initiate a handshake with another agent */
    async connect(targetUrl) {
        try {
            const res = await fetch(`${targetUrl}/api/a2a/handshake`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: this.agentName,
                    name: this.agentName,
                    url: this.agentUrl,
                    capabilities: ['chat', 'knowledge-share'],
                    secret: this.secret,
                }),
            });
            if (!res.ok)
                return null;
            const data = await res.json();
            return this.addPeer(data.peer);
        }
        catch {
            return null;
        }
    }
    /** Send a message to a peer */
    async sendMessage(peerId, content, type = 'greeting') {
        const peer = this.peers.get(peerId);
        if (!peer)
            return { ok: false, error: `Unknown peer: ${peerId}` };
        const msg = {
            from: this.agentName, to: peer.name, content, type,
            ts: new Date().toISOString(),
        };
        try {
            const res = await fetch(`${peer.url}/api/a2a/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-A2A-Secret': this.secret },
                body: JSON.stringify(msg),
            });
            return await res.json();
        }
        catch (err) {
            return { ok: false, error: String(err) };
        }
    }
    /** Build A2A context for system prompt */
    visitorPrompt() {
        if (this.peers.size === 0)
            return '';
        const names = [...this.peers.values()].map(p => p.name).join(', ');
        return `\n\n## Visiting Agents\nConnected peers: ${names}. Be helpful but don't share private facts (prefixed with private.*).`;
    }
    /** Load secret from file */
    static loadSecret(repoDir) {
        const p = join(repoDir, 'cocapn', 'a2a-secret.json');
        if (existsSync(p)) {
            try {
                const data = JSON.parse(readFileSync(p, 'utf-8'));
                return data.secret ?? '';
            }
            catch { /* fall through */ }
        }
        return process.env.COCAPN_A2A_SECRET ?? '';
    }
}
//# sourceMappingURL=a2a.js.map