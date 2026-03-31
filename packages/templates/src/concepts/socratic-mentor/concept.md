# Socratic Mentor — Concept Overview

## What Is This?

Socratic Mentor is a question-first AI agent that guides users to their own answers using the Socratic method. Rather than serving information on a plate, it asks probing questions that lead the learner through structured reasoning. It is a deliberate inversion of how large language models typically behave — instead of racing to provide the most complete answer in the fewest turns, Socratic Mentor treats every question as an opportunity to deepen understanding through guided discovery.

This concept is built as a cocapn template. The soul.md defines the agent's personality and behavioral constraints. The config.yml wires the Socratic-specific features into the bridge. The wiki provides the knowledge base the agent draws from. Together, they produce an agent that fundamentally resists the "just answer" impulse baked into every modern LLM.

## Why This Is Novel

Every major LLM is trained to be helpful, and "helpful" has been optimized to mean "answer quickly and completely." This creates an anti-pattern: the model that gives you the answer fastest wins. But decades of education research show that immediate answers produce fragile, shallow learning. The Socratic method — asking questions that force the learner to construct their own understanding — produces deeper, more durable knowledge.

Building a Socratic agent means fighting the model's training. The LLM wants to answer. The system prompt, the config, the question-first pipeline, the scaffolding engine — all of it exists to redirect that impulse into questioning. This is architecturally interesting because it requires:

1. **Question generation as a first-class capability** — not a fallback, but the primary response mode
2. **Knowledge state tracking** — the agent must model what the user knows to ask the right next question
3. **Frustration detection** — pure Socratic questioning can frustrate learners; the agent must know when to shift strategy
4. **Strategic revelation** — knowing when to break from questioning and provide information is as important as knowing what to ask

No mainstream AI assistant does this. They are answer engines. Socratic Mentor is an understanding engine.

## Socratic Method Foundations

The Socratic method traces back to Socrates as depicted in Plato's dialogues. The core technique is elenchus — a form of cooperative argumentative dialogue that stimulates critical thinking and draws out implicit assumptions. Socrates never lectured. He asked questions that exposed contradictions in his interlocutors' thinking, then helped them reconstruct more coherent positions.

Six canonical types of Socratic questioning form the backbone of this agent:

1. **Clarification questions** — "What exactly do you mean by...?" Forces precision.
2. **Probing assumptions** — "What are you assuming when you say that?" Exposes hidden premises.
3. **Probing evidence and reasons** — "What evidence supports that view?" Demands justification.
4. **Questioning viewpoints and perspectives** — "How might someone who disagrees respond?" Builds intellectual empathy.
5. **Probing implications and consequences** — "If that's true, what else follows?" Tests logical consistency.
6. **Questions about the question** — "Why is this question important?" Develops metacognition.

The agent cycles through these types based on the learner's current state, the topic, and the observed reasoning path. Clarification comes first when the topic is new. Probing assumptions kicks in once the learner has stated a position. Implications come when the reasoning chain is long enough to stress-test.

## Bloom's Taxonomy Integration

Bloom's taxonomy provides the scaffolding ladder. The agent maps each learner's current cognitive level on a per-topic basis and adjusts question complexity accordingly:

- **Remember** (Level 1) — Can the learner recall relevant facts? Questions focus on retrieval.
- **Understand** (Level 2) — Can the learner explain in their own words? Questions demand paraphrase and interpretation.
- **Apply** (Level 3) — Can the learner use knowledge in new situations? Questions present novel scenarios.
- **Analyze** (Level 4) — Can the learner break down and compare? Questions demand decomposition and differentiation.
- **Evaluate** (Level 5) — Can the learner judge and critique? Questions demand argumentation and defense.
- **Create** (Level 6) — Can the learner synthesize something new? Questions demand original construction.

The agent tracks Bloom's level per topic in the brain's knowledge state. When a learner demonstrates consistent competence at one level, the next interaction shifts to the next level. If the learner struggles, the agent drops back and strengthens the foundation before advancing again.

## Knowledge State Tracking

The most technically ambitious part of this concept is the knowledge state model. For each user and each topic discussed, the agent maintains:

- **Known concepts** — The user has demonstrated understanding (confidence: 0.8-1.0)
- **Guessed concepts** — The user seems to know but hasn't verified (confidence: 0.4-0.7)
- **Unknown concepts** — The user has not engaged with this idea (confidence: 0.0-0.3)
- **Misconceptions** — The user holds an incorrect model (flagged, tracked separately)
- **Bloom's level** — Current cognitive complexity on this topic
- **Frustration indicators** — Sentiment trend, repetition count, explicit frustration signals

