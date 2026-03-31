# Pattern Recognition

## Overview

Pattern recognition during sleep is one of the brain's most remarkable capabilities. While we sleep, the brain doesn't just passively store memories — it actively searches for patterns, connections, and regularities across the day's experiences. The Dream Simulator implements analogous cross-memory pattern detection, finding connections that "waking" processing might miss.

---

## Creative Incubation: Sleep Inspires Insight

### Wagner et al. (2004)

In a landmark study, Wagner, Gais, Haider, Verleger, and Born demonstrated that sleep inspires insight. Participants were given a cognitive task with a hidden rule. Those who slept between initial exposure and retesting were **2.9 times more likely** to discover the hidden rule compared to those who stayed awake.

The key finding: sleep didn't just preserve the memory of the task — it restructured the representation, making the hidden pattern accessible to conscious awareness.

### The Remote Associates Test (RAT)

The Remote Associates Test (Mednick, 1962) measures the ability to find connections between seemingly unrelated words. For example, given "cottage," "Swiss," and "cake," the answer is "cheese." Performance on the RAT improves significantly after sleep, particularly REM-rich sleep (Cai et al., 2009).

This suggests that sleep facilitates **associative processing** — the ability to find links between distant concepts. The Dream Simulator implements a computational version of this process.

**Reference**: Wagner, U., et al. "Sleep inspires insight." Nature, 2004. Cai, D.J., et al. "REM, not incubation, improves creativity." PNAS, 2009.

---

## Pattern Completion in Attractor Neural Networks

### Hopfield Networks and Attractors

In attractor neural networks (Hopfield, 1982), memories are stored as attractor states in an energy landscape. Pattern completion is the process of retrieving a complete memory from a partial cue — the network "falls into" the nearest attractor basin.

During consolidation, the brain refines these attractor landscapes:
- Strengthening basins for important, frequently accessed memories
- Flattening basins for noise and irrelevant details
- Creating new basins when overlapping memories form a generalization

### Implementation in the Agent

The agent uses **graph-based clustering** for pattern detection rather than attractor dynamics, but the principle is the same:

1. **Memory embedding**: Each stored memory is represented as an embedding vector
2. **Similarity graph**: A graph is constructed where edges connect memories with high embedding similarity
3. **Cluster detection**: Connected components and density-based clustering identify groups of related memories
4. **Generalization**: The LLM generates a generalization from each cluster (what do these memories have in common?)

---

## Graph-Based Pattern Discovery

### The Algorithm

The agent's pattern detection operates in three phases:

**Phase 1: Memory Sampling**
```
Sample N memories from brain store
Weight by: recency (0.3), importance (0.4), emotional valence (0.3)
Ensure diversity: no more than 20% from any single topic
```

**Phase 2: Graph Construction**
```
For each pair of sampled memories:
  Compute embedding similarity
  Compute temporal proximity score
  Compute topical overlap score
  If combined_score > threshold: add edge to graph
```

**Phase 3: Pattern Extraction**
```
Find connected components (clusters of related memories)
For each cluster with >= 3 memories:
  Summarize the common theme
  Identify the pattern (recurring event, evolving trend, causal chain)
  Generate a pattern insight with confidence score
```

### Pattern Types Detected

The agent classifies detected patterns into categories:

| Pattern Type | Description | Example |
|-------------|-------------|---------|
| Recurring event | Same type of event happens repeatedly | "You discuss deployment issues every Thursday" |
| Evolving trend | A metric or behavior changes over time | "Your testing coverage has increased 3% per week" |
| Causal chain | One type of event follows another | "After code reviews, bugs decrease for 2 days" |
| Cross-domain link | Similar patterns in different domains | "Your cooking and coding both show a preference for iteration" |
| Anomaly | Break in an established pattern | "You didn't mention your project this week, first time in 2 months" |

---

## Temporal Pattern Mining

### Time-Series Analysis

Memories have timestamps, enabling temporal pattern mining:

- **Periodicity detection**: Does a pattern repeat at regular intervals? (daily, weekly, monthly)
- **Trend detection**: Is a measured quantity increasing, decreasing, or stable?
- **Seasonality**: Do patterns correlate with calendar events or seasons?
- **Changepoint detection**: When did a pattern start or stop?

### Implementation

The agent uses simple statistical methods for temporal analysis:
- Autocorrelation for periodicity detection
- Linear regression for trend detection
- Threshold-based changepoint detection

For more sophisticated analysis, the agent can delegate to specialized tools via the MCP client.

---

## The Role of Embedding Similarity

### Why Embeddings?

Embeddings capture semantic similarity — two memories with similar embeddings are "about" similar things, even if they use different words. This enables the agent to find connections between memories that don't share explicit keywords.

### Embedding Sources

The agent can use multiple embedding sources:
- LLM provider embeddings (DeepSeek, OpenAI)
- Local embedding models (for air-gapped deployment)
- Hybrid approaches combining keyword and semantic similarity

### Threshold Calibration

The similarity threshold for pattern detection is configurable per consolidation cycle:
- **Light sleep** (daily): Higher threshold (0.7) — only strong patterns
- **Deep sleep** (weekly): Medium threshold (0.5) — moderate patterns
- **REM** (monthly): Lower threshold (0.3) — weak but potentially creative patterns

The decreasing threshold across cycles mirrors the brain's progression from conservative (NREM) to creative (REM) processing.

---

## Cross-Memory Correlation

### The Insight Engine

The most creative patterns emerge from correlating memories across different topics and times. The agent's insight engine looks for:

1. **Shared structure** — Memories from different domains with similar causal or logical structure
2. **Emotional resonance** — Memories with similar emotional valence that might indicate deeper significance
3. **Temporal coincidence** — Unrelated events that cluster in time
4. **Complementary information** — Memories that together reveal something neither shows alone

### Dream Report Integration

Detected patterns are included in the dream report, presented as hypotheses:
- "I noticed that you tend to feel more productive on days when you exercise. This happened 4 out of 5 times in the last month."
- "Three separate conversations about database performance all mentioned the same table. There might be an underlying schema issue."

These are presented as observations, not conclusions — the user validates or rejects each insight.

---

## References

- Wagner, U., et al. "Sleep inspires insight." Nature, 2004.
- Mednick, S. "The Associative Basis of the Creative Process." Psychological Review, 1962.
- Cai, D.J., et al. "REM, not incubation, improves creativity." PNAS, 2009.
- Hopfield, J.J. "Neural networks and physical systems with emergent collective computational abilities." PNAS, 1982.
- Ester, M., et al. "A density-based algorithm for discovering clusters." KDD, 1996.

---

## See Also

- [Memory Consolidation](./memory-consolidation.md) — The neuroscience of memory replay
- [Neural Dreams](./neural-dreams.md) — The history and philosophy of AI dreaming
- [Implementation Notes](../implementation-notes.md) — Technical details of the pattern detection pipeline
