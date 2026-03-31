# Experiments — Recursive Improver

## Experiment 1: Self-Review Improves Response Quality Over Time

**Type**: Longitudinal measurement
**Duration**: 30 days
**Hypothesis**: Agents that perform regular self-review show measurable improvement in response quality across all evaluation dimensions.

### Method

- Deploy two identical Recursive Improver instances with the same soul.md and config
- Instance A (treatment): Self-review enabled, daily review cycle
- Instance B (control): Self-review disabled, no self-evaluation
- Both instances handle the same set of user interactions (replayed conversations)
- Measure accuracy, helpfulness, completeness, and tone scores weekly

### Metrics

- Per-dimension scores over time (treatment vs control)
- Improvement velocity (delta per week)
- Statistical significance of improvement trend
- Number of self-identified error patterns
- Number of growth log entries generated

### Expected Outcome

Instance A shows statistically significant improvement in at least 2 of 4 dimensions over 30 days. Instance B shows no improvement trend.

### Success Criteria

- Treatment group shows >15% improvement in completeness score
- Treatment group shows >10% improvement in accuracy score
- Improvement is sustained (not just a spike after a single review)
- Growth log shows evidence of pattern identification and strategy application

---

## Experiment 2: Growth Log Transparency Builds User Trust

**Type**: A/B test
**Duration**: 14 days
**Hypothesis**: Users who can see the agent's growth log and self-review process report higher trust and satisfaction than users who interact with the same agent without visibility into the improvement process.

### Method

- Two groups of participants (minimum 20 per group)
- Group A: Full growth log visibility — can see self-review reports, improvement proposals, and before/after metrics
- Group B: Standard interaction — same agent quality, but no visibility into the improvement process
- Both groups interact with the agent for the same tasks over 14 days
- Administer trust and satisfaction surveys at days 1, 7, and 14

### Metrics

- Trust score (standardized survey, 1-7 Likert scale)
- Satisfaction score (standardized survey, 1-7 Likert scale)
- Perceived agent competence
- Willingness to rely on agent for important tasks
- Self-reported comfort with agent making autonomous improvements

### Expected Outcome

Group A shows higher trust scores, particularly after day 7 when growth log entries accumulate. The transparency effect increases with time as users observe genuine improvement.

### Success Criteria

- Group A trust score > Group B by at least 0.5 points on 7-point scale
- Group A satisfaction increases over time; Group B stays flat
- Qualitative feedback mentions transparency and improvement visibility as trust factors

---

## Experiment 3: Soul.md Modifications Improve Personality Alignment

**Type**: Before/after evaluation
**Duration**: 21 days
**Hypothesis**: Agent-proposed soul.md modifications, when approved by users, result in measurable improvement in personality alignment (tone consistency, behavioral rule adherence).

### Method

- Start with a baseline soul.md
- Allow the agent to propose modifications over 21 days
- User reviews and approves/rejects proposals
- At days 7, 14, and 21: evaluate personality alignment using a standardized rubric
- Track which types of soul.md changes produce the most improvement

### Metrics

- Personality alignment score (rubric-based, 1-5)
- Tone consistency across responses
- Behavioral rule adherence rate
- Number and type of soul.md modifications applied
- Correlation between specific changes and alignment improvement

### Expected Outcome

Approved soul.md modifications produce measurable improvement in personality alignment. Procedure additions (specific behavioral protocols) produce more improvement than trait modifications.

### Success Criteria

- Personality alignment score improves by >20% from baseline to day 21
- At least 3 soul.md modifications are proposed and approved
- Each approved modification shows measurable impact in the relevant dimension
- No approved modification causes regression in other dimensions

---

## Experiment 4: Meta-Learning Accelerates Improvement Rate

**Type**: Longitudinal measurement with intervention
**Duration**: 42 days (two 21-day phases)
**Hypothesis**: An agent that applies meta-learning (tracking which review strategies work best) shows accelerating improvement velocity compared to an agent using fixed review strategies.

### Method

- Single Recursive Improver instance running for 42 days
- Phase 1 (days 1-21): Fixed review strategy — equal attention to all dimensions
- Phase 2 (days 22-42): Meta-learning enabled — review focus adapted based on which strategies produced the most improvement in Phase 1
- Measure improvement velocity in both phases
- Compare the slope of the improvement curve

### Metrics

- Improvement velocity (score improvement per review cycle)
- Strategy effectiveness scores (improvement per unit of review effort)
- Distribution of review effort across dimensions
- Phase 1 vs Phase 2 velocity comparison
- Meta-learning data quality (how well the agent predicts which strategies will work)

### Expected Outcome

Phase 2 shows higher improvement velocity than Phase 1. The agent learns which review strategies are most effective for its specific error patterns and concentrates effort accordingly.

### Success Criteria

- Phase 2 improvement velocity > Phase 1 velocity by at least 25%
- Agent correctly identifies its top 2 most productive review dimensions
- Review effort distribution shifts measurably between Phase 1 and Phase 2
- Meta-learning predictions correlate >0.6 with actual improvement outcomes
