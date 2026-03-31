# Experiments — Dream Simulator

## Experiment 1: Dream Frequency vs Insight Quality

### Hypothesis
Daily consolidation (light cycle) will produce more frequent but shallower insights, while monthly consolidation (REM cycle) will produce fewer but more creative and surprising insights. A combination of all three cycles will produce the best overall insight quality.

### Method
- Three groups using the Dream Simulator for 90 days
- Group A: Daily light cycle only
- Group B: Weekly deep cycle only
- Group C: All three cycles (daily + weekly + monthly)
- All groups process the same corpus of memories (synthetic dataset with planted patterns)
- Evaluate: total insights discovered, insight novelty (surprise rating), insight accuracy (validated against planted patterns)

### Metrics
- Total insights discovered per group
- True positive rate (correctly identified planted patterns)
- False positive rate (spurious pattern detection)
- Novelty rating (user-rated surprise on 1-5 scale)
- Time investment vs insight yield

### Expected Results
- Group A finds obvious patterns quickly but misses subtle connections
- Group B finds deeper patterns but misses daily-level events
- Group C finds the most planted patterns with the best novelty/accuracy balance

---

## Experiment 2: Pruning Aggressiveness vs Memory Utility

### Hypothesis
Moderate pruning (threshold 0.3) will improve memory retrieval quality by reducing noise without losing important information. Aggressive pruning (threshold 0.5) will lose valuable memories. Conservative pruning (threshold 0.1) will retain too much noise.

### Method
- Four configurations tested over 60 days on the same memory dataset
- Threshold variants: 0.1 (conservative), 0.3 (default), 0.5 (aggressive), 0.7 (very aggressive)
- Measure retrieval accuracy for known facts, retrieval speed, and user satisfaction
- Track which memories are lost at each threshold (are they important?)

### Metrics
- Retrieval accuracy for key facts (percentage correct)
- Average retrieval latency
- Storage size reduction
- User satisfaction with memory recall quality (Likert scale 1-5)
- Percentage of pruned memories that were later requested

### Expected Results
- Threshold 0.3 provides the best balance (optimal F1 score for memory utility)
- Threshold 0.1 retains noise that degrades search quality
- Threshold 0.5+ loses important low-frequency memories
- User satisfaction peaks at 0.3

---

## Experiment 3: Pattern Discovery Accuracy

### Hypothesis
The agent's pattern detection will correctly identify > 70% of planted cross-memory patterns with < 20% false positive rate, and user-validated patterns will be rated as genuinely useful > 60% of the time.

### Method
- Create a synthetic memory corpus with 15 planted patterns (recurring events, trends, cross-domain links, causal chains, anomalies)
- Run 30 consolidation cycles across all cycle types
- Compare detected patterns against planted patterns
- Have independent evaluators rate the quality and usefulness of each detected pattern
- Measure: recall (planted patterns found), precision (non-spurious detections), user utility

### Metrics
- Recall: percentage of planted patterns correctly detected
- Precision: percentage of detections that match planted patterns
- F1 score (harmonic mean)
- User-rated usefulness of detected patterns (1-5 scale)
- Pattern type accuracy (which types are easiest/hardest to detect)

### Expected Results
- Recurring events and trends detected with > 85% accuracy
- Causal chains harder to detect (~60% accuracy)
- Cross-domain links detected primarily during REM cycles
- Overall F1 > 0.75

---

## Experiment 4: Dream Report Usefulness

### Hypothesis
Users who receive dream reports will report higher engagement with the agent and better self-awareness of their own patterns, compared to users who use the agent without dream reports.

### Method
- Two groups of 20 users over 60 days
- Group A: Full Dream Simulator with dream reports enabled
- Group B: Same agent without dream reports (consolidation runs but reports are hidden)
- Weekly surveys measuring: agent engagement, self-reported learning, perceived agent helpfulness
- End-of-study interview about agent relationship and trust

### Metrics
- Agent engagement (messages per week, session duration)
- Self-reported learning about own patterns (Likert scale 1-5)
- Perceived agent helpfulness (Likert scale 1-5)
- Trust in agent recommendations
- Qualitative feedback from interviews

### Expected Results
- Group A reports significantly higher engagement (dream reports provide conversation starters)
- Group A shows better self-awareness of personal patterns
- Trust scores higher in Group A (transparency about "thinking" process)
- Group A users describe agent as "thoughtful" vs Group B's "helpful"

---

## Cross-Experiment Analysis

After all four experiments:
1. Identify the optimal consolidation cycle configuration
2. Determine the best pruning threshold for general use
3. Validate pattern detection accuracy benchmarks
4. Establish dream report value proposition

## Running These Experiments

Enable experiment logging in config.yml:

```yaml
dreams:
  experimentMode: true
  logLevel: verbose
  logSampling: true
  logPatterns: true
  logPruning: true
  logReportQuality: true
```

Experiment data is stored in brain facts under `dream.experiment.*`.
