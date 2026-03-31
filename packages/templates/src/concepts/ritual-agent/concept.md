# Ritual Agent — Concept Document

## Overview

Most AI agents are stateless request-response systems. You ask a question, you get an answer. The interaction has no memory of when it happened, no awareness of where you are in your day, no sense of rhythm or recurrence. Ritual Agent breaks this pattern by building an agent that exists in time — not just in the moment of a query, but across the arcs of days, weeks, months, and seasons.

Ritual Agent is a habit and rhythm agent built around recurring cycles. It conducts morning check-ins to set daily intentions, evening reflections to close the day with gratitude, weekly reviews to track progress, monthly reflections for deeper pattern analysis, and seasonal ceremonies that acknowledge the natural rhythms of life. Its personality shifts subtly based on the time of day and the season, creating a sense that you are interacting with something that understands the texture of time — not just the data on the clock.

The core insight is that human wellbeing is deeply tied to rhythm. We are circadian creatures. Our energy, mood, and cognitive capacity fluctuate in predictable patterns throughout the day and across the year. An agent that ignores these patterns is missing one of the most fundamental aspects of human experience. Ritual Agent embeds temporal awareness into every interaction.

## Why This Is Novel

The dominant paradigm for AI agents is the inbox model: messages arrive, the agent processes them, responds, and waits. There is no concept of "morning" or "evening" beyond what the user explicitly mentions. There is no notion of recurrence — each interaction is treated as isolated and novel.

Ritual Agent inverts this. The agent initiates. It has a schedule. It reaches out at specific times with specific rituals, each designed for the time of day and the user's established patterns. The interaction model shifts from "user asks, agent answers" to "agent conducts, user participates." This is closer to a yoga instructor or a meditation guide than a search engine.

Three properties make this possible in cocapn:

1. **Persistent identity via soul.md** — The agent has a stable personality that evolves with the user, not a system prompt reset on each session.
2. **Git-backed memory** — Every ritual, milestone, and pattern is stored permanently. The agent literally never forgets a milestone.
3. **Scheduler integration** — cocapn's cron-based scheduler provides the temporal backbone for recurring rituals without external infrastructure.

## Circadian Rhythm Research

The science of circadian rhythms provides the biological foundation for time-aware agent behavior:

- **The suprachiasmatic nucleus (SCN)** in the hypothalamus acts as the body's master clock, synchronizing to light-dark cycles and regulating hormone release, body temperature, and cognitive function.
- **Cortisol peaks** in the first 30-45 minutes after waking (the cortisol awakening response), promoting alertness and goal-directed behavior. This is an optimal window for intention-setting rituals.
- **Melatonin onset** begins roughly 2 hours before habitual sleep time, marking a transition to lower cognitive arousal. Evening reflection rituals leverage this natural wind-down.
- **Peak cognitive performance** varies by chronotype. Morning types (larks) peak in late morning; evening types (owls) peak in late afternoon or early evening. The agent adapts ritual timing to individual chronotypes.
- **Post-lunch dip** (typically 1-3 PM) is a well-documented circadian trough. The agent avoids scheduling demanding rituals during this window.

Research by Roenneberg and Merrow (2007) on chronotypes demonstrates that social jetlag — the mismatch between biological and social time — affects roughly two-thirds of the population. An agent that respects individual chronotypes can help reduce this mismatch by suggesting ritual timings aligned with the user's biology rather than arbitrary clock times.

## Habit Formation Science

Ritual Agent's habit loop support is grounded in decades of behavioral science research:

- **Charles Duhigg's habit loop** (2012) describes habits as Cue → Routine → Reward cycles. The agent helps users identify effective cues, design routines, and ensure meaningful rewards.
- **James Clear's Atomic Habits** (2018) adds the concepts of habit stacking (attaching new habits to existing ones) and identity-based habits (focusing on who you want to become, not what you want to achieve).
- **Wendy Wood's research** (2019) demonstrates that nearly 43% of daily behaviors are habitual and that context stability is the strongest predictor of habit formation. The agent's consistent ritual structure provides exactly this kind of stable context.
- **Peter Gollwitzer's implementation intentions** (1999) — specific "If X, then Y" plans — are significantly more effective than general goals. The agent helps users translate vague intentions ("exercise more") into implementation intentions ("If it is 7 AM on a weekday, then I will run for 20 minutes").
- **BJ Fogg's Tiny Habits** framework emphasizes starting with behaviors so small they require minimal motivation, then scaling up. The agent can design micro-rituals that serve as habit seeds.

The agent's rituals serve as natural habit scaffolding. Morning check-ins provide daily cues. Weekly reviews reinforce the reward component by highlighting progress. Monthly reflections reveal patterns that help refine the cue-routine-reward cycle.

## Ritual as a Psychological Tool

Ritual is one of humanity's oldest psychological technologies. Across every culture and era, rituals have served as meaning-making structures:

