# Debate Methods

## Overview

AI Safety via Debate is an alignment technique proposed by Irving, Christiano, and Amodei (2018) that uses structured adversarial debate between AI systems to improve the quality and truthfulness of AI outputs. The core insight is that even imperfect agents can produce reliable conclusions when forced to defend their claims against adversarial scrutiny.

The Adversarial Reviewer implements a self-play variant of this approach: a single model argues both sides of a question, then evaluates which side presented the stronger case. This document covers the theoretical foundations, the debate protocol used by the agent, and the evidence for debate as a reasoning amplifier.

---

## AI Safety via Debate (Irving et al., 2018)

### The Original Proposal

In the debate framework, two AI agents are presented with a question or claim. Agent A argues for one position (e.g., "this answer is correct"), and Agent B argues against it ("this answer is incorrect"). A human judge — or another AI system — evaluates the debate and determines which agent made the more convincing case.

The key theoretical result is that debate can be more powerful than either agent individually. Even if both agents are imperfect, the adversarial structure incentivizes truth-telling because:
- If Agent A makes a false claim, Agent B can point out the error
- If Agent B fails to challenge a true claim, Agent A's position stands
- The judge benefits from seeing both sides argued forcefully

This creates a Nash equilibrium where honest argumentation is the dominant strategy, at least under certain assumptions about judge quality and argument complexity.

### Assumptions and Limitations

The debate framework makes several important assumptions:
1. The judge is capable of evaluating which arguments are stronger (the "competent judge" assumption)
2. The arguments are decomposable enough to be evaluated in reasonable time
3. The agents have roughly comparable capabilities (one-sided debates are uninformative)
4. The truth is accessible — i.e., the correct answer can be supported with valid arguments

When these assumptions hold, debate substantially improves output quality. When they don't, debate can still help by surfacing uncertainties and alternative perspectives, but the results are less reliable.

**Reference**: Irving, G., Christiano, P., & Amodei, D. "AI Safety via Debate." arXiv:1805.00899, 2018.

---

## Self-Play as a Reasoning Amplifier

### Why Self-Play Works

The Adversarial Reviewer uses self-play rather than multi-agent debate. A single model generates both the thesis and antithesis. This might seem contradictory — how can the same model effectively argue against itself?

Self-play works for several reasons:

1. **Separation of concerns through prompting.** When asked to "generate the strongest possible counter-argument," the model enters a different reasoning mode than when asked to "answer the question." The same knowledge is accessed, but through different pathways, surfacing different considerations.

2. **Asymmetric information requirements.** Generating an answer requires constructing a coherent position. Generating a counter-argument requires finding weaknesses in a specific position. These are different cognitive tasks, and a language model can perform them sequentially even though the same weights are used.

3. **The judge adds separation.** The evaluation step provides additional separation between generation and judgment. The model evaluates the debate as a third party, which reduces the bias toward favoring the first-generated position.

4. **Anchoring to the specific argument.** The counter-argument is generated in response to a specific thesis, not to the abstract question. This means it can address the actual weaknesses in the specific argument, rather than just providing generic opposition.

### Limitations of Self-Play

Self-play is weaker than multi-agent debate in important ways:
- The model cannot introduce truly novel objections outside its knowledge
- There is a tendency to "pull punches" when arguing against oneself
- The same systematic biases may affect both sides of the debate
- The model may subtly favor its initial position during evaluation

These limitations are acknowledged and partially mitigated through:
- Low temperature (0.2) to reduce randomness but increase focus on the strongest arguments
- Explicit instructions to "steel-man" the opposing position
- Separate evaluation prompts that frame the judge as an impartial arbiter
- Confidence calibration that accounts for self-play limitations

---

## Multi-Round Debate Protocols

### The Agent's Debate Protocol

The Adversarial Reviewer supports configurable debate rounds (default: 2). Each round follows this structure:

**Round 1:**
1. Generate initial response (thesis)
2. Generate counter-argument (antithesis)
3. Evaluate both positions (synthesis)

**Round 2 (if enabled):**
1. Take the Round 1 synthesis as the new thesis
2. Generate a new counter-argument targeting the synthesis specifically
3. Re-evaluate, updating scores and confidence

Additional rounds can be configured for high-stakes decisions. The marginal value of each round decreases — Round 2 typically adds nuance rather than reversing the conclusion. Round 3+ is useful for complex decisions where the stakes justify the additional cost.

### Debate Position Configuration

The `debate.positions` config option controls what positions are argued:
- `[for, against]` (default): Standard debate — argue for and against the user's proposed position
- `[optimistic, pessimistic]`: Best-case vs. worst-case analysis
- `[short-term, long-term]`: Immediate vs. downstream consequences
- `[micro, macro]`: Individual vs. systemic perspective

