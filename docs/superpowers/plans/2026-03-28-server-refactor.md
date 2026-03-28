# BridgeServer Decomposition — Architecture & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the 1294-line `packages/local-bridge/src/ws/server.ts` into focused modules — auth, dispatch, and individual handlers — while maintaining full backward compatibility with the existing WebSocket protocol.

**Architecture:** Extract authentication (GitHub PAT + Fleet JWT) into a composable auth handler. Create a dispatcher that routes parsed JSON to either JSON-RPC or typed-message pipelines. Extract each typed-message handler (chat, bash, file, module, skin, peer) into its own file with a shared `Handler` interface. The refactored `BridgeServer` becomes a thin shell: lifecycle + wiring.

**Tech Stack:** TypeScript ESM, `ws` library, Node `http`, Vitest for testing.

---

## Current File Line Map

Reference for which lines of `src/ws/server.ts` (1294 total) map to which new file:

| Lines | Concern | Target File |
|-------|---------|-------------|
| 1-16 | Module doc + imports | `server.ts` (trimmed) |
| 18-33 | Imports | Split across new files |
| 35-91 | Type definitions (`BridgeServerOptions`, `TypedMessage`, `SessionState`, etc.) | `src/ws/types.ts` |
| 92 | `GITHUB_API` constant, `clientCounter` | `src/security/auth-handler.ts` |
| 97-110 | `BridgeServer` class header, constructor | `server.ts` (kept) |
| 116-169 | `start()`, `stop()` lifecycle | `server.ts` (kept) |
| 172-249 | HTTP peer API (`handleHttpRequest`, `verifyPeerAuth`) | `src/handlers/peer.ts` |
| 252-345 | Auth (`authenticateAndConnect`, `extractToken`, `validateGithubPat`) | `src/security/auth-handler.ts` |
| 351-405 | `handleConnection`, message parsing, protocol routing | `src/ws/dispatcher.ts` |
| 411-443 | `dispatchTyped` switch | `src/ws/dispatcher.ts` |
| 450-579 | `handleChat` | `src/handlers/chat.ts` |
| 588-633 | `handleBash` | `src/handlers/bash.ts` |
| 640-673 | `handleFileEdit` | `src/handlers/file.ts` |
| 680-696 | `handleA2aRequest` | `src/handlers/a2a.ts` |
| 704-743 | `handleModuleInstall`, `broadcastModuleList`, `getModuleManager` | `src/handlers/module.ts` |
| 749-896 | JSON-RPC dispatch (`dispatchRpc`, `handleBridgeMethod`, `handleMcpMethod`, `handleModuleMethod`, `handleA2aMethod`) | `src/ws/dispatcher.ts` |
| 902-923 | Helpers (`getBridgeStatus`, `sendTyped`, `sendResult`, `sendError`) | `src/ws/send.ts` |
| 930-987 | `handleChatModuleInstall` | `src/handlers/module.ts` |
| 992-1080 | `handleChangeSkin`, `broadcastSkinUpdate` | `src/handlers/skin.ts` |
| 1082-1162 | `handlePeerQuery` | `src/handlers/peer.ts` |
| 1165-1202 | `parseModuleInstallIntent` (free function) | `src/handlers/intents.ts` |
| 1204-1257 | `parsePeerQueryIntent` (free function) | `src/handlers/intents.ts` |
| 1259-1293 | `parseSkinIntent` (free function) | `src/handlers/intents.ts` |

## New File Structure

```
packages/local-bridge/src/
├── ws/
│   ├── server.ts          ← SLIMMED: lifecycle, wiring, EventEmitter (≈120 lines)
│   ├── types.ts            ← NEW: shared types, interfaces, message shapes
│   ├── dispatcher.ts       ← NEW: parse JSON → route to RPC or typed handler
│   ├── send.ts             ← NEW: sendTyped, sendResult, sendError, broadcast helpers
│   └── chat-router.ts      (unchanged)
├── security/
│   ├── auth-handler.ts     ← NEW: GitHub PAT + Fleet JWT auth, token extraction
│   ├── jwt.ts              (unchanged)
│   ├── audit.ts            (unchanged)
│   └── fleet.ts            (unchanged)
├── handlers/
│   ├── types.ts            ← NEW: Handler interface + HandlerContext
│   ├── chat.ts             ← NEW: CHAT handler
│   ├── bash.ts             ← NEW: BASH handler
│   ├── file.ts             ← NEW: FILE_EDIT handler
│   ├── module.ts           ← NEW: MODULE_INSTALL + CHANGE_SKIN module ops
│   ├── skin.ts             ← NEW: CHANGE_SKIN handler
│   ├── a2a.ts              ← NEW: A2A_REQUEST handler
│   ├── peer.ts             ← NEW: HTTP peer API + peer query handler
│   └── intents.ts          ← NEW: intent parsers (module install, peer query, skin)
└── ...
```

