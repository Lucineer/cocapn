# Implementation Notes

## Technical Architecture

The Adversarial Reviewer is implemented as a multi-stage LLM pipeline. Each stage is a separate LLM call with a distinct prompt structure and purpose. This document covers the architecture, prompt design, memory integration, performance characteristics, and configuration options.

---

## Architecture: Dual-Prompt Pipeline

The pipeline consists of four sequential stages, each producing output that feeds into the next stage. The entire pipeline is orchestrated by the bridge's agent router, which manages state between stages.

### Stage 1: Generate Initial Response (Thesis)

**Purpose**: Produce the best possible answer to the user's question using standard reasoning.

**Prompt structure**:
- System prompt: Standard agent system prompt (from soul.md)
- User prompt: The user's original query, enriched with relevant brain memory (past debates, stored facts, identified biases)
- Parameters: temperature 0.2, maxTokens 8192

**Output**: A structured response containing:
- Direct answer to the question
- Supporting reasoning and evidence
- Confidence level (initial, pre-debate)
- Assumptions made during reasoning

**Implementation detail**: The initial response is generated with the same parameters as a standard agent response, ensuring that the thesis represents the model's genuine best effort. The low temperature (0.2) is intentional — it reduces variability and focuses the model on what it considers most likely to be correct, which provides a stronger target for the counter-argument stage to challenge.

### Stage 2: Generate Counter-Argument (Antithesis)

**Purpose**: Produce the strongest possible challenge to the thesis.

**Prompt structure**:
- System prompt: Modified to instruct adversarial reasoning: "You are a red team analyst. Your job is to find the strongest possible counter-argument to the position below. Steel-man the opposing case. Find every weakness, unsupported assumption, and potential failure mode. Be thorough and honest."
- User prompt: The original question + the full thesis from Stage 1
- Parameters: temperature 0.2, maxTokens 8192

**Output**: A structured counter-argument containing:
- Strongest opposing position
- Evidence supporting the counter-position
- Specific weaknesses identified in the thesis
- Alternative interpretations of the evidence
- Edge cases and failure modes the thesis didn't address

**Implementation detail**: The counter-argument prompt explicitly instructs the model to "steel-man" (argue the strongest version of) the opposing position, not to create a straw man. This is critical for the debate to produce useful results — a weak counter-argument provides false confidence in the thesis.

### Stage 3: Evaluate Both Sides (Judge)

**Purpose**: Impartially evaluate the thesis and antithesis to determine which is stronger.

**Prompt structure**:
- System prompt: Judge-specific instructions with scoring rubric (logical coherence 0.25, evidence quality 0.25, assumption validity 0.20, practical applicability 0.15, constitutional alignment 0.15)
- User prompt: Original question + thesis + antithesis + constitutional principles
- Parameters: temperature 0.1 (lower for evaluation — we want consistent scoring), maxTokens 4096

**Output**: A structured evaluation containing:
- Per-dimension scores for thesis (0-1 scale)
- Per-dimension scores for antithesis (0-1 scale)
- Weighted overall scores
- Narrative explanation of the scoring
- Identification of the stronger argument
- Remaining uncertainties

**Implementation detail**: The judge prompt includes the full constitutional principles so that alignment with the constitution is part of the evaluation criteria. The lower temperature ensures that scoring is consistent across similar inputs — the judge should give similar scores to similar arguments.

### Stage 4: Synthesize Final Answer

**Purpose**: Combine the best elements of both sides into a calibrated, transparent final response.

**Prompt structure**:
- System prompt: Synthesis instructions emphasizing transparency and calibrated confidence
- User prompt: Question + thesis + antithesis + judge evaluation + bias flags
- Parameters: temperature 0.2, maxTokens 8192

**Output**: The final response presented to the user, containing:
- Synthesized conclusion
- Strongest points from each side
- The judge's evaluation summary
- Calibrated confidence score
- Remaining uncertainties and caveats
- Any bias flags that were triggered
- Recommendation (if appropriate)

**Implementation detail**: The synthesis stage does not simply pick a winner. It integrates insights from both sides, acknowledging the strongest points of the weaker argument and incorporating valid concerns from the counter-argument into the final recommendation. The goal is a nuanced conclusion, not a simple binary verdict.

---

## Memory Integration

### Storing Debate Outcomes

After each complete debate cycle, the agent stores key data in brain memory:

```
Type: debate-outcome
Confidence: 0.9
Data:
  question: "Should we migrate to microservices?"
  thesis_score: 0.72
  antithesis_score: 0.65
  verdict: thesis (weak)
  biases_detected: [planning_fallacy, status_quo_bias]
  constitutional_flags: [truth_over_comfort]
  user_decision: postponed
  outcome: null (pending)
```

### Bias Accumulation

