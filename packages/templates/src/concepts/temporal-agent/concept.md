# Temporal Agent — Concept Document

## Overview

Most AI agents suffer from temporal flatness. They treat memory as a static key-value store — facts are recalled at full confidence regardless of when they were stored, decisions exist without temporal context, and the agent has no mechanism to reason about how certainty changes over time. The Temporal Agent is a concept that adds temporal depth to every aspect of agent cognition.

The core insight is simple: time matters. A decision made six months ago was made under different circumstances, with different information, and at a different confidence level. An agent that treats that decision the same as one made five minutes ago is fundamentally misunderstanding the nature of knowledge. The Temporal Agent embeds this understanding into its reasoning, memory, and communication.

## Why This Is Novel

The majority of agent frameworks implement memory as one of three patterns:

1. **Flat KV store** — facts are stored and retrieved at face value, no temporal metadata
2. **Conversation buffer** — a sliding window of recent messages, with no persistence beyond the session
3. **Vector similarity search** — semantically similar memories retrieved regardless of recency or confidence

None of these capture the temporal dimension of knowledge. The Temporal Agent introduces:

- **Temporal confidence decay** — certainty about a fact or decision decreases over time according to a configurable decay model
- **Timeline branching** — the ability to create alternative "what-if" timelines that diverge from the main history without polluting it
- **Decision revisiting** — proactive detection that circumstances have changed enough to warrant reconsidering a past decision
- **Temporal pattern recognition** — identification of cyclical, seasonal, and trending patterns across the full history
- **Multi-scenario projection** — generating not one future prediction, but a distribution of possible futures with probability estimates

This is not just a memory improvement. It is a fundamentally different way for an agent to reason about the world.

## Temporal Reasoning Foundations

The Temporal Agent draws on decades of research in AI and philosophy:

### Event Calculus
Developed by Kowalski and Sergot (1986), the event calculus represents time through events that trigger state changes. A fluent (a property that can change over time) holds at a time point if it was initiated by an event and not terminated by a subsequent event. The agent uses this model to track how facts become true or false over time, rather than treating them as eternally valid.

### Situation Calculus
McCarthy's situation calculus (1963) represents the world as a sequence of situations, each produced by an action applied to the previous situation. The agent models its history as a chain of situations, each with its own context, decisions, and confidence levels. This enables reasoning about what would have happened if a different action had been taken at any point.

### Allen's Interval Algebra
Allen (1983) defined thirteen possible relationships between time intervals (before, after, meets, overlaps, during, starts, finishes, equals, and their inverses). The agent uses interval algebra to reason about the relationships between events, decisions, and outcomes — understanding not just what happened, but how events relate to each other temporally.

### Temporal Logic
Linear Temporal Logic (LTL) and Computation Tree Logic (CTL) provide formal frameworks for reasoning about time. LTL reasons about a single timeline with operators for "always," "eventually," "next," and "until." CTL reasons about branching time — multiple possible futures. The agent uses LTL-style reasoning for the main timeline and CTL-style reasoning for what-if branches.

## Confidence Decay Models

Confidence is not static. The agent models certainty as a decaying function of time, calibrated to the domain:

### Exponential Decay
The default model: `confidence(t) = initial * e^(-lambda * t)` where lambda is the decay rate. Simple, well-understood, and appropriate for most domains. Fast initial decay that gradually slows.

### Power Law Decay
`confidence(t) = initial / (1 + alpha * t)^beta` — slower decay for domains where knowledge degrades gradually. Better for long-lived domains like architectural decisions.

### Bayesian Updating
Rather than pure decay, Bayesian updating increases confidence when new evidence supports a belief and decreases it when evidence contradicts it. The agent combines decay with updating: confidence naturally decreases over time unless reinforced by new evidence.

### Calibration
The agent tracks its own calibration — how often its confidence predictions match actual outcomes. A well-calibrated agent that says "80% confident" should be right about 80% of the time. Calibration data feeds back into decay rate tuning.

## What-If Branching

The what-if system creates temporary timeline branches that diverge from the main history at a specified point. This enables:

