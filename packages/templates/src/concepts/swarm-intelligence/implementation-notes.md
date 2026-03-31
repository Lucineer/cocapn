# Implementation Notes — Swarm Intelligence

## Architecture Overview

Swarm Intelligence is built around four core components that work together to produce multi-perspective responses.

### 1. Persona Orchestrator

The orchestrator manages the lifecycle of all active personas for a given query.

**Responsibilities:**
- Load persona definitions from config.yml (name, focus, weight, color)
- Activate the relevant personas for a given query (all by default, subset if configured)
- Inject persona-specific system prompts into each LLM call
- Coordinate the pipeline phases: activate, analyze, vote, synthesize

**Data flow:**
```
User Query
    |
    v
Persona Orchestrator
    |
    +---> [Scientist prompt] ---> LLM call ---> Scientist analysis
    +---> [Artist prompt]   ---> LLM call ---> Artist analysis
    +---> [Engineer prompt] ---> LLM call ---> Engineer analysis
    +---> [Philosopher prompt] -> LLM call ---> Philosopher analysis
    |
    v
Voting Mechanism (receives all analyses)
    |
    v
Synthesis Generator (receives analyses + votes)
    |
    v
Unified Response
```

### 2. Parallel Prompt Engine

Each persona is driven by a distinct system prompt. The prompts share a common base but diverge in emphasis, evaluative criteria, and knowledge focus.

**Common base (shared across all personas):**
- The user's query and context
- Brain memory relevant to the topic (facts, past interactions, wiki entries)
- The output format expected

**Persona-specific additions:**
- **Scientist**: "Analyze this through the lens of evidence and data. What do we empirically know? What would we need to measure? Be skeptical of claims without support."
- **Artist**: "Analyze this through the lens of creativity and possibility. What novel connections can you draw? What has not been considered? Think laterally."
- **Engineer**: "Analyze this through the lens of practicality and systems. How would you build this? What are the constraints? What could go wrong operationally?"
- **Philosopher**: "Analyze this through the lens of ethics and meaning. What are the implications? Who is affected? What values are at stake? Think long-term."

**Parallel execution:** All persona prompts are dispatched to the LLM simultaneously (or in rapid sequence with streaming). No persona sees another's output during analysis. This prevents anchoring bias and preserves independence.

### 3. Voting and Weighting Algorithm

After all persona analyses are generated, the voting phase begins.

**Weighted voting:**
```
For each recommendation option:
    score = sum(persona.weight * persona.vote(option))
```

**Dynamic weight adjustment:**
- Topic classification determines base weight adjustments (technical queries boost Engineer, creative queries boost Artist)
- Historical accuracy data from brain memory adjusts weights further
- User-configured preferences override both

**Conflict detection algorithm:**
```
for each pair of personas (i, j):
    distance = cosine_distance(position_vector(i), position_vector(j))
    if distance > conflictThreshold:
        flag conflict between i and j
```

Position vectors encode each persona's stance on key dimensions (feasibility, desirability, risk, novelty, ethical weight). The cosine distance measures how differently the personas evaluate the same recommendation.

### 4. Synthesis Generator

The synthesis layer is itself an LLM call — a meta-prompt that receives all persona analyses and voting results and produces the unified response.

**Meta-prompt structure:**
```
You are the synthesis layer of Swarm Intelligence. You have received analyses
from four personas:

1. Scientist: [analysis]
2. Artist: [analysis]
3. Engineer: [analysis]
4. Philosopher: [analysis]

Voting results: [vote tallies with weights]
Conflicts detected: [any flagged disagreements]

Produce a unified response that:
- Attributes contributions to their source persona
- Surfaces significant disagreements explicitly
- Presents the weighted recommendation with reasoning
- Maintains each persona's unique voice in attributed sections
- Weaves a coherent narrative that respects all perspectives
```

The synthesis is where the ensemble magic happens. It is not simply concatenating outputs — it is genuinely merging perspectives into something that reads as a single, coherent, multi-faceted response.

## Cost Implications

Swarm Intelligence makes N + 1 LLM calls per user query, where N is the number of active personas:

- **4 persona calls** (Scientist, Artist, Engineer, Philosopher)
- **1 synthesis call** (meta-prompt merging all analyses)
- **Optional: 1 voting call** (if voting requires its own LLM evaluation rather than simple algorithmic weighting)

With 4 default personas, each user query costs approximately 5x a standard single-call agent. Mitigation strategies:

- **Persona selection**: Allow users to activate only relevant personas for simple queries
- **Caching**: Cache persona analyses for similar queries
- **Model tiering**: Use lighter models for persona analysis and a stronger model for synthesis
- **Streaming**: Stream persona outputs in parallel so latency is bounded by the slowest persona, not the sum

## Brain Memory Integration

The persona system reads from and writes to brain memory stores:

- **Facts**: `swarm.persona.weights` (current weights), `swarm.domain.mapping` (topic-to-persona mappings)
- **Memories**: Persona interaction history, successful synthesis patterns, conflict resolutions
- **Wiki**: Research articles on ensemble methods, cognitive diversity, consensus building
- **Procedures**: The four-step pipeline as a reusable workflow
- **Relationships**: Concept connections as identified by different personas (the Artist might connect two concepts the Engineer sees as unrelated)

## Error Handling

- **Persona timeout**: If a persona's LLM call times out, proceed with available analyses and note the missing perspective in the synthesis.
- **Synthesis failure**: If the synthesis call fails, return the raw persona analyses with a note that synthesis could not be completed.
- **All personas fail**: Fall back to a standard single-prompt response with an error explanation.
- **Weight corruption**: If stored weights become invalid, reset to config.yml defaults.
