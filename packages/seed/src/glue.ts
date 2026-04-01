/**
 * Glue — cross-agent glue layer for cocapn.
 *
 * AgentConnection: connect to another agent over HTTP, WebSocket, or stdio.
 * Message passing, context sharing, task delegation, event bus.
 * Zero dependencies. Uses only Node.js built-ins.
 */

import { EventEmitter } from 'node:events';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Transport = 'http' | 'ws' | 'stdio';

export interface GlueMessage {
  from: string;
  to: string;
  type: 'chat' | 'context' | 'task' | 'event';
  payload: unknown;
  ts?: string;
}

export interface TaskResult { ok: boolean; data?: unknown; error?: string; }

// ─── AgentConnection ───────────────────────────────────────────────────────────

export class AgentConnection {
  readonly id: string;
  readonly url: string;
  readonly transport: Transport;
  private bus: EventEmitter;

  constructor(id: string, url: string, transport: Transport = 'http', bus?: EventEmitter) {
    this.id = id;
    this.url = url.replace(/\/$/, '');
    this.transport = transport;
    this.bus = bus ?? new EventEmitter();
  }

  /** Send a typed message to this agent */
  async send(msg: Omit<GlueMessage, 'from' | 'ts'>): Promise<unknown> {
    const full: GlueMessage = { ...msg, from: this.id, ts: new Date().toISOString() };
    try {
      const res = await fetch(`${this.url}/api/a2a/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(full),
      });
      return await res.json();
    } catch (e) { return { ok: false, error: String(e) }; }
  }

  /** Delegate a task to this agent and wait for results */
  async delegate(task: string, timeout = 30000): Promise<TaskResult> {
    const res = await this.send({ to: this.id, type: 'task', payload: { task } });
    const result = res as TaskResult | undefined;
    if (!result?.ok) return { ok: false, error: result?.error ?? 'no response' };
    return result;
  }

  /** Share code context with this agent */
  async shareContext(files: string[], knowledge?: string): Promise<TaskResult> {
    const res = await this.send({ to: this.id, type: 'context', payload: { files, knowledge } });
    return (res as TaskResult) ?? { ok: false, error: 'no response' };
  }

  /** Subscribe to events from this agent */
  on(event: string, handler: (data: unknown) => void): void { this.bus.on(`${this.id}:${event}`, handler); }
  off(event: string, handler: (data: unknown) => void): void { this.bus.off(`${this.id}:${event}`, handler); }
  emit(event: string, data: unknown): void { this.bus.emit(`${this.id}:${event}`, data); }
}

// ─── GlueBus — central event bus for all connections ────────────────────────────

export class GlueBus {
  private connections = new Map<string, AgentConnection>();
  private bus = new EventEmitter();

  connect(id: string, url: string, transport: Transport = 'http'): AgentConnection {
    const conn = new AgentConnection(id, url, transport, this.bus);
    this.connections.set(id, conn);
    return conn;
  }

  disconnect(id: string): boolean { return this.connections.delete(id); }
  get(id: string): AgentConnection | undefined { return this.connections.get(id); }
  list(): string[] { return [...this.connections.keys()]; }

  /** Broadcast an event to all connected agents */
  async broadcast(event: string, data: unknown): Promise<void> {
    for (const conn of this.connections.values()) {
      conn.emit(event, data);
      await conn.send({ to: conn.id, type: 'event', payload: { event, data } }).catch(() => {});
    }
  }

  /** Subscribe to events from any agent */
  on(event: string, handler: (data: unknown) => void): void { this.bus.on(event, handler); }
  emit(event: string, data: unknown): void { this.bus.emit(event, data); }
}
