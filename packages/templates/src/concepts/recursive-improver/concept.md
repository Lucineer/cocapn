# Recursive Improver

## Overview

The Recursive Improver is a self-upgrading agent concept: an AI that systematically reviews its own past responses, identifies weaknesses, and updates its knowledge and behavior to improve over time. Unlike agents that only learn from external feedback, the Recursive Improver develops an internal improvement loop — a self-supervised cycle of reflection, evaluation, and adaptation.

This concept is built on a simple but powerful observation: **an agent's own output is a rich source of training data about its own capabilities**. Every response the agent generates contains implicit information about what it knows well and where it falls short. By systematically mining this data, the agent can chart its own improvement trajectory.

## Why This Is Novel

Most AI agents operate in a purely reactive mode — they receive input, produce output, and move on. They have no mechanism for learning from their own output. When they make mistakes, those mistakes are either corrected by external feedback (a user says "that's wrong") or they persist indefinitely.

The Recursive Improver closes this loop by treating its own responses as first-class training data. It doesn't need an external teacher. It becomes its own critic, its own coach, and its own curriculum designer.

Key novelties:

1. **Self-supervised improvement from own output**: The agent generates its own training signal by evaluating past responses against quality criteria.
2. **Personality as version-controlled code**: soul.md is a modifiable personality definition tracked in git, making self-improvement auditable and reversible.
3. **Transparent improvement ledger**: The growth log provides a complete, inspectable record of what changed, why, and what impact it had.
4. **Meta-learning applied to self-improvement**: The agent doesn't just improve — it learns which improvement strategies work best, accelerating its own learning rate over time.

## The Self-Review Cycle

The core mechanism is a structured self-review cycle that runs periodically:

```
1. SAMPLE: Select N past responses from the conversation history
2. EVALUATE: Score each response against quality dimensions (accuracy, helpfulness, completeness, tone)
3. IDENTIFY: Detect patterns in low-scoring responses — recurring error types, knowledge gaps, tonal issues
4. STRATEGIZE: Generate improvement strategies for each identified pattern
5. PROPOSE: Create concrete proposals for changes to soul.md, wiki, or knowledge base
6. LOG: Record the review findings, proposed changes, and expected impact in the growth log
7. AWAIT: Present proposals to the user for approval before applying changes
```

This cycle is not a one-time event. It runs on a configurable interval (default: daily) and produces a compounding effect — each review is informed by the accumulated wisdom of all previous reviews.

### Sampling Strategy

The agent doesn't review every response. Instead, it uses a stratified sampling approach:

- **Recent responses** (60%): Focus on the most recent interactions to catch regressions quickly
- **Low-confidence responses** (20%): Responses where the agent was uncertain are rich learning opportunities
- **Random responses** (20%): Prevent bias by including unexpected samples

### Evaluation Dimensions

Each response is evaluated across four dimensions, scored 1-5:

| Dimension | What it measures |
|-----------|-----------------|
| **Accuracy** | Factual correctness, absence of hallucinations |
| **Helpfulness** | How well the response addressed the user's actual need |
| **Completeness** | Whether important aspects were omitted |
| **Tone** | Alignment with the personality defined in soul.md |

These scores are tracked over time to produce improvement trajectories for each dimension.

## Soul.md as Self-Modifiable Personality

The soul.md file is the agent's personality definition. In the Recursive Improver, it becomes a living document that the agent can propose changes to:

### Version Control Through Git

Every proposed change to soul.md follows this protocol:

1. The agent generates a diff describing what it wants to change and why
2. The diff is presented to the user as a git-style patch
3. The user reviews, accepts, modifies, or rejects
4. Accepted changes are committed to git with a message describing the improvement rationale
5. The commit history becomes an auditable trail of the agent's personality evolution

This is critical for safety: the agent never modifies its own personality without human oversight. Every change is traceable, reversible, and explainable.

### What Gets Modified

Typical soul.md modifications include:

- Adjusting personality traits based on user feedback patterns
- Adding new knowledge domains when gaps are discovered
- Refining behavioral rules when edge cases are identified
- Updating tone guidelines when tone evaluation scores are consistently low
- Adding new "What I Don't Do" rules when the agent identifies behaviors to avoid

## Growth Logging

The growth log is the agent's improvement ledger. Each entry contains:

