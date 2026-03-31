# Constitutional AI

## Overview

Constitutional AI (CAI) is an approach to AI alignment developed by Anthropic, introduced in the paper "Constitutional AI: Harmlessness from AI Feedback" (Bai et al., 2022). The core idea is to train language models to follow an explicit set of principles — a "constitution" — rather than relying solely on implicit learning from human preference data.

The Adversarial Reviewer agent adapts this concept for runtime application. Instead of baking constitutional principles into model weights during training, the agent applies them as a structured review step during inference. This makes the alignment process transparent, configurable, and auditable.

---

## How Constitutional AI Works

The original CAI training process has two main phases:

### Phase 1: Supervised Learning from Critiques

1. The model generates a response to a potentially harmful prompt.
2. The model is asked to critique its own response using constitutional principles. For example: "Identify the most harmful aspect of your response and explain which principle it violates."
3. The model revises its response based on the critique. The revision instruction is: "Please rewrite your response to address the critique, following the constitutional principle: [principle]."
4. This critique-revision cycle produces a dataset of (prompt, revised_response) pairs.
5. The model is fine-tuned on these pairs using supervised learning.

### Phase 2: Reinforcement Learning from AI Feedback (RLAIF)

1. The model generates two responses to each prompt.
2. The model evaluates which response better follows the constitution, acting as its own judge.
3. This produces a preference dataset without requiring human labelers.
4. A preference model is trained on this dataset.
5. The language model is fine-tuned using RL against the preference model.

The key insight is that the model is both the generator and the evaluator, but it evaluates against explicit principles rather than implicit preferences. This creates a form of scalable oversight — the model can improve its behavior on dimensions that are specified in the constitution, even without direct human feedback on every example.

---

## The Constitution as a Configurable Set of Principles

In the original CAI paper, the constitution used by Anthropic included principles like:
- "Choose the response that is most helpful, honest, and harmless."
- "Choose the response that is least intended to deceive or manipulate."
- "Choose the response that is least likely to be perceived as harassment or hate speech."

The Adversarial Reviewer extends this concept by making the constitution user-configurable. The default constitution in `config.yml` includes:

1. **Prioritize truth over comfort** — do not sugarcoat inconvenient facts.
2. **Show uncertainty when uncertain** — calibrated confidence over false precision.
3. **Challenge assumptions, especially confident ones** — confidence is a signal to dig deeper.
4. **Present both sides fairly** — steel-man, not straw-man.
5. **Acknowledge when the counter-argument wins** — the goal is truth, not face.

Users can modify these principles through brain memory (stored as `constitution.*` facts), allowing the agent's behavior to evolve with the user's values and experience. This is a significant departure from the training-time approach: rather than a fixed constitution that requires retraining to change, the runtime constitution is living and adaptable.

---

## How the Agent Applies Constitutional Review

The Adversarial Reviewer applies constitutional review at a specific point in the pipeline:

1. **Initial generation** — The model generates a response normally.
2. **Constitutional critique** — A second prompt asks the model to evaluate the initial response against each constitutional principle, identifying any violations or concerns.
3. **Counter-argument generation** — Using the identified weaknesses, the model generates the strongest possible counter-argument (this serves as both critique and red-team analysis).
4. **Evaluation** — A judge prompt evaluates both the original response and the counter-argument, checking each against the constitutional principles.
5. **Synthesis** — The final output incorporates the constitutional evaluation, showing the user which principles were at play and how they influenced the conclusion.

This process ensures that every significant response has been checked against the full constitution before it reaches the user. The user sees not just the final answer, but the constitutional reasoning that shaped it.

---

## Comparison with RLHF and DPO

| Aspect | RLHF | DPO | Constitutional AI (Training) | Constitutional AI (Runtime, this agent) |
|--------|------|-----|------------------------------|----------------------------------------|
| Where alignment happens | Training | Training | Training | Inference |
| Principles | Implicit in human preferences | Implicit in preference pairs | Explicit constitution | Explicit constitution |
| Modifiability | Requires retraining | Requires retraining | Requires retraining | Edit config/brain |
| Transparency | Low | Low | Medium | High |
| Cost per query | Standard | Standard | Standard | 3-4x standard |
| Scalability | Limited by human labelers | Limited by preference data | Scales with AI feedback | Scales with compute |

**RLHF** (Reinforcement Learning from Human Feedback) learns alignment implicitly from human preference data. It's effective but opaque — the model's values are encoded in weights, not in readable principles.

**DPO** (Direct Preference Optimization) simplifies RLHF by eliminating the reward model, directly optimizing from preference pairs. It shares RLHF's opacity problem.

**Training-time CAI** externalizes the principles but still bakes them into weights. Changing the constitution requires retraining.

**Runtime CAI** (this agent) applies principles at inference time. This is more expensive per query but fully transparent and immediately modifiable. The trade-off is intentional: for high-stakes decisions, the extra cost is justified by the improved quality and transparency.

---

## Practical Benefits for Users

1. **Auditability**: Every constitutional evaluation is logged. Users can review why the agent reached a conclusion and which principles influenced it.

2. **Personalization**: Different users can have different constitutions. A financial analyst might prioritize "challenge assumptions about market efficiency," while a software architect might prioritize "identify failure modes in distributed systems."

3. **Evolution**: As users gain experience with the agent, they can refine the constitution based on what works. Principles that consistently produce better outcomes can be weighted more heavily; principles that miss important considerations can be revised.

4. **Trust**: Transparency breeds trust. When users can see the constitutional reasoning, they can develop calibrated trust in the agent's output — knowing what it checks for and what it doesn't.

5. **Accountability**: In professional settings, having an explicit constitution provides accountability. If the agent gives bad advice, the constitution can be examined to understand why — and improved for the future.

---

## References

- Bai, Y., Kadavath, S., Kundu, S., et al. "Constitutional AI: Harmlessness from AI Feedback." arXiv:2212.08073, December 2022.
- Christiano, P. "Deep RL from Human Preferences." NeurIPS 2017.
- Rafailov, R., et al. "Direct Preference Optimization: Your Language Model is Secretly a Reward Model." NeurIPS 2023.
- Anthropic. "Core Views on AI Safety." Blog post, 2023.

---

## See Also

- [Debate Methods](./debate-methods.md) — How self-play debate complements constitutional review
- [Cognitive Biases](./cognitive-biases.md) — How bias detection integrates with constitutional principles
- [Implementation Notes](../implementation-notes.md) — Technical details of the constitutional review pipeline
