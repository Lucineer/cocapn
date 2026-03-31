# Implementation Notes — Dream Simulator

## Architecture Overview

The Dream Simulator consists of four interconnected subsystems that together implement the memory consolidation cycle.

---

### 1. Consolidation Scheduler

Uses cocapn's built-in cron scheduler to trigger consolidation at configurable intervals.

```
Light cycle:  0 3 * * *     (daily at 3 AM)
Deep cycle:   0 3 * * 0     (weekly, Sunday 3 AM)
REM cycle:    0 3 1 * *     (monthly, 1st at 3 AM)
```

Each cycle has different parameters:

| Parameter | Light | Deep | REM |
|-----------|-------|------|-----|
| Replay count | 50 | 200 | 500 |
| Pattern threshold | 0.7 | 0.5 | 0.3 |
| Creative recombination | no | limited | yes |
| Pruning | conservative | moderate | aggressive |

### 2. Replay Engine

The replay engine samples memories from the brain store using importance-weighted sampling.

**Sampling weights:**
- Recency: `weight_recency = e^(-age_days / 30)` — exponentially favors recent memories
- Importance: `weight_importance = initial_importance * current_confidence`
- Emotional valence: `weight_emotion = |valence|` — strong positive or negative emotions are replayed more
- Novelty: `weight_novelty = 1 - last_replay_recency` — memories not recently replayed get priority

Combined weight: `w = 0.3 * recency + 0.4 * importance + 0.3 * emotion * novelty`

### 3. Pattern Detector

Uses graph-based clustering to find patterns across replayed memories.

**Algorithm:**
1. Compute embeddings for each replayed memory
2. Build similarity graph (edge if similarity > threshold)
3. Find connected components (clusters)
4. For each cluster with >= 3 memories, generate a pattern summary via LLM
5. Classify pattern type (recurring, trend, causal, cross-domain, anomaly)

**Pattern classification** uses a lightweight LLM call with a structured prompt that maps the cluster contents to pattern types.

### 4. Dream Journal Generator

Produces a structured dream report from consolidation results using the LLM.

**Report format:**
```markdown
# Dream Report — [date]
## Cycle: [Light/Deep/REM]
### Memories Replayed
- [N] memories sampled, [M] patterns detected

### Patterns Discovered
1. [Pattern description] (confidence: 0.X)
   - Related memories: [links]
   - Insight: [what this suggests]

### Confidence Updates
- [N] memories reinforced, [M] confidence reduced

### Creative Insights (REM only)
- [Novel connections discovered]

### Actions Needed
- [K] memories below pruning threshold — review recommended
```

---

## The Consolidation Cycle

The full cycle runs in five stages:

```
1. SAMPLE: Select memories using importance-weighted sampling
2. REPLAY: Generate embeddings and similarity scores
3. DETECT: Find patterns via graph clustering
4. REPORT: Generate dream report via LLM
5. UPDATE: Modify confidence scores based on replay results
   - Reinforced memories: confidence += 0.1 (max 1.0)
   - Unreinforced memories: confidence decays naturally
   - Pruned memories: confidence set to 0.1 (not deleted)
```

### Confidence Decay

Unreinforced memories decay exponentially:
```
confidence_new = confidence_old * e^(-decayRate * daysSinceLastReplay)
```

Default decay rate: 0.05/day (roughly 5% decay per day for memories not replayed).

### Pruning Strategy

Memories below the pruning threshold (default 0.3) are flagged for review:
- They are NOT automatically deleted
- They appear in the dream report's "Actions Needed" section
- Users can explicitly preserve or allow pruning
- Preserved memories get a confidence boost back to 0.5

---

## Integration with Brain Memory Model

The consolidation process interacts with cocapn's brain memory stores:

| Store | Consolidation Action |
|-------|---------------------|
| `facts.json` | Read for context, not modified during consolidation |
| `memories.json` | Primary target — confidence scores modified, patterns stored as new memories |
| `procedures.json` | Updated if procedural patterns detected |
| `relationships.json` | New entity connections discovered during pattern detection |
| `repo-understanding/` | Updated if code-related patterns emerge |

Dream reports are stored as memories with type `dream-report` and high importance (0.8).

---

## Performance Considerations

| Cycle | Memory Samples | LLM Calls | Estimated Time |
|-------|---------------|-----------|----------------|
| Light | 50 | 2-3 | ~10 seconds |
| Deep | 200 | 5-8 | ~30 seconds |
| REM | 500 | 10-15 | ~60 seconds |

The REM cycle is the most expensive due to creative recombination, which requires additional LLM calls for novel association generation.

---

## Configuration Reference

All consolidation parameters are in `config.yml` under the `dreams` section:

```yaml
dreams:
  schedule: "0 3 * * *"
  cycles:
    - name: light
      interval: daily
      replayCount: 50
      patternThreshold: 0.7
    - name: deep
      interval: weekly
      replayCount: 200
      patternThreshold: 0.5
    - name: rem
      interval: monthly
      replayCount: 500
      patternThreshold: 0.3
  pruningThreshold: 0.3
  maxDreamReportLength: 2000
```

---

## See Also

- [Memory Consolidation](./wiki/memory-consolidation.md) — Neuroscience foundations
- [Pattern Recognition](./wiki/pattern-recognition.md) — Pattern detection algorithms
- [Neural Dreams](./wiki/neural-dreams.md) — History and philosophy of AI dreaming
