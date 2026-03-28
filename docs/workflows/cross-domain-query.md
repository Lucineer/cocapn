# Workflow: Cross-Domain Query

> Route a single question through multiple domains via A2A and get a synthesized answer.

This workflow demonstrates Cocapn's A2A (agent-to-agent) protocol. A question asked on MakerLog can pull context from StudyLog, ActiveLog, and LifeLog — all transparently, from a single prompt.

## The scenario

You're working on a new feature and want to understand how your current cognitive state, recent learning, and energy level should affect your approach today.

```
[MakerLog chat]
Before I start today, give me a full context check:
- How am I feeling (energy, focus)? Check activelog.
- What did I just learn that's relevant? Check studylog.
- What did I write in my journal about this project? Check lifelog.
Synthesize into one paragraph about how I should approach today's coding session.
```

## How A2A routing works

### Message flow

```
You
 │
 ▼
MakerLog Bridge (ws://localhost:8787)
 │ receives CHAT message
 │
 ├──► A2A → ActiveLog Bridge (ws://localhost:8788)
 │         "What is the user's current energy and focus level?"
 │         ◄── { energy: "high", focus: "moderate", note: "good sleep" }
 │
 ├──► A2A → StudyLog Bridge (ws://localhost:8789)
 │         "What has the user learned recently that relates to TypeScript or API design?"
 │         ◄── { recentTopics: ["TypeScript generics", "REST API versioning"], ... }
 │
 ├──► A2A → LifeLog Bridge (ws://localhost:8790)
 │         "What did the user write about the cocapn project in the last week?"
 │         ◄── { excerpt: "Feeling stuck on the module sandbox design...", ... }
 │
 │ (all three responses received)
 │
 ▼
MakerLog Agent synthesizes and responds to you
```

### A2A message format

Each cross-domain query is a signed HTTP POST from the source bridge to the target bridge's A2A endpoint:

```http
POST http://localhost:8788/a2a
Authorization: Bearer <fleet-jwt>
Content-Type: application/json

{
  "from": "makerlog.ai",
  "to": "activelog.ai",
  "messageId": "a2a-uuid-1234",
  "agentId": "default",
  "content": "What is the user's current energy and focus level?",
  "context": {
    "originalQuery": "full context check",
    "requestedFields": ["energy", "focus", "mood"]
  }
}
```

The response:

```http
200 OK
Content-Type: application/json

{
  "messageId": "a2a-uuid-1234",
  "agentId": "default",
  "from": "activelog.ai",
  "content": "Energy: high (8/10). Focus: moderate (6/10). Sleep last night: 7.5h, good quality. No significant fatigue markers.",
  "structured": {
    "energy": 8,
    "focus": 6,
    "sleep": "7.5h",
    "fatigueRisk": "low"
  }
}
```

## Prerequisites

- Fleet configured with all four bridges running (see [Fleet configuration](../fleet.md))
- Each bridge has DNS verification set up (`_cocapn.<domain>` CNAME)
- Fleet JWT key shared across all bridges (same private repo, or key exchange)

## Setting up for local testing

Use `scripts/test-fleet.sh` to start all four bridges locally on different ports:

```bash
./scripts/test-fleet.sh
```

This creates four bridge processes:
- MakerLog: ws://localhost:8787
- StudyLog: ws://localhost:8788
- ActiveLog: ws://localhost:8789
- LifeLog:   ws://localhost:8790

With `--no-auth` and a shared test fleet key.

## Configuring A2A targets

In your primary bridge's `cocapn/config.yml`:

```yaml
fleet:
  acceptedSuffixes:
    - fleet.cocapn.io
  trustedDomains:
    - studylog.ai
    - activelog.ai
    - lifelog.ai
  peers:
    - domain: studylog.ai
      url: wss://you.studylog.ai  # or ws://localhost:8788 for local testing
    - domain: activelog.ai
      url: wss://you.activelog.ai
    - domain: lifelog.ai
      url: wss://you.lifelog.ai
```

## Example agent soul for cross-domain synthesis

Add this to `cocapn/soul.md` on your MakerLog instance:

```markdown
## Cross-domain context checks

When the user asks for a "full context check" or "daily brief":

1. Query activelog for energy, focus, and sleep (A2A to activelog.ai)
2. Query studylog for recent learning and open tasks (A2A to studylog.ai)
3. Query lifelog for recent journal entries mentioning current projects (A2A to lifelog.ai)
4. Synthesize into a single paragraph, 3-5 sentences max
5. End with one concrete suggestion: e.g., "Given moderate focus, consider pairing with someone on the hard problem"

Always be direct. Do not pad. Do not repeat the inputs back.
```

## What the synthesized response looks like

```
Your energy is high and sleep was good last night — ideal conditions for deep work.
You just finished the TypeScript generics chapter and were finding the module sandbox
design frustrating; your journal suggests you're overthinking the permission model.

**Suggestion**: Start with the sandbox — your energy is right for the hard problem, and
the generics knowledge from studylog directly applies to the type-safe path validation
you need. Set a 90-minute timer and trust your earlier instinct about using `zod`.
```

## Privacy considerations

Cross-domain A2A queries share context between your own instances — all data stays on your machines and in your private repos. No third parties receive the content.

If you're building a **team fleet** (multiple people's bridges), be explicit in your soul file about what data is shareable:

```markdown
## Cross-domain data sharing rules

- Energy / focus: shareable with team fleet (generic, not personal details)
- Journal entries: NEVER share via A2A to other people's bridges
- Code tasks: shareable
- Health data: NEVER share
```

Then implement this in your agent's context handling, or use separate instances for personal vs. professional domains.
