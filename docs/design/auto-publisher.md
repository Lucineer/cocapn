# Auto-Publisher System Design

## Overview

Automatically generates sanitized public devlog content from private repo activity. Commits to the private brain repo trigger a pipeline that extracts diffs, redacts sensitive material, summarizes via LLM, and writes public-safe markdown to the user's public repo with streak tracking.

---

## Data Flow

```
 PRIVATE REPO (brain)                    PUBLISHER PIPELINE                       PUBLIC REPO (devlog)
 ════════════════════                    ══════════════════                       ═══════════════════

 User edits files
       │
 RepoWatcher (chokidar)
       │
       ▼
 GitSync.commit()
       │
       ├── emits "committed"
       │   (msg, files[])
       │         │
       │         ▼
       │   ┌─────────────────┐
       │   │  PublishTrigger  │  ── debounce 10s (coalesce rapid commits)
       │   │  (in Bridge)     │  ── skip if files ⊆ encrypted paths
       │   └────────┬────────┘  ── skip if publisher disabled in config
       │            │
       │            ▼
       │   ┌─────────────────┐
       │   │  DiffExtractor  │  ── git diff HEAD~N (N = commits since last publish)
       │   │                 │  ── git log --oneline for commit messages
       │   │                 │  ── returns DiffBundle { patches[], messages[] }
       │   └────────┬────────┘
       │            │
       │            ▼
       │   ┌─────────────────┐
       │   │   Sanitizer     │  ── regex pass: strip secrets, IPs, tokens
       │   │   (pure fn)     │  ── code fence removal: keep descriptions only
       │   │                 │  ── path scrubbing: /home/user → ~
       │   │                 │  ── returns SanitizedDiff + RedactionReport
       │   └────────┬────────┘
       │            │
       │            ▼
       │   ┌─────────────────┐
       │   │  Summarizer     │  ── reads Brain context (soul, facts, tasks)
       │   │  (LLM via MCP)  │  ── prompt: "summarize this work for a devlog"
       │   │                 │  ── input: sanitized diff + brain context
       │   │                 │  ── output: PublicUpdate markdown
       │   └────────┬────────┘     (title, narrative, tech stack, tags)
       │            │
       │            ▼
       │   ┌─────────────────┐     ┌─────────────────────────────┐
       │   │  PublicWriter   │────▶│ updates/2026-03-28.md       │
       │   │                 │     │ stats.json                  │
       │   │                 │     │ updates/index.json          │
       │   └────────┬────────┘     └─────────────────────────────┘
       │            │
       │            ▼
       │   ┌─────────────────┐
       │   │ PublicGitSync   │  ── git add + commit + push to public repo
       │   │ (2nd GitSync)   │  ── commit msg: "update: <title>"
       │   └─────────────────┘
```

---

## New Config Surface

Add to `cocapn/config.yml` (private repo):

```yaml
publisher:
  enabled: true
  # Public repo root (absolute or relative to private repo)
  publicRepo: "../alice.makerlog.ai"
  # Minimum minutes between publishes (debounce)
  cooldownMinutes: 30
  # Paths to never include in diff extraction (beyond encryptedPaths)
  excludePaths:
    - "secrets/**"
    - "cocapn/cocapn-cloud.yml"
    - "*.age"
  # Additional secret patterns (beyond built-in)
  secretPatterns:
    - "OPENAI_API_KEY"
    - "ANTHROPIC_API_KEY"
  # Summarizer agent (must be registered in agents/)
  summarizerAgent: "claude"
  # Skip LLM — just write sanitized diffs as raw updates (offline fallback)
  rawMode: false
  # Streak tracking
  streak:
    enabled: true
    timezone: "America/New_York"
```

Add to `BridgeConfig` type:

```typescript
export interface PublisherConfig {
  enabled: boolean;
  publicRepo: string;
  cooldownMinutes: number;
  excludePaths: string[];
  secretPatterns: string[];
  summarizerAgent: string;
  rawMode: boolean;
  streak: {
    enabled: boolean;
    timezone: string;
  };
}
```

---

## Interface Definitions

### DiffExtractor