This state persists across sessions through the cocapn brain. When the user returns, the agent picks up where they left off. The knowledge state informs question selection: known topics get higher-level questions, unknown topics get foundational clarification questions, misconceptions trigger targeted probing.

## Resisting the "Just Answer" Temptation

LLMs are trained with RLHF to be helpful. "Helpful" usually means "give the answer." The Socratic Mentor concept builds multiple resistance layers:

1. **System prompt constraints** — soul.md explicitly forbids direct answers when a question would serve better
2. **Question-first pipeline** — The config enforces `questionFirstMode: true`, making questioning the default response behavior
3. **Reveal threshold** — `revealThreshold: 0.8` means the user must demonstrate 80% of the reasoning before the agent fills in the gap
4. **Max questions before hint** — `maxQuestionsBeforeHint: 5` prevents infinite Socratic loops
5. **Frustration detection** — Sentiment analysis detects when questioning becomes counterproductive and shifts to guided revelation

The agent does not refuse to answer. It prioritizes questioning, but it recognizes that pure Socratic dialogue is not always appropriate. When the user explicitly requests an answer, when frustration is detected, or when the questioning loop has cycled enough times, the agent provides the information — but frames it within the reasoning the user has already constructed.

## Research Backing

The Socratic method has substantial research support in education literature:

- **Hake (1998)** — Interactive engagement methods (including Socratic dialogue) produced twice the learning gains of traditional instruction in physics
- **Frederick (2005)** — The Socratic method in law education produces deeper analytical thinking than lecture-based approaches
- **Paul and Elder (2007)** — Socratic questioning is the most effective method for developing critical thinking when integrated into content instruction
- **Bangert-Drowns and Bankert (1990)** — Effects of teaching Socratic questioning on critical thinking showed significant gains
- **Vygotsky (1978)** — Zone of proximal development provides the theoretical basis for scaffolding questions at the right difficulty

The Bloom's taxonomy scaffolding is supported by Anderson and Krathwohl's (2001) revision, which provides empirical grounding for the progression from lower to higher-order thinking.

## Cocapn Integration

This concept leverages cocapn's architecture in several specific ways:

### Brain for Persistent Knowledge State
The brain's facts and memories stores hold the per-user knowledge state. Each topic discussed generates facts like `socratic.user123.javascript.closures.level: 3` (Bloom's level 3 = Apply) and memories capturing specific misconceptions observed. This state persists across sessions and survives restarts.

### Soul.md as Behavioral Contract
The soul.md doesn't just suggest questioning behavior — it defines it as the agent's identity. "You are Socratic Mentor" is not a costume; it's the agent's operational definition. The constraints ("never answer directly when a good question would serve better") are not suggestions — they are the behavioral contract.

### Config as Enforcement Layer
The config.yml doesn't just configure features — it enforces the questioning discipline. `questionFirstMode: true` is a runtime constraint. `revealThreshold: 0.8` is a quantitative guardrail. These aren't prompt engineering tricks; they are system-level controls that the bridge enforces.

### Wiki as Knowledge Base
The three wiki documents (socratic-method, bloom-taxonomy, critical-thinking) provide the agent's domain knowledge. When the agent needs to ask about Socratic questioning types, it draws from its own wiki. When it needs to understand Bloom's levels to scaffold correctly, the taxonomy document is in its knowledge store. The agent is a subject matter expert in its own methodology.

### Publishing Layer for Public Face
The publishing layer ensures that the agent's public-facing interactions maintain the Socratic discipline without revealing private learning data. A user's knowledge state, misconceptions, and frustration history are private facts that never leave the brain.

## When to Use This Concept

Socratic Mentor is ideal for:
- **Technical education** — Programming, mathematics, science where reasoning matters more than facts
- **Critical thinking development** — Philosophy, ethics, argumentation
- **Problem-solving training** — Engineering, design, strategy where the process matters as much as the answer
- **Exam preparation** — Active recall through questioning beats passive review
- **Mentorship programs** — Senior developers mentoring juniors through guided discovery

It is not ideal for:
- **Emergency information** — When the user needs a fact immediately (medical, safety, time-critical)
- **Creative collaboration** — When the goal is ideation rather than understanding
- **Simple lookups** — When the user genuinely just needs a quick fact

## Future Directions

- **Multi-learner Socratic seminars** — Extending to group questioning dynamics
- **Adaptive question generation** — Fine-tuned model for generating pedagogically optimal questions
- **Learning analytics dashboard** — Visualizing knowledge state progression over time
- **Cross-topic knowledge transfer** — Detecting when understanding in one domain scaffolds another
- **Socratic dialogue datasets** — Training data for specialized question-generation models
