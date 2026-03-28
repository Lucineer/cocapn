# Workflow: Morning Routine

> Check activelog for fatigue, studylog for tasks, makerlog for builds — all from a single prompt.

This workflow shows how Cocapn can pull together information from multiple domains each morning, giving you a consolidated view before you start work.

## What it does

1. **ActiveLog query** — reads `wiki/sleep.md` and recent habit entries, returns a fatigue score
2. **StudyLog query** — lists open study tasks and any due reviews (spaced repetition)
3. **MakerLog query** — checks `tasks/active.json` for in-progress builds and last CI status
4. **Synthesis** — writes a `wiki/morning-brief-<date>.md` and reads it aloud (or displays in UI)

## Prerequisites

- Active bridge running for your primary domain (e.g. makerlog)
- StudyLog and ActiveLog instances in your fleet (or as A2A targets)
- `habit-tracker` module installed on ActiveLog

## The prompt

Send this to your default agent each morning (set it as a scheduled task, or trigger manually):

```
Good morning. Please run my morning routine:
1. Check activelog for my sleep and fatigue level
2. Check studylog for today's tasks and any overdue reviews
3. Check makerlog for any stalled builds or open PRs
4. Write a brief morning summary to wiki/morning-brief-today.md
5. Tell me the three most important things I should focus on today
```

## How it works under the hood

### Step 1: ActiveLog query (A2A)

The makerlog bridge routes an A2A message to the activelog bridge:

```json
{
  "type": "A2A",
  "targetDomain": "activelog.ai",
  "agentId": "default",
  "content": "What is my sleep quality and fatigue level based on recent logs?"
}
```

ActiveLog's agent reads `wiki/sleep.md` and habit tracker entries, returns a JSON summary:

```json
{
  "sleepHours": 7.2,
  "sleepQuality": "fair",
  "fatigueScore": 3,
  "fatigueLabel": "moderate",
  "note": "Went to bed late last night. 2 nights of poor sleep this week."
}
```

### Step 2: StudyLog query (A2A)

```json
{
  "type": "A2A",
  "targetDomain": "studylog.ai",
  "agentId": "default",
  "content": "What are my open tasks and overdue spaced-repetition reviews for today?"
}
```

StudyLog returns:
```json
{
  "openTasks": 4,
  "overdueReviews": 7,
  "topTask": "Finish TypeScript generics chapter",
  "urgentReview": "Bayesian inference flashcards (7 days overdue)"
}
```

### Step 3: MakerLog CI check

The local makerlog agent reads `tasks/active.json` and checks GitHub API for recent CI runs:

```json
{
  "activeTasks": 2,
  "stalledBuilds": 1,
  "stalledBuild": "cocapn-ui — last green 3 days ago",
  "openPRs": 1
}
```

### Step 4: Synthesis

The agent writes to `wiki/morning-brief-2025-01-15.md`:

```markdown
# Morning Brief — January 15, 2025

## Status
- **Fatigue**: Moderate (3/5) — consider lighter cognitive load today
- **Sleep**: 7.2h, fair quality — 2 poor nights this week

## Today's focus
1. **Fix stalled build** — cocapn-ui CI failing for 3 days (top priority)
2. **StudyLog reviews** — 7 overdue, spend 20 minutes before coding
3. **Finish TypeScript generics chapter** — open task, due end of week

## Reminders
- 1 open PR waiting for review
- 4 active build tasks across makerlog
- 7 spaced-repetition reviews overdue on studylog
```

## Automating it

### Option 1: Browser bookmark / shortcut

Add a bookmarklet that sends the morning routine message on click.

### Option 2: Scheduled task (module)

Install the `cron-tasks` module and add to `cocapn/config.yml`:

```yaml
schedule:
  - cron: "0 8 * * 1-5"   # 8am weekdays
    action: chat
    agentId: default
    content: "Run my morning routine"
```

### Option 3: Shell alias

```bash
alias morning='echo "Run my morning routine" | websocat ws://localhost:8787 --text'
```

## Customising the routine

Edit the prompt in your soul file (`cocapn/soul.md`) to add a `## Morning Routine` section:

```markdown
## Morning Routine

When asked to run the morning routine:
1. Query activelog for sleep and energy (A2A to activelog.ai)
2. Check my studylog tasks (A2A to studylog.ai)
3. Read tasks/active.json for build status
4. Write the brief to wiki/morning-brief-<YYYY-MM-DD>.md
5. Keep the summary under 200 words — I'm not fully awake yet
6. End with exactly three action items, ordered by urgency
```
