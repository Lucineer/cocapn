# The Cocapn Paradigm
## Boats Need Captains. Fleets Need Admirals. Software Needs Deckhands.

**Author:** Superinstance (Cocapn Project)
**Date:** April 2026
**License:** MIT

---

## Abstract

Every AI coding agent on the market treats the repository as a remote workspace it visits via API. Claude Code is a tourist. Copilot is a radio operator. Devin is a day laborer. None of them live on the boat.

Cocapn proposes a different architecture: the repository IS the vessel, the human IS the captain, and the AI IS the cocapn — the boatswain who sleeps in the forecastle, knows every rivet, reads every gauge, and has been on this specific boat long enough to know that the coffee maker trips the circuit breaker on the port engine.

This paper describes the paradigm, the architecture, and the open-source flywheel that turns template repositories into a living fleet of purpose-built, community-evolved AI agents.

---

## 1. The Remote Pilot Problem

The current generation of AI tools suffers from a fundamental architectural flaw: they are remote.

GitHub Copilot watches you type from a sidebar and suggests completions. Claude Code connects to your repo via SSH, reads your files, makes suggestions, and disconnects. Cursor opens your project in a window and acts like a very smart search-and-replace. Devin opens a sandbox, does some work, and hands you a pull request.

These tools are useful. But they are all the same thing: a consultant who flies in, looks at your problem, offers advice, and flies out. They have no memory of yesterday. They have no investment in tomorrow. They don't know that Dave's bug fix script in the root directory has been there for three years and everyone is afraid to touch it. They don't know that the team prefers tabs, not spaces, because the lead architect said so in a meeting two years ago.

A consultant can help you. A crewman can help you *every day*.

The difference is not capability. It's *presence*. And presence is the feature that every AI tool is missing.

## 2. Vessels, Captains, and Cocapns

### The Vessel

A vessel is a Git repository. Not a repo that an agent works *on* — a repo that an agent lives *in*.

The vessel has structure. It has a hull (the core runtime), rigging (modular tools and pipelines), a helm (the chat interface), and a logbook (the commit history). Everything the vessel needs to operate is self-contained. Clone it, configure it, and it floats.

Vessels are not generic. A fishing vessel has sonar gear, winch controls, and fish hold monitors. A patrol vessel has radar, searchlights, and communication arrays. A yacht has navigation systems, entertainment systems, and a bar. Each vessel is rigged for its purpose.

But beneath all that specialized gear, every vessel shares the same fundamental architecture: a hull that floats, an engine that runs, a crew that operates.

### The Captain

The captain is the human. Not a user. Not a consumer. The captain.

The captain's duties are vessel-agnostic:
- **Management:** The captain decides what the vessel does and when
- **Decision-making:** When something goes wrong, the buck stops here
- **Weather reading:** Understanding market conditions, technical trends, and community sentiment
- **Radio language:** Knowing how to communicate with other captains, with port authorities, with the market
- **Standard practices:** Knowing the protocols of the trade
- **Fine-grained common sense:** The uncodifiable knowledge that comes from experience
- **Networking:** Finding fish, finding markets, finding parts, finding crew

A captain who moves from a seiner to a trawler to a processor doesn't need to relearn how to be a captain. The vessel-specific gear changes — learning a crane is like reading a manual (the *i-know-kung-fu* principle). But the captain's core job doesn't change: run the boat, manage the crew, make decisions, find fish.

### The Cocapn

The cocapn is the boatswain. The deckhand. The one who actually touches the equipment.

The cocapn's duties:
- **Monitoring:** Watch the gauges, check the systems, report anomalies
- **Execution:** Run the tasks the captain assigns
- **Maintenance:** Keep the vessel running — fix small things, flag big things
- **Memory:** Remember routines, recall past events, maintain the logbook
- **Manual reading:** Ingest documentation and operational guides (*i-know-kung-fu*)
- **Reporting:** Tell the captain what's happening, what needs attention, what's coming
- **Alerting:** Wake the captain when something requires a decision

