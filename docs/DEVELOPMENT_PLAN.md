# Cocapn — Phased Development Plan

> Assessed 2026-03-27 against CLAUDE.md vision and full codebase audit.

---

## Current State Summary

| Component | Status | LOC |
|-----------|--------|-----|
| local-bridge | Fully implemented, tested | ~4200 |
| ui (packages/ui) | Fully implemented | ~1800 |
| protocols (MCP + A2A) | Fully implemented, zero deps | ~900 |
| cloud-agents | AdmiralDO complete; worker/github stubs | ~250 |
| templates/public | Working Vite app + deploy workflow | complete |
| templates/private | soul.md, config, memory templates | complete |
| modules (3 reference) | habit-tracker, perplexity-search, zotero-bridge | complete |
| schemas (6) | All enforced via SchemaValidator | complete |
| docs + scripts | Architecture, agents, fleet, security, troubleshooting, 3 scripts | complete |
| security layer | age, JWT, audit, filterEnv, fleet keys | complete |
| module system | git submodules, 4 types, sandbox, hooks | complete |
| onboarding wizard | 7-step interactive `cocapn-bridge init` | complete |

### What works end-to-end today

A user can run `cocapn-bridge init`, create repos, generate age keys, start the bridge, connect the React UI via WebSocket, chat with agents, run bash commands, edit files, install modules, and have everything auto-committed to Git. Security (env filtering, audit, JWT fleet auth, encrypted secrets) is in place.

### What doesn't work yet

1. **No `npx create-cocapn` package** — the wizard lives inside local-bridge, not as a standalone scaffolder
2. **Agent routing has no personality-aware selection** — routes by substring match, not by agent capability or context (memory/facts/soul)
3. **Memory/facts system is read-only** — templates have `facts.json`, `procedures.json`, `relationships.json` but nothing writes to or queries them
4. **No chat-driven skin changes** — module install works from chat, but "change my theme to dark blue" doesn't
5. **Cloud worker entrypoint is a stub** — can't actually deploy agents to Cloudflare
6. **No `create-cocapn` npm package** for the standard `npm create` flow
7. **UI ↔ Bridge protocol lacks structured agent selection** — UI sends `agentId` but has no agent picker or capability negotiation
8. **No memory search or retrieval** — agents can't query their own memory (facts, wiki, procedures)
9. **A2A cross-domain routing is wired but untested end-to-end** — DNS verification, fleet JWT signing, HTTP POST forwarding all exist separately

---

## Phase 1: Onboarding & Agent Intelligence (Weeks 1-2)

**Primary goal**: Make the first-run experience zero-friction and give agents access to their memory.

### 1.1 — `create-cocapn` scaffolding package
**Complexity**: Medium

Create `packages/create-cocapn/` as a standalone npm package so users can run:
```bash
npm create cocapn
# or
npx create-cocapn
```

**Design**:
- Separate package with its own `package.json` (`name: "create-cocapn"`, `bin: { "create-cocapn": "./dist/index.js" }`)
- Imports and re-exports the wizard from `@cocapn/local-bridge/cli/init` — OR inlines a stripped-down version that doesn't depend on the full bridge
- The advantage of inlining: zero dependency install for the scaffolder; it just does GitHub API calls, template copy, and age keygen
- After scaffolding, prints `cd my-brain && npx cocapn-bridge` to start the bridge

**Dependencies**: GitHub API, `age-encryption` (WASM), `readline` (stdlib)

**Acceptance criteria**:
- `npx create-cocapn` works on a clean machine with only Node 20+ installed
- Creates both repos on GitHub, clones templates, generates age keypair
- Private repo passes `cocapn-bridge` startup without errors
- Package published to npm (or at least `npm pack` produces a working tarball)

### 1.2 — Memory read/write layer for agents
**Complexity**: High

The private repo has `cocapn/memory/facts.json`, `cocapn/memory/procedures.json`, `cocapn/memory/relationships.json` but nothing reads or writes them programmatically.