```typescript
// packages/local-bridge/src/publisher/diff-extractor.ts

import type { SimpleGit } from "simple-git";

/** A single file's diff with metadata */
export interface FilePatch {
  path:        string;
  status:      "added" | "modified" | "deleted" | "renamed";
  renamedFrom: string | undefined;
  /** Raw unified diff (may contain secrets — NOT safe to publish) */
  rawDiff:     string;
  /** Number of lines added / removed */
  additions:   number;
  deletions:   number;
}

/** Everything extracted from git between last-publish and HEAD */
export interface DiffBundle {
  /** Individual file patches */
  patches:      FilePatch[];
  /** One-line commit messages in chronological order */
  messages:     string[];
  /** SHA range: fromSha..toSha */
  fromSha:      string;
  toSha:        string;
  /** Total files changed */
  filesChanged: number;
  /** Commit count in this bundle */
  commitCount:  number;
}

/**
 * Extract the diff bundle between the last published SHA and HEAD.
 *
 * @param git        - simple-git instance for the private repo
 * @param lastSha    - SHA of the last published commit (undefined = first publish)
 * @param excludes   - glob patterns to exclude from diff (secrets, age files)
 */
export async function extractDiff(
  git:      SimpleGit,
  lastSha:  string | undefined,
  excludes: string[],
): Promise<DiffBundle>;
```

### Sanitizer

```typescript
// packages/local-bridge/src/publisher/sanitizer.ts

/** What was redacted and why */
export interface Redaction {
  /** File path where the redaction occurred */
  file:   string;
  /** Line number (1-based) within the diff */
  line:   number;
  /** Category of the redacted content */
  reason: "secret" | "ip-address" | "internal-url" | "code-block" | "path" | "pattern";
  /** What was replaced (truncated for logging, never the actual secret) */
  hint:   string;
}

/** Result of sanitizing a diff bundle */
export interface SanitizedDiff {
  /**
   * Sanitized patches — code fences replaced with descriptions,
   * secrets replaced with [REDACTED], IPs replaced with [INTERNAL].
   * Safe to send to an LLM or write to a public repo.
   */
  patches:     SanitizedPatch[];
  /** Commit messages (already sanitized) */
  messages:    string[];
  /** Everything that was stripped, for audit logging */
  redactions:  Redaction[];
  /** Summary stats */
  stats: {
    filesProcessed: number;
    linesRedacted:  number;
    secretsFound:   number;
  };
}

export interface SanitizedPatch {
  path:         string;
  status:       "added" | "modified" | "deleted" | "renamed";
  /** Sanitized diff text — safe for public consumption */
  safeDiff:     string;
  /** Human-readable one-line description of what changed */
  description:  string;
  additions:    number;
  deletions:    number;
}

export interface SanitizerOptions {
  /** Additional regex patterns to treat as secrets */
  secretPatterns:  string[];
  /** Paths within the repo to exclude entirely */
  excludePaths:    string[];
  /** Replace code fences with "[code: N lines]" descriptions */
  stripCodeBlocks: boolean;
}

/**
 * Sanitize a raw DiffBundle for public consumption.
 *
 * Pure function — no side effects, no I/O.
 *
 * Default rules (always applied):
 *   - Strip values matching SECRET_KEY_RE from audit.ts (PATs, age keys, Bearer tokens)
 *   - Replace IPv4/IPv6 addresses with [INTERNAL]
 *   - Replace absolute paths (/home/..., C:\Users\...) with relative (~)
 *   - Replace internal URLs (localhost, *.internal, 10.x, 192.168.x) with [INTERNAL]
 *   - Optionally strip multi-line code fences (keep description: "Modified 47 lines of TypeScript")
 *   - Apply user-supplied secretPatterns as additional regex rules
 */
export function sanitize(
  bundle:  DiffBundle,
  options: SanitizerOptions,
): SanitizedDiff;
```

### Summarizer

