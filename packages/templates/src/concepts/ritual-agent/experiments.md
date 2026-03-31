# Experiments — Ritual Agent

This document outlines a series of experiments designed to validate the Ritual Agent concept and measure its impact on user engagement, habit formation, and subjective wellbeing. Each experiment includes a hypothesis, methodology, metrics, and success criteria.

## Experiment 1: Ritual Engagement Over Time

**Question**: Do users sustain engagement with agent-led rituals over time, or does participation decay as novelty wears off?

**Hypothesis**: Users who receive time-aware, personalized rituals will maintain significantly higher engagement at 30 and 90 days compared to users who receive generic, non-time-aware reminders.

**Method**:
- **Group A (treatment)**: Full Ritual Agent with time-aware personality modulation, seasonal themes, milestone celebrations, and adaptive scheduling.
- **Group B (control)**: Static reminder agent that sends the same generic prompts at the same times daily, with no personality modulation or milestone tracking.
- **Duration**: 90 days.
- **Sample size**: 50 users per group (minimum).

**Metrics**:
- Ritual completion rate (percentage of scheduled rituals the user engages with)
- 7-day, 30-day, and 90-day retention rates
- Average engagement depth (length of interaction during rituals, measured in turns)
- Self-reported ritual satisfaction (weekly survey, 1-5 scale)

**Success criteria**: Group A shows at least 25% higher 30-day retention and 40% higher 90-day retention compared to Group B, with statistical significance (p < 0.05).

**Rationale**: This is the foundational experiment. If time-aware personalization does not improve retention, the core premise of the Ritual Agent needs rethinking. The 90-day window is chosen because Lally et al. (2010) found median habit formation time is 66 days — we need to measure past that threshold.

---

## Experiment 2: Time-Aware Personality Shifts and User Perception

**Question**: Do users notice and appreciate the agent's time-of-day and seasonal personality shifts? Does this awareness affect perceived relationship quality?

**Hypothesis**: Users will rate the time-aware agent as more "natural," "attuned," and "trustworthy" than a version without time-aware modulation, even if they cannot articulate exactly what is different.

**Method**:
- **Phase 1 (2 weeks)**: Users interact with the agent with time-aware modulation enabled. No mention is made of the feature.
- **Phase 2 (2 weeks)**: Time-aware modulation is silently disabled. The agent uses a flat, context-independent personality at all hours.
- **Phase 2 variant**: Alternatively, randomize which users get time-aware vs flat personality across the entire 4-week period (between-subjects design).
- **Survey**: After each phase, users complete a survey measuring perceived naturalness, attunement, trustworthiness, and relationship quality (adapted from parasocial relationship scales).

**Metrics**:
- Perceived naturalness (1-7 Likert scale)
- Perceived attunement ("This agent understands me" — 1-7)
- Trust rating (1-7)
- Open-ended responses about what users noticed changing
- Engagement metrics as secondary measures (completion rate, depth)

**Success criteria**: Statistically significant increase in perceived naturalness and attunement during the time-aware phase (p < 0.05), with at least 30% of users spontaneously mentioning time-related differences in open-ended responses.

**Rationale**: The personality modulation is subtle by design. This experiment tests whether subtlety is perceptible and valued, or whether it is too subtle to matter. If users do not notice it, we may need to make shifts more pronounced.

---

## Experiment 3: Habit Tracking and Goal Achievement

**Question**: Does structured habit tracking within the ritual framework lead to better goal outcomes compared to unstructured tracking?

**Hypothesis**: Users who track habits through the Ritual Agent's cue-routine-reward framework with implementation intentions will achieve their stated goals at a higher rate than users who track habits with a simple binary check-off system.

**Method**:
- **Group A (treatment)**: Full habit loop support — cue identification, routine specification, reward articulation, implementation intentions, streak tracking, weekly habit review.
- **Group B (control)**: Simple habit checklist — user defines habits and checks them off daily. No cue-routine-reward structure, no implementation intentions, no weekly habit review.
- **Duration**: 60 days.
- **Users set 1-3 specific goals at the start.**

