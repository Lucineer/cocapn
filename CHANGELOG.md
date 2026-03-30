# Changelog

All notable changes to cocapn will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-03-30

### Breaking Changes
- **Paradigm shift**: The repo IS the agent (not 'an agent runtime')
- **Two-repo model**: Private brain repo + public face repo
- **Removed**: tree-search, graph, assembly, testing, browser-automation, landing, marketplace packages (~30K lines)

### New Features
- **RepoLearner**: Git history analysis for repo understanding
- **Publishing Layer**: Public/private boundary enforcement, PII sanitizer, mode switcher
- **Brain Mode-Aware Access**: Public mode filters private.* facts
- **soul.md Compiler**: YAML frontmatter parsing, section extraction, public/private system prompts
- **Soul Templates**: 5 ready-to-use templates (fishing-buddy, dungeon-master, deckboss, developer-assistant, student-tutor)
- **A2A I/O Layer**: Agent-to-agent communication with HTTP and local transport
- **Local LLM Provider**: Ollama + llama.cpp for offline/air-gapped deployment
- **TwoRepoSync**: Manages private brain + public face repos simultaneously
- **Docker Support**: Multi-stage Dockerfile, docker-compose, air-gapped deployment
- **Onboarding Wizard**: Interactive `cocapn setup` CLI command
- **Community Knowledge Pipeline**: Git-based model improvement (ingest, validate, export)
- **Status Dashboard API**: Real-time agent health, memory, fleet metrics

### Improvements
- Brain lock path now per-repo (not global homedir)
- Brain test isolation fixed (conversation-memory, knowledge-pack pass in batch)
- create-cocapn tests converted from node:test to vitest
- README rewritten for repo-first paradigm
- CLAUDE.md rewritten for new architecture

### Infrastructure
- 134 commits, 280 source files, 119 test files, ~98K lines TypeScript
- 832+ tests pass across 14+ test suites

## [0.1.0] - 2026-03-29

### Added
- **Core runtime** — Bridge server with WebSocket, self-assembly, repo detection
- **Persistent memory** — Git-backed Brain with facts, wiki, procedures, conversation memory
- **LLM providers** — DeepSeek, OpenAI, Anthropic with streaming support
- **Plugin system** — Manifest format, loader, registry, sandbox with permission enforcement
- **Skill cartridges** — Hot/cold loading, LRU eviction, decision tree, tolerance declarations
- **Fleet protocol** — Multi-agent coordination via A2A, task splitting, leader election
- **Tree search** — Best-first exploration, Claude Code executor, approach generation
- **Hybrid search** — Keyword + vector (sqlite-vec), graceful fallback
- **Knowledge graph** — AST-parsed dependency analysis, impact radius, repo map
- **Adaptive context** — 4 budget levels, task complexity classifier
- **Conversation routing** — State tracking, module suggestion, intent parsing
- **Module handoffs** — Inter-module delegation with depth limiting
- **Autonomous testing** — Skeleton generation, post-edit hook
- **Self-editing memory** — Confidence decay, pruning, PII safety
- **Knowledge packs** — Cross-instance memory export/import
- **Browser automation** — Headless Playwright, screenshots, click/type
- **Streaming diffs** — Real-time patch parsing and application
- **Token efficiency** — Per-task/module/skill tracking, waste detection
- **Cloud bridge** — PII engine, SSE streaming, 16 routing rules
- **Cloudflare Workers** — Live deployment with AdmiralDO (SQLite)
- **Template system** — 7 built-in templates (bare, cloud-worker, dmlog, studylog, makerlog, playerlog, businesslog)
- **CLI** — `cocapn init`, `start`, `status`, `skills`, `templates`, `tree`, `graph`, `tokens`, `health`, `personality`, `plugin`
- **create-cocapn** — Scaffold CLI for new instances
- **Settings API** — Persistence, environment overrides, validation
- **Webhook system** — GitHub/Slack/Discord handlers, HMAC signatures
- **Analytics** — Event tracking, metrics, JSON/CSV/Markdown export
- **MCP server** — 6 tools, 5 resources, 2025-06-18 spec compliance
- **MCP client** — Connect to external MCP servers
- **Agent dashboard UI** — React + Tailwind, token chart, skill panel, graph explorer
- **Minimal chat UI** — Single HTML file, WebSocket, dark theme, mobile
- **Memory browser** — Facts, wiki, soul tabs in chat UI
- **Landing page** — Dark theme, hero, features, responsive
- **Plugin marketplace** — npm search, card grid
- **Documentation site** — 8 pages, dark theme
- **GitHub Actions** — CI workflow, cocapn review action
- **Opt-in telemetry** — Privacy-first, no PII, DO_NOT_TRACK
- **Agent personality** — 5 built-in presets, CLI, system prompt builder
- **Security** — JWT auth, PBKDF2, CSP, rate limiting, audit logging, SECURITY.md
- **Multi-tenant support** — Tenant registry, scoped brains, usage metering
- **Request queue** — LLM backpressure, rate limiting, tenant-aware concurrency

### Security
- Security audit completed (GLM-5.1 simulated researcher)
- 4 Critical + 5 High + 4 Medium findings identified
- All Critical and High issues fixed
- SECURITY.md with vulnerability reporting policy
- Plugin sandbox permission enforcement at runtime
- FLEET_JWT_SECRET fails loudly (no default fallback)
- Webhook receiver binds to localhost
- PAT cleared from .git/config after clone

### Documentation
- 13 design documents in docs/designs/
- 4 user testing cycle reports
- 1 security audit report
- Strategic plan (docs/STRATEGIC-PLAN.md)
- Master roadmap (docs/ROADMAP.md)
- CONTRIBUTING.md, SECURITY.md
- 104 test files, ~1500+ tests

[0.2.0]: https://github.com/CedarBeach2019/cocapn/releases/tag/v0.2.0
[0.1.0]: https://github.com/CedarBeach2019/cocapn/releases/tag/v0.1.0
