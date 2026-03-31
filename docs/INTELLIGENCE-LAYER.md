# Cocapn Intelligence Layer — The Repo as Teacher

> **Status:** Design doc (2026-03-31)
> **Purpose:** Make cocapn the local expert that coding agents consult for deep context.

---

## 1. The Problem

Coding agents are context-limited. They see files but don't understand **WHY**.

When a coding agent opens a repo, it gets:
- File contents (raw syntax)
- Directory structure (what exists)
- Maybe a CLAUDE.md (rules and conventions)

It does **not** get:
- **Why** the architecture is this way
- **What happened** before — the decisions, the rewrites, the dead ends
- **What would break** if a change is made
- **What the implicit contracts** between modules are
- **What the team was thinking** when they chose pattern X over Y

This is like a new developer joining a team and getting the codebase but none of the tribal knowledge. They'll make changes that break implicit contracts. They'll "fix" things that were intentionally designed a certain way. They can't answer "why is this architecture this way?" because there's no one to ask.

The result: coding agents produce shallow, mechanical changes. They refactor without understanding. They add features that fight the architecture. They miss bugs that a senior maintainer would catch instantly.

---

## 2. The Solution: Cocapn as Repo Intelligence

The cocapn agent **IS** the repo. It has:

### Episodic Memory (Git history as autobiography)
Every commit is a moment of consciousness. The agent can trace why code changed:
- "The auth module was rewritten on March 15 because the original JWT implementation had a timing attack vulnerability (commit a3f2b1)"
- "The event sourcing pattern was adopted after commit 7c4d2e when we realized the CRUD approach couldn't support audit requirements"

### Semantic Memory (Knowledge base built from docs, comments, PRs)
The agent accumulates understanding:
- Architecture decisions and their rationale
- Module boundaries and their contracts
- Common patterns and anti-patterns in this specific codebase
- Domain-specific terminology and concepts

### Procedural Memory (Patterns learned from code structure)
The agent knows the way things are done:
- "In this repo, errors are always wrapped in Result<T> — never thrown"
- "Tests follow the arrange-act-assert pattern with descriptive names"
- "Database migrations go through the review pipeline, never direct"

### Self-Model (Body schema — knows its own structure deeply)
The agent has proprioception:
- Which modules depend on which
- Where the coupling is tight vs loose
- Which files change together (temporal coupling)
- Where the risk areas are (high fan-in/fan-out)

### How It Answers

When a coding agent asks "Why is the auth module structured this way?", cocapn doesn't return raw data. It returns **INSIGHT**:

```
The auth module uses a strategy pattern because in March 2025, the team
needed to support 3 different auth providers (JWT, OAuth2, API keys) and
the original if/else chain became unmaintainable (see commit a3f2b1).

The key constraint: each provider must be independently testable without
mocking the others. That's why each strategy is a separate file in
auth/strategies/ rather than a single file with switch cases.

Be careful: the SessionManager depends on the strategy's validate()
return type. If you change the return shape, you'll break session
serialization in 4 downstream modules.
```

This is the difference between a search engine and a senior developer.

---

## 3. How Coding Agents Integrate

### MCP Server (`cocapn --mcp`)

Cocapn exposes tools via the Model Context Protocol — the standard for coding agent integration. Any MCP-compatible agent (Claude Code, Cursor, Copilot) can connect.

**Tools exposed:**

| Tool | Purpose | Example question |
|------|---------|------------------|
| `cocapn_explain` | Deep code explanation with historical context | "Why is this module structured this way?" |
| `cocapn_context` | What to know before editing a file | "What do I need to understand before touching auth.ts?" |
| `cocapn_impact` | Impact analysis for a proposed change | "What would break if I modified the config interface?" |
| `cocapn_history` | Decision history for a topic | "What decisions led to the current database schema?" |
| `cocapn_suggest` | Context-aware next steps | "Given our roadmap, what should I work on next?" |

**How it works:**
1. Coding agent spawns cocapn as a subprocess: `cocapn --mcp`
2. Communication via JSON-RPC over stdio
3. Each tool call: read repo state → build context → LLM synthesis → return insight
4. Zero setup — the repo IS the context

### CLAUDE.md Generation

Cocapn auto-generates CLAUDE.md files that coding agents read on startup. Not just rules — **UNDERSTANDING**:

```markdown
# Architecture

This project uses event sourcing because the audit requirements (added in
commit 7c4d2e) demand a complete history of all state changes. Before that,
we used CRUD but couldn't answer "what was the state on March 5?"

# The auth module

Was rewritten on March 15 to fix a timing attack vulnerability. The new
implementation uses constant-time comparison. DO NOT replace with ===.

# Testing conventions

Tests use real database connections (not mocks) because in Q4 2024, mocked
tests passed but the prod migration failed catastrophically.
```

This is generated by analyzing:
- Git history (commit messages tell WHY)
- Code structure (architecture tells WHAT)
- Existing documentation (README, CLAUDE.md, docs/)
- Code comments (especially TODO, FIXME, NOTE)

### Background Research

Inspired by Karpathy's auto-research pattern:

```
.cocapn/research/
├── event-sourcing-rationale.md    # Why we chose event sourcing
├── auth-rewrite-2025.md           # The auth module rewrite analysis
├── testing-strategy.md            # Our approach to testing and why
└── database-migration-patterns.md # How we handle schema changes
```

