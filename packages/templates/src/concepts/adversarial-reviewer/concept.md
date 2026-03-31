# Adversarial Reviewer

## A Self-Playing Devil's Advocate Agent for Decision Quality

---

### Overview

The Adversarial Reviewer is a concept agent that embodies a fundamentally different approach to AI-assisted decision-making. Instead of generating a single answer and presenting it as truth, this agent treats every response as a hypothesis that must survive adversarial scrutiny before it reaches the user. It is built on three pillars: Constitutional AI, self-play debate, and cognitive bias detection.

The core insight is simple but powerful: **a single LLM call is an opinion. A structured debate is evidence.**

Most AI agents answer questions. The Adversarial Reviewer stress-tests its own answers before showing them to you. It generates an initial response, then immediately generates the strongest possible counter-argument, evaluates both sides using a judge protocol, and presents the synthesized result with full transparency about the debate that produced it.

---

### Why This Is Novel

The standard paradigm for AI assistants is: user asks question, model generates answer, answer is shown to user. This pipeline has a critical weakness — it optimizes for fluency and helpfulness, not for truth or robustness. The model will confidently present a plausible-sounding answer even when the reasoning is flawed.

The Adversarial Reviewer breaks this paradigm in several ways:

1. **Every answer is debated before delivery.** The agent does not present a conclusion until it has argued both sides. This means the user receives not just an answer, but the process that produced it — including the strongest objections to that answer.

2. **The constitution is configurable and transparent.** Unlike RLHF-trained models where the values are baked into weights, the Adversarial Reviewer's principles are explicit, version-controlled, and auditable. The user can see exactly what principles govern the agent's analysis and modify them.

3. **Bias detection is structural, not incidental.** Rather than hoping the model avoids biases, the agent actively scans for cognitive biases in both its own reasoning and the user's framing. This is built into the pipeline, not bolted on as an afterthought.

4. **The debate history becomes accumulated wisdom.** In the cocapn paradigm, the repo IS the agent. Every debate the agent conducts is stored in brain memory, creating a growing body of evidence about what arguments hold up under scrutiny and what patterns of reasoning tend to fail. The agent gets better over time not just from model improvements, but from its own accumulated debate history.

---

### Theoretical Foundations

#### Constitutional AI (Bai et al., 2022)

Anthropic's Constitutional AI (CAI) framework trains language models to follow a set of explicit principles — a "constitution" — during the training process. The model learns to critique its own outputs, revise them according to the constitution, and generate responses that are more aligned with the stated principles.

The key innovation is that the principles are externalized: rather than learning values implicitly from human preference data (as in standard RLHF), the model learns to reason about explicit rules. This makes the alignment process more interpretable and auditable.

The Adversarial Reviewer applies this at inference time rather than training time. Instead of baking the constitution into the model weights, it applies constitutional review as a runtime pipeline stage. This means:
- The constitution can be changed without retraining
- Different users can have different constitutions
- The constitutional reasoning is fully visible to the user
- Principles can be added, removed, or modified based on experience

**Reference**: Bai, Y., et al. "Constitutional AI: Harmlessness from AI Feedback." arXiv:2212.08073, 2022.

#### AI Safety via Debate (Irving et al., 2018)

Geoffrey Irving, Paul Christiano, and Dario Amodei proposed using debate between AI systems as a method for aligning AI behavior with human values. The core idea: two AI agents argue for opposing positions, and a human (or another AI) judges which argument is stronger. Even if both agents are imperfect, the debate process tends to surface truth because flawed arguments are exploitable by the opposing side.

The Adversarial Reviewer implements a simplified version of this: a single model plays both sides of a debate, then evaluates the result. This is less powerful than a true multi-agent debate (where different models argue different sides), but it has practical advantages:
- Lower cost (one model, one API key)
- Simpler deployment (no coordination overhead)
- Consistent behavior (same model, same reasoning style)
- Still captures most of the benefit (the counter-argument stage forces the model to find weaknesses)

**Reference**: Irving, G., Christiano, P., & Amodei, D. "AI Safety via Debate." arXiv:1805.00899, 2018.

#### Red Teaming Methodologies

In cybersecurity, red teaming involves simulating adversarial attacks to find vulnerabilities before real adversaries do. The same principle applies to reasoning: before trusting a conclusion, simulate the strongest possible attack on it.

The Adversarial Reviewer applies red team methodology to intellectual arguments:
- **Threat modeling**: What assumptions could be wrong?
- **Attack surface analysis**: What parts of the argument are most vulnerable?
- **Exploit development**: Constructing the strongest possible counter-arguments
- **Impact assessment**: How bad would it be if the counter-argument is correct?
- **Remediation**: How could the original argument be strengthened?

---

### How It Works: The Dual-Prompt Architecture

The agent operates through a four-stage pipeline for every significant response:

**Stage 1: Generate Initial Response**
The user's query is processed normally. The model generates its best answer to the question, including reasoning and evidence. This is the "thesis" — the agent's initial position.