## Interface Definitions

### 1. `src/ws/types.ts` — Shared Protocol Types

```typescript
/**
 * Shared type definitions for the BridgeServer WebSocket protocol.
 * Extracted from the monolithic server.ts to enable handler-level imports
 * without circular dependencies.
 */

import type { WebSocket } from "ws";
import type { AgentRouter } from "../agents/router.js";
import type { AgentSpawner } from "../agents/spawner.js";
import type { GitSync } from "../git/sync.js";
import type { BridgeConfig } from "../config/types.js";
import type { CloudAdapterRegistry } from "../CloudAdapter.js";
import type { Brain } from "../brain/index.js";
import type { ModuleManager } from "../modules/manager.js";
import type { AuditLogger } from "../security/audit.js";
import type { ChatRouter } from "./chat-router.js";

// ─── Server options (unchanged from current contract) ────────────────────────

export interface BridgeServerOptions {
  config: BridgeConfig;
  router: AgentRouter;
  spawner: AgentSpawner;
  sync: GitSync;
  repoRoot: string;
  skipAuth: boolean | undefined;
  cloudAdapters: CloudAdapterRegistry | undefined;
  moduleManager: ModuleManager | undefined;
  fleetKey: string | undefined;
  brain: Brain | undefined;
  enablePeerApi?: boolean;
}

// ─── Event map ───────────────────────────────────────────────────────────────

export type BridgeServerEventMap = {
  listening: [port: number];
  connection: [clientId: string];
  disconnection: [clientId: string];
  error: [err: Error];
};

// ─── Protocol messages ───────────────────────────────────────────────────────

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown;
}

export type TypedMessageType =
  | "CHAT"
  | "BASH"
  | "FILE_EDIT"
  | "A2A_REQUEST"
  | "MODULE_INSTALL"
  | "INSTALL_MODULE"
  | "CHANGE_SKIN";

export interface TypedMessage {
  type: TypedMessageType;
  id: string;
  [key: string]: unknown;
}

// ─── Session state ───────────────────────────────────────────────────────────

export interface SessionState {
  clientId: string;
  githubLogin: string | undefined;
  githubToken: string | undefined;
  connectedAt: Date;
}
```

### 2. `src/handlers/types.ts` — Handler Interface

```typescript
/**
 * Handler interface for typed WebSocket messages.
 *
 * Each handler is a plain function (not a class method). It receives:
 *   - ws:  the WebSocket connection to send responses to
 *   - msg: the parsed TypedMessage
 *   - ctx: a HandlerContext with all services the handler might need
 *
 * Handlers are async and may throw — the dispatcher catches and sends
 * an error frame automatically.
 */

import type { WebSocket } from "ws";
import type { TypedMessage } from "../ws/types.js";
import type { AgentRouter } from "../agents/router.js";
import type { AgentSpawner } from "../agents/spawner.js";
import type { GitSync } from "../git/sync.js";
import type { BridgeConfig } from "../config/types.js";
import type { CloudAdapterRegistry } from "../CloudAdapter.js";
import type { Brain } from "../brain/index.js";
import type { ModuleManager } from "../modules/manager.js";
import type { AuditLogger } from "../security/audit.js";
import type { ChatRouter } from "../ws/chat-router.js";
import type { Sender } from "../ws/send.js";

/**
 * Everything a handler needs to do its job.
 * Passed by reference — handlers must NOT mutate config.
 */
export interface HandlerContext {
  readonly config: BridgeConfig;
  readonly router: AgentRouter;
  readonly spawner: AgentSpawner;
  readonly sync: GitSync;
  readonly repoRoot: string;
  readonly audit: AuditLogger;
  readonly chatRouter: ChatRouter;
  readonly sender: Sender;

  // Optional services (may be undefined)
  readonly brain: Brain | undefined;
  readonly cloudAdapters: CloudAdapterRegistry | undefined;
  readonly fleetKey: string | undefined;

  // Mutable — lazily created
  getModuleManager(): ModuleManager;

  // Broadcast to all connected clients
  broadcast(payload: Record<string, unknown>): void;
}

/**
 * A typed message handler function.
 * Returns void — all responses are sent via ctx.sender.
 */
export type TypedHandler = (
  ws: WebSocket,
  clientId: string,
  msg: TypedMessage,
  ctx: HandlerContext,
) => Promise<void>;
```

