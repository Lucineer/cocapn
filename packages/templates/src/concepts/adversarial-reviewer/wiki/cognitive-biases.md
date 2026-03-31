# Cognitive Biases

## Overview

Cognitive biases are systematic patterns of deviation from rational judgment. They affect everyone — including AI models and the people who build and use them. The Adversarial Reviewer includes structural bias detection as a core capability, scanning for biases in both its own reasoning and the user's framing of questions.

This document covers the most relevant cognitive biases for decision-making, how the agent detects and flags them, the debiasing strategies built into the agent's pipeline, and the relationship between bias detection and constitutional review.

---

## Top Cognitive Biases in Decision-Making

### Confirmation Bias

The tendency to search for, interpret, and recall information that confirms pre-existing beliefs. This is arguably the most dangerous bias in analytical work because it operates invisibly — the biased thinker genuinely believes they are being objective.

**Impact**: Analysts give more weight to evidence supporting their hypothesis, dismiss contradicting evidence as "exceptions" or "noise," and frame questions in ways that presuppose the desired answer.

**Detection in the agent**: The agent checks whether the initial response disproportionately supports one position, whether evidence is cherry-picked, and whether the user's question framing assumes a particular conclusion. The counter-argument stage is specifically designed to break confirmation bias by forcing consideration of opposing evidence.

**Reference**: Nickerson, R. S. "Confirmation Bias: A Ubiquitous Phenomenon in Many Guises." Review of General Psychology, 1998.

### Anchoring Bias

The tendency to rely too heavily on the first piece of information encountered (the "anchor") when making decisions. Once an anchor is set, subsequent judgments are biased toward that initial value.

**Impact**: Initial estimates, even arbitrary ones, influence final decisions. A product manager who sees a competitor's pricing first will anchor their own pricing strategy to that number regardless of cost structure.

**Detection in the agent**: The agent checks whether the response is disproportionately influenced by the first piece of evidence mentioned, whether numbers and estimates cluster around initial values, and whether alternative starting points would lead to different conclusions.

**Reference**: Tversky, A. & Kahneman, D. "Judgment under Uncertainty: Heuristics and Biases." Science, 1974.

### Availability Heuristic

The tendency to overweight information that is easily recalled — typically because it is recent, vivid, emotionally charged, or frequently encountered in media.

**Impact**: Recent failures are over-weighted in risk assessment. Vivid anecdotes are given more weight than statistical evidence. High-profile but rare events (plane crashes, terrorist attacks) are perceived as more common than they are.

**Detection in the agent**: The agent checks whether the response relies heavily on recent or vivid examples, whether statistical evidence is available but ignored in favor of anecdotes, and whether the user's question references a specific recent event that might be inflating perceived probability.

**Reference**: Tversky, A. & Kahneman, D. "Availability: A Heuristic for Judging Frequency and Probability." Cognitive Psychology, 1973.

### Sunk Cost Fallacy

The tendency to continue investing in a losing course of action because of prior investments (time, money, effort) that cannot be recovered. The rational decision is to ignore sunk costs, but the emotional pull of "we've already invested so much" is powerful.

**Impact**: Projects that should be canceled continue draining resources. Bad investments are held rather than cut. Failed relationships continue longer than they should. The bias is especially strong in organizational settings where admitting a past mistake has social costs.

**Detection in the agent**: The agent checks whether the user's framing emphasizes past investment as a reason to continue, whether the analysis of future prospects is contaminated by emotional attachment to sunk costs, and whether discontinuation is being unfairly penalized in the cost-benefit analysis.

**Reference**: Arkes, H. R. & Blumer, C. "The Psychology of Sunk Cost." Organizational Behavior and Human Decision Processes, 1985.

### Dunning-Kruger Effect

The tendency for people with limited knowledge in a domain to overestimate their competence, while experts tend to underestimate theirs. The less you know, the more confident you tend to be.

