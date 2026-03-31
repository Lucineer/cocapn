# Circadian Rhythm — Wiki

## The Biology of Daily Rhythms

Circadian rhythms are endogenous biological cycles that repeat approximately every 24 hours. The term derives from the Latin *circa* (around) and *diem* (day). These rhythms are not simply responses to external cues — they are generated internally by a molecular clock mechanism present in nearly every cell of the body, synchronized by a master pacemaker in the brain.

### The Suprachiasmatic Nucleus (SCN)

Located in the anterior hypothalamus, directly above the optic chiasm, the SCN is the body's central circadian pacemaker. It receives direct light input from the retina via the retinohypothalamic tract and uses this information to synchronize peripheral clocks throughout the body. The SCN orchestrates:

- **Hormone release**: Cortisol (peaks morning), melatonin (peaks night), growth hormone (pulses during deep sleep), thyroid-stimulating hormone (peaks late evening).
- **Body temperature**: Reaches its lowest point (nadir) in the early morning hours (typically 4-5 AM) and its peak in the late afternoon.
- **Cognitive function**: Alertness, working memory, and executive function follow a predictable curve that rises through the morning, peaks in late morning to early afternoon, and declines through the evening.
- **Sleep-wake cycles**: The two-process model (Borbely, 1982) describes sleep regulation as the interaction of homeostatic sleep pressure (which builds during wakefulness) and circadian arousal (which promotes wakefulness during the biological day).

### Chronotypes: Larks, Owls, and Everything Between

Not all circadian systems run on the same schedule. Chronotype — the behavioral manifestation of circadian timing — exists on a continuum:

- **Morning types (larks)**: Peak alertness and cognitive performance in early to mid-morning. Prefer sleep times of 9-10 PM to 5-6 AM. Represent roughly 15-20% of the population.
- **Intermediate types**: The majority (~60-70%) of people fall somewhere in the middle, with moderate morning or evening tendencies.
- **Evening types (owls)**: Peak performance in late afternoon or evening. Prefer sleep times of midnight to 8-9 AM. Represent roughly 10-15% of the population, with higher prevalence among younger adults.

Chronotype has a genetic basis, influenced by polymorphisms in clock genes (PER1, PER2, PER3, CLOCK, BMAL1). It also shifts across the lifespan: most people are more morning-oriented in childhood, shift toward eveningness in adolescence and early adulthood, and gradually become more morning-oriented again in later life.

### Social Jetlag

Roenneberg and colleagues (2007, 2012) introduced the concept of social jetlag — the mismatch between biological timing and social timing (work schedules, school start times). Roughly two-thirds of the population experiences social jetlag, with evening types suffering most. Chronic social jetlag is associated with:

- Increased risk of obesity, diabetes, and cardiovascular disease
- Reduced cognitive performance and mood disturbances
- Higher rates of depression and anxiety
- Substance use (caffeine, nicotine, alcohol) as compensatory mechanisms

An agent that respects chronotype — scheduling demanding morning rituals for larks but not for owls, and offering evening reflection at biologically appropriate times — can help reduce social jetlag rather than exacerbate it.

### Peak Cognitive Performance Windows

Research on time-of-day effects on cognition reveals several key patterns:

- **Working memory** peaks in the late morning (roughly 10 AM - 12 PM for intermediate types).
- **Sustained attention** is best in the mid-morning and declines through the afternoon, with a notable post-lunch dip between 1-3 PM.
- **Creative thinking** may actually benefit from reduced cognitive control, peaking during non-optimal times of day (when the prefrontal cortex is less dominant). For morning types, this means late afternoon or evening.
- **Physical performance** peaks in the late afternoon (4-6 PM), when body temperature and reaction times are at their best.
- **Emotional regulation** follows a U-shaped curve, with the best regulation in mid-morning and the worst in the very early morning and late at night.

### Seasonal Affective Patterns

Circadian rhythms are modulated by seasonal changes in day length (photoperiod). Seasonal Affective Disorder (SAD) affects roughly 5% of the US population severely, with another 10-20% experiencing subclinical seasonal mood changes:

- **Winter pattern** (most common): Depression, hypersomnia, carbohydrate craving, social withdrawal, weight gain. Linked to increased melatonin duration and reduced serotonin availability.
- **Summer pattern** (less common): Insomnia, agitation, reduced appetite, anxiety. Less well-understood but may relate to heat stress and disrupted sleep.

Even in people without clinical SAD, seasonal effects on mood and cognition are measurable. The agent's seasonal personality modulation reflects these real biological and psychological shifts, creating an experience that feels attuned to the user's actual state rather than oblivious to it.

### How the Agent Uses Time-Awareness

The Ritual Agent applies circadian science in several concrete ways:

1. **Chronotype detection**: During initial interactions, the agent infers the user's chronotype from their preferred interaction times, self-reports, and behavioral patterns. This is stored as a fact (`ritual.chronotype`) and used to personalize all ritual timing.

2. **Time-appropriate content**: Morning check-ins focus on forward-looking, intention-setting content during the cortisol awakening response. Evening reflections leverage the natural wind-down period for gratitude and review. The agent does not try to do deep analytical work at 11 PM or gentle reflection at 8 AM.

3. **Seasonal modulation**: The agent's personality, suggested rituals, and content themes shift with the seasons. In winter, it acknowledges lower energy and suggests gentler rituals. In spring, it leans into themes of renewal and fresh starts. These shifts are based on both the calendar and the user's reported mood patterns.

4. **Adaptive scheduling**: The cron schedules in config.yml are defaults. The agent learns the user's actual patterns — when they typically engage with morning check-ins, when they prefer evening reflection — and suggests schedule adjustments. If a user consistently engages at 8:30 AM rather than 7 AM, the agent proposes shifting the morning ritual.

5. **Temporal landmark recognition**: The agent recognizes and leverages temporal landmarks (Mondays, first of the month, birthdays, anniversaries) as natural "fresh start" moments, consistent with Dai, Milkman, and Riis's (2014) research on the fresh start effect.

### Implementation of Time-Based Personality Shifts

Time-based personality modulation is implemented at the system prompt level. When the soul.md compiler processes the agent's identity, it injects time-aware context:

- A time-of-day descriptor ("It is early morning. The user is likely just waking up. Be energetic and forward-looking.") is prepended to the personality context.
- A seasonal descriptor ("It is late autumn. Days are shortening. Be reflective and warm.") is added.
- Recent interaction history (from brain memories) is included to provide continuity.

These modulations do not change the agent's core identity — they shift its presentation, much as a thoughtful friend would naturally shift their demeanor based on context. The agent remains the same warm, grounded presence whether it is 6 AM or 11 PM; it simply meets the user where they are in their day.