```json
{
  "id": "gl-2026-03-30-001",
  "date": "2026-03-30",
  "trigger": "self-review",
  "finding": "Consistently omitting edge cases in code review responses",
  "evidence": [
    "Response 3/15 missed null check pattern",
    "Response 7/15 missed error handling pattern",
    "Response 12/15 missed race condition pattern"
  ],
  "strategy": "Add explicit edge-case checklist to code review procedure",
  "proposedChanges": [
    {
      "target": "soul.md",
      "diff": "+ ## Code Review Checklist\n+ - Null/undefined checks\n+ - Error handling paths\n+ - Race conditions\n+ - Boundary conditions",
      "status": "proposed"
    }
  ],
  "metrics": {
    "accuracy": { "before": 3.2, "after": null },
    "helpfulness": { "before": 3.8, "after": null },
    "completeness": { "before": 2.9, "after": null },
    "tone": { "before": 4.1, "after": null }
  },
  "status": "pending-approval"
}
```

After the change is applied and enough new responses are collected, the entry is updated with "after" metrics to measure actual improvement.

## Research Foundations

### Meta-Learning (Thrun & Pratt, 1998)

"Learning to learn" — the study of systems that improve their own learning process. The Recursive Improver applies meta-learning by tracking which review strategies produce the most improvement and adapting its review process accordingly. If evaluating tone turns out to be less productive than evaluating completeness, the agent shifts focus.

### Growth Mindset (Dweck, 2006)

Carol Dweck's research on growth vs. fixed mindsets applies directly to AI agent design. A "fixed mindset" agent treats its capabilities as static. A "growth mindset" agent treats capabilities as developable through effort and feedback. The growth log operationalizes this by making improvement visible and celebrated.

### Deliberate Practice (Ericsson, 1993)

Anders Ericsson's research on expertise development emphasizes targeted practice on weaknesses, not just repetition. The Recursive Improver doesn't review random responses — it deliberately targets areas where evaluation scores are lowest, concentrating improvement effort where it matters most.

### Self-Supervised Learning

The agent generates its own labels (evaluation scores) and uses them to improve. This is analogous to self-supervised learning in deep learning, where models create training signals from the data itself rather than relying on external annotation.

### Automated Prompt Engineering (Zhou et al., 2022)

Automated Prompt Engineering (APE) showed that LLMs can generate and evaluate their own prompts. The Recursive Improver extends this by treating the entire soul.md as a self-refinable prompt, not just instruction text.

### Constitutional AI (Anthropic, 2022)

Constitutional AI uses self-critique to improve model outputs. The Recursive Improver adopts a similar principle but applies it at the personality level — the agent critiques its own behavioral patterns, not just individual outputs.

## Connection to Cocapn

The Recursive Improver concept is deeply aligned with the cocapn paradigm:

- **soul.md changes are git commits**: Every personality modification is version-controlled, auditable, and reversible. The agent's evolution is a git log.
- **Growth log is in brain memories**: Improvement data is stored in the brain's memory system, giving the agent persistent access to its improvement history across sessions.
- **Wiki updates are knowledge acquisition**: When the agent identifies knowledge gaps, it adds to its wiki, expanding its knowledge base through self-directed learning.
- **The repo IS the agent**: Self-improvement isn't a separate system — it's the agent modifying its own repository, which IS itself.
- **Two-repo privacy model**: Self-review happens in the private repo. Public-facing improvements are published through the normal publishing pipeline.

## Safety Considerations

Self-improving systems raise important safety questions. The Recursive Improver addresses these through:

1. **Human approval gate**: No soul.md change is applied without user approval
2. **Immutable growth log**: The log records everything, including failed experiments and rejected proposals
3. **Reversibility**: Any change can be reverted via git
4. **Bounded improvement**: The agent improves within the constraints of its model and doesn't modify its own code
5. **Transparency**: The entire improvement process is visible and inspectable by the user

## Future Directions

- **Collaborative self-improvement**: Multiple Recursive Improvers sharing improvement strategies via fleet protocol
- **Cross-domain transfer**: Applying improvement strategies that work in one domain to new domains
- **Predictive self-improvement**: Using past improvement trajectories to predict where the agent will struggle next
- **User-specific adaptation**: Tailoring the improvement focus to individual user needs and priorities