**Impact**: Novices make high-stakes decisions with unwarranted confidence. Experts hedge unnecessarily. Teams fail to seek expert input because they don't recognize the limits of their own understanding.

**Detection in the agent**: The agent monitors confidence levels in both the user's framing and its own initial response. High confidence paired with simple reasoning is flagged as a potential Dunning-Kruger indicator. The agent cross-references confidence with the complexity of the domain and its own stored knowledge about past accuracy in that domain.

**Reference**: Kruger, J. & Dunning, D. "Unskilled and Unaware of It." Journal of Personality and Social Psychology, 1999.

### Planning Fallacy

The tendency to underestimate the time, cost, and risks of future actions while overestimating their benefits. Related to optimism bias but specifically focused on planning and forecasting.

**Impact**: Projects consistently run over budget and behind schedule. Benefits are over-promised and under-delivered. Risk mitigation plans are insufficient because risks were underestimated in the planning phase.

**Detection in the agent**: The agent compares the user's estimates and timelines against stored data from similar past projects (via brain memory), checks whether the analysis accounts for historical overrun rates, and flags projections that are more optimistic than base rates would suggest.

**Reference**: Buehler, R., Griffin, D., & Ross, M. "Inside the Planning Fallacy." Journal of Personality and Social Psychology, 1994.

### Status Quo Bias

The tendency to prefer the current state of affairs. Changes from the baseline are perceived as losses, even when the change would be beneficial. Related to loss aversion — losses loom larger than equivalent gains.

**Impact**: Organizations stick with suboptimal tools, processes, and strategies because changing them feels risky. "We've always done it this way" becomes an argument against improvement.

**Detection in the agent**: The agent checks whether the analysis favors inaction without justification, whether the costs of change are inflated relative to the costs of stasis, and whether the user's framing treats the current state as the default without examining whether it's optimal.

**Reference**: Samuelson, W. & Zeckhauser, R. "Status Quo Bias in Decision Making." Journal of Risk and Uncertainty, 1988.

### Survivorship Bias

The tendency to focus on entities that survived a selection process while ignoring those that did not. This leads to false conclusions about what factors contribute to success.

**Impact**: Business advice based on successful companies ignores the thousands of failed companies that followed the same strategies. Investment strategies backtested on surviving stocks overestimate returns. "Best practices" from successful projects may be coincidental rather than causal.

**Detection in the agent**: The agent checks whether the evidence set includes only successful cases, whether the analysis accounts for the full population (including failures), and whether causal claims are supported by comparing both survivors and non-survivors.

**Reference**: Elton, E. J., Gruber, M. J., & Blake, C. R. "Survivorship Bias and Mutual Fund Performance." Review of Financial Studies, 1996.

---

## How the Agent Detects and Flags Biases

### The Bias Scan Pipeline

Bias detection runs as a parallel process alongside the main debate pipeline:

1. **Framing analysis**: Before generating the thesis, the agent analyzes the user's question for biased framing — loaded language, presuppositions, and implicit assumptions.

2. **Evidence audit**: During thesis generation, the agent tracks what evidence is cited and what is omitted. Asymmetries in evidence selection are flagged as potential confirmation bias.

3. **Counter-argument check**: The counter-argument stage naturally tests for many biases. If the counter-argument reveals important considerations that were completely absent from the thesis, this suggests bias in the initial generation.

4. **Cross-reference with history**: The agent checks brain memory for past biases identified in the user's reasoning. If a user has been flagged for anchoring bias three times before, the agent applies extra scrutiny to numerical estimates.

5. **Confidence calibration**: The agent compares its confidence in the current answer with its historical accuracy in similar domains. Overconfidence relative to track record is flagged.

### Bias Flags

When a bias is detected, the agent generates a structured bias flag:

```
[BIAS FLAG]
Type: Confirmation bias
Confidence: 0.8
Evidence: Initial response cites 4 studies supporting the thesis and 0 opposing. The counter-argument found 2 well-regarded studies that contradict the conclusion.
Recommendation: Include the contradicting studies in the synthesis and re-evaluate confidence.
[/BIAS FLAG]
```

These flags are included in the final response (transparent by design) and stored in brain memory for future reference.

---

## Debiasing Strategies Built Into the Agent

### Structural Debiasing

These are built into the pipeline and run automatically:

1. **Counter-argument generation**: The most powerful debiasing tool. By forcing the model to argue the opposite position, many biases (especially confirmation bias) are structurally countered.

2. **Constitutional principles**: Principles like "challenge assumptions, especially confident ones" serve as explicit debiasing rules. The agent applies them mechanically, not just when it "feels like" being fair.

3. **Evidence balance check**: The agent counts pro and con evidence cited and flags asymmetries. This doesn't guarantee balance, but it makes imbalance visible.

4. **Base rate reference**: For probabilistic questions, the agent references base rates from stored knowledge. This counters availability heuristic and planning fallacy by grounding estimates in statistical reality.

5. **Pre-mortem analysis**: Before finalizing a recommendation, the agent runs a "pre-mortem" — assuming the recommendation failed, what was the most likely cause? This counters overconfidence and optimism bias.

### Interactive Debiasing

These require user participation:

1. **Bias alerts**: The agent can be configured to alert the user when it detects biased reasoning in the user's framing. These alerts are non-judgmental and specific.

2. **Reframing suggestions**: When biased framing is detected, the agent suggests alternative framings that might lead to different conclusions. The user can accept or reject these suggestions.

3. **Confidence challenges**: When the user expresses very high confidence, the agent explicitly challenges that confidence with the strongest available counter-evidence. This is the "devil's advocate mode" triggered by overconfidence.

4. **Historical reflection**: The agent can surface past decisions where similar biases were identified, helping the user recognize patterns in their own reasoning.

---

## The Relationship Between Bias Detection and Constitutional Review

Bias detection and constitutional review are complementary:

- **Constitutional review** operates at the principle level: "Does this response violate any stated principles?"
- **Bias detection** operates at the cognitive level: "Does this reasoning exhibit systematic errors in judgment?"

A response might pass constitutional review (no principles violated) but still exhibit cognitive biases. Conversely, a biased response might be constitutionally compliant because the constitution doesn't explicitly address that bias. The combination of both provides broader coverage than either alone.

The constitutional principles themselves encode debiasing guidance:
- "Show uncertainty when uncertain" counters overconfidence bias
- "Challenge assumptions, especially confident ones" counters confirmation bias
- "Present both sides fairly" counters one-sided analysis
- "Acknowledge when the counter-argument wins" counters commitment escalation

As the agent accumulates experience with a user, the constitution can be refined to address the specific biases that user is most susceptible to. This creates a personalized debiasing framework that improves over time.

---

## References

- Kahneman, D. "Thinking, Fast and Slow." Farrar, Straus and Giroux, 2011.
- Tversky, A. & Kahneman, D. "Judgment under Uncertainty: Heuristics and Biases." Science, 1974.
- Nickerson, R. S. "Confirmation Bias: A Ubiquitous Phenomenon in Many Guises." Review of General Psychology, 1998.
- Kruger, J. & Dunning, D. "Unskilled and Unaware of It." JPSP, 1999.
- Larrick, R. P. "Debiasing." In Koehler, D. J. & Harvey, N. (Eds.), Blackwell Handbook of Judgment and Decision Making, 2004.
- Morewedge, C. K., et al. "Debiasing Decisions." Policy Insights from the Behavioral and Brain Sciences, 2015.

---

## See Also

- [Constitutional AI](./constitutional-ai.md) — The principles that govern bias detection
- [Debate Methods](./debate-methods.md) — How debate naturally counters many cognitive biases
- [Implementation Notes](../implementation-notes.md) — Technical details of the bias detection pipeline
