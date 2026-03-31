# Bloom's Taxonomy — Knowledge Base

## Overview

Bloom's taxonomy is a hierarchical framework for classifying educational learning objectives into levels of complexity and specificity. Originally published in 1956 by Benjamin Bloom and a committee of educators, it was revised in 2001 by Anderson and Krathwohl (Bloom's former students) to better reflect contemporary understanding of cognitive processes.

The taxonomy provides the scaffolding backbone for Socratic Mentor. Each learner's position on the taxonomy is tracked per topic, and questions are calibrated to the appropriate cognitive level. The goal is to progressively move learners from lower-order thinking (remembering, understanding) to higher-order thinking (evaluating, creating).

## The Original Taxonomy (Bloom, 1956)

The original taxonomy presented six levels in a strict hierarchy:

1. **Knowledge** — Recall of facts, terms, basic concepts
2. **Comprehension** — Understanding meaning, interpretation, extrapolation
3. **Application** — Using knowledge in new situations
4. **Analysis** — Breaking information into parts, identifying relationships
5. **Synthesis** — Combining elements to form something new
6. **Evaluation** — Making judgments based on criteria and standards

## The Revised Taxonomy (Anderson & Krathwohl, 2001)

The revision made several important changes:

- Renamed levels from nouns to verbs (emphasizing the process, not the product)
- Changed "Synthesis" to "Create" and moved it to the top
- Renamed "Knowledge" to "Remember" and "Comprehension" to "Understand"
- Added a knowledge dimension (factual, conceptual, procedural, metacognitive) alongside the cognitive process dimension

The revised levels, from lowest to highest complexity:

### Level 1: Remember
Retrieving, recognizing, and recalling relevant knowledge from long-term memory.

- **Recognize** — Identifying previously learned material
- **Recall** — Retrieving relevant knowledge from long-term memory

Socratic Mentor questions at this level:
- "What is the definition of...?"
- "Can you recall the key properties of...?"
- "What did we establish earlier about...?"

### Level 2: Understand
Determining the meaning of instructional messages, including oral, written, and graphic communication.

- **Interpret** — Changing from one form of representation to another
- **Exemplify** — Finding a specific example of a general concept
- **Classify** — Determining that something belongs to a category
- **Summarize** — Abstracting a general theme or major point
- **Infer** — Drawing a logical conclusion from presented information
- **Compare** — Detecting correspondences between two ideas
- **Explain** — Constructing a cause-and-effect model of a system

Socratic Mentor questions at this level:
- "Can you explain that in your own words?"
- "How would you summarize what we've discussed?"
- "What's an example of this concept in practice?"
- "How does this compare to what we covered before?"

### Level 3: Apply
Carrying out or using a procedure in a given situation.

- **Execute** — Applying a procedure to a familiar task
- **Implement** — Applying a procedure to an unfamiliar task

Socratic Mentor questions at this level:
- "How would you use this to solve...?"
- "What would happen if you applied this to...?"
- "Can you walk through how this would work in this scenario?"

### Level 4: Analyze
Breaking material into its constituent parts and detecting how the parts relate to one another and to an overall structure.

- **Differentiate** — Distinguishing relevant from irrelevant parts
- **Organize** — Identifying how elements fit into a structure
- **Attribute** — Determining the point of view, bias, or intent

Socratic Mentor questions at this level:
- "What are the component parts of this?"
- "How do these elements relate to each other?"
- "What assumptions are embedded in this approach?"
- "How does this differ from the alternative?"

### Level 5: Evaluate
Making judgments based on criteria and standards.

- **Check** — Detecting inconsistencies or fallacies
- **Critique** — Judging a product based on specified criteria

Socratic Mentor questions at this level:
- "Which approach is better and why?"
- "What are the strengths and weaknesses of...?"
- "How would you defend this against criticism?"
- "What criteria would you use to judge...?"

### Level 6: Create
Putting elements together to form a novel, coherent whole or make an original product.

- **Generate** — Coming up with alternatives or hypotheses
- **Plan** — Devising a procedure for accomplishing a task
- **Produce** — Inventing a product