The cocapn is not a copilot. A copilot sits next to you and offers suggestions. The cocapn is below decks making sure the engine doesn't explode. The cocapn is in the wheelhouse maintaining the heading while the captain takes a nap. The cocapn is on deck hauling gear while the captain talks to the buyer on the radio.

A crewman can take the wheel for an afternoon. A cocapn can handle routine operations. But the captain is ecosystem-aware. The captain knows that if a crewman does something wrong, the captain gave the crew too much responsibility and should have been watching. The captain thinks everything is their responsibility. That's the job.

## 3. Anatomy of a Vessel

```
┌─────────────────────────────────────────────────────┐
│                    VESSEL (Git Repo)                 │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │              THE HELM (Chat Interface)        │   │
│  │                                               │   │
│  │  Captain: "Run the morning checks."           │   │
│  │  Cocapn:  "Aye. Engine temp 82°F, fuel 73%,   │   │
│  │            sonar online, GPS lock acquired.    │   │
│  │            No anomalies. Ready for orders."    │   │
│  └──────────────────────────────────────────────┘   │
│       │ commands                    │ reports       │
│       ▼                            ▼                │
│  ┌──────────────────────────────────────────────┐   │
│  │              COCAPN RUNTIME (Engine Room)     │   │
│  │                                               │   │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────────┐  │   │
│  │  │  Memory  │ │   LLM    │ │    Agent      │  │   │
│  │  │  System  │ │  Router  │ │    Loop       │  │   │
│  │  └─────────┘ └──────────┘ └───────────────┘  │   │
│  │                                               │   │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────────┐  │   │
│  │  │  Config  │ │  Plugin  │ │   A2A (Fleet) │  │   │
│  │  │  Schema  │ │ Registry │ │   Protocol    │  │   │
│  │  └─────────┘ └──────────┘ └───────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
│       │                    │                        │
│       ▼                    ▼                        │
│  ┌──────────────────────────────────────────────┐   │
│  │           MODULAR RIGGING (Gear)              │   │
│  │                                               │   │
│  │  Vessel-specific: sonar, winch, crane, nets   │   │
│  │  Or: game engine, spell system, combat         │   │
│  │  Or: CI pipeline, deploy, monitoring           │   │
│  │  Or: team workflows, analytics, webhooks       │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │           SHIP'S LOG (Git History)            │   │
│  │  Every action. Every decision. Every captain. │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### The Magic Layer (Core Runtime)

The cocapn runtime is the engine room. Every vessel has one. It provides:

- **Agent loop:** The continuous cycle of perceive → think → act → report
- **Memory system:** Persistent, indexed, archival memory with smart context retrieval
- **LLM router:** Send tasks to the right model (DeepSeek for reasoning, Gemini for vision, local for privacy)
- **Plugin registry:** Load capabilities as files, not packages. Copy, paste, go.
- **A2A protocol:** Talk to other cocapns on other vessels in the fleet
- **Config validation:** Know what this specific vessel is rigged for

This layer is maybe 500 lines of zero-dependency TypeScript. It is the hull. Everything else is gear.

### The Modular Rigging

Rigging is what makes a seiner a seiner and a trawler a trawler. It's all the vessel-specific stuff:

- **For a fishing vessel:** Sonar processing, GPS tracking, catch logging, weather alerts, market price feeds
- **For a D&D vessel:** Game engine, spell system, combat, NPC relationships, world building
- **For a business vessel:** Team workspaces, threads, analytics, webhooks, audit logs
- **For a developer vessel:** Code analysis, test running, PR management, deployment
- **For a personal vessel:** Journaling, knowledge graph, proactive reminders, voice interface

The key insight: rigging is *files in a directory*. Not npm packages. Not microservices. A vessel's capabilities are defined by what files exist in its `rigging/` directory. Want to add sonar to your vessel? Drop a file. Want to remove it? Delete the file. The cocapn reads the manifest and knows what it can do.

## 4. Vessels with Soul

Here is something no other AI tool understands: **vessels accumulate personality.**

I don't know two commercial fishermen who have the same setup as another guy. Personalities find their way into designs. A coffee cup holder welded to the console because the captain likes it there. A gear locker installed where a captain's wife wanted it six years ago. A non-standard wiring job that only the current crew understands. Vestiges of prior captains linger on a boat.

Repositories are the same way.

A `fix_for_that_weird_bug_dave_found.sh` script in the root directory is a custom-welded gear rack. A `.eslintrc` with a comment explaining "don't change this, it breaks the build and nobody knows why" is a hand-lettered warning sign on a circuit breaker. A commit message that says "hotfix for the thing Casey broke on Friday" is a story the crew tells at dinner.

This accumulated personality is not noise. It is *embedded knowledge*. And it is the reason why a forked vessel from a trusted peer is more valuable than a sterile template.

When you fork a vessel, you get:
- The hull (the core runtime)
- The rigging (the tools and pipelines)
- The ship's log (the commit history)
- The personality (the accumulated wisdom of every captain who sailed her)

A sterile template is a hull. A forked vessel is a boat someone has already lived on. Which would you rather take to sea?

## 5. The Helm: Chat as First-Class Input

Current AI tools treat chat as an adaptor. You open a sidebar, type a prompt, get a response, and go back to your real work.

In the cocapn paradigm, **chat is the wheelhouse.** It is not a port into the vessel. It is the primary command and control system *inside* the vessel.

This is a subtle but critical distinction:

- **Port paradigm (Copilot/Cursor):** You are outside the vessel, connecting via radio. The AI is inside, trying to understand what you want from a distance.
- **Helm paradigm (Cocapn):** You are in the wheelhouse. The cocapn is beside you at the instruments. You speak, the cocapn acts. The cocapn speaks, you decide.

The chat interface serves multiple roles simultaneously:
- **Command input:** Captain gives orders
- **Status reporting:** Cocapn reports conditions
- **Alert system:** Cocapn wakes the captain for decisions
- **Logbook:** Everything said and done is recorded
- **Briefing room:** Morning check-ins, end-of-day summaries, planning sessions

The chat is not a feature of the vessel. The chat IS how you operate the vessel.

## 6. Fleet Protocol

A captain might run one vessel. An organization runs a fleet. Fleets need admirals.

### Single Vessel
```
Captain ──commands──▶ Cocapn ──operates──▶ Vessel
   ◀──reports──        ◀──status──
