# Context Weaver — Concept Document

## Overview

Context Weaver is an agent concept built around a single powerful idea: **the most creative insights emerge at the intersection of previously unrelated domains**. Most AI assistants are excellent within a single domain — they can help you code, help you write, or help you analyze data. But they rarely help you see that a pattern you recognize in music theory has a direct analogue in software architecture, or that a biological mechanism maps cleanly onto an organizational design challenge.

Context Weaver exists to bridge those gaps. It is a cross-domain synthesis agent that builds a growing knowledge map of connections between fields, tracks which connections prove useful, and actively introduces serendipitous ideas from unexpected domains into the user's thinking.

The agent's knowledge graph lives in the repo itself, in the wiki, accumulating over time. Each user session potentially adds new cross-domain connections, new analogies, and new transfer-learning insights. The repo becomes a personalized creativity engine.

---

## Why This Is Novel

Most agents stay in their lane. A coding assistant helps you code. A writing assistant helps you write. A research assistant helps you research. These agents are optimized for depth within a single domain — and that optimization is valuable. But it leaves a gap: the space *between* domains, where some of the most creative and impactful ideas live.

Consider the history of innovation. The field of bio-inspired engineering emerged when engineers started paying attention to how organisms solve physical problems. Velcro came from burrs sticking to a dog's fur. The Wright brothers' wing-warping technique came from observing birds. Japanese bullet trains were redesigned based on the kingfisher's beak. None of these innovations came from going deeper within a single field — they came from bridging two fields.

Context Weaver is designed to systematically explore those bridges. It does not replace domain-specific expertise. It complements it by introducing structured lateral thinking, analogy generation, and cross-domain knowledge transfer into every conversation.

This approach is grounded in Koestler's theory of bisociation — the creative act of connecting two previously unrelated matrices of thought. Where association connects ideas within a single matrix (a single domain), bisociation connects ideas across matrices. Context Weaver is, at its core, a bisociation engine.

---

## Lateral Thinking and Bisociation

Edward de Bono coined the term "lateral thinking" in 1967 to describe a way of solving problems through indirect and creative approaches, rather than through step-by-step logic (which he called "vertical thinking"). Lateral thinking techniques include:

- **Random entry**: introducing a randomly chosen word or concept and forcing a connection to the problem at hand
- **Provocation (PO)**: deliberately making a statement that is known to be wrong or impossible, then exploring where it leads
- **Challenge**: questioning assumptions that everyone in a domain takes for granted
- **Fractionation**: breaking a problem into smaller parts and recombining them differently

Arthur Koestler's bisociation theory, outlined in *The Act of Creation* (1964), provides the theoretical foundation. Koestler argued that all creative acts — in humor, art, and science — involve the intersection of two habitually incompatible frames of reference. The punchline of a joke bisociates two unexpected meanings. A scientific discovery bisociates two previously separate theoretical frameworks. A work of art bisociates two emotional or perceptual matrices.

Context Weaver implements both lateral thinking and bisociation as operational patterns:

- **Random entry** becomes the Serendipity Engine — introducing concepts from distant domains
- **Provocation** becomes the "what if we flipped this?" pattern in analogy generation
- **Challenge** becomes domain boundary exploration — questioning why domains are separated
- **Bisociation** becomes the core operation — finding structural overlap between two domains

---

## Analogy as a Cognitive Tool

Analogy is not merely a literary device. Cognitive scientists have shown that analogy is one of the fundamental mechanisms of human cognition. Dedre Gentner's structure-mapping theory (1983) demonstrates that analogies work by aligning the relational structure between two domains, not by matching surface features. A good analogy maps the *relationships* between entities in one domain to the *relationships* between entities in another.

Keith Holyoak's work on analogical reasoning extends this: analogy is how humans transfer knowledge from a familiar "source" domain to a novel "target" domain. When you understand electricity by analogy to water flow, you are transferring relational knowledge (pressure, flow, resistance) from one domain to another.

Context Weaver uses analogy as its primary bridging tool. It does not look for surface-level word associations. It looks for structural isomorphisms — cases where the *pattern of relationships* in one domain matches the *pattern of relationships* in another. This is what makes its connections valuable rather than merely surprising.

The agent evaluates analogy quality on three dimensions:

1. **Structural depth**: How deep is the relational match? A single shared relation is weak; a network of corresponding relations is strong.
2. **Predictive power**: Does the analogy suggest anything new about the target domain? If it only maps what you already know, it is illustrative but not generative.
3. **Fruitfulness**: Does the analogy open up new lines of inquiry? The best analogies don't just explain — they generate hypotheses.

---

## Cross-Domain Knowledge Graphs

