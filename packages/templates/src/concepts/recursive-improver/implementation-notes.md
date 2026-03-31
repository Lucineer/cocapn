# Implementation Notes — Recursive Improver

## Architecture Overview

The Recursive Improver consists of four core components that work together to create a self-improvement loop.

### Component 1: Self-Review Engine

The self-review engine is responsible for sampling past responses and evaluating them against quality criteria. It runs on a configurable interval (default: daily) and follows this process:

1. Query the brain's memory for recent conversation exchanges
2. Apply stratified sampling: 60% recent responses, 20% low-confidence, 20% random
3. Evaluate each sampled response against the configured metrics dimensions
4. Score each dimension 1-5 and record the scores
5. Identify patterns in low-scoring responses
6. Generate a structured self-review report

The engine respects the `reviewSampleSize` config option (default: 20 responses per review cycle) and the `metricsDimensions` list for which dimensions to evaluate.

### Component 2: Growth Log Store

The growth log is stored in the brain's memory system as typed entries. Each entry follows the growth log data structure:

```typescript
interface GrowthLogEntry {
  id: string;                    // "gl-YYYY-MM-DD-NNN"
  date: string;                  // ISO date
  trigger: 'self-review' | 'user-feedback' | 'meta-learning';
  finding: string;               // Plain text description of what was found
  evidence: string[];            // Specific response examples supporting the finding
  strategy: string;              // Proposed strategy to address the finding
  proposedChanges: ProposedChange[];
  metrics: {
    [dimension: string]: {
      before: number | null;
      after: number | null;
    };
  };
  status: 'pending-review' | 'pending-approval' | 'applied' | 'measured' | 'rejected';
}
```

The growth log is append-only. Entries are never deleted, only updated with new status and after-metrics. Retention is configured via `growthLogRetention` (default: 365 days).

### Component 3: Soul.md Modifier

The soul.md modifier generates proposed diffs to the agent's personality file. It follows this protocol:

1. Analyze self-review findings and growth log patterns
2. Determine what type of change would address the identified issue
3. Generate a unified diff describing the proposed change
4. Include rationale explaining why the change is expected to help
5. Present the proposal to the user for review

The modifier never applies changes directly. All proposals go through the user approval gate. Approved changes are committed to git with a descriptive message.

Change types that can be proposed:
- Personality trait adjustments (modifying tone or behavioral guidelines)
- New knowledge domains (adding "What You Know" entries)
- Behavioral rules (adding "What You Don't Do" entries)
- Memory priority updates
- Public face description changes

### Component 4: Metrics Tracker

The metrics tracker maintains longitudinal data on the agent's performance across all evaluation dimensions. It stores:

- Per-dimension scores for each self-review cycle
- Rolling averages (7-day, 30-day)
- Improvement velocity (rate of change per dimension)
- Dimension correlations (does improving one dimension affect others?)
- Meta-learning statistics (which strategies produce the most improvement)

## Review Cycle Implementation

```
[Timer: reviewInterval triggers]
    |
    v
[Sample N past responses from memory]
    |
    v
[For each response: evaluate against metrics dimensions]
    |
    v
[Aggregate scores and identify patterns]
    |
    v
[Match patterns against known error types]
    |
    v
[Generate improvement proposals for each pattern]
    |
    v
[Create growth log entry with findings and proposals]
    |
    v
[Present to user for review]
    |
    v
[On approval: apply changes, commit to git]
    |
    v
[After sufficient new data: measure impact, update growth log]
```

## Soul.md Modification Protocol

```
1. IDENTIFY: Self-review finds a behavioral pattern
   Example: "Responses to code review questions consistently omit error handling"

2. ANALYZE: Determine what soul.md section needs changing
   Example: Add to "What You Do" or add a procedure

3. GENERATE: Create a diff
   Example:
   ```diff
   + ## Code Review Protocol
   + When reviewing code, systematically check:
   + - Error handling paths
   + - Null/undefined guards
   + - Boundary conditions
   + - Race conditions
   ```

4. PROPOSE: Present to user with evidence
   "I've noticed I consistently miss error handling in code reviews (3 of 5 recent examples).
    I'd like to add a code review protocol to my soul.md. Here's the proposed change:
    [diff]
    Would you like me to apply this?"

5. APPLY: On approval, commit to git
   git commit -m "improvement: add code review protocol (addresses growth-log gl-2026-03-30-001)"

6. MEASURE: After enough new responses, evaluate impact
   Update the growth log entry with after-metrics
```

## Data Storage

All self-improvement data is stored in the brain:

- `facts.json`: Current dimension scores, review strategy preferences
- `memories.json`: Growth log entries (typed as "growth-log")
- `procedures.json`: Learned review and improvement procedures
- `wiki/`: Knowledge articles added through self-directed learning
- `soul.md`: The agent's modifiable personality (changes via git commits)

The `factsNamespace: growth` config ensures all self-improvement facts are namespaced under `growth.*` to avoid collisions with other fact types.

## Configuration

Key configuration options in config.yml:

- `features.*`: Toggle individual self-improvement features
- `improvement.reviewInterval`: How often self-review runs (cron expression or "daily")
- `improvement.reviewSampleSize`: Number of responses to review per cycle
- `improvement.autoProposeChanges`: Whether to automatically generate proposals
- `improvement.requireUserApproval`: Always true — safety gate
- `improvement.metricsDimensions`: Which dimensions to evaluate
- `improvement.growthLogRetention`: How long to keep growth log entries