```typescript
// packages/local-bridge/src/publisher/summarizer.ts

import type { SanitizedDiff } from "./sanitizer.js";
import type { Brain } from "../brain/index.js";
import type { AgentSpawner } from "../agents/spawner.js";
import type { AgentRouter } from "../agents/router.js";

/** The LLM-generated public update */
export interface PublicUpdate {
  /** Short title for the update (used as H2 heading) */
  title:       string;
  /** 2-4 sentence narrative: what was done and why */
  narrative:   string;
  /** Technologies/libraries mentioned in the changes */
  techStack:   string[];
  /** Content tags for filtering/search */
  tags:        string[];
  /** Problem → solution framing (if detectable) */
  problemSolution: {
    problem:  string;
    solution: string;
  } | undefined;
  /** How many commits this summarizes */
  commitCount: number;
  /** ISO 8601 timestamp */
  publishedAt: string;
}

export interface SummarizerDeps {
  brain:   Brain;
  spawner: AgentSpawner;
  router:  AgentRouter;
  /** Agent ID to use for summarization (e.g. "claude") */
  agentId: string;
}

/**
 * Generate a public-safe devlog update from a sanitized diff.
 *
 * Uses the Brain's context (soul, facts, active tasks) to give the LLM
 * enough personality and project context to write a coherent narrative
 * rather than a dry changelog.
 *
 * Falls back to a structured template if the LLM is unavailable.
 */
export async function summarize(
  diff: SanitizedDiff,
  deps: SummarizerDeps,
): Promise<PublicUpdate>;

/**
 * Fallback: generate a structured update without LLM.
 * Used when rawMode=true or when the summarizer agent is offline.
 */
export function summarizeRaw(diff: SanitizedDiff): PublicUpdate;
```

### PublicWriter

```typescript
// packages/local-bridge/src/publisher/writer.ts

import type { PublicUpdate } from "./summarizer.js";

export interface StreakStats {
  /** Current consecutive-day streak */
  currentStreak:   number;
  /** Longest streak ever */
  longestStreak:   number;
  /** Date (YYYY-MM-DD) of the last publish */
  lastPublishDate: string;
  /** Total number of published updates */
  totalUpdates:    number;
  /** Total commits summarized across all updates */
  totalCommits:    number;
  /** Map of YYYY-MM-DD → update count for calendar heatmap */
  calendar:        Record<string, number>;
}

export interface WriterOptions {
  /** Root of the public repo */
  publicRepoRoot: string;
  /** IANA timezone for streak day boundary */
  timezone:       string;
}

/**
 * Write a PublicUpdate to the public repo.
 *
 * Creates or appends to: updates/YYYY-MM-DD.md
 * Updates:               stats.json
 * Updates:               updates/index.json
 *
 * Returns the path of the written markdown file.
 */
export async function writeUpdate(
  update:  PublicUpdate,
  options: WriterOptions,
): Promise<string>;

/**
 * Read current streak stats from the public repo.
 * Returns default stats if stats.json doesn't exist.
 */
export function readStats(publicRepoRoot: string): StreakStats;

/**
 * Recalculate streak based on today's date and last publish date.
 */
export function updateStreak(
  stats:    StreakStats,
  today:    string,
  timezone: string,
): StreakStats;
```

### PublishPipeline (Orchestrator)

```typescript
// packages/local-bridge/src/publisher/pipeline.ts

import type { GitSync } from "../git/sync.js";
import type { Brain } from "../brain/index.js";
import type { AgentSpawner } from "../agents/spawner.js";
import type { AgentRouter } from "../agents/router.js";
import type { PublisherConfig } from "../config/types.js";
import type { PublicUpdate } from "./summarizer.js";

export type PublishEventMap = {
  /** Fired when a publish cycle starts */
  started:   [commitCount: number];
  /** Fired when sanitization completes */
  sanitized: [filesProcessed: number, secretsFound: number];
  /** Fired when LLM summary is generated */
  summarized: [update: PublicUpdate];
  /** Fired when public repo is committed */
  published: [updatePath: string, streak: number];
  /** Fired on any pipeline error (non-fatal — pipeline retries next commit) */
  error:     [err: Error, stage: "extract" | "sanitize" | "summarize" | "write" | "push"];
  /** Fired when publish is skipped (cooldown, no significant changes, etc.) */
  skipped:   [reason: string];
};

export interface PublishPipelineDeps {
  /** GitSync for the PRIVATE repo (source) */
  privateSync:  GitSync;
  /** GitSync for the PUBLIC repo (target) */
  publicSync:   GitSync;
  brain:        Brain;
  spawner:      AgentSpawner;
  router:       AgentRouter;
  config:       PublisherConfig;
}

/**
 * PublishPipeline — orchestrates the commit→sanitize→summarize→publish flow.
 *
 * Instantiated by Bridge and attached to privateSync's "committed" event.
 * Maintains internal state: last published SHA, cooldown timer, streak stats.
 */
export class PublishPipeline extends EventEmitter<PublishEventMap> {
  constructor(deps: PublishPipelineDeps);

  /**
   * Start listening for commits. Called by Bridge.start().
   * Wires into privateSync.on("committed", ...) with debounce.
   */
  start(): void;

  /**
   * Stop listening. Called by Bridge.stop().
   */
  stop(): void;

  /**
   * Force a publish cycle now, ignoring cooldown.
   * Useful for manual triggers via CLI or WebSocket command.
   */
  async publishNow(): Promise<PublicUpdate | undefined>;

  /**
   * Get current streak stats without triggering a publish.
   */
  getStats(): StreakStats;
}
```