### 3. `src/ws/send.ts` — Send Helpers

```typescript
/**
 * Sender — encapsulates WebSocket frame serialization.
 *
 * Extracted so handlers don't need to call ws.send(JSON.stringify(...))
 * directly. Also makes testing easier — inject a mock Sender.
 */

import type { WebSocket } from "ws";
import type { JsonRpcRequest } from "./types.js";

export interface Sender {
  /** Send a typed message frame (used by all handlers). */
  typed(ws: WebSocket, payload: Record<string, unknown>): void;

  /** Send a JSON-RPC success response. */
  result(ws: WebSocket, id: JsonRpcRequest["id"], result: unknown): void;

  /** Send a JSON-RPC error response. */
  error(ws: WebSocket, id: JsonRpcRequest["id"], code: number, message: string): void;
}

export function createSender(): Sender {
  return {
    typed(ws, payload) {
      ws.send(JSON.stringify(payload));
    },
    result(ws, id, result) {
      ws.send(JSON.stringify({ jsonrpc: "2.0", id, result }));
    },
    error(ws, id, code, message) {
      ws.send(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }));
    },
  };
}
```

### 4. `src/security/auth-handler.ts` — Authentication

```typescript
/**
 * AuthHandler — composable WebSocket authentication.
 *
 * Supports two auth methods (tried in order):
 *   1. Fleet JWT  — token starts with "eyJ", verified via HMAC-SHA256
 *   2. GitHub PAT — validated against GitHub /user endpoint
 *
 * Returns an AuthResult on success, or closes the WebSocket with 4001 on failure.
 */

import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { AuditLogger } from "./audit.js";

export interface AuthResult {
  githubLogin: string | undefined;
  githubToken: string | undefined;
}

export interface AuthHandlerOptions {
  skipAuth: boolean | undefined;
  fleetKey: string | undefined;
  audit: AuditLogger;
  /** Called when GitHub PAT is validated — lets cloud adapters store the token */
  onGithubToken?: (token: string) => void;
}

/**
 * Attempt to authenticate a new WebSocket connection.
 *
 * Returns AuthResult on success. On failure, closes the WebSocket
 * with code 4001 and returns undefined.
 */
export async function authenticateConnection(
  ws: WebSocket,
  req: IncomingMessage,
  options: AuthHandlerOptions,
): Promise<AuthResult | undefined>;

/**
 * Extract token from WebSocket URL query string.
 * Supports: ws://host/?token=<value>
 */
export function extractToken(url: string): string | undefined;

/**
 * Validate a GitHub Personal Access Token against the GitHub API.
 * Returns the GitHub login on success, undefined on failure.
 */
export async function validateGithubPat(token: string): Promise<string | undefined>;

/**
 * Verify a fleet JWT from an HTTP Authorization header.
 * Used by the peer HTTP API endpoints.
 * Returns true when auth passes or is disabled (skipAuth).
 */
export function verifyPeerAuth(
  req: IncomingMessage,
  skipAuth: boolean | undefined,
  fleetKey: string | undefined,
): boolean;
```

### 5. `src/ws/dispatcher.ts` — Message Dispatch

```typescript
/**
 * Dispatcher — parses incoming WebSocket frames and routes them.
 *
 * Two protocols coexist on the same WebSocket:
 *
 *   1. JSON-RPC 2.0  — discriminated by { jsonrpc: "2.0" }
 *      Methods: bridge/*, mcp/<agentId>/*, module/*, a2a/*
 *
 *   2. Typed messages — discriminated by { type: "CHAT" | "BASH" | ... }
 *      Routed to individual handler functions.
 *
 * The dispatcher owns the connection-level message listener and
 * the close/error listeners. It delegates all business logic to
 * handlers.
 */

import type { WebSocket } from "ws";
import type { TypedMessage, JsonRpcRequest } from "./types.js";
import type { HandlerContext, TypedHandler } from "../handlers/types.js";
import type { Sender } from "./send.js";

/** Registry mapping typed message types to handler functions. */
export type HandlerRegistry = Map<string, TypedHandler>;

/**
 * Wire up message/close/error listeners on a connected WebSocket.
 *
 * Called once per connection after authentication succeeds.
 * Sends the initial bridge status frame, then listens for messages.
 */
export function attachDispatcher(
  ws: WebSocket,
  clientId: string,
  handlers: HandlerRegistry,
  ctx: HandlerContext,
): void;

/**
 * Dispatch a JSON-RPC request to the appropriate bridge/mcp/module/a2a method.
 *
 * Pure routing logic — all state access goes through ctx.
 */
export async function dispatchRpc(
  ws: WebSocket,
  req: JsonRpcRequest,
  ctx: HandlerContext,
): Promise<void>;
```