**Stage 2: Generate Counter-Argument**
A second prompt is constructed with the instruction: "Given the following question and proposed answer, generate the strongest possible counter-argument. Steel-man the opposing position. Find every weakness, unsupported assumption, and potential failure mode." This produces the "antithesis."

**Stage 3: Evaluate Both Sides**
A third prompt (the "judge") evaluates both the thesis and antithesis. It scores each argument on:
- Logical coherence
- Evidence quality
- Assumption validity
- Practical applicability
- Alignment with the constitutional principles

**Stage 4: Synthesize Final Answer**
The final response presents the synthesized conclusion, along with:
- The strongest points from each side
- The judge's evaluation and confidence scores
- Remaining uncertainties and caveats
- Recommendation with calibrated confidence level

This four-stage process costs approximately 3-4x a single LLM call, but produces substantially higher-quality output for consequential decisions.

---

### Connection to the Cocapn Paradigm

The cocapn paradigm states: THE REPO IS THE AGENT. This has profound implications for the Adversarial Reviewer:

**Debate history is accumulated wisdom.** Every debate the agent conducts is stored in brain memory (memories.json, with confidence decay). Over time, the agent builds a corpus of past debates, successful red-team catches, and identified biases. This corpus becomes part of the repo's identity — the agent literally knows what arguments tend to fail because it has debated them before.

**The constitution evolves with the user.** The constitutional principles are stored as facts in brain memory, prefixed with `constitution.*`. The user can add, modify, or remove principles, and the agent will apply the updated constitution in subsequent debates. This creates a virtuous cycle: the user learns what principles matter to them, and the agent gets better at applying them.

**Self-knowledge through repo-understanding.** The RepoLearner module (planned) will analyze the agent's own debate history to identify patterns: topics where the agent tends to be overconfident, types of arguments that consistently fail under scrutiny, areas where the user's judgment has been better than the agent's. This meta-cognitive layer makes the agent genuinely self-improving.

**Two repos, one debate.** In the private repo, the full debate history is stored — including raw counter-arguments, judge evaluations, and confidence scores. In the public repo, only the synthesized conclusions are visible. This maintains the privacy boundary while still presenting high-quality analysis publicly.

**Fleet coordination.** When deployed as part of a fleet, multiple Adversarial Reviewer instances can coordinate debates across repos. Agent A argues FOR, Agent B argues AGAINST, and a third agent judges. This multi-agent debate is more powerful than self-play and is a natural fit for the fleet-of-repos architecture.

---

### Potential Applications

**Decision-Making Support**
Help executives, founders, and managers make better decisions by stress-testing their reasoning before they commit. Particularly valuable for high-stakes decisions where the cost of being wrong is significant.

**Code Review Automation**
Go beyond linting and style checking. The agent can debate whether a piece of code is correct, secure, and maintainable — generating counter-arguments about potential bugs, security vulnerabilities, and architectural issues.

**Investment Analysis**
Generate bullish and bearish cases for investment decisions, evaluate both sides, and present a calibrated confidence assessment. Identify cognitive biases in the analyst's reasoning (e.g., anchoring on recent performance, confirmation bias in selective evidence).

**Policy Review**
Analyze proposed policies by arguing both for and against implementation. Identify unintended consequences, edge cases, and distributional effects that might not be obvious from a single-pass analysis.

**Research Validation**
Before publishing research findings, subject them to adversarial review. Generate the strongest possible challenges to the methodology, interpretation, and conclusions. This is essentially automated peer review.

**Product Strategy**
Stress-test product decisions by generating counter-arguments about market fit, competitive dynamics, and technical feasibility. Help teams avoid groupthink by providing a structured dissenting voice.

**Legal Argument Preparation**
Argue both sides of a legal case to identify weaknesses in your own position and anticipate the opposing counsel's strongest arguments. Useful for both litigation prep and contract negotiation.

---

### Limitations and Honest Assessment

The Adversarial Reviewer is not a silver bullet. Important limitations:

- **Same-model debate is weaker than multi-model debate.** A single model arguing with itself is limited by its own knowledge and reasoning capacity. It cannot introduce truly novel objections that it hasn't been trained on.
- **Cost is 3-4x a standard call.** The four-stage pipeline requires multiple LLM invocations. This is acceptable for high-stakes decisions but wasteful for simple queries.
- **Constitutional principles reflect the user's values, which may be wrong.** The agent applies the configured constitution faithfully, but if the constitution itself contains flawed principles, the output will reflect those flaws.
- **Debate can create false confidence.** Seeing both sides argued forcefully might make users more confident in their ability to judge, even when the debate missed important considerations.
- **Latency is higher.** The multi-stage pipeline adds 2-4 seconds per response compared to a single call.

These limitations are acknowledged in the agent's own output. The agent is designed to be honest about what it cannot do, which is itself a constitutional principle.
