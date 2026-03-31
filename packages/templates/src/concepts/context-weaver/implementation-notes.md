# Implementation Notes — Context Weaver

## Architecture Overview

Context Weaver is built around four core subsystems that work together to detect, generate, track, and deliver cross-domain connections:

```
User Input
    |
    v
[Domain Detector] --> [Analogy Engine] --> [Response Generator]
    |                        |                     |
    v                        v                     v
[Facts Store]         [Knowledge Graph]     [Connection Tracker]
    |                   (wiki/)                    |
    v                        |                     v
[Skill Map]                  v              [Strength Scores]
                       [Serendipity Injector]
                              |
                              v
                       [Random Domain Entry]
```

### 1. Domain Detector

The domain detector identifies which field(s) the user is currently working in. It uses multiple signals:

- **Facts in the `weave` namespace**: Persistent domain interests stored in the brain
- **Current conversation keywords**: Real-time topic detection from the chat
- **Wiki history**: Recently accessed wiki pages suggest active domains
- **Session context**: Previous connections in the current session

Domain detection is not a rigid taxonomy. The detector assigns confidence scores to multiple domains simultaneously. A conversation about "harmonics" might score 0.7 for music theory and 0.4 for physics, reflecting genuine ambiguity that the agent can use productively — the ambiguity itself is a potential cross-domain connection.

The detector outputs a ranked list of (domain, confidence) pairs, which the analogy engine uses as input.

### 2. Analogy Engine

The analogy engine is the core reasoning subsystem. Given a ranked list of domains, it:

1. **Extracts structural features** for each detected domain using the LLM with a structured prompt focused on relational patterns (not surface features)
2. **Queries the knowledge graph** for existing connections involving these domains
3. **Generates candidate analogies** by comparing structural features across domains
4. **Scores candidates** using the three-dimensional evaluation (structural depth, predictive power, fruitfulness)
5. **Filters by threshold** using the `analogyThreshold` config parameter (default 0.6)
6. **Ranks by expected utility** — a combination of analogy score, user's historical preference for certain connection types, and novelty (connections not previously suggested)

The analogy engine has access to the full wiki, allowing it to draw on the lateral thinking, cross-domain innovation, and analogy mapping knowledge bases for well-grounded suggestions.

### 3. Knowledge Graph Builder

The cross-domain knowledge graph is stored as markdown in `wiki/cross-domain-map.md`. This file is:

- **Human-readable**: Users can browse and edit it directly
- **Version-controlled**: Git tracks the evolution of the user's cross-domain knowledge
- **Agent-readable**: The agent parses it to inform future suggestions
- **Accumulating**: New connections are added but rarely removed (pruning happens through strength decay rather than deletion)

The graph format in markdown uses a structured but readable syntax:

```markdown
## Connection: [Source Domain] <-> [Target Domain]

- **Type**: structural | functional | procedural | causal | temporal | spatial
- **Strength**: 0.0 - 1.0
- **Source**: conversation | serendipity | literature
- **Discovered**: YYYY-MM-DD
- **Fruitful**: yes | no | untested

### Mapping
- [Source concept A] <-> [Target concept X]
- [Source relation R] <-> [Target relation R']

### Notes
[Free-text notes about the connection]
```

### 4. Serendipity Injector

The serendipity injector implements de Bono's random entry technique at the domain level. It operates probabilistically, controlled by the `serendipityFrequency` parameter (default 0.2, meaning roughly 20% of interactions include a serendipitous injection).

The injection algorithm:

1. **Select a random domain** from the agent's knowledge base, weighted away from domains the user already works in (the goal is genuinely unexpected connections)
2. **Select a random concept** from that domain
3. **Attempt a forced connection** between the random concept and the current conversation topic
4. **If the connection has structural merit** (above a minimal threshold), present it with a "This might seem unrelated, but..." framing
5. **If no structural merit exists**, discard and try again (up to 3 attempts per injection opportunity)

The serendipity injector is deliberately non-deterministic. Two identical conversations may produce different serendipitous suggestions, reflecting the creative value of randomness.

### 5. Connection Strength Scoring

Every cross-domain connection in the knowledge graph has a strength score that evolves over time:

- **Initial score**: Set by the analogy engine based on structural evaluation (0.3 - 0.8)
- **User validation bonus**: +0.1 if the user explicitly finds the connection useful
- **Exploration bonus**: +0.05 if the user asks follow-up questions about the connection
- **Fruitfulness bonus**: +0.15 if the connection leads to further discoveries
- **Time decay**: -0.02 per week (slower than memories, since connections are more stable)
- **Minimum floor**: 0.1 (connections are never fully removed, just deprioritized)

Connections below the `analogyThreshold` are not suggested in normal conversation but remain in the graph for serendipity injection (where lower thresholds can reveal surprising value).

---

## Domain Detection from User Conversations

The domain detector operates in two modes:

### Explicit Detection

The user directly states their domain: "I'm working on a machine learning project" or "Can you help me with my sourdough recipe?" These statements are high-confidence signals.

### Implicit Detection

The user's vocabulary, concepts, and question patterns reveal their domain. "Gradient descent," "loss function," and "overfitting" implicitly signal machine learning even if the user never names the domain. The detector uses a domain vocabulary mapping stored in facts to make these inferences.

Implicit detection is less confident but more valuable — it can reveal domain crossings the user wasn't consciously aware of.

---

## Knowledge Graph Stored in Wiki

The decision to store the knowledge graph in wiki markdown rather than a structured database is deliberate:

1. **Transparency**: Users can see exactly what the agent knows about their cross-domain connections
2. **Editability**: Users can correct, extend, or prune the graph directly
3. **Version history**: Git provides a complete history of how the graph evolved
4. **No additional infrastructure**: No database, no migration, no schema management
5. **Alignment with cocapn**: The wiki IS part of the agent's brain, version-controlled alongside everything else

---

## Response Integration

Cross-domain suggestions are integrated into responses using several patterns:

- **"This reminds me of..."**: The signature phrase for strong analogies (strength > 0.7)
- **"Speaking of X, have you considered..."**: Weaker connections framed as tangential suggestions
- **"A completely different field handles this by..."**: Methodological transfer suggestions
- **"I wonder if..."**: Speculative connections left open for the user to evaluate
- **Serendipity interrupt**: "On a completely different note, I was thinking about [random domain] and it occurred to me that..."

Each pattern is appropriate for different connection strengths and contexts. The agent selects the pattern based on confidence, relevance, and the current conversation flow.
