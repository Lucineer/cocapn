# Decision Trees with Temporal Dimension

## Overview

Traditional decision trees map choices to outcomes. Temporal decision trees add a time axis — each branch carries not just an outcome, but a timeline of intermediate states, confidence values, and temporal annotations. This enables the agent to reason about not just what will happen, but when and with what evolving certainty.

## What-If Branching

The what-if system is the Temporal Agent's primary mechanism for exploring alternative futures without committing to any of them. It creates lightweight timeline branches that diverge from the main history at a user-specified point.

### Branching Mechanics

A branch is defined by three parameters:

1. **Divergence point** — the timestamp (or event) where the branch leaves the main timeline
2. **Alternative premise** — the counterfactual assumption ("what if we had chosen B instead of A?")
3. **Projection depth** — how far into the future the branch should be simulated

The branch shares all history up to the divergence point with the main timeline (copy-on-write). From the divergence point forward, the branch maintains its own independent state. The agent can run multiple branches concurrently and compare their outcomes.

### Branch Lifecycle

1. **Creation** — the user asks a what-if question, or the agent proactively creates a branch to explore uncertainty
2. **Simulation** — the agent projects the branch forward using LLM reasoning informed by the timeline context at the divergence point
3. **Evaluation** — the agent compares the branch's projected outcomes against the main timeline and other branches
4. **Reporting** — the agent presents the branch's story to the user with confidence estimates and key divergences
5. **Archival or Merge** — the branch is either archived for reference or, if the user chooses, merged into the main timeline

### Branch Comparison

When multiple branches exist, the agent can perform comparative analysis:

- **Outcome divergence** — how different are the projected endpoints?
- **Confidence spread** — how much does confidence vary across branches?
- **Robustness** — which decisions appear in all (or most) branches regardless of assumptions?
- **Regret** — which branch produces the worst outcome if chosen incorrectly?
- **Key sensitivities** — which assumptions most influence the outcome spread?

## Scenario Trees

A scenario tree is a structured exploration of possible futures. Unlike a single what-if branch, a scenario tree starts from the present and fans out into multiple possible futures at each decision point.

### Constructing a Scenario Tree

1. **Identify decision points** — moments in the future where a choice must be made
2. **Enumerate options** — the plausible alternatives at each decision point
3. **Estimate probabilities** — the likelihood of each option based on historical data and context
4. **Project outcomes** — use the LLM to simulate each path forward
5. **Compute expected values** — weight outcomes by their probability

The resulting tree gives a comprehensive view of the decision landscape. The agent presents it as a set of scenarios ranked by probability and expected value.

### Pruning

Full scenario trees grow exponentially. The agent prunes aggressively:

- **Low probability paths** — branches with probability below a threshold (default: 5%) are summarized rather than fully simulated
- **Similar paths** — branches that converge on similar outcomes are merged
- **User-relevant paths** — the agent prioritizes paths that involve decisions the user can influence

## Monte Carlo Methods for Future Projection

When analytical projection is insufficient (complex systems, high uncertainty), the agent can use Monte Carlo simulation:

1. **Define the model** — identify the key variables and their distributions based on historical data
2. **Sample** — draw random samples from each distribution
3. **Simulate** — run the timeline forward with the sampled values
4. **Aggregate** — repeat thousands of times and aggregate the results

The output is a probability distribution over possible futures rather than a single point estimate. The agent presents this as a range with confidence intervals: "There is a 70% chance that outcome falls between X and Y."

### When to Use Monte Carlo

Monte Carlo is computationally expensive. The agent uses it selectively:

- When the number of interacting variables is large (>5)
- When the relationships between variables are nonlinear
- When the user explicitly requests high-confidence projections
- When the domain is known to have fat tails (financial markets, complex projects)

For simpler cases, the agent uses analytical projection (scenario trees with estimated probabilities).

## Regret Minimization

Regret minimization (Savage 1954, Loomes & Sugden 1982) is a decision criterion that minimizes the maximum regret — the difference between the outcome of the chosen action and the best possible outcome in hindsight.

The agent computes regret for each branch:

1. For each possible future state, identify the best action in hindsight
2. For each action, compute the regret in each future state (best outcome minus action's outcome)
3. For each action, find the maximum regret across all future states
4. Recommend the action with the minimum maximum regret

This is more conservative than expected utility maximization and is appropriate when the cost of being wrong is high or when the probability distribution is uncertain.

## Robust Decision Making Under Uncertainty

Robust decision making (Lempert et al., 2003) focuses on finding strategies that perform reasonably well across a wide range of possible futures rather than optimizing for a single expected future.

The agent applies robust decision making when:

- Probability distributions are unknown or contested
- The system has deep uncertainty (not just parametric uncertainty)
- The user's risk tolerance favors robustness over optimization

### Implementation

1. **Ensemble of futures** — generate a diverse set of plausible futures (not probability-weighted)
2. **Candidate strategies** — enumerate possible courses of action
3. **Evaluate across futures** — score each strategy in each future
4. **Identify robust strategies** — strategies that score acceptably across most futures
5. **Identify vulnerabilities** — conditions under which the robust strategy fails
6. **Hedge** — recommend modifications that address the vulnerabilities

The agent presents robust decision analysis as: "Strategy X performs well in most scenarios. It struggles if [condition]. To hedge against this, consider [modification]."

## Branching Timeline Implementation

### Data Structure

Each branch is stored as:

```
Branch {
  id: string
  parentId: string | null        // null for main timeline
  divergencePoint: timestamp
  divergenceEvent: string        // description of what changed
  premise: string                // the counterfactual assumption
  events: Event[]                // events after divergence (copy-on-write)
  confidence: number             // overall confidence in this branch
  status: 'active' | 'archived' | 'merged'
  createdAt: timestamp
  expiresAt: timestamp | null    // auto-archive after this time
}
```

### Copy-on-Write Semantics

Branches do not duplicate the main timeline's history. They store only:

1. A reference to the divergence point
2. The delta events from that point forward
3. Overridden facts and confidence values

This keeps memory usage proportional to the branch's unique content, not the full history.

### Branch Garbage Collection

Inactive branches are automatically archived after a configurable period (default: 30 days). Archived branches remain queryable but are not evaluated for decision revisiting or pattern detection. The agent can resurrect an archived branch if the user asks about a past what-if scenario.

## Integration with LLM

The LLM is the simulation engine for branch projection. When projecting a branch forward:

1. The agent constructs a prompt containing the timeline state at the divergence point, the counterfactual premise, and the projection depth
2. The LLM generates a plausible sequence of events given the premise
3. The agent parses the output into structured events and adds them to the branch
4. The agent applies confidence decay to the projected events based on their distance from the present

The LLM's role is constrained by the agent's temporal logic layer — it cannot project events that violate temporal constraints (e.g., an effect before its cause, a fact that was terminated but is projected to persist without justification).
