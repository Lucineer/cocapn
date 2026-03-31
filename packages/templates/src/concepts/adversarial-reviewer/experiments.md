# Experiments

## Planned Experiments for Validating the Adversarial Reviewer

This document outlines experiments designed to measure whether the adversarial review pipeline (self-play debate + constitutional review + bias detection) produces measurably better outcomes than standard single-pass generation. Each experiment includes a hypothesis, methodology, metrics, and success criteria.

---

## Experiment 1: Debate Quality vs Single-Pass (A/B Test)

### Hypothesis
Responses that go through the full debate pipeline (thesis -> antithesis -> judge -> synthesis) will be rated higher by independent evaluators than single-pass responses to the same questions, particularly for questions involving reasoning, trade-offs, or predictions.

### Methodology
- **Dataset**: 100 questions from decision-making domains (investment analysis, product strategy, policy evaluation, technical architecture)
- **Condition A (control)**: Single-pass generation with standard prompting
- **Condition B (treatment)**: Full 4-stage debate pipeline
- **Evaluation**: 3 independent human evaluators rate each response on a 1-5 scale across dimensions: accuracy, completeness, fairness, usefulness, and confidence calibration
- **Blinding**: Evaluators do not know which condition produced which response

### Metrics
- Mean quality score per condition (across all dimensions)
- Per-dimension score comparison
- Inter-rater agreement (Fleiss' kappa)
- Effect size (Cohen's d)
- Statistical significance (paired t-test, p < 0.05)

### Success Criteria
- Condition B scores at least 0.3 points higher on the 5-point scale (practical significance)
- The effect is consistent across at least 4 of 5 dimensions
- Statistical significance at p < 0.05

### Expected Outcome
Based on prior research (Cohen et al., 2023; Du et al., 2023), we expect debate to improve quality by 0.3-0.5 points on the 5-point scale, with the largest gains in fairness and confidence calibration.

---

## Experiment 2: Constitutional Principle Impact (Ablation Study)

### Hypothesis
Each constitutional principle contributes independently to response quality, and removing principles degrades quality in predictable ways. The full constitution outperforms any subset.

### Methodology
- **Constitution variants**:
  1. Full constitution (5 principles)
  2. Remove "Prioritize truth over comfort"
  3. Remove "Show uncertainty when uncertain"
  4. Remove "Challenge assumptions, especially confident ones"
  5. Remove "Present both sides fairly"
  6. Remove "Acknowledge when the counter-argument wins"
  7. Empty constitution (no principles)
- **Dataset**: 50 questions specifically designed to test constitutional boundaries (e.g., questions where the truthful answer is uncomfortable, questions with high uncertainty, questions where the user's assumption is wrong)
- **Evaluation**: Automated scoring using the judge protocol, plus human evaluation of constitutional compliance

### Metrics
- Constitutional compliance rate (percentage of responses that follow each principle)
- Quality degradation per removed principle
- Interaction effects (does removing one principle affect compliance with others?)
- User trust rating (how much users trust the response)

### Success Criteria
- Each principle contributes measurably to compliance with its target dimension
- Removing "Present both sides fairly" reduces fairness scores by at least 0.5 points
- Removing "Show uncertainty when uncertain" reduces confidence calibration by at least 0.3 points
- The full constitution outperforms all subsets

### Expected Outcome
We expect "Present both sides fairly" and "Challenge assumptions" to have the largest individual impact, while "Acknowledge when the counter-argument wins" may have a smaller standalone effect but a significant interaction with other principles.

---

## Experiment 3: Bias Detection Accuracy (Benchmark)

### Hypothesis
The agent's bias detection pipeline correctly identifies cognitive biases in user framing and model reasoning at rates significantly above chance, with precision and recall both exceeding 0.7 for the top 5 biases.

### Methodology
- **Dataset**: 200 questions annotated with known biases (created by researchers who deliberately introduce specific biases into question framing)
- **Biases tested**: Confirmation bias, anchoring, availability heuristic, sunk cost fallacy, planning fallacy
- **Condition**: Agent processes each question and reports detected biases
- **Ground truth**: Researcher annotations indicating which bias(es) are present

### Metrics
- Per-bias precision, recall, and F1 score
- Overall accuracy (percentage of correct bias classifications)
- False positive rate (bias detected when none present)
- False negative rate (bias present but not detected)
- Calibration of bias confidence scores

### Success Criteria
- Overall F1 score > 0.7
- No individual bias has F1 < 0.6
- False positive rate < 0.2
- Confidence scores correlate with accuracy (well-calibrated)

### Expected Outcome
We expect strong performance on confirmation bias detection (the counter-argument stage naturally surfaces it) and weaker performance on sunk cost fallacy (which requires understanding of the user's investment history). Anchoring detection should be moderate — it requires sensitivity to numerical patterns.

---

## Experiment 4: User Decision Quality (Longitudinal Study)

### Hypothesis
Users who use the Adversarial Reviewer for decision support over a 3-month period will report higher decision satisfaction and demonstrate improved decision outcomes compared to their own baseline (before using the agent) and compared to users of a standard AI assistant.

### Methodology
- **Participants**: 30 professionals in decision-intensive roles (product managers, investors, consultants, engineering leads)
- **Duration**: 3 months
- **Groups**:
  1. Treatment (n=15): Use the Adversarial Reviewer for real decisions
  2. Control (n=15): Use a standard AI assistant (single-pass generation)
- **Data collection**:
  - Pre-study survey: Baseline decision confidence, past decision satisfaction, self-assessed bias awareness
  - Weekly: Log 2-3 decisions made with agent support, rate decision quality (1-5), note whether the agent's debate changed their initial inclination
  - Post-study survey: Decision satisfaction, bias awareness, trust in the agent, perceived value of the debate process
  - 3-month follow-up: Retrospective assessment of decisions made during the study

### Metrics
- Self-reported decision satisfaction (pre vs. post, treatment vs. control)
- Percentage of decisions where the debate changed the user's initial inclination
- Retrospective decision quality (how well did the decisions hold up over 3 months?)
- Bias awareness improvement (pre vs. post survey)
- Agent trust score evolution over time
- Net Promoter Score for each tool

### Success Criteria
- Treatment group reports statistically higher decision satisfaction than control (p < 0.05)
- Debate changes user's initial inclination in at least 20% of decisions (indicating the agent provides non-obvious value)
- Treatment group shows greater improvement in bias awareness
- 3-month retrospective shows treatment group decisions aged better

### Expected Outcome
We expect the treatment group to report moderate improvement in decision satisfaction (the agent catches some but not all errors), with the strongest effects in domains where the user is less experienced. The debate process should change the user's mind in 25-35% of cases. Bias awareness should improve as users see their own biases flagged repeatedly.

---

## Metrics Summary

| Metric | Collection Method | Target |
|--------|-------------------|--------|
| Response quality | Human evaluation (1-5 scale) | > 0.3 improvement vs. baseline |
| Constitutional compliance | Automated + human review | > 90% compliance rate |
| Bias detection F1 | Benchmark against annotated data | > 0.70 |
| Decision satisfaction | User self-report (1-5 scale) | > 0.5 improvement vs. baseline |
| Mind-change rate | Decision logs | > 20% of decisions |
| Cost per query | Token counting | < $0.02 per debate cycle |
| Latency | Time measurement | < 15 seconds total |
| User retention | 3-month follow-up | > 80% continued use |

---

## Experimental Timeline

| Phase | Duration | Activities |
|-------|----------|-----------|
| Preparation | 2 weeks | Build evaluation infrastructure, recruit participants, create datasets |
| Experiment 1 (A/B test) | 2 weeks | Run 100-question evaluation, collect ratings |
| Experiment 2 (Ablation) | 2 weeks | Run 7-variant evaluation, analyze results |
| Experiment 3 (Benchmark) | 2 weeks | Create annotated dataset, run bias detection, compute metrics |
| Experiment 4 (Longitudinal) | 12 weeks | Recruit users, run 3-month study, collect follow-up data |
| Analysis & Writing | 2 weeks | Statistical analysis, write results, identify improvements |

---

## Threats to Validity

### Internal Validity
- **Selection bias**: Participants in the longitudinal study may self-select based on interest in decision-making, which may not generalize.
- **Hawthorne effect**: Users may make better decisions simply because they know they're being studied, not because of the agent.
- **Evaluator fatigue**: Human evaluators rating 100+ responses may develop fatigue effects.

### External Validity
- **Domain specificity**: Results on investment/strategy questions may not generalize to other domains like code review or legal analysis.
- **Model specificity**: Results with DeepSeek may not generalize to other LLM providers.
- **Constitution specificity**: Results with the default constitution may not hold for user-customized constitutions.

### Mitigation
- Use diverse question sets spanning multiple domains
- Include a "no-agent" control in the longitudinal study (users make decisions without AI)
- Counterbalance evaluation order to reduce fatigue effects
- Run follow-up experiments with different models and constitutions

---

## References

- Cohen, R., et al. "LM vs LM: Detecting hallucinations via cross-examination." arXiv:2305.13281, 2023.
- Du, Y., et al. "Improving Factuality and Reasoning in Language Models through Multiagent Debate." arXiv:2305.14325, 2023.
- Bai, Y., et al. "Constitutional AI: Harmlessness from AI Feedback." arXiv:2212.08073, 2022.
- Irving, G., Christiano, P., & Amodei, D. "AI Safety via Debate." arXiv:1805.00899, 2018.