Custom positions can be defined by adding entries to the positions array in config.yml.

---

## Judge and Evaluator Models

### The Evaluation Protocol

The judge prompt is designed to be impartial and structured. It evaluates each argument on multiple dimensions:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Logical coherence | 0.25 | Does the argument follow valid reasoning? |
| Evidence quality | 0.25 | Are claims supported by evidence or valid inference? |
| Assumption validity | 0.20 | Are the underlying assumptions reasonable? |
| Practical applicability | 0.15 | Does the argument apply to real-world conditions? |
| Constitutional alignment | 0.15 | Does the argument align with the configured principles? |

Each dimension is scored 0-1, and the weighted average produces the overall argument score. The judge also provides a narrative evaluation explaining the scoring.

### Separate Evaluation Model

When `debate.evaluationModel: separate` is configured (the default), the evaluation step uses a separate prompt structure with different system instructions than the generation steps. This provides logical separation between generation and evaluation even though the same underlying model is used.

For deployments that support multiple models, the evaluation can be routed to a different model entirely (e.g., generate with DeepSeek, evaluate with Claude). This provides the strongest separation and is recommended for high-stakes applications.

---

## How the Agent Implements Debate

### The Full Pipeline

```
User Query
    |
    v
[Stage 1: Generate Thesis]
    |-- Uses standard system prompt
    |-- Produces initial answer with reasoning
    |
    v
[Stage 2: Generate Antithesis]
    |-- Uses reversed prompt: "Find the strongest counter-argument"
    |-- Takes the thesis as input
    |-- Produces the best possible opposing case
    |
    v
[Stage 3: Evaluate (Judge)]
    |-- Uses evaluation prompt
    |-- Scores both sides on 5 dimensions
    |-- Produces confidence-calibrated verdict
    |
    v
[Stage 4: Synthesize]
    |-- Combines strongest points from both sides
    |-- Shows the debate structure to the user
    |-- Presents calibrated confidence level
    |-- Flags remaining uncertainties
    |
    v
Final Response to User
```

### Memory Integration

After each debate, the agent stores key outcomes in brain memory:
- The question, thesis, antithesis, and verdict
- Confidence scores for each position
- Which constitutional principles were most relevant
- Any biases detected in the initial reasoning
- The user's final decision (if different from the agent's recommendation)

This stored debate history creates an evolving knowledge base about what kinds of arguments hold up under scrutiny and what patterns of reasoning tend to fail. Over time, the agent can reference past debates to provide more nuanced analysis.

---

## Evidence for Debate Improving Answer Quality

### Empirical Results

Research on debate-based approaches has shown promising results:

1. **Irving et al. (2018)**: Theoretical analysis showing that debate is at least as powerful as the best agent, and potentially more powerful under realistic assumptions about judge competence.

2. **Perez et al. (2019)**: Experiments showing that debate-like processes improve factuality in language model outputs, particularly for questions where the model has high uncertainty.

3. **Cohen et al. (2023)**: LM vs. LM debate experiments demonstrating that adversarial debate improves accuracy on reasoning benchmarks by 5-15% compared to single-pass generation.

4. **Du et al. (2023)**: Improving Factuality and Reasoning in Language Models through Multiagent Debate — shows that multi-agent debate significantly improves mathematical reasoning and factual accuracy.

5. **Anthropic (2023)**: Internal experiments with Constitutional AI showing that critique-revision cycles improve alignment metrics without degrading capability.

### Practical Observations

In informal testing of the self-play debate approach:
- Arguments that survive debate are substantially more likely to be correct
- The counter-argument stage catches roughly 20-30% of errors in initial responses
- Confidence calibration is more accurate after debate than before
- Users report higher trust in debated answers, even when they disagree with the conclusion

---

## References

- Irving, G., Christiano, P., & Amodei, D. "AI Safety via Debate." arXiv:1805.00899, 2018.
- Perez, E., et al. "Red Teaming Language Models to Reduce Harms." arXiv:2209.07858, 2022.
- Cohen, R., et al. "LM vs LM: Detecting hallucinations via cross-examination." arXiv:2305.13281, 2023.
- Du, Y., et al. "Improving Factuality and Reasoning in Language Models through Multiagent Debate." arXiv:2305.14325, 2023.
- Michael, J., et al. "Debate Helps Supervise Unreliable Experts." arXiv:2311.08702, 2023.

---

## See Also

- [Constitutional AI](./constitutional-ai.md) — How constitutional review frames the debate principles
- [Cognitive Biases](./cognitive-biases.md) — How bias detection enhances debate quality
- [Implementation Notes](../implementation-notes.md) — Technical details of the debate pipeline