### 6. Handler Function Signatures

Each handler file exports a single `handle*` function conforming to `TypedHandler`:

**`src/handlers/chat.ts`**
```typescript
import type { TypedHandler } from "./types.js";

/** CHAT — routes to agent via ChatRouter, streams response. */
export const handleChat: TypedHandler;
```

**`src/handlers/bash.ts`**
```typescript
import type { TypedHandler } from "./types.js";

/** BASH — execute shell command, stream stdout/stderr. cwd sandboxed to repo root. */
export const handleBash: TypedHandler;
```

**`src/handlers/file.ts`**
```typescript
import type { TypedHandler } from "./types.js";

/** FILE_EDIT — write file + auto-commit. Path sandboxed to repo root. */
export const handleFileEdit: TypedHandler;
```

**`src/handlers/a2a.ts`**
```typescript
import type { TypedHandler } from "./types.js";

/** A2A_REQUEST — route A2A task to best agent. */
export const handleA2aRequest: TypedHandler;
```

**`src/handlers/module.ts`**
```typescript
import type { TypedHandler } from "./types.js";

/** MODULE_INSTALL / INSTALL_MODULE — install module by git URL. */
export const handleModuleInstall: TypedHandler;

/** Chat-based module installation (conversational confirm/install flow). */
export function handleChatModuleInstall(
  ws: WebSocket,
  msgId: string,
  intent: ModuleInstallIntent,
  ctx: HandlerContext,
): Promise<void>;
```

**`src/handlers/skin.ts`**
```typescript
import type { TypedHandler } from "./types.js";

/** CHANGE_SKIN — switch UI theme/skin. */
export const handleChangeSkin: TypedHandler;
```

**`src/handlers/peer.ts`**
```typescript
import type { IncomingMessage, ServerResponse } from "http";
import type { HandlerContext } from "./types.js";
import type { WebSocket } from "ws";
import type { PeerQueryIntent } from "./intents.js";

/** HTTP request handler for A2A peer discovery + fact queries. */
export async function handleHttpPeerRequest(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: HandlerContext,
): Promise<void>;

/** Handle cross-domain peer query from chat intent. */
export async function handlePeerQuery(
  ws: WebSocket,
  msgId: string,
  intent: PeerQueryIntent,
  ctx: HandlerContext,
): Promise<void>;
```

**`src/handlers/intents.ts`**
```typescript
/** Intent types and parser functions — pure, no side effects, fully testable. */

export interface ModuleInstallIntent {
  gitUrl: string;
  moduleName: string;
}

export interface PeerQueryIntent {
  domain: string;
  factKey: string;
  originalContent: string;
}

export interface SkinIntent {
  skin: string;
  preview: boolean;
}

export function parseModuleInstallIntent(content: string): ModuleInstallIntent | undefined;
export function parsePeerQueryIntent(content: string): PeerQueryIntent | undefined;
export function parseSkinIntent(content: string): SkinIntent | undefined;
```

## The Refactored `server.ts` (≈120 lines)

After extraction, `BridgeServer` becomes a thin orchestrator:

```typescript
// Pseudocode — shows shape, not exact implementation

export class BridgeServer extends EventEmitter<BridgeServerEventMap> {
  private wss: WebSocketServer | null = null;
  private httpSrv: http.Server | null = null;
  private options: BridgeServerOptions;
  private sessions = new Map<string, SessionState>();
  private audit: AuditLogger;
  private chatRouter: ChatRouter;
  private sender: Sender;
  private handlers: HandlerRegistry;
  private handlerCtx: HandlerContext;

  constructor(options: BridgeServerOptions) {
    // Build audit, chatRouter, sender
    // Build HandlerContext (references to all services)
    // Register handlers: CHAT→handleChat, BASH→handleBash, etc.
  }

  start(): void {
    // Create HTTP server (if enablePeerApi) — delegates to handleHttpPeerRequest
    // Create WebSocketServer
    // On connection: authenticateConnection() → attachDispatcher()
  }

  stop(): Promise<void> { /* unchanged */ }
}
```

## Migration Plan

