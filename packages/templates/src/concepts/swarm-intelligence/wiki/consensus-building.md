# Consensus Building and Multi-Agent Agreement

## Overview

Consensus building is the process by which diverse perspectives converge toward a shared conclusion. In Swarm Intelligence, this happens through the voting and synthesis layers. This wiki entry covers consensus methods, multi-agent debate research, and how the agent resolves conflicts between its personas.

## Consensus Methods

### Unanimity

All participants must agree. Provides maximum confidence but is vulnerable to:

- **Holdout problems**: A single dissenter blocks the entire decision.
- **Group pressure**: Dissenters may conform rather than genuinely agree.
- **Lowest common denominator**: The final decision satisfies everyone but excels at nothing.

Swarm Intelligence does not require unanimity. Unanimity is treated as a signal of either a trivial problem or insufficient diversity.

### Majority Vote

The option with the most votes wins. Simple and robust, but:

- **Tyranny of the majority**: Consistent minority perspectives are always overruled.
- **Vote splitting**: Similar options divide votes, allowing a weaker option to win.
- **No intensity information**: A 51-49 split is treated the same as a 99-1 consensus.

Swarm Intelligence uses weighted majority vote as the default, with weights adjusted by domain relevance and historical accuracy.

### Weighted Voting

Each voter's influence is proportional to their weight. Weights can reflect expertise, confidence, or relevance. Swarm Intelligence assigns weights based on:

- **Default weights**: Set in config.yml (all personas start at 1.0).
- **Domain relevance**: Technical queries boost Engineer weight; creative queries boost Artist weight.
- **Historical accuracy**: Personas that have contributed well to similar topics get higher weights.
- **User preferences**: Users can manually adjust persona weights.

### Condorcet Methods

Condorcet voting ranks options by pairwise comparison — which option beats every other option in head-to-head matchups. The Condorcet winner is the option that would win against every other option in a two-way race.

Advantages:
- Respects the full preference ordering, not just top choices.
- Less vulnerable to strategic voting.
- A Condorcet winner, when it exists, has strong democratic legitimacy.

Swarm Intelligence can use Condorcet-style ranking when personas rank multiple options, ensuring the synthesis reflects the most broadly acceptable recommendation rather than just the plurality favorite.

### Approval Voting

Each voter approves or disapproves each option independently. The option with the most approvals wins. Simpler than ranked methods and encourages honest voting.

Swarm Intelligence uses an approval-style mechanism for conflict detection: if a persona strongly disapproves of the leading recommendation, that disapproval is surfaced to the user.

## Multi-Agent Debate Research

### Du et al. (2023) — Improving Factuality and Reasoning

Demonstrated that multi-agent debate significantly improves factuality and reasoning quality. Key findings:

- Agents that debate their answers produce more accurate responses than single agents.
- The improvement is largest for factual questions where the answer is verifiable.
- Debate works by forcing agents to justify their positions and respond to counterarguments.

Swarm Intelligence adapts this by having personas "debate" through the voting phase, where they see each other's analyses before casting votes.

### Liang et al. (2023) — Encouraging Diverse Perspectives

Showed that explicitly encouraging diverse perspectives in multi-agent discussions produces more robust and creative answers:

- Agents prompted to "think differently" generate more diverse solution spaces.
- Diversity of perspective is more valuable than diversity of model architecture.
- The optimal number of perspectives is domain-dependent (3-5 for most tasks).

This validates Swarm Intelligence's four-persona default while supporting extensibility to more or fewer personas.

### Wang et al. (2023) — Society of Minds

Proposed a "Society of Minds" approach where multiple LLM instances with different prompts collaborate:

- Each instance maintains its own reasoning chain.
- Instances share conclusions (but not full reasoning) with each other.
- Iterative convergence produces higher-quality outputs than single-pass reasoning.

Swarm Intelligence implements a simplified version: personas share conclusions during voting, and the synthesis layer performs the convergence.

## Handling Disagreement in Swarm Intelligence

### Conflict Detection

Conflict is measured as the distance between persona positions on a recommendation:

1. **Position encoding**: Each persona's recommendation is encoded as a position vector (stance on key dimensions like feasibility, desirability, risk, novelty).
2. **Distance calculation**: Cosine distance or Euclidean distance between position vectors.
3. **Threshold comparison**: If the maximum pairwise distance exceeds the `conflictThreshold` (default 0.3), the conflict is flagged.
4. **Severity classification**: Low (0.3-0.5), Medium (0.5-0.7), High (0.7+).

### Conflict Resolution Strategies

When personas disagree, Swarm Intelligence applies different resolution strategies based on conflict severity:

**Low conflict (0.3-0.5)**: Synthesis proceeds normally. Minor disagreements enrich the response without destabilizing it. The synthesis notes the different emphases.

**Medium conflict (0.5-0.7)**: The synthesis explicitly surfaces the disagreement. Users see a "Perspectives diverge" section explaining what each persona emphasizes and why they disagree. The synthesis presents both the weighted recommendation and the minority view.

**High conflict (0.7+)**: The disagreement is treated as a feature, not a bug. The response presents the conflict prominently, explaining that this is a genuinely contested question. Both positions are presented with full reasoning. The user is empowered to decide rather than being given a forced consensus.

### When to Surface vs Synthesize

The decision to surface or synthesize a disagreement follows these principles:

- **Synthesize when**: Personas agree on the conclusion but differ in emphasis or reasoning. The synthesis weaves complementary perspectives together.
- **Surface when**: Personas genuinely disagree on the conclusion. Forcing a synthesis would create a misleading "consensus" that no persona fully endorses.
- **Flag when**: One persona has a strong objection that others dismiss. The objection may reveal a blind spot in the majority view.

### The Value of Irreducible Disagreement

Not all disagreements can or should be resolved. Some questions genuinely have no single right answer — they involve competing values, incomplete information, or irreducible uncertainty. In these cases, Swarm Intelligence's greatest contribution is making the disagreement visible and structured, so users understand what they are choosing between.

This is a deliberate design choice: an agent that always presents a unified front on contested questions is not being helpful — it is being reductive. Surfacing genuine disagreement is a form of intellectual honesty.

## Practical Configuration

The consensus mechanism is configurable through config.yml:

```yaml
voting:
  method: weighted          # weighted, majority, condorcet, approval
  conflictThreshold: 0.3    # distance threshold for conflict flagging
  requireConsensus: false   # if true, high-conflict queries return no synthesis
```

Users can adjust these parameters based on their tolerance for disagreement and their need for unified recommendations. A decision-support use case might set `requireConsensus: true` to avoid forced syntheses on contested topics. A brainstorming use case might lower `conflictThreshold` to surface more creative tension.
