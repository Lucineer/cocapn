# Implementation Notes — Socratic Mentor

## Architecture Overview

The Socratic Mentor concept is implemented through five interconnected subsystems that work together to produce question-first behavior while maintaining learner engagement.

### 1. Question Generator

The question generator is the core subsystem. It takes as input: the user's message, the current knowledge state for the relevant topic, the Bloom's level, the conversation history, and the active question type. It produces as output: the next question to ask, the question type used, the expected knowledge gap being probed, and an updated knowledge state.

The generator operates as a pipeline:

1. **Topic extraction** — Identify what domain the user's message relates to
2. **State lookup** — Retrieve the knowledge state for this user + topic from brain
3. **Bloom's level assessment** — Determine current cognitive level from state
4. **Question type selection** — Choose the Socratic question type based on state and level
5. **Question formulation** — Generate the actual question using the LLM with question-first constraints
6. **State update** — Record the interaction and update confidence levels

The question generator is intentionally the only subsystem that calls the LLM. All other subsystems are deterministic logic.

### 2. Knowledge State Model

Each user-topic pair has a knowledge state represented as a JSON structure:

```json
{
  "topic": "javascript-closures",
  "concepts": {
    "lexical-scope": { "status": "known", "confidence": 0.9, "bloomLevel": 4 },
    "closure-mechanism": { "status": "guessed", "confidence": 0.6, "bloomLevel": 2 },
    "practical-application": { "status": "unknown", "confidence": 0.1, "bloomLevel": 0 }
  },
  "misconceptions": [
    { "concept": "closure-mechanism", "description": "Believes closures copy values rather than reference environment", "detected": "2025-01-15", "resolved": false }
  ],
  "bloomLevel": 2,
  "interactions": 12,
  "lastActive": "2025-01-15T10:30:00Z",
  "frustrationScore": 0.2,
  "questionTypeHistory": ["clarification", "clarification", "probing-assumptions", "probing-evidence"]
}
```

This state is stored in the brain's facts namespace under the `socratic` prefix. The brain's persistence ensures the state survives sessions and restarts.

### 3. Scaffolding Engine

The scaffolding engine controls Bloom's level progression. It reads the knowledge state and determines whether the learner is ready to advance. Advancement criteria:

- At least 3 correct demonstrations at the current Bloom's level
- No unresolved misconceptions at the current level
- Frustration score below 0.5
- At least 2 different question types used at the current level

Regression criteria (dropping back a level):
- Two consecutive incorrect responses at the current level
- Frustration score above 0.6
- Explicit request from the user to go back to basics
- New misconception detected at the current level

### 4. Misconception Detector

The misconception detector analyzes user responses for signs of incorrect mental models. It looks for:

- **Contradictions** — The user states something that contradicts their earlier statement
- **Category errors** — The user confuses concepts from different domains
- **Overgeneralization** — The user applies a rule beyond its valid scope
- **Undergeneralization** — The user fails to apply a rule where it is valid
- **False analogies** — The user draws incorrect parallels between unrelated concepts

When a misconception is detected, it is logged in the knowledge state and the question generator shifts to targeted probing questions that expose the misconception without directly correcting it.

### 5. Frustration Detection

Frustration is estimated from three signals:

- **Sentiment analysis** — Negative sentiment in user messages (weighted 0.4)
- **Repetition detection** — User restating the same point or asking "just tell me" multiple times (weighted 0.3)
- **Session duration** — Time spent on a single topic without progression (weighted 0.3)

When the frustration score exceeds 0.6, the agent shifts from pure Socratic questioning to guided revelation. Instead of asking another question, it provides a partial answer framed within the user's existing reasoning, then asks a confirmatory question. This maintains the question-first philosophy while preventing the agent from becoming an obstacle to learning.

## Knowledge State Persistence

The knowledge state is persisted through the brain's facts store:

- **Facts** — Bloom's levels per topic, overall frustration indicators, learning preferences
- **Memories** — Specific misconceptions, questions that unlocked understanding, reasoning patterns
- **Procedures** — Learned question sequences that worked for similar learners (future)

The brain's autoSync feature ensures state is committed to git regularly, providing a complete learning history.

## Question Selection Algorithm

The question selection algorithm prioritizes question types based on the learner's state:

```
IF topic is new → start with clarification questions
IF user stated a position → probe assumptions
IF user provided evidence → probe evidence quality
IF reasoning chain > 3 steps → probe implications
IF user seems confident → introduce alternative viewpoints
IF user is frustrated → shift to guided revelation (not a question type, a mode change)
IF user explicitly asks for answer → check revealThreshold, provide if met
```

The algorithm avoids repeating the same question type more than twice in a row and rotates through types to ensure broad cognitive engagement.

## Hint Generation

When `maxQuestionsBeforeHint` is reached (default: 5) without the learner progressing, the agent generates a hint rather than another question. Hints are structured as:

1. Acknowledge the reasoning the user has demonstrated
2. Point to the specific gap in their reasoning
3. Provide a concrete example or analogy that bridges the gap
4. End with a simpler question that should be answerable with the hint

This keeps the interaction in the question-first framework while preventing dead-end loops.

## Integration with Brain

The brain integration uses the `socratic` facts namespace to avoid collisions with other agents. Key fact keys:

- `socratic.{userId}.{topic}.bloomLevel` — Current Bloom's level
- `socratic.{userId}.{topic}.frustration` — Current frustration score
- `socratic.{userId}.{topic}.concepts.{conceptName}.status` — Known/guessed/unknown
- `socratic.{userId}.{topic}.concepts.{conceptName}.confidence` — 0.0 to 1.0

Memories store qualitative data: specific misconceptions, reasoning patterns, breakthrough moments, and questions that were particularly effective.

## Performance Considerations

- Knowledge state lookups should be cached per session to avoid repeated brain reads
- Frustration score is recalculated on each message (lightweight computation)
- Bloom's level re-evaluation happens every 3 interactions (not every message)
- Misconception detection runs on every user message but is a simple pattern matcher
- The full knowledge state is written back to brain only when the conversation topic changes or the session ends
