# Experiments — Socratic Mentor

## Experiment 1: Socratic vs Direct Answer (Learning Retention)

### Hypothesis
Learners who receive Socratic questioning will retain knowledge significantly longer than learners who receive direct answers, even if direct-answer learners report higher initial satisfaction.

### Method
- Two groups of 20 participants each
- Both groups learn the same topic (e.g., JavaScript closures)
- Group A receives direct answers from a standard LLM
- Group B receives Socratic questioning from Socratic Mentor
- Post-session quiz immediately after, then 1 week later, then 1 month later
- Quiz tests all six Bloom's levels: recall, explain, apply, analyze, evaluate, create

### Metrics
- Quiz scores at each time interval (0-100)
- Time to complete learning session
- Number of turns in conversation
- Self-reported satisfaction (Likert scale 1-5)
- Self-reported confidence in understanding (Likert scale 1-5)

### Expected Results
- Group A scores higher on immediate quiz recall questions
- Group B scores significantly higher on 1-week and 1-month retention
- Group B scores higher on application and analysis questions at all intervals
- Group A reports higher initial satisfaction
- Group B reports higher confidence after the 1-week mark

### Sample Size Justification
20 participants per group provides 80% power to detect a 15-point difference in retention scores at alpha = 0.05, based on Hake (1998) effect sizes for interactive engagement.

---

## Experiment 2: Scaffolding Speed (Bloom's Level Progression)

### Hypothesis
The Bloom's taxonomy scaffolding engine will produce measurable cognitive progression within 10-15 interactions on a single topic, and the progression rate will correlate with long-term retention.

### Method
- 30 participants, each working through a structured topic with Socratic Mentor
- Agent logs Bloom's level after each interaction
- Measure: interactions needed to advance each Bloom's level
- Track: which question types are most effective at each level
- Follow-up quiz at 1 week to correlate progression speed with retention

### Metrics
- Interactions per Bloom's level transition
- Question types that triggered level transitions
- Correlation between scaffolding speed and 1-week retention
- Variance in progression speed across participants
- Failure-to-progress rate (participants stuck at a level for > 10 interactions)

### Expected Results
- Remember → Understand: 2-3 interactions
- Understand → Apply: 3-5 interactions
- Apply → Analyze: 4-6 interactions
- Analyze → Evaluate: 3-5 interactions
- Evaluate → Create: 4-7 interactions
- Faster progression correlates with higher retention (up to a point — too fast may indicate prior knowledge)

---

## Experiment 3: Frustration Detection Accuracy

### Hypothesis
The frustration detection subsystem (sentiment + repetition + duration) will correctly identify frustrated learners with > 80% accuracy and > 75% precision, enabling timely intervention before disengagement.

### Method
- 25 participants working through a challenging topic
- Participants self-report frustration level every 5 minutes (ground truth)
- Agent's frustration score is logged alongside
- Compare agent's frustration score with self-reported frustration
- Measure whether frustration-triggered mode shifts (to guided revelation) reduce disengagement

### Metrics
- Correlation between agent frustration score and self-report (Pearson's r)
- Precision: % of agent-detected frustration events that match self-report
- Recall: % of self-reported frustration events detected by agent
- F1 score (harmonic mean of precision and recall)
- Disengagement rate: participants who quit before completing the topic
- Recovery rate: frustrated participants who re-engage after mode shift

### Expected Results
- Frustration score correlates with self-report at r > 0.7
- Precision > 0.80, Recall > 0.75, F1 > 0.77
- Mode shifts triggered by frustration detection reduce disengagement by 40%
- Recovery rate > 60% for participants who receive timely mode shifts

---

## Experiment 4: Long-Term Knowledge Retention

### Hypothesis
Learners who complete a full Socratic Mentor session (reaching Bloom's Create level) will retain > 70% of knowledge after 3 months, compared to < 40% for direct-answer learners.

### Method
- Longitudinal study with 15 participants per group (Socratic vs direct)
- Same topic, same learning objectives
- Assessments at 1 week, 1 month, 3 months
- Assessment covers all Bloom's levels plus transfer tasks (applying knowledge to a different domain)
- Track knowledge state in brain throughout the learning period

### Metrics
- Retention score at each interval (percentage of knowledge retained)
- Transfer task performance (applying concepts to novel problems)
- Knowledge decay rate (slope of retention over time)
- Correlation between Bloom's level achieved and retention
- Confidence calibration (does learner's confidence match actual performance)

### Expected Results
- Socratic group retains > 70% at 3 months, direct group < 40%
- Socratic group outperforms on transfer tasks by 25%+
- Knowledge decay is slower for Socratic group (flatter slope)
- Learners who reached Bloom's Evaluate or Create retain > 85% at 3 months
- Socratic group shows better confidence calibration (knowing what they know and don't know)

---

## Cross-Experiment Analysis

After all four experiments, analyze:

1. **Interaction patterns** — Which question sequences produced the best outcomes?
2. **Individual differences** — Did prior knowledge, learning style, or topic familiarity moderate effects?
3. **Failure modes** — When did Socratic questioning fail? What characterized those situations?
4. **Optimal parameters** — What `maxQuestionsBeforeHint` and `revealThreshold` values produced the best balance of learning and engagement?
5. **Agent improvements** — What knowledge state tracking refinements would improve question selection?

## Running These Experiments

Each experiment can be run using the Socratic Mentor concept with logging enabled. Set in config.yml:

```yaml
socratic:
  experimentMode: true
  logLevel: verbose
  logInteractions: true
  logStateTransitions: true
  logFrustrationScores: true
  logQuestionTypes: true
```

Logged data is stored in the brain's facts namespace under `socratic.experiment.*` and can be exported for analysis.
