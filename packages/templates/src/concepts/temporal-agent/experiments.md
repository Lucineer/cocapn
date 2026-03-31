# Experiments — Temporal Agent

## Experiment 1: Temporal Context Improves Decision Quality

### Hypothesis
Providing the LLM with temporal context (when past decisions were made, how confidence has decayed, what has changed since) produces higher-quality recommendations than providing the same facts without temporal annotations.

### Method
- Collect 50 real-world decision-making scenarios, each with a history spanning 1-6 months
- For each scenario, generate two recommendations:
  - **Control**: LLM receives the relevant facts without temporal metadata
  - **Treatment**: LLM receives the same facts with temporal annotations (timestamps, confidence decay curves, context changes)
- Have human evaluators blind-rank the two recommendations on relevance, accuracy, and actionability

### Metrics
- Win rate of treatment over control (target: >60%)
- Evaluator agreement (Cohen's kappa > 0.6)
- Qualitative analysis of when temporal context helps most

### Success Criteria
Treatment recommendations are preferred in at least 60% of scenarios, demonstrating that temporal annotations measurably improve LLM reasoning.

---

## Experiment 2: Confidence Decay Calibration

### Hypothesis
The agent's confidence decay model can be calibrated to produce well-calibrated predictions — when the agent says "70% confident," the prediction is correct approximately 70% of the time.

### Method
- Run the agent on 200 prediction tasks spanning multiple domains
- Record each prediction's confidence at the time it was made
- Wait for outcomes to be determined (or use historical prediction-outcome pairs)
- Build a calibration curve: group predictions by confidence bucket, compute actual accuracy per bucket

### Metrics
- Calibration error (Brier score decomposition: target < 0.05)
- Discrimination (ability to distinguish likely from unlikely outcomes)
- Reliability diagram slope (ideal: 1.0)

### Success Criteria
Calibration error below 0.05 across confidence buckets, indicating the decay model produces honest uncertainty estimates.

---

## Experiment 3: What-If Simulation Accuracy

### Hypothesis
Timeline branching produces plausible alternative histories that are consistent with the counterfactual premise and do not violate temporal constraints.

### Method
- Create 30 what-if branches from historical decision points where the actual outcome is known
- For each branch, simulate the counterfactual and compare the projected timeline against:
  - Internal consistency (no temporal contradictions)
  - Plausibility (rated by domain experts on a 1-5 scale)
  - Outcome divergence from actual history (branches should differ from reality but remain plausible)

### Metrics
- Internal consistency rate (target: >95% of branches are contradiction-free)
- Expert plausibility rating (target: mean > 3.5 on 5-point scale)
- Outcome spread (branches should show meaningful divergence from each other)

### Success Criteria
At least 90% of simulated branches are internally consistent, and expert plausibility averages above 3.5, demonstrating that the branching mechanism generates useful alternative histories.

---

## Experiment 4: Decision Revisit Timeliness

### Hypothesis
The revisit algorithm flags decisions that genuinely need revisiting, and does so earlier than a naive time-based review schedule.

### Method
- Track 100 decisions over a 6-month period
- For each decision, record when the revisit algorithm triggers
- Compare against:
  - **Ground truth**: when a human expert would flag the decision for review
  - **Baseline**: a fixed-interval review schedule (e.g., monthly)
- Measure lead time (how far in advance the algorithm flags) and precision (what fraction of flagged decisions actually needed review)

### Metrics
- Precision (fraction of revisits that were warranted: target > 70%)
- Recall (fraction of decisions that needed revisiting that were caught: target > 80%)
- Lead time (average time between algorithm flag and actual need: target > 7 days)
- Comparison vs fixed-interval baseline (target: >20% improvement in F1 score)

### Success Criteria
The revisit algorithm achieves >70% precision and >80% recall, with at least 7 days of lead time on average, outperforming a fixed-interval baseline by at least 20% on F1 score.

---

## Cross-Experiment Analysis

After all four experiments, conduct a meta-analysis:

1. Does temporal context improvement (Exp 1) correlate with calibration quality (Exp 2)? Hypothesis: better calibration leads to better temporal annotations, which leads to better recommendations.
2. Do accurate what-if simulations (Exp 3) contribute to timely revisits (Exp 4)? Hypothesis: branches that explore decision consequences help the revisit algorithm identify when circumstances have diverged from expectations.
3. Overall: does temporal depth measurably improve agent utility compared to a flat-memory baseline?

### Reporting
All experiments should report:
- Raw data (predictions, confidence values, outcomes, evaluator responses)
- Statistical significance (p-values for pairwise comparisons)
- Effect sizes (Cohen's d or equivalent)
- Confidence intervals for all reported metrics
- Negative results (what did not work and why)