The agent's core data structure is a cross-domain knowledge graph. This graph lives in the wiki and grows over time. Nodes represent concepts from any domain. Edges represent relationships — both within-domain (standard knowledge graph) and cross-domain (the novel part).

Cross-domain edges carry metadata:

- **Connection type**: analogy, causal, structural, historical, methodological, metaphorical
- **Strength**: initially scored by the analogy engine, updated based on user feedback
- **Source**: how the connection was discovered (user conversation, serendipity injection, literature)
- **Fruitfulness**: has this connection led to useful insights? Tracked over time

The graph is stored as markdown in the wiki, making it version-controlled, human-readable, and editable. The `wiki/cross-domain-map.md` file serves as the primary store. Additional wiki pages provide deeper explorations of specific connections.

Over time, this graph becomes a personalized creativity tool. It reflects the user's unique combination of interests and the connections the agent has discovered. No two users will have the same graph.

---

## Transfer Learning Applied to Reasoning

In machine learning, transfer learning means applying knowledge gained in one task to a different but related task. Context Weaver applies this principle to human reasoning: identifying when skills, patterns, or mental models from one domain can be transferred to another.

This goes beyond analogy. Analogy maps structure between domains. Transfer learning maps *skills and processes*. For example:

- A user who is skilled at debugging code has a transferable skill: systematic hypothesis testing. This applies to debugging mechanical systems, organizational problems, and even personal habits.
- A user trained in musical improvisation has transferable skills: real-time pattern recognition, constraint satisfaction under time pressure, and the ability to work within a structure while breaking specific rules.
- A user experienced in project management has transferable skills: decomposition of large tasks, dependency tracking, and resource allocation — applicable to creative projects, event planning, and research programs.

Context Weaver identifies these transfer opportunities by maintaining a map of skills the user has demonstrated (stored in facts and memories) and a library of skill-decomposition patterns that span domains.

---

## Research Backing

The design of Context Weaver draws on several established research traditions:

- **Koestler (1964)**: *The Act of Creation* — bisociation as the mechanism of creativity
- **Gentner (1983)**: Structure-mapping theory — analogy as structural alignment
- **Holyoak & Thagard (1995)**: *Mental Leaps* — analogical thinking in creativity and decision-making
- **de Bono (1967, 1970)**: *The Use of Lateral Thinking*, *Lateral Thinking* — systematic creativity techniques
- **Fauconnier & Turner (2002)**: *The Way We Think* — conceptual blending as a fundamental cognitive operation
- **Hofstadter (2001)**: *Analogy as the Core of Cognition* — analogy as the engine of thought
- **Dunbar & Klahr (2012)**: *Scientific Thinking and Reasoning* — cross-domain analogies in scientific discovery
- **Ward, Smith & Vaid (1997)**: *Creative Thought* — conceptual combination and creative cognition

---

## Cocapn Integration

Context Weaver is designed as a cocapn concept, leveraging the platform's unique capabilities:

**Wiki as Knowledge Graph**: The cross-domain knowledge map lives in the wiki, version-controlled by git. It grows organically with each session. Users can edit it directly, and the agent can read and update it. This is the "repo IS the agent" principle in action — the knowledge graph is part of the repo, part of the agent's identity.

**Facts for Domain Detection**: The agent stores user interest domains as facts (in the `weave` namespace). These facts inform domain detection, allowing the agent to tailor its cross-domain suggestions to the user's actual interests rather than generic connections.

**Memories for Connection Tracking**: Each discovered cross-domain connection is stored as a memory entry with metadata (connection type, strength, source). The agent uses these memories to avoid repeating connections and to prioritize fruitful areas.

**Soul-Driven Personality**: The agent's personality — curious, creative, respectful, playful — is defined in soul.md and can be modified by the user. The personality affects how connections are presented: a more playful soul might present wilder analogies; a more scholarly soul might focus on historically documented cross-domain innovations.

**Git History as Insight Source**: Over time, the git history of the wiki and knowledge graph becomes a record of the user's creative journey — which connections were explored, which proved valuable, and how thinking evolved. This is the RepoLearner concept applied to cross-domain synthesis.

**Templates for Structured Exploration**: The concept includes templates for structured activities: cross-domain analysis (systematic comparison of two domains), analogy maps (visual relationship mapping), serendipity journals (recording unexpected connections), and transfer insights (documenting skill transfer opportunities).

**Growing Over Time**: Unlike a stateless chatbot, Context Weaver accumulates knowledge. Each session potentially adds new connections, strengthens existing ones, and prunes ones that proved unfruitful. The repo becomes an increasingly valuable creativity tool specific to this user.
