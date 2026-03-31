# Implementation Notes — Temporal Agent

## Architecture Overview

The Temporal Agent extends Cocapn's local bridge with five new subsystems. Each subsystem operates independently but communicates through a shared timeline data layer.

### Subsystems

1. **Timeline Store** — Append-only log of temporal events, the single source of truth for all time-aware queries
2. **Branch Manager** — Creates, tracks, compares, and garbage-collects what-if timeline branches
3. **Decay Engine** — Background process that recalculates confidence values based on elapsed time and new evidence
4. **Pattern Detector** — Scans timelines for recurring patterns, seasonal trends, and anomalies
5. **Projection Generator** — Uses LLM reasoning + timeline context to produce multi-scenario future forecasts

### Data Flow

```
User Query
  -> Temporal Agent
    -> Timeline Store (query historical state)
    -> Decay Engine (get current confidence values)
    -> Pattern Detector (identify relevant patterns)
    -> Branch Manager (check active what-if branches)
    -> Projection Generator (if future reasoning needed)
    -> LLM (synthesize response with temporal context)
  -> User Response (with temporal annotations)
```

## Timeline Data Structure

The timeline is an append-only log. Each entry is a temporal event:

```typescript
interface TemporalEvent {
  id: string;
  timestamp: number;           // Unix epoch milliseconds
  type: 'fact_stored' | 'fact_updated' | 'fact_invalidated'
      | 'decision_made' | 'decision_outcome'
      | 'confidence_updated' | 'confidence_decayed'
      | 'pattern_detected' | 'pattern_broken'
      | 'branch_created' | 'branch_archived' | 'branch_merged'
      | 'prediction_made' | 'prediction_outcome'
      | 'revisit_triggered';
  payload: Record<string, unknown>;
  confidence: number;          // 0.0 to 1.0
  branchId: string | null;    // null = main timeline
  parentEventId: string | null; // causal chain
  tags: string[];              // domain, topic, entity tags
}
```

Events are never mutated or deleted. Corrections are new events that supersede earlier ones. This ensures the timeline is always reconstructable.

## Branching Mechanism — Copy-on-Write

Branches do not duplicate the main timeline. They store only:

1. A reference to the divergence event in the main timeline
2. A counterfactual premise describing what differs
3. Delta events from the divergence point forward

```typescript
interface TimelineBranch {
  id: string;
  divergenceEventId: string;     // point in main timeline
  premise: string;               // what-if assumption
  deltaEvents: TemporalEvent[];  // only the new events
  confidence: number;            // overall branch plausibility
  status: 'active' | 'archived' | 'merged';
  createdAt: number;
  expiresAt: number | null;      // auto-archive deadline
}
```

When querying a branch, the system reconstructs the full timeline by concatenating the main timeline up to the divergence point with the branch's delta events. This keeps memory usage proportional to branch activity, not total history.

Branch cleanup: branches that have not been accessed in 30 days are automatically archived. Archived branches remain queryable but are excluded from pattern detection and projection generation.

## Decay Computation

The decay engine runs on a configurable interval (default: every 6 hours). For each tracked item, it:

1. Reads the item's initial confidence and timestamp
2. Computes elapsed time since last confidence update
3. Applies the decay function: `current = initial * e^(-lambda * elapsed)`
4. Checks if any new evidence arrived since last computation
5. If new evidence exists, applies Bayesian update on top of the decayed value
6. Persists the new confidence and timestamps the update
7. If confidence crossed the revisit threshold, emits a `revisit_triggered` event

The computation is batch-oriented for efficiency. Items are grouped by decay model and domain, allowing vectorized decay calculations. For a brain with 2000 memories, full decay recomputation takes under 50ms.

## What-If Simulation via LLM

Branch projection uses the LLM as a simulation engine. The prompt construction is critical:

1. **Timeline state at divergence** — serialize the relevant facts, decisions, and confidence values as they were at the branch point
2. **Counterfactual premise** — clearly state what differs from the main timeline
3. **Projection depth** — how far into the future to simulate
4. **Constraints** — temporal logic constraints that the simulation must respect (no effects before causes, no resurrected terminated facts without justification)
5. **Output format** — structured events, not prose

The LLM's output is parsed into `TemporalEvent` objects and added to the branch's delta. Each projected event carries a confidence penalty proportional to its distance from the present, reflecting the inherent uncertainty of simulation.

## Decision Revisiting Algorithm

The revisit algorithm evaluates all tracked decisions on each decay cycle:

```
for each decision in tracked_decisions:
  current_confidence = decay(decision)
  context_similarity = compare_context(decision.context, current_context)
  impact_score = decision.impact  // user-defined or inferred
  reversibility = decision.reversibility

  revisit_score = (
    (1 - current_confidence) * 0.3          // low confidence -> higher score
  + (1 - context_similarity) * 0.3          // changed context -> higher score
  + impact_score * 0.2                       // high impact -> higher score
  + (1 - reversibility) * 0.2               // irreversible -> higher score
  )

  if revisit_score > REVISIT_THRESHOLD:
    emit revisit_triggered event for this decision
```

Revisit events are prioritized by revisit score. The agent surfaces the top items to the user with a summary of what changed and why the revisit is warranted.

## Persistence and Recovery

Timeline events are stored in the brain's memory layer, inheriting its git-backed persistence. On startup, the agent:

1. Loads all timeline events from the brain stores
2. Reconstructs the main timeline
3. Rebuilds any active branches
4. Runs a single decay cycle to catch up on any missed intervals
5. Resumes pattern detection and projection generation

No data is lost on restart. The append-only design means recovery is always complete — there is no state that is not recoverable from the event log.

## Performance Considerations

- Timeline queries use time-indexed lookups (binary search on sorted timestamps)
- Decay computation is batched and runs every 6 hours, not on every query
- Branch projection is lazy — branches are only simulated when accessed
- Pattern detection uses sliding windows with configurable granularity
- The 2000 memory limit in config keeps the working set bounded
- Copy-on-write branching ensures branches do not multiply memory usage
