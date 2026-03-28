# Architecture

Cocapn is a repo-first hybrid agent OS. The fundamental design principle is: **Git is the database, your machine is the compute, Cloudflare is optional.**

## Layers

```
┌──────────────────────────────────────────────────────────┐
│  Browser (you.domain.ai — GitHub Pages)                  │
│  React SPA, domain-skinned, connects via WebSocket       │
└───────────────────────┬──────────────────────────────────┘
                        │
                WebSocket (ws://localhost:8787)
                or Cloudflare Tunnel (wss://…)
                        │
┌───────────────────────▼──────────────────────────────────┐
│  Local Bridge (cocapn-bridge)                            │
│  Node.js process on your machine                         │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ BridgeServer│  │ AgentSpawner │  │ GitSync        │  │
│  │ (WebSocket) │  │ (child_proc) │  │ (auto-commit)  │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ SecretMgr   │  │ ModuleManager│  │ FleetKeyManager│  │
│  │ (age crypto)│  │ (submodules) │  │ (JWT auth)     │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
└────────┬──────────────────────┬──────────────────────────┘
         │                      │
┌────────▼────────┐   ┌─────────▼──────────────┐
│ Private Git Repo│   │ Cloudflare Workers       │
│ (encrypted)     │   │ (optional, 24/7 agents)  │
│                 │   │                          │
│ secrets/*.age   │   │ cloud-agents/            │
│ cocapn/agents/  │   │ Admiral DO               │
│ wiki/, tasks/   │   │ Vectorize, D1, KV        │
└─────────────────┘   └──────────────────────────┘
         │
┌────────▼────────┐
│ Public Git Repo │
│ (GitHub Pages)  │
│ cocapn.yml      │
│ skin/           │
│ index.html      │
└─────────────────┘
```

## Data Flow

### Chat message

1. Browser sends `{ type: "CHAT", agentId: "default", content: "Hello" }` over WebSocket
2. `BridgeServer.dispatchTyped` routes to `handleChat`
3. `AgentRouter` selects the target agent (local or cloud)
4. For local agents: `AgentSpawner` spawns the CLI process (e.g. `claude` or `pi`) with:
   - `COCAPN_SOUL` = contents of `cocapn/soul.md`
   - `COCAPN_*` project vars
   - Stripped host env (no AWS/OpenAI/GitHub tokens)
5. Streamed output → `STREAM_CHUNK` messages → Browser terminal
6. On completion: `STREAM_END`, agent is stopped or kept warm

### Git sync

1. `RepoWatcher` (chokidar) detects file changes in the private repo
2. After a debounce delay, `GitSync` stages + commits changed files
3. Every N seconds, `GitSync` pulls from `origin` then pushes
4. Events: `committed`, `pushed`, `pulled`, `conflict`, `error`

### Secret access

1. Agent requests a secret via `COCAPN_SECRET_NAME` env var (pre-injected at spawn)
2. Bridge decrypts `secrets/NAME.age` using the identity loaded from OS keychain
3. Secret value is passed as env var — never logged, never stored in plaintext

## Key Components

### BridgeServer (`src/ws/server.ts`)

WebSocket server built on the `ws` library. Handles:
- **Authentication**: GitHub PAT (checked against `/user` API) or JWT fleet token
- **Message dispatch**: typed message router for CHAT, BASH, FILE_EDIT, RPC, MODULE_INSTALL
- **Agent streaming**: pipes agent subprocess stdout/stderr as `STREAM_CHUNK` messages
- **Module RPC**: proxies `module/*` methods to `ModuleManager`
- **Audit logging**: every action goes to `AuditLogger`

### AgentSpawner (`src/agents/spawner.ts`)

Manages child processes for CLI agents. Features:
- `filterEnv`: strips all host secrets, passes only `COCAPN_*` + safe system vars
- Process lifecycle: spawn, stream, stop, stopAll
- Per-agent env injection (secrets, soul, project vars)

### GitSync (`src/git/sync.ts`)

Auto-commit/push/pull loop using `simple-git`. Events emitted for the bridge to log.

### SecretManager (`src/secret-manager.ts`)

age encryption wrapper. Uses the `age-encryption` npm package (WASM-based). Identity stored in:
1. OS keychain via `keytar` (preferred)
2. `~/.config/cocapn/identity.age` mode 0600 (fallback)

### ModuleManager (`src/modules/manager.ts`)

Git-submodule-based extension system. Supports four module types with type-specific install logic and sandbox enforcement.

### FleetKeyManager (`src/security/fleet.ts`)

Manages the fleet JWT signing key stored in `secrets/fleet-key.age`. Enables multi-device and multi-bridge authentication without GitHub PAT sharing.

## Multi-device (Fleet)

Multiple bridge instances (e.g. desktop + laptop + cloud) form a fleet:

1. One device runs `cocapn-bridge secret init` → generates fleet key → stores in `secrets/fleet-key.age`
2. Other devices pull the repo → load the fleet key via `FleetKeyManager.load(decryptFn)`
3. Bridges authenticate each other with fleet JWTs (HMAC-SHA256, 1 hour TTL)
4. A2A messages route between bridges via `AgentRouter`

## Cloud Tier (Optional)

When `cocapn/cocapn-cloud.yml` is present, the bridge loads `CloudAdapterRegistry` which proxies agent requests to Cloudflare Workers. The Admiral Durable Object provides:
- Heartbeat tracking (which bridges are online)
- Git commit notifications (cloud agents pull latest repo state)
- 24/7 background task execution via Alarms API