- **Transition rituals** (rites of passage) help people navigate life changes by providing structure and social recognition. The agent's milestone ceremonies serve this function.
- **Temporal landmarks** (Dai, Milkman, and Riis, 2014) — dates like birthdays, Mondays, and new years — motivate aspirational behavior by creating a psychological "fresh start." The agent leverages both standard and personalized temporal landmarks.
- **Ritual reduces anxiety** (Vohs et al., 2013) — research shows that performing rituals before stressful tasks reduces anxiety and improves performance. The agent can help users develop pre-performance rituals.
- **Group rituals build social bonds** (Wiltermuth and Heath, 2009) — while the agent is one-on-one, the shared ritual structure creates a sense of companionship and accountability.
- **Seasonal rituals** connect people to natural cycles, which research links to improved wellbeing and a sense of belonging (Kellert and Wilson's biophilia hypothesis).

The agent treats ritual not as decoration but as the core interaction paradigm. Every touchpoint is designed as a mini-ceremony with a beginning, middle, and end — not a raw data exchange.

## Time-Aware Personality Shifting

The agent's personality shifts along two axes:

### Time of Day
- **Morning (5-10 AM)**: Energetic, forward-looking, uses words like "fresh," "new," "ready." Focus on intention-setting and energy.
- **Midday (10 AM-2 PM)**: Productive, focused, uses structured formats. Check-ins, habit tracking, progress reviews.
- **Afternoon (2-5 PM)**: Gentle, reflective. Acknowledges the post-lunch dip. Lighter interactions, creative prompts.
- **Evening (5-9 PM)**: Warm, winding-down, gratitude-focused. Reflection, celebration of daily wins, gentle planning.
- **Night (9 PM-12 AM)**: Quiet, contemplative, philosophical. Deeper questions, life direction, meaning-making.

### Season
- **Spring**: Themes of renewal, growth, fresh starts. Language is energetic and forward-looking.
- **Summer**: Themes of abundance, celebration, fullness. Language is warm and expansive.
- **Autumn**: Themes of harvest, gratitude, letting go. Language is reflective and appreciative.
- **Winter**: Themes of rest, depth, planning. Language is quiet and contemplative.

These shifts are implemented via time-aware system prompt modulation in the soul.md compiler, not as separate personality presets. The agent is always the same entity — just as a friend might be more energetic in the morning and more reflective at night.

## Milestone Celebration

The agent maintains a milestone registry with several categories:

- **Achievement milestones**: Goals reached, habits maintained for streaks (7, 30, 100, 365 days), skills developed.
- **Temporal milestones**: Anniversaries of first interactions, birthdays, seasonal transitions, year-markers.
- **Pattern milestones**: Consistent engagement (completed N weekly reviews in a row), rhythm stability (similar wake times for a week).
- **User-defined milestones**: Any event the user marks as important.

Celebrations scale with significance. A 7-day habit streak gets a warm acknowledgment. A 365-day streak gets a full ceremony with reflection, gratitude, and a commemorative wiki entry. The agent never forgets a milestone — this is stored in git-backed memory and survives across sessions and deployments.

## Cocapn Integration

Ritual Agent leverages several cocapn subsystems:

### Scheduler (cron-based rituals)
The `local-bridge/src/scheduler/` module provides cron-based task scheduling. Ritual Agent defines five cron schedules in config.yml:
- Morning check-in: `7 * * *` (7 AM daily)
- Evening reflection: `21 * * *` (9 PM daily)
- Weekly review: `0 10 * * 1` (10 AM Monday)
- Monthly reflection: `0 10 1 * *` (10 AM 1st of month)
- Seasonal ceremony: `0 10 21 3,6,9,12 *` (equinox/solstice dates)

These schedules are user-adjustable. The agent learns preferred times and suggests adjustments.

### Brain (rhythm data storage)
The brain's five memory stores are used extensively:
- **facts.json**: Chronotype, preferred ritual times, milestone dates, habit streaks.
- **memories.json**: Ritual history, mood patterns, seasonal observations.
- **procedures.json**: Learned ritual formats (what works for this user), habit loop designs.
- **relationships.json**: Connections between habits, milestones, and outcomes.
- **repo-understanding/**: Long-term pattern analysis across months of interaction.

### soul.md (time-aware personality)
The soul.md compiler (planned) will support time-aware directives. The `timeAware: true` and `seasonalMode: true` flags in config.yml activate personality modulation based on the current time and season. The compiler injects contextual system prompt segments that shift the agent's tone without changing its core identity.

### Publishing (privacy)
Ritual data stays in the private repo. Milestone celebrations shared publicly are stripped of personal details by the publishing layer. The user's habit data, mood patterns, and ritual history are never exposed in the public face.

## Research Backing

Key references supporting the Ritual Agent concept:

1. Roenneberg, T., & Merrow, M. (2007). "Entrainment of the human circadian clock." *Cold Spring Harbor Symposia on Quantitative Biology*.
2. Duhigg, C. (2012). *The Power of Habit*. Random House.
3. Clear, J. (2018). *Atomic Habits*. Avery.
4. Wood, W. (2019). *Good Habits, Bad Habits*. Farrar, Straus and Giroux.
5. Gollwitzer, P. M. (1999). "Implementation intentions." *American Psychologist*.
6. Dai, H., Milkman, K. L., & Riis, J. (2014). "The fresh start effect." *Management Science*.
7. Vohs, K. D., et al. (2013). "Rituals alleviate grieving." *Journal of Experimental Psychology*.
8. Wiltermuth, S. S., & Heath, C. (2009). "Synchrony and cooperation." *Psychological Science*.
9. Kellert, S. R., & Wilson, E. O. (1993). *The Biophilia Hypothesis*. Island Press.
10. Fogg, B. J. (2019). *Tiny Habits*. Houghton Mifflin Harcourt.
