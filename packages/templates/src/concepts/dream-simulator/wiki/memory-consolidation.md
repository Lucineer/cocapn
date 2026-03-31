# Memory Consolidation

## Overview

Memory consolidation is the process by which the brain stabilizes a memory trace after initial acquisition. In neuroscience, this occurs primarily during sleep through a process called hippocampal replay. The Dream Simulator agent implements an analogous process for AI memory systems — periodically replaying stored memories, strengthening important connections, and pruning noise.

This document covers the neuroscience of memory consolidation, the theoretical frameworks that inform the agent's design, and how biological consolidation maps to the agent's implementation.

---

## Hippocampal Replay and Sharp-Wave Ripples

### The Discovery

In 1989, Pavlides and Winson discovered that hippocampal place cells — neurons that fire when an animal is in a specific location — "replay" their firing patterns during sleep. A rat that navigated a maze during the day would show the same sequence of place cell activation during subsequent sleep, as if re-experiencing the maze in fast-forward.

This replay occurs during **sharp-wave ripples** (SPW-R) — brief (50-100ms), high-frequency oscillations in the hippocampus that occur during slow-wave sleep. During a sharp-wave ripple:

1. Sequences of neurons that were active during waking experience fire again in the same order
2. The replay occurs at compressed timescales — roughly 10-20x faster than the original experience
3. The replayed information is transmitted from hippocampus to neocortex for long-term storage

**Reference**: Buzsáki, G. "Hippocampal sharp wave-ripple: A cognitive biomarker for episodic memory and planning." Hippocampus, 2015.

### Implications for the Agent

The Dream Simulator maps sharp-wave ripple replay to its **memory sampling** process:
- **Replay** = sampling a subset of stored memories based on importance weighting
- **Compressed timescale** = batch processing multiple memories in a single consolidation cycle
- **Hippocampus-to-neocortex transfer** = moving insights from consolidation processing into the permanent knowledge base

---

## Systems Consolidation Theory

### Standard Model

The standard model of memory consolidation (McGaugh, 2000) proposes two phases:

1. **Fast learning (hippocampus)**: New experiences are rapidly encoded in the hippocampus with high temporal resolution but limited capacity
2. **Slow learning (neocortex)**: Through repeated replay during sleep, memories are gradually transferred to the neocortex, where they become integrated into existing knowledge structures

This creates a natural **stability-plasticity tradeoff**: the hippocampus can learn quickly without disrupting existing knowledge, while the neocortex learns slowly to maintain stable representations.

### Complementary Learning Systems (CLS)

McClelland, McNaughton, and O'Reilly (1995) formalized this as Complementary Learning Systems theory. The key insight is that the brain needs **two learning systems** with complementary properties:

| Property | Hippocampus (Fast) | Neocortex (Slow) |
|----------|-------------------|-------------------|
| Learning rate | Fast (one-shot) | Slow (gradual) |
| Capacity | Limited | Vast |
| Representation | Sparse, specific | Distributed, overlapping |
| Interference | Low | High without interleaving |
| Retrieval | Pattern completion | Generalization |

The CLS theory explains why sleep is essential: **offline replay allows the slow learning system to gradually absorb new information without catastrophic interference with existing knowledge**.

**Reference**: McClelland, J.L., McNaughton, B.L., & O'Reilly, R.C. "Why there are complementary learning systems in the hippocampus and neocortex." Psychological Review, 1995.

### Application to the Agent

The agent's brain memory model mirrors CLS:
- **Facts store** (fast learning): Rapid KV storage with last-write-wins semantics
- **Memories store** (slow learning): Typed entries with confidence decay, supporting gradual integration
- **Wiki** (neocortex analogue): Structured knowledge that evolves through repeated consolidation

---

## Sleep Stages and Their Consolidation Functions

### NREM Sleep (Stages N1-N3)

NREM sleep, particularly slow-wave sleep (SWS, stage N3), is primarily responsible for **declarative memory consolidation** — facts, events, and spatial information.

During SWS:
- Hippocampal sharp-wave ripples are most frequent
- Slow oscillations (0.5-1 Hz) coordinate the dialogue between hippocampus and neocortex
- Sleep spindles (12-15 Hz bursts) gate plasticity in the neocortex
- The thalamocortical network promotes synaptic downscaling (pruning)

**Agent mapping**: The "deep sleep" consolidation cycle (weekly) corresponds to NREM SWS — thorough replay of a large sample of memories with pattern detection and pruning.

### REM Sleep

REM sleep is primarily associated with **procedural memory consolidation** and emotional processing. During REM:
- The brain is metabolically active (similar to waking)
- Theta oscillations (4-8 Hz) dominate the hippocampus
- Emotional memories are processed and integrated
- Creative associations form between distant concepts

**Agent mapping**: The "REM" consolidation cycle (monthly) corresponds to REM sleep — creative recombination of memories, emotional valence processing, and cross-domain association generation.

### Light Sleep (N1-N2)

Light sleep serves as a transition and performs initial memory processing. Sleep spindles in stage N2 are particularly important for motor memory consolidation.

**Agent mapping**: The "light" consolidation cycle (daily) corresponds to light sleep — quick replay of recent memories with surface-level pattern detection.

---

## Ebbinghaus Forgetting Curve

Hermann Ebbinghaus (1885) was the first to systematically study forgetting. His key findings:

1. **Forgetting is exponential**: Memory strength decays following an exponential curve
2. **Spaced repetition slows forgetting**: Reviewing material at increasing intervals dramatically improves retention
3. **Savings**: Re-learning forgotten material is faster than initial learning

The forgetting curve is described by: **R = e^(-t/S)**, where R is retention, t is time, and S is memory strength.

### Application to the Agent

The agent implements confidence decay using an exponential model:
- Each memory has a confidence score (0.0 to 1.0)
- Confidence decays exponentially over time: `confidence *= e^(-decayRate * timeDelta)`
- Replay during consolidation **reinforces** confidence (analogous to spaced repetition)
- Memories below the pruning threshold (default: 0.3) are candidates for noise reduction

The decay rate is configurable (`temporal.confidenceDecayRate` in config.yml), with a default of 0.05 (roughly 5% decay per day for unreinforced memories).

---

## Implementation Mapping Summary

| Biological Process | Agent Implementation |
|--------------------|---------------------|
| Hippocampal replay | Importance-weighted memory sampling |
| Sharp-wave ripples | Pattern burst detection in sampled memories |
| NREM slow oscillation | Deep consolidation cycle (weekly) |
| REM theta activity | Creative recombination cycle (monthly) |
| Synaptic downscaling | Confidence pruning of low-value memories |
| Spaced repetition | Confidence reinforcement during replay |
| Neocortical integration | Pattern insights written to wiki |
| Dream experience | Dream report generated by LLM |

---

## References

- Buzsáki, G. "Hippocampal sharp wave-ripple." Hippocampus, 2015.
- McClelland, J.L., et al. "Complementary learning systems." Psychological Review, 1995.
- McGaugh, J.L. "Memory — A century of consolidation." Science, 2000.
- Ebbinghaus, H. "Memory: A contribution to experimental psychology." 1885.
- Rasch, B. & Born, J. "About sleep's role in memory." Physiological Reviews, 2013.
- Diekelmann, S. & Born, J. "The memory function of sleep." Nature Reviews Neuroscience, 2010.

---

## See Also

- [Pattern Recognition](./pattern-recognition.md) — How replayed memories are analyzed for patterns
- [Neural Dreams](./neural-dreams.md) — The history and philosophy of AI dreaming
- [Implementation Notes](../implementation-notes.md) — Technical details of the consolidation pipeline