---

## Storage Format

### `updates/YYYY-MM-DD.md` (public repo)

Each daily file can contain multiple updates (appended throughout the day):

```markdown
---
date: 2026-03-28
updates: 2
totalCommits: 7
tags: [typescript, websocket, security]
---

# March 28, 2026

## Refactored WebSocket server authentication

Separated the authentication layer from the main server module into
a composable middleware. The new auth handler supports both GitHub PAT
tokens and fleet JWT authentication, making it possible to test each
path independently.

**Tech:** TypeScript, WebSocket, JWT (HMAC-SHA256)
**Tags:** security, refactoring, testing

---

## Added path traversal protection to file operations

Implemented a multi-layer path sanitizer that defends against null-byte
injection, directory traversal (../), and absolute path injection.
The sanitizer runs before any file system operation and produces
structured errors for audit logging.

**Tech:** TypeScript, Node.js path module
**Tags:** security, file-system
**Problem:** File edit endpoint accepted user-supplied paths without
sufficient validation, allowing potential directory traversal.
**Solution:** Five-layer sanitization: null-byte check, absolute path
rejection, normalize + segment scan, canonical root resolution,
root-with-separator boundary guard.
```

### `stats.json` (public repo root)

```json
{
  "currentStreak": 14,
  "longestStreak": 31,
  "lastPublishDate": "2026-03-28",
  "totalUpdates": 47,
  "totalCommits": 312,
  "calendar": {
    "2026-03-15": 2,
    "2026-03-16": 1,
    "2026-03-17": 3,
    "2026-03-28": 2
  }
}
```

### `updates/index.json` (update index for UI)

```json
{
  "updates": [
    {
      "date": "2026-03-28",
      "file": "updates/2026-03-28.md",
      "entries": [
        {
          "title": "Refactored WebSocket server authentication",
          "tags": ["security", "refactoring", "testing"],
          "techStack": ["TypeScript", "WebSocket", "JWT"],
          "commitCount": 4,
          "publishedAt": "2026-03-28T14:23:00Z"
        },
        {
          "title": "Added path traversal protection to file operations",
          "tags": ["security", "file-system"],
          "techStack": ["TypeScript", "Node.js"],
          "commitCount": 3,
          "publishedAt": "2026-03-28T16:45:00Z"
        }
      ]
    }
  ]
}
```

### `cocapn/publisher-state.json` (private repo — internal state)

```json
{
  "lastPublishedSha": "a1b2c3d4e5f6",
  "lastPublishTime": "2026-03-28T16:45:00Z",
  "pendingCommits": 0
}
```

---

## Hook Points in Existing Code

### 1. GitSync — new `diff()` method

GitSync currently emits `"committed"` with `(message, files[])` but has no diff extraction. Add:

```typescript
// Addition to GitSync class

/**
 * Get the unified diff between two commits.
 * If fromSha is undefined, diffs against the empty tree (initial commit).
 */
async diff(fromSha: string | undefined, toSha: string = "HEAD"): Promise<string> {
  if (!fromSha) {
    // First publish: diff everything against empty tree
    return this.git.diff(["4b825dc642cb6eb9a060e54bf899d69f82623700", toSha]);
  }
  return this.git.diff([fromSha, toSha]);
}

/**
 * Get the list of commits between two SHAs.
 */
async logRange(
  fromSha: string | undefined,
  toSha: string = "HEAD"
): Promise<Array<{ hash: string; message: string; date: string }>> {
  const range = fromSha ? `${fromSha}..${toSha}` : toSha;
  const log = await this.git.log({ from: fromSha, to: toSha });
  return log.all.map((c) => ({
    hash:    c.hash,
    message: c.message,
    date:    c.date,
  }));
}
```

### 2. Bridge — instantiate PublishPipeline

```typescript
// Addition to Bridge class constructor (bridge.ts)

import { PublishPipeline } from "./publisher/pipeline.js";

// In constructor:
if (this.config.publisher?.enabled) {
  const publicSync = new GitSync(
    resolve(options.privateRepoRoot, this.config.publisher.publicRepo),
    {
      ...this.config,
      sync: { ...this.config.sync, autoCommit: false, autoPush: true },
    },
  );

  this.publisher = new PublishPipeline({
    privateSync: this.sync,
    publicSync,
    brain:   this.brain,
    spawner: this.spawner,
    router:  this.router,
    config:  this.config.publisher,
  });
}

// In start():
this.publisher?.start();

// In stop():
this.publisher?.stop();
```

### 3. BridgeServer — new WebSocket commands

```typescript
// New typed message: PUBLISH_NOW
// Triggers an immediate publish cycle (ignores cooldown)
case "PUBLISH_NOW":
  await this.publisher?.publishNow();
  break;

// New JSON-RPC methods:
// bridge/publisher/status  → { enabled, lastPublish, streak, pendingCommits }
// bridge/publisher/stats   → StreakStats
// bridge/publisher/trigger → force publish now
```

### 4. BridgeConfig — extend type

```typescript
// In config/types.ts, add to BridgeConfig:
publisher: PublisherConfig | undefined;

// And the DEFAULT_CONFIG:
publisher: undefined,  // Opt-in, not enabled by default
```

---

## Sanitizer Rules (Layered)

Applied in order. Each rule is independent — a line can be redacted by multiple rules.

| Priority | Rule | Pattern | Replacement |
|----------|------|---------|-------------|
| 1 | **Null bytes** | `\0` | Remove entire line |
| 2 | **Age keys** | `AGE-SECRET-KEY-1[a-z0-9]+` | `[REDACTED:age-key]` |
| 3 | **GitHub PATs** | `gh[pos]_[A-Za-z0-9]{36,}` | `[REDACTED:github-pat]` |
| 4 | **Bearer tokens** | `Bearer\s+\S{8,}` | `Bearer [REDACTED]` |
| 5 | **API keys** | `(KEY\|TOKEN\|SECRET\|PASSWORD\|API_KEY)=\S+` | `$1=[REDACTED]` |
| 6 | **JWT tokens** | `eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+` | `[REDACTED:jwt]` |
| 7 | **IPv4** | `\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b` (not semver) | `[INTERNAL]` |
| 8 | **IPv6** | `[0-9a-f]{1,4}(:[0-9a-f]{1,4}){7}` | `[INTERNAL]` |
| 9 | **Internal URLs** | `https?://(localhost\|127\.\|10\.\|192\.168\.\|*.internal)` | `[INTERNAL]` |
| 10 | **Absolute paths** | `/home/\w+/`, `/Users/\w+/`, `C:\\Users\\` | `~/` |
| 11 | **Code fences** | `` ```...``` `` (multi-line) | `[code: N lines of <lang>]` |
| 12 | **User patterns** | From `config.secretPatterns` | `[REDACTED:custom]` |

Rules 1-10 share logic with `maskSecrets()` in `src/security/audit.ts` — import and extend rather than duplicate.

---

## Summarizer LLM Prompt

