/**
 * Web — minimal HTTP chat server for cocapn.
 *
 * Routes:
 *   GET  /                → chat UI (index.html)
 *   GET  /cocapn/soul.md  → public soul
 *   GET  /api/status      → agent state (name, birth, files, last commit)
 *   GET  /api/whoami      → full self-perception
 *   GET  /api/memory      → recent memories
 *   GET  /api/memory/search?q= → search memories
 *   DELETE /api/memory    → clear all memories
 *   GET  /api/git/log     → recent commits
 *   GET  /api/git/stats   → repo statistics
 *   GET  /api/git/diff    → uncommitted changes
 *   POST /api/chat        → streaming SSE chat
 *   POST /api/a2a/handshake → exchange capabilities
 *   POST /api/a2a/message   → receive and process A2A message
 *   GET  /api/a2a/peers     → list known agents
 *   POST /api/a2a/disconnect → remove peer
 *
 * Zero dependencies. Uses only Node.js built-ins.
 */
import { IncomingMessage, ServerResponse } from 'node:http';
import type { LLM } from './llm.js';
import type { Memory } from './memory.js';
import type { Awareness } from './awareness.js';
import type { Soul } from './soul.js';
import type { A2AHub } from './a2a.js';
export declare function startWebServer(port: number, llm: LLM, memory: Memory, awareness: Awareness, soul: Soul, a2a?: A2AHub): import("http").Server<typeof IncomingMessage, typeof ServerResponse>;
//# sourceMappingURL=web.d.ts.map