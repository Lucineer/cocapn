# Temporal Reasoning

## Foundations

Temporal reasoning is the capacity to represent, store, and draw inferences about time-dependent information. Unlike static knowledge bases where facts are either true or false, temporal reasoning systems understand that the truth of propositions can change over time and that the temporal relationships between events carry meaning.

The Temporal Agent implements temporal reasoning through multiple complementary formalisms, each suited to different aspects of time-aware cognition.

## Event Calculus

The event calculus, introduced by Kowalski and Sergot in 1986, is the primary framework for representing time-varying properties. It models the world in terms of:

- **Events** — things that happen at specific time points (a decision was made, a fact was learned, a prediction was issued)
- **Fluents** — properties whose truth value can change over time (a project is active, a preference holds, an assumption is valid)
- **Initiates/Terminates** — an event initiates a fluent (makes it true) or terminates it (makes it false)

The key axiom: a fluent holds at time T if some event initiated it before T and no event has terminated it between then and T.

The Temporal Agent uses event calculus to track the lifecycle of every fact in its brain. When a fact is stored, an initiation event is recorded. When the fact is contradicted or superseded, a termination event is recorded. The agent always knows which facts are currently valid and which have been superseded, and can reconstruct the state of knowledge at any historical point.

## Allen's Interval Algebra

James Allen's 1983 interval algebra defines thirteen fundamental relationships between time intervals. These relationships allow the agent to reason not just about when things happened, but about how events relate to each other temporally:

| Relation | Meaning | Inverse |
|----------|---------|---------|
| before | X entirely before Y | after |
| meets | X ends exactly when Y starts | met-by |
| overlaps | X starts before Y, ends during Y | overlapped-by |
| during | X entirely within Y | contains |
| starts | X and Y start together, X ends first | started-by |
| finishes | X and Y end together, X starts later | finished-by |
| equals | X and Y are the same interval | equals |

The agent uses interval algebra when reasoning about decisions and their consequences. A decision interval that "contains" an outcome interval tells a different story than one that merely "meets" it. An assumption that "overlaps" a conflicting fact signals a temporal conflict that needs attention.

## Situation Calculus

McCarthy's situation calculus represents history as a sequence of situations, each produced by applying an action to the previous situation. The formal model:

- `s0` — the initial situation (empty brain)
- `do(a, s)` — the situation resulting from performing action `a` in situation `s`
- `Holds(f, s)` — fluent `f` holds in situation `s`

This model directly supports counterfactual reasoning: "What would be true if instead of action `a1` at situation `s3`, we had performed action `a2`?" The branch from `s3` creates an alternative timeline that the agent can explore without affecting the main history.

The Temporal Agent implements situation calculus through its branching mechanism. Each branch represents an alternative history starting from a divergence point. The agent can evaluate fluents (facts, confidence levels, predictions) along any branch independently.

## Temporal Logic

### Linear Temporal Logic (LTL)
LTL reasons about a single timeline with temporal operators:
- **X (next)** — the proposition holds in the next time step
- **F (eventually)** — the proposition will hold at some future point
- **G (always)** — the proposition holds at every future point
- **U (until)** — the first proposition holds until the second becomes true

The agent uses LTL-style reasoning for queries about the main timeline: "Will this assumption always hold?" "Will this decision eventually be revisited?" "Has this pattern occurred before?"

### Computation Tree Logic (CTL)
CTL reasons about branching time — multiple possible futures. It combines temporal operators with path quantifiers:
- **A (all paths)** — the proposition holds on every possible future
- **E (exists a path)** — there is at least one possible future where the proposition holds

The agent uses CTL-style reasoning for what-if scenarios and future projections. When generating multiple future scenarios, it reasons about which propositions hold on which branches.

## Temporal Representation in the Agent

### Point Events vs Interval Events
The agent distinguishes between two types of temporal entities:

- **Point events** — instantaneous occurrences (a decision was made, a message was sent, a threshold was crossed). Represented as `{ timestamp, type, payload }`.
- **Interval events** — extended durations (a project was active, a preference held, a pattern was observed). Represented as `{ start, end, type, payload }` where `end` may be `null` for ongoing intervals.

### Temporal Queries
The agent supports a rich query language over its temporal store:

- `at(t)` — what was true at time `t`?
- `during(t1, t2)` — what was true during the interval `[t1, t2]`?
- `before(t)` — what was true before time `t`?
- `since(t)` — what has changed since time `t`?
- `between(a, b)` — what happened between events `a` and `b`?
- `overlapping(i)` — what intervals overlap with interval `i`?
- `confident(above)` — what beliefs have confidence above `above` at time `t`?

### Implementation Mapping
The temporal reasoning layer maps directly to Cocapn's brain stores:

- **Facts store** — point events (fact stored, fact updated, fact invalidated)
- **Memories store** — interval events (memory created with confidence, confidence decayed, memory archived)
- **Procedures store** — sequence events (procedure defined, procedure executed, procedure adapted)
- **Relationships store** — edge events (relationship formed, relationship strengthened, relationship weakened)
- **Wiki store** — document events (page created, page revised, page deprecated)

Each store provides temporal access methods that the reasoning layer queries. The reasoning layer itself is stateless — it computes answers from the raw temporal data in the stores.

## Practical Implications

Temporal reasoning enables the agent to:

1. Answer "what did I believe then?" questions accurately
2. Detect when current beliefs contradict past assumptions
3. Trace the history of any decision back to its origin
4. Understand the causal chain from past events to current state
5. Project current trends forward with appropriate uncertainty bounds
6. Identify when the current moment resembles a past moment (pattern matching)
