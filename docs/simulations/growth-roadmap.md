# Cocapn Growth Roadmap — Seed to Platform Simulation

**Date:** 2026-03-31
**Simulated:** 365 days of agent growth

## Growth Phases

| Phase | Days | Users | Conversations/Day | Features | Triggers |
|-------|------|-------|-------------------|----------|----------|
| Seed | 1-7 | 1 | 5 | 5 | 0 pain points |
| Sprout | 8-30 | 3 | 15 | 10 | 2 pain points |
| Growth | 31-90 | 15 | 75 | 18 | 7 pain points |
| Expansion | 91-180 | 47 | 235 | 20 | 8 pain points |
| Maturity | 181-365 | 163 | 815 | 20 | 8 pain points |

## Feature Activation Timeline

Features activate when their trigger condition is met:

| Day | Feature | Category | Complexity | Trigger | Lines Added |
|-----|---------|----------|------------|---------|-------------|
| 1 | Basic memory (facts.json) | memory | low | First conversation | +80 (1 files) |
| 1 | Soul.md personality | platform | low | First run | +35 (1 files) |
| 1 | Git awareness | platform | low | First `whoami` command | +180 (1 files) |
| 1 | Web server | deployment | medium | User wants browser access | +150 (2 files) |
| 7 | Memory search | memory | medium | Can't find facts from last week | +60 (0 files) |
| 12 | Template installer | platform | medium | Second user wants to set up their own instance | +100 (2 files) |
| 13 | Memory decay | memory | medium | Old facts polluting context | +45 (0 files) |
| 14 | Wiki (structured docs) | memory | medium | User starts asking 'how does X work?' repeatedly | +120 (1 files) |
| 30 | Plugin system | plugins | high | Third-party wants to extend the agent | +250 (4 files) |
| 30 | Docker deployment | deployment | low | Non-technical user wants to run the agent | +40 (2 files) |
| 45 | Webhook handlers | plugins | medium | Agent needs to react to GitHub/Slack events | +180 (3 files) |
| 45 | Relationships graph | memory | medium | Agent interacts with multiple people/services | +90 (1 files) |
| 45 | Multi-tenant support | platform | high | Hosted deployment serving multiple users | +350 (6 files) |
| 45 | Age encryption | platform | medium | Agent stores sensitive data (API keys, tokens) | +80 (2 files) |
| 60 | Fleet coordination | a2a | high | User runs multiple agents for different repos | +400 (5 files) |
| 60 | Scheduler (cron) | platform | medium | Agent needs to do things on a schedule | +150 (2 files) |
| 90 | A2A protocol | a2a | high | Agents need to talk to each other | +300 (3 files) |
| 90 | Cloudflare Workers | deployment | high | Users want always-on agent without running a server | +200 (4 files) |
| 120 | RepoLearner | platform | high | Agent can't explain why code exists | +500 (8 files) |
| 120 | Semantic memory (embeddings) | memory | high | Recall accuracy drops below 80% | +200 (3 files) |

## Key Questions Answered

### When does the agent need plugins?

**Answer: Day 30** (when 3+ external feature requests accumulate)
- Before plugins: every new feature is hardcoded into the core
- After plugins: third parties can extend without touching core
- The seed does NOT need plugins — it needs a clean plugin API to grow into

### When does the agent need A2A?

**Answer: Day 60 for fleet, Day 90 for A2A**
- A2A is needed when a single user runs 3+ agents simultaneously
- The trigger is agent proliferation, not user count
- The seed should NOT include A2A — but should be architected to accept it

### When does the agent need the full cocapn platform?

**Answer: Day 90-180** (when multi-tenant + cloud deployment are needed)
- The seed is self-sufficient for 1-3 users
- Platform features (multi-tenant, Workers, fleet) kick in at scale
- Migration path: seed → local bridge → cloud bridge → fleet

## Growth Metrics Over Time

| Day | Users | Conversations/Day | Total Facts | Files | Features Active |
|-----|-------|-------------------|-------------|-------|-----------------|
| 1 | 1 | 5 | 15 | 45 | 4/20 |
| 7 | 1 | 5 | 105 | 58 | 5/20 |
| 14 | 2 | 10 | 255 | 92 | 8/20 |
| 30 | 5 | 25 | 1140 | 120 | 10/20 |
| 60 | 15 | 75 | 4875 | 195 | 16/20 |
| 90 | 25 | 125 | 11310 | 230 | 18/20 |
| 180 | 70 | 350 | 46815 | 295 | 20/20 |
| 270 | 160 | 800 | 106620 | 340 | 20/20 |
| 365 | 255 | 1275 | 196110 | 387 | 20/20 |

## Complexity Budget

**Total features:** 20
**Total code added:** 3510 lines across 51 new files

| Category | Features | Lines | Percentage |
|----------|----------|-------|------------|
| Memory | 6 | 595 | 17% |
| Plugins | 2 | 430 | 12% |
| A2A | 2 | 700 | 20% |
| Platform | 7 | 1395 | 40% |
| Deployment | 3 | 390 | 11% |

## Recommendations for the Seed

### Include at seed (Day 1)
These features should be in the initial seed package:
- **Basic memory (facts.json)** (+80 lines)
- **Soul.md personality** (+35 lines)
- **Git awareness** (+180 lines)
- **Web server** (+150 lines)
- **Memory search** (+60 lines)

### Design for, don't build yet (Day 7-30)
These features need interface slots but not implementations:
- **Memory decay** — triggered at Day 13
- **Wiki (structured docs)** — triggered at Day 14
- **Template installer** — triggered at Day 12
- **Plugin system** — triggered at Day 30
- **Docker deployment** — triggered at Day 30

### Plan for (Day 30+)
These features are future platform scope:
- **Webhook handlers** — triggered at Day 45
- **Relationships graph** — triggered at Day 45
- **Fleet coordination** — triggered at Day 60
- **A2A protocol** — triggered at Day 90
- **Multi-tenant support** — triggered at Day 45
- **Cloudflare Workers** — triggered at Day 90
- **RepoLearner** — triggered at Day 120
- **Semantic memory (embeddings)** — triggered at Day 120
- **Scheduler (cron)** — triggered at Day 60
- **Age encryption** — triggered at Day 45
