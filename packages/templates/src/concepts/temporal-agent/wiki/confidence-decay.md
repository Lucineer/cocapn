# Confidence Decay

## Why Confidence Decays

Knowledge is not permanent. The confidence we hold in a fact, decision, or prediction naturally decreases over time because the world changes. A market analysis from six months ago is less reliable than one from yesterday. A technical decision made under specific constraints may become invalid as those constraints evolve. A user preference expressed a year ago might no longer reflect current preferences.

The Temporal Agent models this decay explicitly rather than treating all stored knowledge as equally valid. This is not a limitation — it is a more honest representation of how knowledge works.

### Sources of Decay

Confidence decays for several distinct reasons:

1. **Environmental drift** — the external world changes independent of the agent's observations. Market conditions shift, technology evolves, social norms change.
2. **Information staleness** — the longer it has been since an observation, the more likely it is that the underlying reality has changed without the agent knowing.
3. **Assumption erosion** — decisions are made under assumptions. Over time, assumptions become less likely to hold.
4. **Context shift** — the user's context (goals, priorities, constraints) changes over time, making some previously relevant knowledge less applicable.
5. **Feedback absence** — beliefs that are not reinforced by new evidence naturally become less certain.

Not all knowledge decays at the same rate. Mathematical truths decay slowly (or not at all). User preferences decay moderately. Market predictions decay rapidly. The agent allows per-domain and per-fact decay rate configuration.

## Exponential Decay

The default decay model: `confidence(t) = C0 * e^(-lambda * t)`

Where:
- `C0` is the initial confidence (at the time the fact was stored or last reinforced)
- `lambda` is the decay rate (higher = faster decay)
- `t` is the time elapsed since `C0` was established

### Properties

- **Always positive** — confidence approaches zero but never reaches it, so no knowledge is ever truly "deleted"
- **Monotonically decreasing** — confidence only goes down over time (absent reinforcement)
- **Rate-determinable** — the half-life of confidence is `ln(2) / lambda`, giving an intuitive measure
- **Composable** — sequential decay computations are equivalent to a single computation, simplifying implementation

### Choosing Lambda

The decay rate `lambda` should be calibrated to the domain:

| Domain | Half-life | Lambda | Rationale |
|--------|-----------|--------|-----------|
| Mathematical facts | Infinite | 0 | Truths do not decay |
| User identity facts | 365 days | 0.0019 | Core identity changes slowly |
| User preferences | 90 days | 0.0077 | Preferences shift moderately |
| Technical decisions | 60 days | 0.0116 | Technical context evolves |
| Market observations | 14 days | 0.0495 | Markets change rapidly |
| Daily context | 3 days | 0.2310 | Daily context is ephemeral |

The default `lambda` of 0.05 corresponds to a half-life of approximately 14 days, appropriate for general-purpose knowledge that benefits from regular reinforcement.

## Power Law Decay

An alternative model: `confidence(t) = C0 / (1 + alpha * t)^beta`

Where:
- `alpha` controls the scale (when decay becomes noticeable)
- `beta` controls the shape (how steep the decay is)

### When to Use Power Law

Power law decay is appropriate when:

- Knowledge has a long tail of relevance — it stays useful for much longer than exponential decay would predict, then eventually drops off
- The domain has "sticky" knowledge — architectural decisions, core principles, fundamental relationships
- Early decay is too aggressive under the exponential model

### Comparison with Exponential

Exponential decay starts fast and gradually slows. Power law decay starts slow (or flat), maintains for a while, then drops off more sharply. The choice between them should be empirically validated: does the domain show rapid initial degradation (exponential) or long-then-sudden degradation (power law)?

For most domains, exponential decay is a safe default. Power law should be used when calibration data shows it fits better.

## Bayesian Updating

Decay alone is insufficient. In reality, confidence should also increase when new evidence supports a belief. Bayesian updating provides the mathematical framework:

`P(H|E) = P(E|H) * P(H) / P(E)`

Where:
- `P(H)` is the prior confidence (before new evidence)
- `P(E|H)` is the likelihood of observing evidence `E` if hypothesis `H` is true
- `P(E)` is the probability of observing evidence `E` under all hypotheses
- `P(H|E)` is the posterior confidence (after incorporating evidence)

### Combining Decay and Updating

The agent uses a two-step process at each time step:

