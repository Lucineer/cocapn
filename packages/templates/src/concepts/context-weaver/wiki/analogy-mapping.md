# Analogy Mapping

## Overview

Analogy is the cognitive process of identifying structural similarities between two domains and using those similarities to transfer knowledge from a familiar domain to a less familiar one. Analogy is not merely a rhetorical device — cognitive science research demonstrates that it is one of the fundamental mechanisms of human thought, learning, and creativity.

This page covers the theoretical foundations of analogical reasoning, computational approaches to analogy detection, and how Context Weaver implements analogy mapping as a core capability.

---

## Structure-Mapping Theory (Gentner)

Dedre Gentner's structure-mapping theory (1983) is the most influential cognitive theory of analogy. Its central claim: analogies work by aligning the *relational structure* between two domains, not by matching surface features.

### Key Principles

1. **Systematicity**: People prefer analogies that map connected systems of relations rather than isolated relations. An analogy that maps a single relationship is weak; one that maps an entire network of corresponding relationships is strong.

2. **Relational Focus**: Analogies prioritize relational matches over attribute matches. "An atom is like a solar system" works because the *relationships* (orbiting, central force, distance) map — not because atoms and planets share surface features.

3. **One-to-One Mapping**: Each element in the source domain maps to at most one element in the target domain. If two source elements map to the same target element, the analogy is ambiguous and loses power.

4. **Parallel Connectivity**: If a relation between two source elements maps to a relation between two target elements, then the source elements themselves must also map to the corresponding target elements.

### Example: Atom and Solar System

| Solar System (Source) | Atom (Target) |
|-----------------------|---------------|
| Sun | Nucleus |
| Planets | Electrons |
| Gravitational attraction | Electromagnetic attraction |
| Orbital motion | Orbital motion |
| Greater mass at center | Greater mass at center |

This analogy maps a network of relations (central mass, orbiting bodies, attractive force, motion pattern). The systematicity — the connected structure — is what makes it powerful. It also has predictive value: it suggested (incorrectly, as it turned out) that electrons orbit in fixed paths, which led to the Bohr model.

---

## Analogical Reasoning (Holyoak)

Keith Holyoak's theory of analogical reasoning extends structure-mapping by emphasizing the *purpose* of the analogy. Analogies are not just structural alignments — they are tools for achieving goals.

### Key Concepts

1. **Purpose-Driven Mapping**: Which structural correspondences are relevant depends on what the analogy is being used for. The same two domains can support different analogies for different purposes.

2. **Pragmatic Constraints**: Real-world analogies are constrained by what the reasoner knows, what they are trying to achieve, and what aspects of the source are considered relevant.

3. **Schema Abstraction**: Repeated use of analogies can lead to the extraction of an abstract schema — a general pattern that is no longer tied to either specific domain. This is how cross-domain transfer becomes generalizable knowledge.

4. **Analogy as Inference**: Analogies are not just descriptions — they generate inferences. If A relates to B in the source domain, and A' maps to A, then the analogy suggests that B' (mapping to B) exists and relates to A' in the same way. This is how analogies produce new knowledge.

### The SAP (Structure-Abstraction-Purpose) Framework

Holyoak proposes three interacting constraints on analogical mapping:

- **Structural**: The relational correspondences between domains
- **Abstraction**: The level of generality at which the analogy operates
- **Purpose**: The goal that the analogy serves

Good analogies satisfy all three constraints simultaneously.

---

## Computational Models of Analogy

Several computational systems have been built to model and automate analogical reasoning:

### Structure-Mapping Engine (SME)

Falkenhainer, Forbus, and Gentner (1989) built SME to computationally implement structure-mapping theory. SME takes structured descriptions of two domains and finds the largest consistent mapping between them. It evaluates mappings based on systematicity (preferring connected relational structures over isolated relations).

### Analogical Mapping by Constraint Satisfaction (ACME)