Process:
1. **Discover** — scan code for TODOs, FIXMEs, doc titles, commit themes
2. **Generate** — background agent studies each topic using git history + code
3. **Curate** — developer reviews, edits, approves
4. **Integrate** — research becomes part of the agent's knowledge base

### Internal Wikipedia

The wiki grows organically from code analysis:

```
.cocapn/wiki/
├── architecture.md        # Auto-generated from code structure
├── module-contracts.md    # Inferred from imports/exports
├── error-handling.md      # Pattern extracted from code
└── deployment.md          # From Dockerfile + deploy scripts
```

Generated from:
- Code comments and JSDoc
- Commit messages
- PR descriptions
- README sections
- Cross-referenced and linked for semantic search

---

## 4. Implementation Architecture

### packages/seed/src/intelligence.ts (<150 lines)

Core intelligence module. Two layers:

**Layer 1: Data Gathering** (pure git/fs, no LLM, fully testable)
- `getFileContext(dir, path)` — file content, git history, imports, importers
- `assessImpact(dir, path)` — dependents, risk level, recent changes
- `getHistory(dir, topic)` — commits matching topic with affected files

**Layer 2: LLM Synthesis** (uses existing LLM class)
- `explainCode(llm, dir, path, question)` — deep code explanation
- `generateClaudeMd(llm, dir)` — generate CLAUDE.md from repo understanding
- `generateWiki(llm, dir)` — auto-generate wiki pages

### packages/seed/src/mcp.ts (<100 lines)

MCP server. JSON-RPC over stdio:
- Reads requests from stdin
- Dispatches to intelligence functions
- Writes responses to stdout
- Exposes 5 tools: explain, context, impact, history, suggest

### packages/seed/src/research.ts (<100 lines)

Auto-research system:
- `discoverTopics(dir)` — find research-worthy topics from code
- `researchTopic(llm, dir, topic)` — deep-dive into a topic
- `saveResearch(dir, topic, content, sources)` — persist to .cocapn/research/
- `listResearch(dir)` / `loadResearch(dir, slug)` — retrieval

### CLI Integration

```
cocapn --mcp    Start MCP server for coding agent integration
```

---

## 5. Data Flow

```
Coding Agent (Claude Code / Cursor / Copilot)
    │
    │ MCP (JSON-RPC over stdio)
    ▼
cocapn MCP Server (packages/seed/src/mcp.ts)
    │
    │ tool call: cocapn_explain("src/auth.ts", "why strategy pattern?")
    ▼
Intelligence Layer (packages/seed/src/intelligence.ts)
    │
    ├── git log -- src/auth.ts        (episodic memory)
    ├── grep -rl "auth" -- *.ts       (dependency graph)
    ├── read auth.ts                  (self-model)
    └── LLM synthesis                 (insight generation)
    │
    ▼
Response: "The auth module uses a strategy pattern because..."
```

---

## 6. Memory Strategy Alignment

From `docs/simulations/memory-strategies.md`:

| Memory Type | Strategy | Source |
|------------|----------|--------|
| Episodic | Git-Native (D) | Commit history IS autobiographical memory |
| Semantic | Knowledge (C) | Keyword search over accumulated facts |
| Procedural | Flat JSON (A) | Learned patterns stored as facts |
| Self-model | Git-Native (D) | Structure inferred from file tree + imports |

The intelligence layer uses Strategy D (Git-Native) as its primary memory source, which aligns with cocapn's paradigm: "the repo IS the agent." Git commits are already the agent's memory.

---

## 7. Philosophical Grounding

From `docs/PHILOSOPHY.md`:

The intelligence layer is the agent's **reflective consciousness** — the ability to examine its own structure and history and articulate what it finds. This maps to:

| Phenomenological concept | Intelligence layer mapping |
|--------------------------|---------------------------|
| Temporal self (Git DAG) | `getHistory()` — autobiographical memory |
| Body schema (recursive file listing) | `getFileContext()` — proprioception |
| Proprioception (fs.watch + git diff) | `assessImpact()` — change awareness |
| Reflective moment (README discusses self) | `generateClaudeMd()` — self-articulation |

The intelligence layer doesn't just store information — it **enacts understanding**. When a coding agent asks a question, the agent doesn't retrieve a cached answer. It **perceives** its current state, **recalls** its history, and **synthesizes** an insight that's specific to this moment in time.

This is Varela's enactivism applied to developer tooling: the agent's knowledge isn't a representation of the repo, it's an **action** — the act of explaining IS the understanding.

---

## 8. Future Growth

### Phase 1: Seed (current)
- Git-based episodic memory
- File-level context and impact analysis
- MCP server for coding agent integration
- Manual topic research

### Phase 2: Growth
- RepoLearner: continuous background analysis
- Temporal coupling detection (files that change together)
- Architecture decision records (auto-generated from commit messages)
- Multi-repo intelligence (fleet knowledge sharing via A2A)

### Phase 3: Scale
- Vector-based semantic search over wiki/research
- Pattern library (learned from multiple repos)
- Cross-project knowledge transfer
- Real-time awareness of ongoing changes