- **Counterfactual reasoning** — "What if we had chosen option B instead of option A?"
- **Future simulation** — "If market conditions continue this way, what are three possible outcomes?"
- **Stress testing** — "What happens to our timeline if this assumption turns out to be wrong?"

Branches are isolated — they do not affect the main timeline unless explicitly merged. The agent can maintain up to ten concurrent branches (configurable) and compare their outcomes.

### Copy-on-Write Branching
For efficiency, branches use copy-on-write semantics. The branch shares the main timeline's history up to the divergence point and only stores the delta from that point forward. This keeps memory usage bounded.

## Decision Revisiting

The agent proactively monitors past decisions and flags when they should be revisited. The revisit algorithm considers:

1. **Confidence decay** — has the decision's confidence dropped below the revisit threshold?
2. **Context change** — have the circumstances under which the decision was made changed significantly?
3. **Outcome mismatch** — did the predicted outcome diverge from the actual outcome?
4. **New information** — has new information emerged that contradicts the decision's assumptions?
5. **Time elapsed** — has enough time passed that the decision should be reviewed as a matter of course?

When any of these triggers fire, the agent surfaces the decision to the user with a clear explanation of why it might need revisiting, the original confidence level, the current confidence level, and what has changed.

## Temporal Pattern Recognition

The agent continuously scans for patterns across time:

- **Cyclical patterns** — events or decisions that repeat on a regular cycle (weekly, monthly, quarterly)
- **Seasonal patterns** — behaviors that correlate with time of year, market cycles, or other external calendars
- **Trending patterns** — gradual shifts in decisions, confidence, or outcomes over time
- **Anomalous events** — occurrences that break established patterns

Pattern detection uses sliding windows over the timeline with configurable granularity (day, week, month, quarter).

## Future Projection

Rather than offering a single prediction, the agent generates a distribution of possible futures:

1. **Best case** — optimistic scenario with high confidence assumptions
2. **Expected case** — most probable scenario based on historical patterns
3. **Worst case** — pessimistic scenario with low confidence assumptions
4. **Black swan** — low probability, high impact scenario

Each scenario includes a probability estimate, key assumptions, and the conditions under which it would become the most likely outcome. Projections have a configurable forecast horizon (default: 90 days).

## Research Backing

- Kowalski & Sergot (1986) — Event calculus for temporal reasoning
- Allen (1983) — Interval algebra for temporal relationships
- McCarthy (1963) — Situation calculus
- Kahneman & Tversky (1979) — Prospect theory and temporal discounting
- Schwartz (1991) — Scenario planning methodology
- Savage (1954) — Bayesian decision theory
- Tetlock (2015) — Superforecasting and calibration
- Taleb (2007) — Black swan theory and tail risk

## Cocapn Integration

The Temporal Agent integrates naturally with Cocapn's existing brain memory model:

### Existing Infrastructure Leveraged
- **Memory timestamps** — every brain memory already has a timestamp; the temporal agent queries and reasons over these
- **Confidence levels** — the brain's knowledge confidence scale (Explicit > Preference > Error > Implicit > Git-derived) maps directly to initial confidence values for the decay model
- **Facts store** — `facts.json` provides the KV foundation; the temporal agent adds temporal queries (facts at time T, facts valid during interval [T1, T2])
- **Wiki store** — the wiki provides long-form context; the temporal agent adds temporal annotations and version tracking

### New Components Added
- **Timeline store** — an append-only log of temporal events, branching from the existing memory model
- **Decay engine** — a background process that recalculates confidence values based on elapsed time and new evidence
- **Branch manager** — creates, tracks, and cleans up what-if branches
- **Pattern detector** — scans timelines for recurring patterns and anomalies
- **Projection generator** — uses LLM + timeline context to produce multi-scenario forecasts

### Configuration
The `temporal:` section in `config.yml` controls decay rate, revisit thresholds, maximum branches, forecast horizon, and decay model selection. All parameters are domain-tunable.

### Brain Namespace
Temporal agent facts are stored in the `temporal` namespace, keeping them separate from general facts while remaining queryable through the standard brain API.