**Metrics**:
- Goal achievement rate (percentage of stated goals achieved or meaningfully progressed)
- Habit completion rate (days with habit completed / total days)
- Streak length (average longest streak per habit)
- Self-efficacy rating (adapted from Schwarzer's General Self-Efficacy Scale, administered at start and end)
- Implementation intention specificity (rated by independent coders for Group A)

**Success criteria**: Group A achieves at least 20% higher goal achievement rate and 15% higher habit completion rate compared to Group B, with statistical significance (p < 0.05).

**Rationale**: Implementation intentions have strong research backing (Gollwitzer and Sheeran, 2006 meta-analysis: d = 0.65), but most of this research is lab-based. This experiment tests whether the effect replicates in a real-world, agent-mediated context over an extended period.

---

## Experiment 4: Milestone Celebrations and User Retention

**Question**: Do milestone celebrations (ceremonial acknowledgment of achievements like habit streaks, anniversaries, and progress markers) measurably affect user retention and engagement?

**Hypothesis**: Users who receive milestone celebrations will show higher long-term retention and report higher satisfaction than users who achieve the same milestones without ceremonial acknowledgment.

**Method**:
- **Group A (treatment)**: Full milestone celebration system — automatic detection, scaled ceremonies, wiki entries, commemorative notes.
- **Group B (control)**: Milestones are tracked internally but never surfaced to the user. The agent acknowledges achievements with simple statements ("You've maintained this for 30 days.") but no ceremonial framing.
- **Duration**: 120 days (long enough for multiple milestone events).
- **Milestone types tracked**: 7-day, 30-day, 100-day habit streaks; monthly engagement anniversaries; user-defined milestones.

**Metrics**:
- Retention rate at 30, 60, 90, and 120 days
- Post-milestone engagement spike (engagement in the 7 days following a milestone vs the 7 days before)
- Self-reported motivation (weekly survey, 1-7)
- Emotional valence of post-milestone interactions (sentiment analysis of user messages in the 3 days following a milestone)
- Qualitative feedback on milestone experience (survey at end of study)

**Success criteria**: Group A shows at least 15% higher retention at 90 days, with a measurable post-milestone engagement spike (at least 10% increase in the week following a celebrated milestone vs no spike in the control group).

**Rationale**: The milestone celebration feature requires significant implementation effort. This experiment validates whether that effort is justified by measurable retention and satisfaction improvements, or whether simple acknowledgment is sufficient.

---

## Cross-Cutting Considerations

### Data Collection and Ethics
- All experiments require informed consent. Users must opt in to experiment participation and be told they may be in a treatment or control group.
- Engagement and sentiment data should be collected with clear privacy disclosures.
- Users should be able to withdraw from experiments at any time without losing their data.
- Results should be reported in aggregate, never individually identifiable.

### Statistical Approach
- Primary analyses use intention-to-treat (all enrolled users, regardless of engagement level).
- Secondary analyses use per-protocol (users who completed minimum participation thresholds).
- Effect sizes reported alongside p-values to distinguish statistical from practical significance.
- Bayesian analysis as a complement to frequentist approaches, especially for small sample sizes.

### Iteration
These experiments are designed to be run sequentially. Experiment 1 (engagement over time) should be run first, as its results determine whether the core concept is viable. If engagement decays rapidly even with full personalization, the concept needs fundamental revision before running the other experiments. If engagement holds, Experiments 2-4 can validate specific features and inform prioritization.

Results from each experiment should feed back into the agent's design. If Experiment 2 shows that personality modulation is imperceptible, make it more pronounced. If Experiment 3 shows that implementation intentions do not improve outcomes in this context, simplify the habit tracking model. The experimental cycle is: design, measure, learn, iterate.