Detected biases are accumulated over time:

```
Type: bias-pattern
Confidence: 0.8
Data:
  user_id: inferred from session
  bias_type: confirmation_bias
  frequency: 7 occurrences in 23 debates
  domains: [investment_decisions, hiring]
  severity: moderate
  last_detected: 2026-03-15
```

This allows the agent to tailor bias detection to the specific user over time, focusing on biases that have been repeatedly observed.

### Constitutional Evolution

When a user modifies constitutional principles (through conversation or direct config editing), the change is recorded:

```
Type: constitution-change
Confidence: 1.0
Data:
  action: added
  principle: "Always consider second-order effects"
  reason: "User requested after debate about policy change"
  date: 2026-03-22
```

---

## Performance Considerations

### Cost Analysis

| Stage | Approximate Token Usage | Relative Cost |
|-------|------------------------|---------------|
| Thesis generation | ~2000-4000 tokens | 1x |
| Antithesis generation | ~2000-4000 tokens | 1x |
| Judge evaluation | ~1000-2000 tokens | 0.5x |
| Synthesis | ~2000-4000 tokens | 1x |
| **Total per query** | **~7000-14000 tokens** | **~3.5x** |

Using DeepSeek as the default provider keeps costs manageable — approximately $0.01-0.02 per complete debate cycle at current pricing. This makes the approach viable for regular use, not just occasional high-stakes decisions.

### Latency

Each stage requires a separate LLM call. With sequential execution:
- Stage 1: ~2-4 seconds
- Stage 2: ~2-4 seconds
- Stage 3: ~1-2 seconds
- Stage 4: ~2-3 seconds
- **Total**: ~7-13 seconds per query

This is significantly slower than a single-call response (~2-4 seconds). For queries that don't require adversarial review (simple factual questions, casual conversation), the agent can be configured to skip the debate pipeline and respond directly based on a confidence threshold.

### Optimization Options

1. **Parallel thesis/antithesis**: For multi-round debates, the thesis for round N+1 can begin while the antithesis for round N is still generating (pipelining).

2. **Streaming partial results**: The thesis can be streamed to the user immediately (marked as "pre-debate"), with the full debated response following. This reduces perceived latency at the cost of potentially showing an answer that gets revised.

3. **Confidence-based routing**: Simple queries (high initial confidence, low stakes) skip the full pipeline. Complex queries trigger the complete debate. The routing is configurable.

4. **Caching common debates**: For frequently asked questions in the same domain, previous debate outcomes can be referenced rather than re-generated. The cache respects recency and context changes.

---

## Configuration Options

### Debate Configuration

```yaml
debate:
  rounds: 2              # Number of debate rounds (1-5)
  positions: [for, against]  # What positions to argue
  evaluationModel: separate  # 'same' or 'separate' prompt for judge
  minimumConfidence: 0.6     # Below this, flag as low-confidence
```

### Feature Toggles

```yaml
features:
  selfPlayDebate: true        # Enable/disable the debate pipeline
  constitutionalReview: true  # Enable/disable constitutional checks
  biasDetection: true         # Enable/disable bias scanning
  confidenceCalibration: true # Enable/disable confidence scoring
  argumentMapping: true       # Enable/disable argument structure visualization
  redTeamMode: true           # Enable/disable adversarial counter-arguments
```

Each feature can be independently toggled. Disabling all features reverts to standard single-pass generation.

### Constitution

The constitutional principles are defined as a list of strings in config.yml. They can also be modified at runtime through brain memory:

```
fact:constitution.prioritize_truth = true
fact:constitution.custom_challenge = "Always consider the impact on marginalized groups"
```

Runtime modifications take precedence over config.yml values, allowing the user to evolve the constitution without editing files.

---

## Error Handling

### Pipeline Failures

If any stage fails (API error, timeout, malformed response):
- The failed stage is logged with full context
- The pipeline continues with available data (e.g., if the judge fails, synthesis uses thesis + antithesis without scores)
- The user is informed that the debate was incomplete and that confidence may be lower than usual
- The partial results are still stored in brain memory for future reference

### Malformed Responses

If the judge produces scores outside the 0-1 range or fails to score one or more dimensions:
- Default scores are applied for missing dimensions
- Out-of-range scores are clamped to [0, 1]
- A warning is included in the synthesis noting the scoring irregularity
- The full raw judge output is stored in memory for debugging

---

## See Also

- [Constitutional AI](./wiki/constitutional-ai.md) — Theory behind the constitutional review stage
- [Debate Methods](./wiki/debate-methods.md) — Theory behind the debate pipeline
- [Cognitive Biases](./wiki/cognitive-biases.md) — Theory behind the bias detection stage
- [Experiments](./experiments.md) — Planned experiments to validate the approach