Socratic Mentor questions at this level:
- "Can you design a system that...?"
- "What would an entirely new approach look like?"
- "How would you synthesize what we've covered into...?"
- "Can you create something that solves...?"

## Knowledge Dimension

The revised taxonomy adds a second dimension — the type of knowledge being targeted:

| | Factual | Conceptual | Procedural | Metacognitive |
|---|---|---|---|---|
| **Remember** | Terms, details | Categories, principles | Steps, algorithms | Strategies, self-knowledge |
| **Understand** | Fact interpretation | Theory understanding | Procedure comprehension | Awareness of learning strategies |
| **Apply** | Fact usage | Concept application | Skill execution | Strategy application |
| **Analyze** | Fact examination | Concept breakdown | Technique analysis | Strategy evaluation |
| **Evaluate** | Fact verification | Theory assessment | Procedure judgment | Strategy selection |
| **Create** | Fact combination | Theory construction | Procedure design | Strategy invention |

Socratic Mentor primarily targets conceptual and procedural knowledge across all six cognitive levels. Factual knowledge is addressed through lower-level questioning, and metacognitive knowledge is developed through questions-about-the-question.

## How the Agent Uses Bloom's for Scaffolding

The scaffolding process follows a specific protocol:

1. **Assessment** — The agent determines the learner's current Bloom's level on a topic through questioning and response analysis
2. **Targeting** — Questions are generated at the current level plus one level above (zone of proximal development)
3. **Advancement** — After consistent demonstration of competence (3+ correct at a level), the target moves up
4. **Regression** — If the learner struggles (2+ incorrect), the target moves back to solidify the foundation
5. **Mastery** — When a learner reaches Create level for a topic, the topic is marked as mastered in the knowledge state

### Measuring Cognitive Complexity

The agent uses several signals to assess Bloom's level:

- **Vocabulary used** — "I remember" vs "I think" vs "I would argue" indicates different levels
- **Response structure** — Single facts vs explanations vs comparisons vs original constructions
- **Error patterns** — Errors at Level 2 look different from errors at Level 4
- **Question responses** — How the learner handles increasingly complex questions
- **Spontaneous connections** — Learners at higher levels connect ideas without prompting

### Bloom's Level and Question Type Alignment

Not all Socratic question types are equally effective at all Bloom's levels:

| Bloom's Level | Most Effective Question Types |
|---|---|
| Remember | Clarification |
| Understand | Clarification, Probing Assumptions |
| Apply | Probing Evidence, Probing Implications |
| Analyze | Probing Assumptions, Viewpoint Perspectives |
| Evaluate | Viewpoint Perspectives, Questions About the Question |
| Create | Questions About the Question, Probing Implications |

The agent uses this alignment to select question types that are most likely to stimulate the target cognitive level.

## Progression Tracking in the Agent

The knowledge state tracks Bloom's level per concept within a topic. A learner might be at Level 3 (Apply) for basic closure syntax but Level 1 (Remember) for closure performance implications. This granularity prevents the agent from assuming uniform understanding across a topic.

The brain stores this as:
```
socratic.{userId}.{topic}.concepts.{concept}.bloomLevel = {1-6}
```

Progression events are logged as memories:
```
"Bloom's level for {topic}.{concept} advanced from {N} to {N+1} after correctly {demonstration}"
```

This creates a complete learning history that can be reviewed by the learner or used by the agent to understand a learner's trajectory.

## Practical Implementation Considerations

- Bloom's level assessment is approximate, not precise. The agent treats it as a probabilistic estimate, not a definitive classification.
- Learners may skip levels. Some concepts are intuitive enough that a learner moves directly from Remember to Apply. The agent detects this and adjusts.
- Different topics may have different "natural" starting levels. A topic the learner has background in might start at Level 2 or 3 rather than Level 1.
- The revised taxonomy (2001) is preferred over the original (1956) because it better reflects the creative and evaluative thinking that the Socratic method aims to develop.
- Cultural factors affect comfort with different Bloom's levels. Some learners are more comfortable with analysis than with creative generation. The agent adapts to individual patterns.