1. **Decay** — apply the decay model to reduce all confidences based on elapsed time
2. **Update** — for any new evidence, apply Bayesian updating to increase or decrease confidences

This means that a fact whose confidence has decayed can be "rescued" by new supporting evidence. Conversely, a fact can be actively weakened by contradicting evidence even if no decay has occurred.

### Practical Simplification

Full Bayesian updating requires estimating `P(E|H)` and `P(E)` for each piece of evidence, which is impractical for a general-purpose agent. The agent uses a simplified model:

- **Supporting evidence** — multiply confidence by `(1 + weight)` where weight depends on the evidence strength
- **Contradicting evidence** — multiply confidence by `(1 - weight)` where weight depends on the contradiction strength
- **Neutral evidence** — no update, only decay applies

This simplified model captures the essential dynamics without requiring full probability distributions.

## Calibration Curves

A well-calibrated agent's confidence predictions should match observed outcomes. If the agent says it is "80% confident" across 100 predictions, approximately 80 of those predictions should turn out to be correct.

### Tracking Calibration

The agent maintains a calibration curve:

1. Group past predictions into confidence buckets (70-80%, 80-90%, 90-100%, etc.)
2. For each bucket, compute the actual accuracy (how many predictions came true)
3. Plot confidence vs accuracy

A perfectly calibrated agent produces a diagonal line. Systematic overconfidence (confidence > accuracy) or underconfidence (confidence < accuracy) indicates the decay model needs adjustment.

### Automatic Recalibration

When calibration data shows systematic bias:

- **Overconfident** — increase the decay rate (lambda) to reduce confidence faster
- **Underconfident** — decrease the decay rate to maintain confidence longer
- **Domain-specific** — adjust per-domain decay rates independently

The agent recalibrates monthly by default, using the accumulated prediction-outcome pairs in its memory.

## Visualizing Confidence

The agent communicates confidence through multiple channels:

### Numerical Representation
- Exact confidence values for precise queries: "Confidence: 0.73 (decayed from 0.95 over 45 days)"
- Confidence ranges for summaries: "Confidence in this prediction: 60-75%"
- Half-life annotations: "This belief has a half-life of approximately 30 days"

### Temporal Confidence Curves
For decisions and predictions, the agent can display how confidence has changed over time:
- Starting confidence at the moment of decision
- Decay curve showing projected confidence loss
- Actual confidence trajectory (including Bayesian updates from new evidence)
- Current confidence level
- Projected confidence at the forecast horizon

### Revisit Indicators
When confidence crosses the revisit threshold, the agent marks the item for attention:
- Color coding (green = high confidence, yellow = moderate, red = below threshold)
- Time-to-threshold estimate: "This decision will drop below revisit threshold in approximately 12 days"
- Context summary: what has changed since the decision was made

## When to Revisit Decisions

The revisit threshold (default: 0.4) is the confidence level below which a decision warrants review. However, the agent considers multiple factors:

1. **Absolute confidence** — has it dropped below the threshold?
2. **Rate of change** — is confidence dropping faster than expected? (steep decay may indicate a changed environment)
3. **Impact** — how important is this decision? (high-impact decisions should be revisited at higher confidence levels)
4. **Reversibility** — how hard is it to change course? (irreversible decisions need lower thresholds)
5. **Context similarity** — does the current context still resemble the decision's original context?

The agent combines these factors into a revisit score and surfaces the highest-scoring items proactively.

## Relationship Between Decay Rate and Domain Volatility

The appropriate decay rate is a function of domain volatility — how quickly things change in the relevant domain:

- **Stable domains** (mathematics, fundamental physics) — near-zero decay. Facts persist indefinitely.
- **Slow-changing domains** (organizational structure, core technology stack) — low decay (half-life: 6-12 months)
- **Moderate domains** (project requirements, team preferences, market position) — moderate decay (half-life: 1-3 months)
- **Fast-changing domains** (daily context, current events, stock prices) — high decay (half-life: days to weeks)
- **Chaotic domains** (breaking news, real-time metrics) — very high decay (half-life: hours)

The agent auto-detects domain volatility by tracking how often facts in a domain are updated or contradicted. Domains with frequent updates get higher decay rates. Domains where facts persist unchanged get lower decay rates. This auto-calibration runs continuously and adjusts decay rates without user intervention.
