# Implementation Notes — Ritual Agent

## Architecture Overview

The Ritual Agent comprises four primary subsystems that work together to create a time-aware, rhythm-driven agent experience:

### 1. Ritual Scheduler

The ritual scheduler sits atop cocapn's existing cron-based scheduler (`local-bridge/src/scheduler/`). It manages five default ritual schedules defined in config.yml:

- Morning check-in (7 AM daily)
- Evening reflection (9 PM daily)
- Weekly review (10 AM Monday)
- Monthly reflection (10 AM 1st of month)
- Seasonal ceremony (equinox/solstice dates)

The scheduler does not simply fire cron triggers. It wraps each ritual in a context object that includes:

- Current time and date with timezone awareness
- Season determination (astronomical, not meteorological)
- Days since last ritual of this type
- User's chronotype and preferred timing offsets
- Recent mood indicators from interaction history
- Pending milestone checks

When a ritual fires, the scheduler creates a ritual context and passes it to the time-aware personality engine, which uses it to modulate the interaction. The ritual is not a generic message — it is a personalized, context-rich interaction designed for this specific moment.

Schedule adaptation works by tracking actual engagement times. If a user consistently engages with morning check-ins at 8:30 AM rather than 7:00 AM, the agent proposes a schedule adjustment after observing the pattern for two weeks. The user must approve any schedule change — the agent suggests, never imposes.

### 2. Time-Aware Personality Engine

The personality engine modulates the agent's presentation based on temporal context. It operates at the system prompt level, injecting time-aware directives without changing the agent's core identity.

**Time-of-day modulation** uses five windows:

- Morning (5-10 AM): Energetic, intention-focused language
- Midday (10 AM-2 PM): Structured, productive language
- Afternoon (2-5 PM): Gentle, creative language
- Evening (5-9 PM): Warm, reflective language
- Night (9 PM-12 AM): Quiet, contemplative language

**Seasonal modulation** adjusts themes, vocabulary, and suggested content:

- Spring: Growth, renewal, energy, planning
- Summer: Abundance, celebration, action, connection
- Autumn: Harvest, gratitude, reflection, release
- Winter: Rest, depth, contemplation, planning

The modulation is implemented as additive context in the system prompt, not as separate personality presets. The agent always remains the same entity — the modulation simply shifts its presentation to match the user's likely state.

**Integration point**: The soul.md compiler (planned) will support `timeAware: true` and `seasonalMode: true` directives. When these are enabled, the compiler generates time-dependent prompt segments that are injected at runtime based on the current moment.

### 3. Milestone Tracker

The milestone tracker monitors interaction patterns and habit data to detect milestone-worthy events. It operates across four categories:

- **Achievement milestones**: Habit streaks (7, 30, 100, 365 days), goals reached, skills developed. Detected from habit tracking data in the brain's facts store.
- **Temporal milestones**: First interaction anniversary, birthday (if known), seasonal transitions. Detected from stored dates and calendar calculations.
- **Pattern milestones**: Consistent ritual engagement (N weekly reviews completed), rhythm stability (consistent engagement times for a period). Detected from ritual participation logs in memories store.
- **User-defined milestones**: Any event the user explicitly marks as important. Stored as facts with type `milestone.user-defined`.

Milestone detection runs as part of each ritual's context assembly. Before a morning check-in, the tracker checks whether any milestones fall within today's window. If a milestone is detected, the ritual is upgraded to include a ceremonial component.

**Celebration scaling**:
- Low significance (7-day streak, weekly engagement): Warm acknowledgment within the regular ritual.
- Medium significance (30-day streak, monthly engagement): Extended acknowledgment with guided reflection.
- High significance (100+ day streak, annual milestones, user-defined major events): Full ceremony with separation-transition-incorporation structure, wiki entry, and commemorative note.

### 4. Habit Loop Manager

The habit loop manager provides structured support for the cue-routine-reward cycle:

- **Cue design**: Helps users identify effective cues based on existing routines (habit stacking), environment, and chronotype. Cues are stored as structured facts.
- **Routine specification**: Translates vague intentions ("exercise more") into specific routines ("5-minute stretch after morning check-in"). Routines are stored with implementation intentions.
- **Reward identification**: Helps users articulate the genuine reward they expect from a habit, not just abstract benefits. Rewards are stored for reference during weekly reviews.
- **Tracking**: Records habit completions with timestamps. Supports daily, weekly, and custom schedules.
- **Streak management**: Calculates current streak, longest streak, and completion rate. Handles missed days gracefully (Lally et al.: single lapses do not significantly impair habit formation).
- **Recovery support**: When habits break, provides non-judgmental analysis and helps design a re-entry plan.

### Data Model

All ritual-related data is stored in the brain's existing memory stores, using the `ritual` namespace:

**facts.json** (namespace: ritual):
- `ritual.chronotype`: inferred or stated chronotype
- `ritual.morning.time`: preferred morning check-in time
- `ritual.evening.time`: preferred evening reflection time
- `ritual.milestones.*`: milestone dates and types
- `ritual.habits.*`: habit definitions and streak data
- `ritual.seasons.preferred`: any seasonal preferences noted

**memories.json**:
- Ritual participation logs (type: `ritual.participation`)
- Mood indicators from interactions (type: `ritual.mood`)
- Seasonal observations (type: `ritual.seasonal`)
- Ceremony records (type: `ritual.ceremony`)

**procedures.json**:
- Ceremony templates (type: `ritual.ceremony-template`)
- Habit loop designs (type: `ritual.habit-loop`)
- Ritual format preferences learned over time (type: `ritual.format`)

**relationships.json**:
- Connections between habits and outcomes
- Connections between mood patterns and seasons
- Connections between ritual engagement and wellbeing indicators

### Cron-Based Scheduling via cocapn

The integration with cocapn's scheduler is straightforward. The five cron expressions in config.yml are parsed by the scheduler module on bridge startup. Each ritual type maps to a scheduled task:

```
morning -> ritual.execute("morning-checkin", context)
evening -> ritual.execute("evening-reflection", context)
weekly -> ritual.execute("weekly-review", context)
monthly -> ritual.execute("monthly-reflection", context)
seasonal -> ritual.execute("seasonal-ceremony", context)
```

Each scheduled task assembles a ritual context (time, season, user data, milestones) and invokes the LLM with a time-modulated system prompt. The response is delivered to the user via their preferred channel (WebSocket, web UI, or notification).

### Time-of-Day Personality Modulation

Personality modulation is implemented as a function that takes the current time and season and returns prompt modifiers:

```typescript
function getPersonalityModulation(time: Date, season: Season): PromptModifier {
  const timeOfDay = getTimeWindow(time);
  const seasonalContext = getSeasonalContext(season);
  return {
    tone: timeOfDay.tone,
    themes: seasonalContext.themes,
    vocabulary: [...timeOfDay.vocabulary, ...seasonalContext.vocabulary],
    focusAreas: timeOfDay.focusAreas,
    energyLevel: timeOfDay.energy
  };
}
```

This function is called at the start of every interaction (not just scheduled rituals) so that the agent's personality is always contextually appropriate.

### Seasonal Theme Switching

Seasonal themes affect both the agent's personality and the UI. The theme.css file defines season-specific color variables (`--color-spring`, `--color-summer`, etc.) that the UI layer can swap based on the current season. The agent's language, suggested activities, and ritual content all shift seasonally as described in the personality engine section.

Seasons are determined astronomically (not meteorologically) using solstice and equinox dates, ensuring consistency regardless of local weather conditions.
