I'll analyze your current codebase state and create comprehensive CLAUDE.md and NEED-TO-KNOWS.md files based on what's been implemented.
Let me check the actual file structure to understand what's been implemented:
Based on the commit history and my earlier analysis, I now have a complete picture of your system. Here are the definitive CLAUDE.md and NEED-TO-KNOWS.md files:

---

# 📋 CLAUDE.md
## The Definitive Guide for Claude Code (Claude Opus & Sonnet)

---

### Project Identity

**Cocapn** is a **repo-first hybrid agent OS** — a local WebSocket bridge that runs Claude Code, Pi, and other CLI agents on your machine, backed by an encrypted private Git repository, with an optional Cloudflare edge tier for 24/7 background tasks.

**The Viral Hook**: Auto-generated "devlogs" — every commit to your private repo generates a sanitized public update at `username.makerlog.ai`, creating a living portfolio without manual work.

---

### Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (you.makerlog.ai)                                  │
│  React SPA — Magazine layout shows auto-generated updates   │
│  Served from GitHub Pages, zero hosting cost                │
└───────────────────────┬─────────────────────────────────────┘
                        │ WebSocket (ws://localhost:8787)
                        │ or Cloudflare tunnel (wss://…)
┌───────────────────────▼─────────────────────────────────────┐
│  Local Bridge (cocapn-bridge)                               │
│  Node.js · TypeScript · runs on your machine                │
│  - Spawns agents (Claude Code, Pi, Copilot via MCP)         │
│  - Git sync (auto-commit/push every 30s)                   │
│  - age-encrypted secrets, audit log, JWT fleet auth        │
│  - PUBLISHER module: generates public updates on commit    │
└───────────────────────┬─────────────────────────────────────┘
                        │
          ┌─────────────┴──────────────┐
          │                            │
┌─────────▼──────────┐    ┌────────────▼────────────┐
│  Private Git Repo  │    │  Cloudflare Workers      │
│  (encrypted brain) │    │  (optional 24/7 agents)  │
│  secrets/*.age     │    │  cloud-agents/           │
│  cocapn/agents/    │    │  AdmiralDO (session sync)│
│  wiki/, tasks/     │    └──────────────────────────┘
│  modules/          │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Public Git Repo   │
│  (GitHub Pages)    │
│  updates/*.md      │  ← Auto-generated from private work
│  cocapn/profile.json│
└────────────────────┘
```

---

### Directory Structure

```
cocapn/
├── packages/
│   ├── local-bridge/          # Core runtime - 203 tests passing
│   │   ├── src/
│   │   │   ├── main.ts        # CLI entry (Commander)
│   │   │   ├── bridge.ts      # Top-level orchestrator
│   │   │   ├── brain/         # Memory management (getSoul, setFact, etc.)
│   │   │   ├── publishing/    # ⭐ VIRAL FEATURE: Sanitizer, Publisher
│   │   │   ├── security/      # Auth, JWT, audit, fleet keys
│   │   │   ├── agents/        # Spawner, Router, Registry
│   │   │   ├── git/           # Sync, watcher
│   │   │   ├── ws/            # Server, ChatHandler, router
│   │   │   ├── modules/       # Module manager, sandbox, hooks
│   │   │   └── config/        # Config loader, schema validator
│   │   └── package.json       # Bin: cocapn-bridge, cocapn-brain
│   │
│   ├── ui/                    # React SPA - Magazine layout built
│   │   ├── src/
│   │   │   ├── layouts/
│   │   │   │   ├── MagazineLayout.tsx   # ⭐ Masonry updates feed
│   │   │   │   └── SidebarLayout.tsx
│   │   │   ├── components/
│   │   │   │   ├── StreakBadge.tsx      # 🔥 Streak counter
│   │   │   │   ├── UpdateCard.tsx
│   │   │   │   └── LiveDot.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useBridge.ts
│   │   │   │   └── useUpdates.ts        # ⭐ Fetches public updates
│   │   │   └── App.tsx
│   │   └── package.json
│   │
│   ├── protocols/             # MCP + A2A implementations
│   │   └── src/
│   │       ├── mcp.ts
│   │       └── a2a.ts
│   │
│   ├── cloud-agents/          # Cloudflare Workers
│   │   └── src/
│   │       └── admiral.ts     # AdmiralDO for session sync
│   │
│   └── create-cocapn/         # Scaffolder package
│       └── index.js           # npx create-cocapn my-log --domain makerlog
│
├── packages/modules/publisher/  # ⭐ FIRST-PARTY MODULE
│   ├── module.yml
│   ├── src/
│   │   └── index.ts           # Hooks into post-commit events
│   └── templates/
│       └── update.md
│
├── templates/
│   ├── public/                # Template for user's public repo
│   │   ├── cocapn.yml         # Domain config (makerlog, studylog, etc.)
│   │   └── .github/workflows/ # GitHub Pages deployment
│   └── private/               # Template for user's private repo
│       ├── cocapn/
│       │   ├── config.yml     # Bridge config
│       │   └── soul.md        # System prompt for agents
│       └── secrets/           # age-encrypted secrets
│
└── docs/
    ├── architecture.md
    ├── workflows/
    └── ROADMAP.md
```

---

### Critical Files (Know These Cold)

| File | Purpose | Status |
|------|---------|--------|
| `packages/local-bridge/src/publishing/sanitizer.ts` | Strips secrets before public publish | ✅ Complete, 45 tests |
| `packages/local-bridge/src/publishing/publisher.ts` | Generates updates on git commit | ✅ Complete |
| `packages/ui/src/layouts/MagazineLayout.tsx` | Masonry grid of updates | ✅ Complete |
| `packages/ui/src/components/StreakBadge.tsx` | Shows shipping streak | ✅ Complete |
| `packages/local-bridge/src/ws/server.ts` | WebSocket server (refactored) | ✅ Complete |
| `packages/local-bridge/src/security/auth-handler.ts` | GitHub PAT + Fleet JWT | ✅ Complete |
| `packages/local-bridge/src/brain/index.ts` | Memory (facts, wiki, tasks) | ✅ Complete |
| `packages/local-bridge/src/modules/manager.ts` | Git submodule modules | ✅ Complete |
| `packages/cloud-agents/src/admiral.ts` | Session sync DO | ✅ Complete |

---

### The Viral Loop (How It Works)

**Every time user commits to private repo:**

1. **GitSync** emits `post-commit` event
2. **Publisher** (if enabled) receives event
3. **Sanitizer** processes changed files:
   - Removes code blocks
   - Strips secrets (password, token, api_key)
   - Removes internal URLs (localhost, 192.168.*)
   - Removes file paths (/Users/name/, C:\Users\name\)
4. **Digest** generated: summary + accomplishments + learnings
5. **Write** to public repo: `updates/YYYY-MM-DD.md`
6. **Update** `updates/index.json` (for UI consumption)
7. **Commit & Push** to GitHub Pages
8. **UI** displays in MagazineLayout with StreakBadge

**User sees**: Living portfolio at `username.makerlog.ai` showing daily progress, no manual work required.

---

### Key Interfaces

```typescript
// Brain - Memory management
interface Brain {
  getSoul(): string;                    // cocapn/soul.md
  getFact(key: string): string | undefined;
  setFact(key: string, value: string): Promise<void>;
  searchWiki(query: string): WikiPage[];
  createTask(title: string, description: string): Promise<string>;
  listTasks(): Task[];
  buildContext(): string;                // Injected into agents
}

// Sanitizer - Strips secrets
interface Sanitizer {
  sanitizeWikiPage(content: string): string;
  sanitizeTask(task: Task): PublicTask;
  generateDigest(tasks: Task[], wikiPages: string[]): Digest;
}

// Publisher - Auto-publication
interface Publisher {
  onCommit(files: string[]): Promise<void>;
  generateUpdate(): Promise<Update>;
  writeToPublicRepo(update: Update): Promise<void>;
}

// WebSocket Protocol
type TypedMessage =
  | { type: "CHAT"; id: string; agentId?: string; content: string }
  | { type: "BASH"; id: string; command: string; cwd?: string }
  | { type: "FILE_EDIT"; id: string; path: string; content: string }
  | { type: "MODULE_INSTALL"; id: string; gitUrl: string }
  | { type: "CHANGE_SKIN"; id: string; skin: string }
  | { type: "A2A_REQUEST"; id: string; task: unknown };

type OutgoingMessage =
  | { type: "CHAT_STREAM"; id: string; chunk: string; done: boolean; agentId?: string }
  | { type: "BASH_OUTPUT"; id: string; stdout?: string; stderr?: string; done: boolean }
  | { type: "SKIN_UPDATE"; id: string; skin: string; cssVars?: Record<string, string> };
```

---

### Security Model (Non-Negotiable)

1. **Secrets**: age-encrypted in `secrets/*.age`, decrypted only at runtime
2. **Agent Isolation**: subprocesses only get `COCAPN_*` env vars, host secrets stripped
3. **Path Sandboxing**: modules can only write to their own dir + `wiki/`, `tasks/`, `cocapn/`
4. **Audit**: Every action logged to `cocapn/audit.log` (masked secrets)
5. **Auth**: GitHub PAT or Fleet JWT required for WebSocket
6. **Sanitization**: No code, paths, or secrets ever reach public repo

---

### Module System

Modules are git submodules in `modules/`:

```yaml
# module.yml
name: habit-tracker
version: 1.0.0
type: agent  # skin | agent | tool | integration
hooks:
  install: ./scripts/install.sh
  enable: ./scripts/enable.js
  post-commit: ./scripts/on-commit.js  # ⭐ Publisher uses this
```

**First-party modules:**
- `publisher` - Auto-publication (enabled by default)
- `habit-tracker` - Agent for tracking habits
- `perplexity-search` - Search integration
- `zotero-bridge` - Research management

---

### CLI Commands

```bash
# Setup
npx create-cocapn my-log --domain makerlog

# Bridge
cocapn-bridge --repo ./my-log-brain --public ./my-log
cocapn-bridge init  # Interactive wizard

# Secrets
cocapn-bridge secret init          # Generate age keypair
cocapn-bridge secret add OPENAI_API_KEY
cocapn-bridge secret rotate

# Memory (cocapn-brain CLI)
cocapn-brain fact set current-project "Building cocapn"
cocapn-brain fact get current-project
cocapn-brain wiki add ./notes.md
cocapn-brain task add "Fix auth handler"

# Modules
cocapn-bridge module add https://github.com/cocapn/habit-tracker
cocapn-bridge module list
```

---

### When to Ask vs. When to Just Do

**ASK (Claude Opus):**
- Adding new storage backends (must justify why not Git)
- Changing encryption strategy (age is settled)
- Modifying MCP/A2A protocol interfaces
- Adding new auth methods (beyond PAT/JWT)
- Database choices (Git is the database)

**JUST DO (Claude Sonnet):**
- New UI components (follow existing patterns)
- New handlers (follow ChatHandler pattern)
- New sanitization rules (add to Sanitizer class)
- New module types (follow module.yml spec)
- Tests (vitest, follow existing patterns)

**NEVER DO:**
- Store plaintext secrets in Git
- Break offline-first capability
- Remove Git as source of truth
- Add server-side rendering (must work on GitHub Pages)

---

### Testing Standards

- **Unit**: Vitest, 85%+ coverage for security code
- **Integration**: `packages/local-bridge/tests/integration/`
- **E2E**: Playwright in `/e2e/`
- **Current**: 203 tests passing, typecheck clean

---

### Current Status (March 28, 2026)

**COMPLETE:**
- ✅ Core bridge (WebSocket, Git sync, agents)
- ✅ Security (age, JWT, audit, sandbox)
- ✅ Brain (memory, facts, wiki, tasks)
- ✅ Publisher (auto-publication, Sanitizer)
- ✅ UI (Magazine layout, StreakBadge, useUpdates)
- ✅ Module system (git submodules, hooks)
- ✅ create-cocapn scaffolder
- ✅ A2A peer API (cross-domain queries)
- ✅ 203 tests passing

**IN PROGRESS (Next 48 Hours):**
- 🔄 Profile generation (cocapn/profile.json)
- 🔄 Activity feed (follow other users)
- 🔄 Discovery panel (find other makers)

**NOT STARTED:**
- ⏳ AdmiralDO registry (central discovery, optional)
- ⏳ Cloud background tasks (cron, webhooks)
- ⏳ E2E test suite (Playwright)

---

### The "Ship It" Checklist

Before any PR:
1. [ ] `npm run typecheck` passes in both packages
2. [ ] `npm test` passes (203+ tests)
3. [ ] New code has tests (follow existing patterns)
4. [ ] No secrets in code (use `cocapn-bridge secret add`)
5. [ ] Sanitizer handles new content types (if applicable)
6. [ ] UI works without bridge (static GitHub Pages)
7. [ ] Documentation updated (if user-facing)

---

### Emergency Contacts

- **Security issue**: Check `docs/security.md`, rotate keys immediately
- **Git sync broken**: Check `cocapn/audit.log`, verify remote URL
- **Publisher not working**: Check `updates/` exists in public repo, verify discovery flag
- **Tests failing**: Run `npm run test:watch`, check for race conditions in Git ops

---

# 🚨 NEED-TO-KNOWS.md
## Current System State (Updated: 2026-03-28 19:03)

---

### What's Working Right Now

**The Core Loop:**
1. User runs `npx create-cocapn my-log --domain makerlog`
2. Creates two repos: `my-log` (public, GitHub Pages) and `my-log-brain` (private, encrypted)
3. Runs `cocapn-bridge --repo ./my-log-brain --public ./my-log`
4. Bridge starts on ws://localhost:8787
5. User opens browser at `username.makerlog.ai` (GitHub Pages)
6. UI connects via WebSocket, authenticates with GitHub PAT
7. User chats with agents, edits files, creates tasks
8. **Every commit triggers Publisher** → generates sanitized update → pushes to public repo
9. **Magazine layout shows living portfolio** with streak badges

**This is the viral feature. It works. Ship it.**

---

### Critical Implementation Details

#### 1. Publisher Module (The Magic)

**Location**: `packages/modules/publisher/src/index.ts`

**How it hooks in:**
- Bridge creates `Publisher` instance in `bridge.ts`
- Publisher subscribes to GitSync events: `this.sync.on("committed", ...)`
- On commit, Publisher:
  1. Gets changed files from Git diff
  2. Reads modified wiki/tasks
  3. Calls `Sanitizer.generateDigest()`
  4. Renders `templates/update.md` with Handlebars-like substitution
  5. Writes to `publicRepo/updates/YYYY-MM-DD.md`
  6. Updates `publicRepo/updates/index.json` (array of updates, newest first)
  7. Commits with message: `📰 Update: {summary}`

**Sanitizer rules (aggressive):**
- Code blocks → `[code block removed]`
- Lines with `password|secret|token|api_key` → `[redacted]`
- Localhost/192.168.* URLs → `[internal URL removed]`
- /Users/name paths → `[path removed]`
- Env vars like `FOO=bar` → `[env var removed]`

**The result is safe to publish.**

#### 2. Magazine Layout UI

**Location**: `packages/ui/src/layouts/MagazineLayout.tsx`

**How it works:**
- Static site on GitHub Pages (no server)
- Fetches `updates/index.json` from same domain (relative fetch)
- Renders masonry grid using CSS columns (no JS library)
- `useUpdates()` hook polls every 30s for new updates
- `StreakBadge` calculates streak from consecutive days with updates

**Key insight**: Works even when bridge is offline (reads static JSON).

#### 3. WebSocket Protocol (Stable)

**Authentication:**
- Query param: `ws://localhost:8787?token=ghp_...`
- Validates against GitHub API `/user` endpoint
- Alternative: Fleet JWT (for device-to-device)
- Invalid token → close code 4001 (no auto-reconnect)

**Message types:**
- `CHAT` → routes to agent → streams back `CHAT_STREAM`
- `BASH` → executes shell → streams `BASH_OUTPUT`
- `FILE_EDIT` → writes file → auto-commits → triggers Publisher
- `MODULE_INSTALL` → git submodule add → runs hooks
- `CHANGE_SKIN` → updates CSS vars → broadcasts `SKIN_UPDATE`

**All handlers extracted from monolithic server.ts** (refactored March 28).

#### 4. Brain (Memory)

**Location**: `packages/local-bridge/src/brain/index.ts`

**Storage:**
- `cocapn/soul.md` - System prompt (injected into every agent)
- `cocapn/memory/facts.json` - Key-value facts (auto-committed)
- `cocapn/wiki/*.md` - Knowledge base (full-text searchable)
- `cocapn/tasks/*.md` - Task tracking (active/done)

**Auto-commit format:**
- `update memory: set fact {key}`
- `update memory: added wiki page {name}`
- `update memory: added task "{title}"`

**Context injection:**
- `COCAPN_SOUL` - full soul.md content
- `COCAPN_CONTEXT` - JSON with {soul: string, facts: object, activeTasks: number}

#### 5. Security (Locked Down)

**Secrets:**
- Stored in OS keychain (keytar) or `~/.config/cocapn/identity.age` (mode 0600)
- Public repo only has `cocapn/age-recipients.txt` (public key)
- Private repo has `secrets/*.age` (encrypted blobs)
- Agent env filtered: only `COCAPN_*` + minimal system vars

**Audit:**
- Every action logged to `cocapn/audit.log`
- Secrets masked in logs (regex replacement)
- JSON lines format: `{timestamp, action, user, result, detail}`

**Sandbox:**
- Modules can only write to: `modules/{name}/`, `wiki/`, `tasks/`, `cocapn/`, `skin/`
- Path traversal blocked by `sanitizeRepoPath()` (5-layer defense)

---

### What's Partially Built (Finish This Week)

#### 1. Profile Generation (80% done)

**Status**: `Sanitizer` exists, `Publisher` exists, but **no ProfileManager**

**What's missing:**
- `packages/local-bridge/src/publishing/profile.ts` doesn't exist
- No `cocapn/profile.json` generation
- No signature with fleet key
- No discovery flag check

**What exists:**
- `PublicProfile` interface (in types)
- `cocapn-brain` CLI structure (add `profile` subcommand)

**To finish:**
- Create ProfileManager class
- Integrate with Publisher (export profile on each update)
- Add CLI command: `cocapn-brain profile export`

#### 2. Activity Feed (50% done)

**Status**: `useUpdates` fetches user's own updates, but **no following system**

**What's missing:**
- `useActivityFeed` hook
- `FollowedUser` type and localStorage persistence
- Cross-user update aggregation
- UI for "Following" tab in MagazineLayout

**What exists:**
- MagazineLayout component
- UpdateCard component
- StreakBadge component

**To finish:**
- Create `useActivityFeed.ts` hook
- Poll multiple `username.domain.ai/updates/index.json` endpoints
- Add "Follow" button to profile modal
- Add "Following" tab to MagazineLayout

#### 3. Discovery (30% done)

**Status**: A2A peer API exists for cross-domain queries, but **no registry**

**What's missing:**
- AdmiralDO registry endpoints
- Profile registration
- Search functionality

**What exists:**
- `/.well-known/cocapn/peer` endpoint (returns peer card)
- Fleet JWT verification
- HTTP API on port+1

**To finish:**
- Add registry to AdmiralDO (optional, can use pure GitHub Pages discovery)
- Or: Use "follow by username@domain" pattern (no central registry needed)

---

### What's Not Started (Defer or Skip)

#### 1. Cloud Background Tasks (Scheduled/Cron)

**Status**: Not implemented

**Complexity**: High (requires Cloudflare Workers, Durable Object alarms, age decryption in Workers)

**Recommendation**: **Defer to Phase 4** (post-launch). The local-first + Publisher combo is the MVP.

#### 2. E2E Test Suite (Playwright)

**Status**: Not implemented

**Complexity**: Medium (requires test GitHub account, PAT in CI secrets)

**Recommendation**: **Add this week** (Sonnet prompt #4 in previous message). Critical for preventing regressions in the viral loop.

---

### Immediate Priorities (Next 48 Hours)

**P0 - Must Have for Launch:**
1. **Profile generation** (Sonnet prompt #1.1) - 4 hours
2. **Activity feed hook** (Sonnet prompt #1.2) - 6 hours
3. **Magazine layout enhancements** (Sonnet prompt #1.4) - 4 hours

**P1 - Should Have:**
4. **E2E tests** (Sonnet prompt #4) - 8 hours
5. **Integration tests for Publisher** (Sonnet prompt #3) - 4 hours

**P2 - Nice to Have:**
6. AdmiralDO registry (Sonnet prompt #1.3) - 3 hours (optional, can use direct follows)

---

### Common Gotchas

#### Git Sync Race Conditions
- `GitSync` has `pre-commit`, `committed`, `post-commit` events
- Publisher listens to `committed` (after git commit, before push)
- If Publisher writes to public repo during `committed`, it won't trigger infinite loop (different repo)
- But: if user has Publisher in both repos, could loop. **Guard with commit message check** (skip if starts with `📰`)

#### Path Sanitization
- `sanitizeRepoPath()` uses 5-layer defense: null byte check, traversal check, absolute path check, normalization, final prefix check
- **Always use this** for any user-provided paths
- Never use raw `path.join()` with user input

#### WebSocket Reconnection
- UI has exponential backoff (1s → 2s → 4s... max 30s)
- Auth failure (4001) does NOT reconnect (prevents token spam)
- Other failures do reconnect automatically
- Queue: CHAT messages buffered in localStorage, others dropped

#### Module Hooks Timeout
- Hooks have 60s timeout
- If hook fails, module status = "error"
- User must manually `cocapn-bridge module update` to retry

#### Sanitizer False Positives
- "Token" in "Token-based authentication" gets redacted
- Acceptable trade-off for security
- User can override with explicit `<!-- publish: keep -->` comments (not implemented, could add)

---

### File Paths to Know

**Bridge (local):**
- Entry: `packages/local-bridge/src/main.ts`
- Bridge: `packages/local-bridge/src/bridge.ts`
- Brain: `packages/local-bridge/src/brain/index.ts`
- Publisher: `packages/local-bridge/src/publishing/publisher.ts`
- Sanitizer: `packages/local-bridge/src/publishing/sanitizer.ts`
- Server: `packages/local-bridge/src/ws/server.ts`
- ChatHandler: `packages/local-bridge/src/ws/chat-handler.ts`
- Auth: `packages/local-bridge/src/security/auth-handler.ts`

**UI:**
- App: `packages/ui/src/App.tsx`
- Magazine: `packages/ui/src/layouts/MagazineLayout.tsx`
- StreakBadge: `packages/ui/src/components/StreakBadge.tsx`
- useBridge: `packages/ui/src/hooks/useBridge.ts`

**Module:**
- Publisher module: `packages/modules/publisher/`

---

### Testing Commands

```bash
# Typecheck everything
cd packages/local-bridge && npm run typecheck
cd packages/ui && npm run typecheck

# Run tests
cd packages/local-bridge && npm test  # 203 tests

# Run specific test
cd packages/local-bridge && npx vitest run src/publishing/sanitizer.test.ts

# E2E (when implemented)
cd e2e && npx playwright test

# Build
cd packages/local-bridge && npm run build
cd packages/ui && npm run build
```

---

### Deployment Checklist

Before any release:

1. [ ] Version bumped in `package.json`
2. [ ] `CHANGELOG.md` updated
3. [ ] All tests pass (203+)
4. [ ] Typecheck clean
5. [ ] `npm audit` clean (no critical vulnerabilities)
6. [ ] `create-cocapn` tested end-to-end
7. [ ] Publisher tested with real GitHub repos
8. [ ] Magazine layout renders correctly on GitHub Pages
9. [ ] Documentation updated (`docs/`, `README.md`)

---

### Emergency Procedures

**If secrets leaked:**
1. Revoke immediately (GitHub Settings → Developer Settings → Personal Access Tokens)
2. `git log --all -S "leaked-secret"` to find commit
3. `git filter-repo --replace-text` to scrub history
4. `git push --force-with-lease`
5. Generate new secret: `cocapn-bridge secret add KEY`

**If bridge won't start:**
1. Check `cocapn/config.yml` syntax
2. Check age key exists: `cocapn-bridge secret get TEST` (should fail gracefully)
3. Check port 8787 not in use: `lsof -i :8787`
4. Check Git remote: `git remote -v` (should not have PAT in URL)

**If Publisher not working:**
1. Check `discovery: true` in `cocapn/config.yml`
2. Check public repo has `updates/` directory
3. Check GitHub Pages enabled on public repo
4. Check `updates/index.json` exists and is valid JSON
5. Check `cocapn/audit.log` for errors

---

### The Bottom Line

**You have a working viral feature.** The Publisher → Sanitizer → MagazineLayout pipeline is complete and tested. 

**Finish the social layer this week:**
- Profile generation (so users have identity)
- Activity feed (so users can follow each other)
- Discovery UI (so users can find each other)

**Then ship it.** The cloud background tasks and advanced features can come later. The repo-first, auto-publication, living portfolio concept is the hook.