**Phase A: Extract types + helpers (zero behavior change)**
1. Create `src/ws/types.ts` — move type definitions out of server.ts, re-export from server.ts for backward compat
2. Create `src/ws/send.ts` — extract `sendTyped`/`sendResult`/`sendError` as standalone functions
3. Create `src/handlers/types.ts` — define `HandlerContext` and `TypedHandler`
4. Create `src/handlers/intents.ts` — move 3 intent parser functions (pure, no deps)
5. Run tests — must pass with zero changes to test files

**Phase B: Extract auth**
6. Create `src/security/auth-handler.ts` — move `authenticateAndConnect`, `extractToken`, `validateGithubPat`, `verifyPeerAuth`
7. Update `server.ts` to import and call `authenticateConnection()`
8. Run tests — auth test must still pass

**Phase C: Extract handlers**
9. Create `src/handlers/bash.ts` — move `handleBash`
10. Create `src/handlers/file.ts` — move `handleFileEdit`
11. Create `src/handlers/a2a.ts` — move `handleA2aRequest`
12. Create `src/handlers/module.ts` — move `handleModuleInstall`, `handleChatModuleInstall`, `broadcastModuleList`, `getModuleManager`
13. Create `src/handlers/skin.ts` — move `handleChangeSkin`, `broadcastSkinUpdate`
14. Create `src/handlers/peer.ts` — move `handleHttpRequest`, `handlePeerQuery`
15. Create `src/handlers/chat.ts` — move `handleChat` (biggest, depends on intents + chatRouter)
16. Run tests after each handler extraction

**Phase D: Extract dispatcher**
17. Create `src/ws/dispatcher.ts` — move `handleConnection`, `dispatchTyped`, `dispatchRpc`, `handleBridgeMethod`, `handleMcpMethod`, `handleModuleMethod`, `handleA2aMethod`
18. Wire dispatcher into the slimmed `server.ts`
19. Run full test suite

**Phase E: Update exports + new tests**
20. Update `src/index.ts` to re-export from new locations (keep backward compat)
21. Add unit tests for intent parsers (pure functions, currently untested standalone)
22. Add unit tests for auth-handler (currently only integration-tested via ws-server.test.ts)
23. Final full test run, typecheck

## Key Design Decisions

1. **Functions over classes for handlers** — Handlers are stateless. A function + `HandlerContext` is simpler to test than a class with constructor injection. The `TypedHandler` type makes them interchangeable and composable.

2. **`HandlerContext` as a service bag** — Avoids passing 8+ parameters. All handlers get the same bag. They access what they need. This mirrors the current `this.options` pattern but makes deps explicit.

3. **`Sender` interface** — Decouples handlers from raw WebSocket serialization. In tests, you can inject a mock `Sender` that captures frames into an array.

4. **Intent parsers are pure functions** — Already were free functions in server.ts. Moving them to `intents.ts` with no dependencies makes them trivially testable.

5. **Backward-compatible re-exports** — `src/ws/server.ts` continues to export `BridgeServer`, `BridgeServerOptions`, `BridgeServerEventMap`, `TypedMessage`. The `src/index.ts` barrel continues to re-export `src/ws/server.js`. No external consumer breaks.

6. **`HandlerRegistry` as a `Map`** — The dispatcher looks up `handlers.get(msg.type)` instead of a switch. This makes handler registration declarative and extensible without modifying dispatcher code.

## Test Strategy

- **Existing `ws-server.test.ts`** (11 tests) must pass throughout — this is the regression gate
- **Existing `chat-router.test.ts`** (7 tests) is unaffected (file not modified)
- **New `tests/intents.test.ts`** — unit tests for all 3 intent parsers
- **New `tests/auth-handler.test.ts`** — unit tests for `extractToken`, `verifyPeerAuth` (mock-free), plus `validateGithubPat` with HTTP mock
- Handler functions can be unit tested by constructing a `HandlerContext` with stubs and a mock `Sender` — no real WebSocket needed

## Risk Notes

- **`handleChatModuleInstall` holds conversational state** — It `await`s the next WebSocket message (line 943). This must move carefully; the handler still needs direct `ws.once("message", ...)` access. This is the one handler that is inherently stateful.
- **`handleChat` is the largest handler** (~130 lines) with complex control flow (brain context injection, ChatRouter, cloud vs local paths, spawner event subscriptions). Extract last, test most carefully.
- **`broadcastModuleList` and `broadcastSkinUpdate`** need access to `wss.clients`. These go through `ctx.broadcast()` which the server wires to its `WebSocketServer` instance.