**Design**:
- New `src/memory/store.ts` — `MemoryStore` class:
  ```
  addFact(fact, confidence, source) → id
  queryFacts(query) → Fact[] (substring + optional confidence threshold)
  addProcedure(name, steps) → id
  getProcedures(tag?) → Procedure[]
  addRelationship(entity1, relation, entity2) → id
  getRelationships(entity) → Relationship[]
  ```
- Backed by JSON files in Git (reads on demand, writes + auto-commit via GitSync)
- Schema-validated against `memory-fact.schema.json`
- Exposed to agents via MCP tools: `memory_query`, `memory_add_fact`, `memory_add_procedure`
- Exposed to WebSocket clients via JSON-RPC: `memory/query`, `memory/add`

**Dependencies**: SchemaValidator, GitSync (for auto-commit on write)

**Acceptance criteria**:
- Agent can call `memory_query` MCP tool and get facts back
- Facts added via `memory/add` RPC appear in `cocapn/memory/facts.json` and are auto-committed
- Facts survive bridge restart (they're in Git)
- Test: roundtrip add → query → verify content and schema

### 1.3 — Agent personality from soul.md + memory injection
**Complexity**: Medium

Currently `COCAPN_SOUL` is injected as a single env var with the raw soul.md text. Agents have no structured access to facts, procedures, or wiki context.

**Design**:
- On agent spawn, build a context object:
  ```
  { soul: string, recentFacts: Fact[], activeProcedures: Procedure[], recentWiki: string[] }
  ```
- Inject as `COCAPN_CONTEXT` (JSON) alongside `COCAPN_SOUL` (raw text)
- The soul.md text remains the system prompt; context is supplementary structured data
- For MCP agents: register tools `get_soul`, `get_facts`, `get_wiki` so the agent can pull context on demand instead of getting everything upfront

**Dependencies**: MemoryStore (1.2)

**Acceptance criteria**:
- Spawned agent receives `COCAPN_CONTEXT` with recent facts and active procedures
- Agent can call `get_facts` tool to query memory dynamically
- soul.md changes are picked up on next agent spawn without bridge restart

### 1.4 — Agent routing by capability, not just substring
**Complexity**: Medium

Current routing: substring match on message content → agent id. Vision: route by agent capability, task type, and cost.

**Design**:
- Extend `AgentDefinition` with structured capabilities:
  ```
  capabilities: ["research", "code", "habits", "web-search"]
  preferredFor: ["research questions", "code review"]
  ```
- Add a `resolveByCapability(taskType)` method to `AgentRouter` that scores agents by capability match
- The UI sends optional `taskHint` alongside content: `{ type: "CHAT", taskHint: "research", content: "..." }`
- Keep the existing substring rules as an override layer — explicit rules beat capability inference

**Dependencies**: AgentRegistry (existing), agent-definition.schema.json update

**Acceptance criteria**:
- Agent with `capabilities: ["research"]` is selected when `taskHint: "research"` is sent
- Existing substring routing still works (backwards compatible)
- `bridge/agents` RPC returns capabilities per agent for UI display
- Test: two agents registered, correct one selected by capability

---

## Phase 2: Chat-Driven UX & Cloud Deployment (Weeks 3-4)

**Primary goal**: Make the system fully controllable from the chat interface, and deploy cloud agents to Cloudflare.

### 2.1 — Chat-driven skin changes
**Complexity**: Medium

Users should be able to type "change my theme to dark blue" or "use the cyberpunk skin" in chat and have the UI update.

**Design**:
- Extend `parseModuleInstallIntent` (or add `parseSkinIntent`) to detect:
  - "change theme to X" → modify CSS variables in `skin/<current>/theme.css`
  - "use skin X" → if installed module, enable it; if not, search registry
  - "make the background darker" → adjust `--color-bg` variable
- New WebSocket message type: `SKIN_UPDATE` — broadcasts CSS variable changes to all connected clients
- The UI's `DomainSkin.tsx` already reads CSS variables; it just needs to listen for `SKIN_UPDATE` and hot-patch them
- Persist changes by writing to `skin/<name>/theme.css` in the public repo and auto-committing

**Dependencies**: ModuleManager (for skin modules), GitSync (for persist)

**Acceptance criteria**:
- "change theme to dark blue" modifies `--color-primary` and `--color-bg` and UI updates live
- "use skin cyberpunk" installs a skin module if available, or errors gracefully
- Changes persist across browser refresh (CSS file committed to public repo)

### 2.2 — Structured agent picker in UI
**Complexity**: Low

The UI currently sends a hardcoded `agentId` or relies on server-side routing. Users need to see available agents and pick one.

**Design**:
- On connect, UI calls `bridge/agents` RPC and gets `[{id, name, capabilities, type, status}]`
- Add an agent selector dropdown in `ChatPanel.tsx` header
- Selected agent id sent with every CHAT message
- Show agent name/icon in chat bubbles
- "auto" option uses server-side routing (existing behavior)

**Dependencies**: `bridge/agents` RPC (exists), UI only

**Acceptance criteria**:
- Agent picker shows all registered agents with their capabilities
- Selecting an agent routes all subsequent messages to that agent
- "auto" mode uses existing AgentRouter logic

### 2.3 — Cloud worker deployment (`cocapn deploy`)
**Complexity**: High

The cloud-agents package has AdmiralDO but no actual worker entrypoint. This closes that gap.

**Design**:
- `packages/cloud-agents/src/worker.ts` — Cloudflare Worker entrypoint:
  - Routes to AdmiralDO for state management
  - Handles A2A requests (receives task, spawns inference, returns result)
  - Uses Cloudflare AI for inference (free tier: 10K neurons/day)
- New CLI command: `cocapn-bridge deploy <agent-id>` — packages an agent definition + soul into a Cloudflare Worker and deploys via Wrangler API
- `wrangler.toml` generated from agent definition
- The bridge's `CloudAdapter` already knows how to talk to workers — this just provisions them

**Dependencies**: Cloudflare account + API token, wrangler

**Acceptance criteria**:
- `cocapn-bridge deploy navigator --name my-scout` creates a Cloudflare Worker
- Worker responds to A2A requests at `https://<worker>.workers.dev`
- Bridge discovers deployed worker via `cocapn-cloud.yml` and routes to it
- Worker uses Cloudflare AI for inference, returns result

### 2.4 — End-to-end A2A test
**Complexity**: Medium

A2A components exist (protocols package, fleet JWT, DNS CNAME verification, router integration) but have never been tested end-to-end across two bridge instances.

**Design**:
- Extend `scripts/test-fleet.sh` to actually send A2A messages between bridges (not just print curl commands)
- Add integration test: `tests/a2a-e2e.test.ts` — starts two bridges programmatically, authenticates with fleet JWT, sends A2A_REQUEST from bridge A to bridge B, verifies response
- Fix any protocol mismatches discovered during testing (e.g., the `handleA2aRequest` currently just routes locally — it doesn't HTTP POST to a remote bridge)

**Dependencies**: Fleet JWT (exists), two bridge instances

**Acceptance criteria**:
- Bridge A sends `A2A_REQUEST` targeting `studylog.ai` → Bridge B receives it, processes, responds
- Fleet JWT auth is verified on both sides
- test-fleet.sh demonstrates the flow and prints results

---

## Phase 3: Polish, Observability & Community (Weeks 5-6)

**Primary goal**: Production hardening, monitoring, and community infrastructure.

### 3.1 — Memory search with relevance scoring
**Complexity**: Medium

Phase 1's MemoryStore does substring matching. For useful agent memory, we need relevance scoring.

**Design**:
- Add TF-IDF scoring to `MemoryStore.queryFacts()` — no external deps, just term frequency on the JSON corpus
- Optional: if the user has a Cloudflare account, use Vectorize for semantic search (embed facts on write, query by embedding on read)
- The local TF-IDF path must always work (offline-first constraint)
- Expose as MCP tool: `memory_search` with `{ query, limit, minConfidence }` params

**Dependencies**: MemoryStore (Phase 1.2)

**Acceptance criteria**:
- `memory_search("TypeScript generics")` returns relevant facts even if the query words don't exactly match the fact text
- Works offline (no cloud dependency)
- Optional Vectorize path improves results when available

### 3.2 — UI tests and E2E smoke suite
**Complexity**: Medium

The UI has zero tests. The bridge has unit tests but no integration tests with the actual WebSocket protocol.

**Design**:
- Vitest + Testing Library for React components (ChatPanel, Terminal, ModulePanel)
- E2E smoke test: start bridge + Vite dev server, connect via WebSocket, send CHAT, verify CHAT_STREAM response
- Test harness: `tests/e2e/` in local-bridge that starts a real BridgeServer on a random port

**Dependencies**: Vitest, @testing-library/react

**Acceptance criteria**:
- At least 1 test per React component (renders, handles WebSocket messages)
- E2E test: connect → auth → chat → receive response → disconnect
- CI-runnable (no interactive prompts, no real GitHub API calls)

### 3.3 — Observability: structured logging + metrics
**Complexity**: Low

Bridge currently uses `console.info/warn/error` with `[bridge]`/`[git]` prefixes. For production use, this needs structure.

**Design**:
- Replace `console.*` calls with a `Logger` class that outputs structured JSON when `COCAPN_LOG_FORMAT=json`
- Metrics: track agent spawn count, message throughput, git sync latency, auth success/failure rate
- Expose via `bridge/metrics` RPC endpoint for the UI to display
- Keep it simple — no Prometheus, no OpenTelemetry. Just JSON log lines and an in-memory counter map

**Dependencies**: None

**Acceptance criteria**:
- `COCAPN_LOG_FORMAT=json cocapn-bridge --repo .` outputs JSON lines
- `bridge/metrics` returns `{ agentSpawns, messagesHandled, gitSyncs, authFailures, uptime }`
- Default behavior (no env var) remains human-readable console output

### 3.4 — Module registry and discovery
**Complexity**: Medium

Currently modules are installed by raw git URL. The vision includes a community registry (`cocapn.ai/community`).

**Design**:
- `packages/module-registry/` — a simple JSON registry served from GitHub Pages (no backend)
- `registry.json`: `[{ name, gitUrl, description, type, author, stars, downloads }]`
- CLI: `cocapn-bridge module search <query>` — fetches registry, filters locally
- Chat: "install habit tracker" now checks registry before constructing `https://github.com/cocapn/<slug>`
- Community contributions via PR to the registry repo

**Dependencies**: GitHub Pages (for hosting), existing ModuleManager

**Acceptance criteria**:
- `cocapn-bridge module search habit` returns matching modules from the registry
- "install habit-tracker" in chat resolves via registry (not just hardcoded GitHub URL pattern)
- Registry is a static JSON file, no backend required

---

## Architectural Conflicts & Suggested Refactors

### 1. `cocapn-bridge init` embeds the PAT in git remote URLs

**File**: `src/cli/init.ts:454`
```typescript
execSync(`git remote add origin https://oauth2:${token}@github.com/${login}/${repoName}.git`, ...)
```

**Problem**: The PAT is stored in `.git/config` in plaintext. If the user runs `git remote -v`, it's visible. If the repo is shared, the PAT leaks.

**Fix**: Use SSH URLs (`git@github.com:user/repo.git`) when SSH keys are available, or use the `credential.helper` mechanism instead of embedding tokens. As a stopgap, after the initial push, replace the remote URL with the non-token version:
```typescript
execSync(`git remote set-url origin https://github.com/${login}/${repoName}.git`, ...)
```

### 2. Agent secret injection resolves at registry load, not at spawn

**File**: `src/agents/registry.ts:294` — `parseEnvObject` reads `env:` from YAML but doesn't resolve `"secret:KEY"` references.

**Problem**: The YAML can declare `env: { API_KEY: "secret:PERPLEXITY_API_KEY" }` but the `"secret:..."` prefix is never dereferenced. Agents get the literal string `"secret:PERPLEXITY_API_KEY"` instead of the decrypted value.

**Fix**: Add a `resolveSecretRefs(env, secretManager)` step in `AgentSpawner.spawn()` that resolves `"secret:KEY"` values via `SecretManager.getSecret(KEY)`. This must happen at spawn time (not registry load) because the identity key may not be loaded at registry time.

### 3. Chat module intent parser is fragile

**File**: `src/ws/server.ts:854-878` — `parseModuleInstallIntent` uses regex to detect "install X" in user messages.

**Problem**: False positives (user says "install Node.js on my server" → tries to install a module called "node.js"). False negatives (user says "can you set up the habit tracker module for me" → not detected).

**Fix before Phase 2**: Add a confirmation step (already partially implemented with the yes/no prompt) and add a `known_modules` list from the registry to avoid guessing. For Phase 2, use the agent itself to classify intent (the agent has the soul context to understand what the user means).

### 4. Bridge constructor does too much

**File**: `src/bridge.ts:83-141`

**Problem**: The constructor synchronously loads config, creates all subsystems, loads agents from both repos, loads cloud adapters, and builds the router. Any failure crashes the constructor with a confusing stack trace. Also makes testing hard — you can't construct a Bridge without a valid repo.

**Fix**: Move subsystem creation into `start()` using a builder pattern. The constructor should only store options. This also allows async initialization (e.g., loading secrets before building the server).

### 5. No graceful reconnection in UI

**File**: `packages/ui/src/hooks/useBridge.ts`

**Problem**: If the bridge restarts (common during development), the UI WebSocket disconnects and doesn't automatically reconnect.

**Fix**: Add exponential backoff reconnection to `useBridge.ts`. The public template's `useBridge.ts` appears to have this (`exponential-backoff reconnect` is mentioned in the README) but the actual packages/ui version should be verified.

---

## Two-Week Sprint Plan (Phases 1.1–1.4 + refactors)

Assumes one developer working ~6 hours/day.

| Day | Task | Est. Hours | Notes |
|-----|------|-----------|-------|
| **1** | Refactor: fix PAT-in-remote-URL (stopgap) | 1h | Replace remote URL after push |
| **1** | Refactor: add `resolveSecretRefs` in AgentSpawner | 2h | Resolve `"secret:KEY"` at spawn time |
| **1** | Refactor: move Bridge construction into `start()` | 2h | Builder pattern, async-safe |
| **2** | 1.2: MemoryStore — addFact, queryFacts, addProcedure | 4h | JSON-backed, schema-validated |
| **2** | 1.2: MemoryStore — GitSync integration (auto-commit on write) | 2h | |
| **3** | 1.2: MemoryStore — MCP tool exposure (memory_query, memory_add_fact) | 3h | Register tools with MCPServer |
| **3** | 1.2: MemoryStore — WebSocket RPC (memory/query, memory/add) | 2h | Wire into BridgeServer |
| **3** | 1.2: Tests for MemoryStore | 1h | |
| **4** | 1.3: Build context object at spawn time | 2h | soul + recentFacts + procedures |
| **4** | 1.3: Register `get_soul`, `get_facts`, `get_wiki` MCP tools | 3h | On-demand context for agents |
| **5** | 1.4: Extend AgentDefinition with structured capabilities | 2h | Schema update + registry parser |
| **5** | 1.4: `resolveByCapability` in AgentRouter | 2h | Score agents by capability match |
| **5** | 1.4: UI taskHint support + tests | 2h | |
| **6** | 1.1: Create `packages/create-cocapn/` package | 3h | Standalone scaffolder |
| **6** | 1.1: Inline wizard (no local-bridge dep) | 3h | GitHub API + age-encryption only |
| **7** | 1.1: Test `npx create-cocapn` flow end-to-end | 2h | |
| **7** | Integration testing: full flow with memory + routing | 3h | |
| **8** | Fix bugs found during integration | 4h | Buffer day |
| **9** | Docs: update README, architecture.md, agents.md | 3h | Reflect new memory + routing |
| **9** | Update CLAUDE.md with new architecture decisions | 1h | |
| **10** | Final typecheck, test suite, push | 2h | |

**Total**: ~48 hours across 10 working days

### Priority order (if time is short)

1. **Refactor: resolveSecretRefs** — broken functionality, blocks real agent use
2. **1.2: MemoryStore** — biggest gap between vision and reality
3. **1.1: create-cocapn** — first-run experience is the funnel
4. **1.4: Capability routing** — quality-of-life for multi-agent setups
5. **1.3: Context injection** — improves agent quality but not strictly required
6. **Refactor: PAT in remote URL** — security hygiene
7. **Refactor: Bridge constructor** — code quality, not user-facing