Holyoak and Thagard's ACME (1989) uses a neural network that settles into a state representing the best analogical mapping. It balances structural, semantic, and pragmatic constraints simultaneously.

### Copycat

Hofstadter and Mitchell's Copycat (1995) models analogy-making in a microdomain (letter string analogies). It demonstrates how analogy emerges from the interaction of perceptual processes, rather than being a purely logical operation.

### Companion Cognitive Systems

Forbus and colleagues have built systems that learn by analogy over extended periods, accumulating a case library and using analogical retrieval to apply past experiences to new problems. This is closest to Context Weaver's approach — the knowledge graph serves as a growing case library of cross-domain connections.

---

## Evaluating Analogy Quality

Not all analogies are equally valuable. Context Weaver evaluates analogies on three dimensions:

### 1. Surface Similarity vs. Structural Similarity

- **Surface similarity**: Shared features or attributes (both involve water, both are round, both are old). Surface similarity is easy to detect but often misleading.
- **Structural similarity**: Shared relational patterns (both involve centralization, both exhibit feedback loops, both follow power-law distributions). Structural similarity is harder to detect but far more valuable.

Context Weaver prioritizes structural similarity and uses surface similarity only as an initial filter or for serendipity (where surprising connections are the goal).

### 2. Predictive Power

A good analogy does not just describe existing knowledge — it generates new inferences. The atom-solar system analogy was valuable not because it described what was known, but because it suggested specific hypotheses about electron behavior (some of which were correct).

### 3. Fruitfulness

A fruitful analogy opens up new lines of inquiry. It suggests experiments, raises questions, or reveals gaps in understanding. The most valuable analogies are those that the user continues to think about and explore after the conversation ends.

---

## Implementing Analogy Detection in Context Weaver

Context Weaver implements analogy detection through a multi-stage process:

### Stage 1: Domain Detection

The agent identifies which domain(s) the user is currently operating in, using facts from the `weave` namespace and the current conversation context. Domain detection uses keyword clustering, not rigid taxonomies — a user discussing "chords" might be in music theory or structural engineering, and context determines which.

### Stage 2: Structural Feature Extraction

For each identified domain, the agent extracts relational features: key entities, relationships between them, patterns, constraints, and principles. This extraction happens through the LLM, prompted to focus on relational structure rather than surface features.

### Stage 3: Cross-Domain Matching

The agent compares the structural features of the current domain against stored features of other domains in the knowledge graph. It looks for isomorphisms — matching relational patterns. The `analogyThreshold` parameter (default: 0.6) sets the minimum structural overlap for a connection to be suggested.

### Stage 4: Analogy Presentation

When a match is found, the agent presents the analogy with:

- The source and target domains clearly labeled
- The specific relational correspondences mapped
- Any inferences or predictions the analogy suggests
- A confidence rating based on structural depth and historical success of similar analogies

### Stage 5: Feedback and Learning

The user's response to the analogy is tracked. Did they find it useful? Did they explore it further? Did it lead to insights? This feedback updates the connection strength in the knowledge graph, improving future analogy suggestions.

---

## Analogy Types in the Knowledge Graph

The knowledge graph categorizes analogies by type, each with different characteristics:

| Type | Description | Example |
|------|-------------|---------|
| Structural | Matching relational patterns | Ecosystems and economic markets |
| Functional | Matching purpose or function | Immune system and cybersecurity |
| Procedural | Matching processes or methods | Evolution and iterative design |
| Causal | Matching causal mechanisms | Neural pruning and garden maintenance |
| Temporal | Matching time-based patterns | Civilizations and organism lifecycles |
| Spatial | Matching spatial or topological features | Brain connectivity and social networks |

Each type has different predictive power and different likelihood of generating fruitful insights. Structural and causal analogies tend to be most generative; surface and temporal analogies tend to be most accessible. Context Weaver tracks which types prove most useful for each user and adjusts its emphasis accordingly.