```
You are a devlog writer for a software project. Generate a concise, public-safe
summary of recent development work.

CONTEXT (from the developer's brain):
- Soul: {soul excerpt, 500 chars}
- Active project facts: {facts}
- Active tasks: {taskCount}

CHANGES (sanitized diff):
{sanitized patches with descriptions}

COMMIT MESSAGES:
{messages}

INSTRUCTIONS:
1. Write a short title (5-10 words)
2. Write a 2-4 sentence narrative explaining what was done and why
3. Use problem→solution framing when applicable
4. List technologies mentioned
5. Generate 2-4 content tags
6. Maintain the developer's voice/personality from their soul.md
7. Do NOT invent details not in the diff
8. Do NOT include any code snippets

Return JSON: { title, narrative, techStack, tags, problemSolution? }
```

---

## File Layout

```
packages/local-bridge/src/publisher/
├── pipeline.ts         Pipeline orchestrator (EventEmitter, debounce, state)
├── diff-extractor.ts   Git diff extraction + commit log
├── sanitizer.ts        Pure function: DiffBundle → SanitizedDiff
├── summarizer.ts       LLM call via MCP + raw fallback
├── writer.ts           Write updates/YYYY-MM-DD.md + stats.json
└── types.ts            Shared types (PublicUpdate, StreakStats, etc.)

packages/local-bridge/tests/
├── publisher-sanitizer.test.ts   Unit tests for sanitizer (pure, no I/O)
├── publisher-writer.test.ts      Unit tests for writer (temp dir)
└── publisher-pipeline.test.ts    Integration tests (mock git + spawner)
```

---

## Streak Algorithm

```
function updateStreak(stats, todayStr, timezone):
  today = parseDate(todayStr, timezone)
  lastPublish = parseDate(stats.lastPublishDate, timezone)
  daysBetween = diffInDays(today, lastPublish)

  if daysBetween == 0:
    // Same day — increment update count, streak unchanged
    stats.calendar[todayStr] = (stats.calendar[todayStr] ?? 0) + 1
    return stats

  if daysBetween == 1:
    // Consecutive day — increment streak
    stats.currentStreak += 1
    stats.longestStreak = max(stats.longestStreak, stats.currentStreak)
  else:
    // Streak broken — reset
    stats.currentStreak = 1

  stats.lastPublishDate = todayStr
  stats.calendar[todayStr] = 1
  stats.totalUpdates += 1
  return stats
```

---

## Error Handling & Resilience

1. **Pipeline errors are non-fatal** — A failed publish logs to stderr and the `error` event. The pipeline remembers where it left off (lastPublishedSha) and retries on the next commit.

2. **LLM unavailable** — Falls back to `summarizeRaw()` which generates a structured template from the sanitized diff without calling the LLM. Updates still publish.

3. **Public repo push fails** — The commit is retained locally. Next publish cycle will include both old and new changes in a single update.

4. **Cooldown enforcement** — Rapid commits within `cooldownMinutes` are coalesced. The pipeline debounces for 10 seconds after the last commit, then checks cooldown. If still in cooldown, it increments `pendingCommits` and waits.

5. **State persistence** — `publisher-state.json` is committed to the private repo so the last-published SHA survives bridge restarts.

---

## Decisions & Tradeoffs

| Decision | Reasoning |
|----------|-----------|
| **Second GitSync for public repo** | Private sync handles encrypted paths, auto-push policy, memory timers. Public sync needs different autoPush (always true) and no encryption. Sharing one GitSync would conflate concerns. |
| **Sanitizer as pure function** | Testable without git, mocks, or I/O. The same sanitizer can be used in a CLI tool, a Worker, or tests. |
| **Code fences → descriptions** | Code snippets in a devlog are both a security risk (may contain logic that reveals internal structure) and noisy for readers. A description like "Modified 47 lines of TypeScript in the auth module" is more informative for a public audience. |
| **Daily rollup files** | One file per day rather than one per commit prevents file explosion. Multiple updates per day are appended with `---` separators. |
| **Calendar heatmap in stats.json** | GitHub-style contribution graphs are motivating. The `calendar` field enables this in the UI with zero additional storage. |
| **Debounce 10s + cooldown 30min** | 10s debounce coalesces rapid saves. 30min cooldown prevents noise from frequent small edits while still capturing meaningful work sessions. |
| **No new module type** | After analysis, `"publisher"` doesn't fit the module pattern (modules are git submodules installed by URL). The publisher is a core bridge feature configured via `config.yml`, not an installable module. This avoids complicating the module type system for something that every instance should have built-in access to. |