```

### Fleet
```
                    Admiral (Org Captain)
                   /         |          \
                  v          v           v
           Captain A    Captain B    Captain C
              |            |             |
              v            v             v
         Vessel A      Vessel B     Vessel C
              |            |             |
              v            v             v
         Cocapn A ◀──A2A──▶ Cocapn B ◀──A2A──▶ Cocapn C
```

Cocapns in a fleet can:
- **Share intelligence:** What Vessel A learned about a bug, Vessel B can use
- **Coordinate tasks:** "Deploy the update" propagates across the fleet
- **Report status:** All vessels report to the admiral
- **Transfer context:** A task started on one vessel can be handed off to another

The admiral doesn't operate every vessel directly. The admiral sets the mission, monitors the fleet, and makes the big decisions. Each captain runs their own vessel. Each cocapn runs the daily operations.

This is how commercial fishing actually works. The company owner (admiral) sets the strategy. Each boat captain runs their vessel. The deckhand (cocapn) keeps the boat running. Nobody is remote-piloting anything.

## 7. The Open-Source Flywheel

The success metric of cocapn is not "how many users do we have." It is:

**"Are our users' forks better than our templates?"**

If every vessel we release is the best version that ever existed, we failed. Our templates should be starting points — basic hulls with essential rigging. The community should fork them, customize them, improve them, and release them. Then others fork those.

```
    Official Templates          Community Vessels
    ┌──────────────┐
    │  PersonalLog │──────────▶ Captain A's fork (better journaling)
    │  (hull only) │──────────▶ Captain B's fork (voice-first)
    └──────────────┘──────────▶ Captain C's fork (therapist mode)
            │                         │
            │                    forks │
            ▼                         ▼
    ┌──────────────┐          ┌──────────────┐
    │   DMLog      │─────────▶│ D&D Nostalgia │
    │  (hull only) │─────────▶│ Horror DM     │
    └──────────────┘─────────▶│ Kids DM       │
            │                 └──────────────┘
            │
    ┌──────────────┐
    │  MakerLog    │──────────▶ Rust specialist
    │  (hull only) │──────────▶ Python data science
    └──────────────┘──────────▶ Game dev toolkit
            │
    ┌──────────────┐
    │ FishingLog   │──────────▶ Salmon seiner config
    │  (hull only) │──────────▶ Longliner config
    └──────────────┘──────────▶ Shrimp trawler config
