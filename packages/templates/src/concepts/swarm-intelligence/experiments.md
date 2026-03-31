# Experiments — Swarm Intelligence

## Overview

These experiments are designed to validate the Swarm Intelligence concept and optimize its configuration. Each experiment has a clear hypothesis, methodology, and success metric. Results should be stored in the brain wiki for ongoing reference.

---

## Experiment 1: Multi-Persona vs Single-Persona Answer Quality

**Hypothesis:** Multi-persona responses (4 personas + synthesis) will be rated higher than single-persona responses on complex, multi-faceted questions, but not significantly different on simple factual questions.

**Methodology:**
1. Curate a test set of 50 questions: 25 complex (open-ended, multi-domain) and 25 simple (factual, single-domain).
2. For each question, generate two responses:
   - **Control**: Standard single-persona response (default system prompt).
   - **Treatment**: Full Swarm Intelligence response (4 personas + synthesis).
3. Have 3 independent evaluators rate each response on:
   - Completeness (1-5): Does the response cover important dimensions?
   - Accuracy (1-5): Is the information correct?
   - Nuance (1-5): Does the response acknowledge trade-offs and complexities?
   - Usefulness (1-5): Would this response help the user make a decision?
4. Compare average ratings between control and treatment for each question category.

**Metrics:**
- Average rating difference (treatment - control) per dimension
- Win rate: percentage of questions where treatment scores higher
- Statistical significance via paired t-test (alpha = 0.05)

**Expected results:** Treatment wins on completeness and nuance for complex questions. No significant difference for simple questions. Small treatment advantage on usefulness overall.

---

## Experiment 2: Optimal Number of Personas

**Hypothesis:** 4 personas is the optimal default, but 3 personas may offer a better cost-quality tradeoff, and 6+ personas provide diminishing returns.

**Methodology:**
1. Test with 2, 3, 4, 5, and 6 personas on the same set of 30 complex questions.
2. For N personas, select the N most cognitively diverse combinations from the available set (Scientist, Artist, Engineer, Philosopher, plus optional Historian and Economist).
3. Rate responses on the same 4 dimensions as Experiment 1.
4. Track cost per response (N + 1 LLM calls) and latency.

**Metrics:**
- Quality score per persona count (normalized for cost)
- Marginal quality improvement per additional persona
- Cost-effectiveness ratio (quality / cost)
- Latency per persona count

**Expected results:** Quality increases steeply from 2 to 4 personas, plateaus from 4 to 6. Cost-effectiveness peaks at 3-4 personas. Recommendation: 4 as default, 3 for cost-sensitive deployments.

---

## Experiment 3: Dynamic Weighting Effectiveness

**Hypothesis:** Dynamic weighting (adjusting persona weights based on topic) outperforms uniform weighting, and the improvement grows with accumulated interaction data.

**Methodology:**
1. Run Swarm Intelligence with 3 weighting configurations:
   - **Uniform**: All personas have weight 1.0 always.
   - **Static domain**: Pre-set weight adjustments based on topic category (e.g., technical = Engineer 1.5).
   - **Dynamic learned**: Weights adjusted by historical accuracy data from brain memory.
2. Test on 40 questions across 4 domains (technical, creative, ethical, mixed).
3. Rate synthesized responses on relevance and depth of the most relevant persona's contribution.

**Metrics:**
- Relevance rating per domain per weighting strategy
- Improvement of dynamic over uniform over time (learning curve)
- Weight convergence speed (how many interactions until dynamic weights stabilize)

**Expected results:** Static domain weighting beats uniform by a small margin. Dynamic learned weighting beats static by a larger margin, with the gap increasing as the system accumulates more interaction data. After ~50 interactions per domain, dynamic weights should be well-calibrated.

---

## Experiment 4: Conflict Surfacing Usefulness

**Hypothesis:** Users find explicitly surfaced persona disagreements more valuable than hidden disagreements, especially for decision-making questions.

**Methodology:**
1. Generate 20 responses where personas have measured conflict (distance > 0.3).
2. For each, produce two versions:
   - **Synthesized only**: Standard synthesis that resolves the disagreement into a unified view.
   - **Surfaced conflict**: Synthesis that explicitly presents the disagreement with both positions.
3. Have users rate both versions on:
   - Trust (1-5): How much do you trust this response?
   - Decision confidence (1-5): How confident are you in making a decision based on this?
   - Preference: Which version would you rather receive?

**Metrics:**
- Average trust and confidence ratings per version
- User preference percentage
- Qualitative feedback on why users preferred one version over the other

**Expected results:** Surfaced conflict version scores higher on trust and decision confidence for questions where the conflict is genuine (not manufactured). Users report that seeing both sides helps them understand the trade-offs. A minority of users prefer the synthesized-only version for its cleaner presentation.

---

## Running These Experiments

To run these experiments in a cocapn deployment:

1. Store the test question sets in `wiki/experiments/` as markdown files.
2. Use the scheduler module to run experiments at intervals (e.g., weekly).
3. Store results in brain memories with type `experiment-result` and confidence 0.9.
4. Update persona weights and conflict thresholds based on accumulated results.
5. Document findings in the wiki for the synthesis layer to reference.

The brain's memory persistence means experiment results accumulate over time, creating an ever-richer evidence base for configuration decisions. This is the cocapn way: the agent learns from its own experiments.