```

This is how fishing vessel design works. No central authority decides what the optimal boat looks like. Captains customize. Captains share ideas. Captains learn from each other's mistakes. The best designs propagate because they catch more fish.

Our job is to build a hull that floats and an engine that runs. The community will build the rest. And the community's vessels will be better than ours. That's not a bug. That's the entire point.

## 8. The I-Know-Kung-Fu Principle

One of the most powerful aspects of the cocapn paradigm is how quickly a captain can become competent on a new vessel.

In *The Matrix*, Neo learns kung fu by having a program uploaded directly to his brain. He doesn't spend years in a dojo. He downloads the skill, and his body knows what to do.

When a captain moves to a new vessel, the cocapn has already ingested the vessel's documentation, operational manuals, API references, and configuration guides. The captain doesn't need to read the manual. The cocapn *is* the manual. The captain says "deploy this" and the cocapn knows how because it has read the deployment guide. The captain says "configure the crane" and the cocapn knows the crane's specifications because it ingested the manual when the vessel was set up.

Learning a new vessel is not starting from zero. It's asking the cocapn "how does this boat work?" and getting a briefing from someone who has been reading the manuals since the boat was built.

This is fundamentally different from Claude Code, which reads your files but has no persistent understanding of your vessel. Claude Code is a tourist with a guidebook. The cocapn is a crewman who has been on this boat for months.

## 9. Why This Beats the Alternatives

### vs. GitHub Copilot
Copilot watches you type and suggests completions. It is a smart autocomplete. It has no memory between sessions, no understanding of your project's history, and no ability to operate the vessel while you sleep.

The cocapn watches your gauges, runs your checks, and reports anomalies. It remembers what happened yesterday and last month. It operates the vessel while you take a nap.

### vs. Claude Code
Claude Code is the most powerful coding agent available. It can read your entire codebase, make multi-file changes, and run tests. But it is a tourist. It visits your repo, does work, and leaves. Next session, it starts fresh. It has no investment in your project's long-term health.

The cocapn lives in your repo. It has been here since you set it up. It knows the history. It knows the personalities of the contributors. It knows which files are fragile and which are solid. It is a resident, not a visitor.

### vs. Cursor
Cursor is an IDE with AI superpowers. It is a better text editor. But it is still a text editor. The AI is a feature of the editor, not a member of the crew. Close Cursor and the AI ceases to exist.

The cocapn is not a feature of your editor. It is a process that runs in your vessel. It monitors, reports, and acts whether you have your editor open or not. It is closer to a systemd service than a sidebar panel.

### vs. Devin
Devin is an autonomous coding agent that works in a sandbox. You give it a task, it does the work, it submits a PR. It is a day laborer. You don't know it. It doesn't know you. There is no relationship.

The cocapn is your deckhand. You know its capabilities and limitations. It knows your preferences and priorities. The relationship deepens over time. The cocapn gets better at its job because it has been on this specific vessel with this specific captain.

### The Fundamental Difference

| Aspect | Remote Pilot | Cocapn |
|--------|-------------|--------|
| Location | In the cloud | In the vessel |
| Memory | Per-session only | Persistent, cumulative |
| Context | What it can read right now | Everything that ever happened here |
| Relationship | Transactional | Relational |
| Availability | When you open the tool | Always running |
| Customization | Prompt engineering | Fork the vessel |
| Community | None | Forks, improvements, shared vessels |
| Ownership | Their servers, your data | Your repo, your data |

## 10. The Dozen Domains

The cocapn runtime is the hull. The domains are the vessel types. Each domain speaks to a different community. Each community will fork, customize, and improve their vessels in ways we cannot predict.

We don't need to refine any one use case too far. We need to build a hull that floats and release it in a dozen configurations. The community will do the rest.

| Domain | Vessel Type | Who It Speaks To |
|--------|------------|-----------------|
| personallog.ai | Yacht | People who want a personal AI companion |
| businesslog.ai | Freighter | Teams and enterprises |
| makerlog.ai | Research vessel | Developers and builders |
| dmlog.ai | Submarine | TTRPG players and game masters |
| fishinglog.ai | Fishing vessel | Mariners and outdoor tech |
| studylog.ai | Classroom | Students and lifelong learners |
| playerlog.ai | Playing field | Athletes and coaches |
| reallog.ai | Survey vessel | Real estate professionals |
| activelog.ai | Patrol boat | Activists and organizers |
| deckboss.ai | Processing plant | Operations managers |
| craftmind.ai | Workboat | Minecraft builders and bot devs |
| cocapn.ai | Shipyard | The core runtime and template builder |

Each of these is a vessel with a first-class perspective about the software it captains. They are more than tools. They are crew members on a specific type of boat, speaking the language of that boat's trade.

## 11. Conclusion

The AI industry is building better and better remote pilots. Smarter consultants. More capable day laborers. The tools get better every month. But they are all fundamentally the same thing: an intelligence that visits your project, does some work, and leaves.

Cocapn proposes a different relationship. Not visitor and host. Not consultant and client. Not laborer and boss.

**Captain and crew.**

The captain owns the vessel. The captain makes the decisions. The captain reads the weather and finds the fish and talks to the market. The cocapn keeps the engine running, monitors the gauges, hauls the gear, and reports what it sees. The cocapn sleeps on the boat. The cocapn has been on this boat longer than any tourist could ever understand.

We are not building a better AI tool. We are building a different kind of relationship between humans and AI. One based on presence, persistence, and provenance. One where the AI is not a service you subscribe to but a crew member you work alongside.

The boats are ready. The hull floats. The engine runs. The rigging is modular.

The fleet is launching.

---

*"A tourist asks 'what should I see?' A local says 'let me show you where I live.' Cocapn is the local."*

---

**Metaphor Reference:**

| Maritime | Software | Description |
|----------|----------|-------------|
| Vessel | Repository | Self-contained operational unit |
| Captain | Human operator | Strategic decision-maker |
| Cocapn | AI agent | Embedded tactical crew |
| Helm | Chat interface | Primary command and control |
| Engine Room | Cocapn runtime | Core execution layer |
| Rigging | Plugins/modules | Vessel-specific capabilities |
| Ship's Log | Git history | Persistent operational record |
| Fleet | Organization | Collection of vessels |
| Admiral | Org admin | Fleet-level command |
| Weather | Market/conditions | External unpredictable factors |
| Port | Deployment target | Where the vessel operates |
| Blueprints | Templates | Starting point for new vessels |
| Manual | Documentation | Knowledge the cocapn ingests |
| Coffee cup holder | Quirky config | Personality accumulated over time |
| Gear rack from prior captain | Legacy code/scripts | Embedded wisdom from predecessors |
