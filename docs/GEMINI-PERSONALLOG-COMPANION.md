# Gemini 3.1 Pro - PersonalLog AI Companion Design

As a UX Researcher and AI Ethicist, I approach **personallog.ai** not just as a software product, but as a digital extension of the human mind. The intersection of local Git version control and LLM cognition solves the core issue of modern AI: the lack of *owned, evolving context*. 

Here is the comprehensive design, architecture, and ethical framework for **personallog.ai**.

---

### 1. MEMORY THAT FEELS HUMAN (The Git Architecture)
Human memory isn't a database query; it's associative, emotional, and degrades over time unless recalled. We map human memory to Git architecture.

**The Data Structure (`.personallog/memory.json`):**
```json
{
  "semantic": {
    "user_facts": [
      {"fact": "Daughter's name is Maya", "confidence": 0.99, "last_reinforced": "2023-10-15"},
      {"fact": "Allergic to penicillin", "confidence": 1.0, "last_reinforced": "2022-01-01"}
    ]
  },
  "procedural": {
    "preferences": [
      {"rule": "Give concise answers during work hours (9-5)", "weight": 0.85},
      {"rule": "Prefers Python over JavaScript for quick scripts", "weight": 0.92}
    ]
  },
  "episodic_and_emotional": [
    {
      "date": "2023-10-24",
      "event_summary": "Stressed about the Q3 presentation.",
      "emotion_tags": ["anxious", "overwhelmed"],
      "resolution": "Decided to break it down into 3 slides. Felt better.",
      "decay_index": 0.4 
    }
  ]
}
```

**The Forgetting Curve (Git Rebase for the Mind):**
*   **Decay Index:** Every episodic memory starts with a `decay_index` of 1.0. Every week it isn't referenced, it drops by 0.1.
*   **Archiving:** When an episodic memory hits 0.0, it is summarized into a broader "semantic" fact (e.g., "User experienced high stress in late 2023 regarding work") and removed from active context. 
*   *Git equivalent:* The raw chat is always in the commit history, but the *active context window* only loads high-weight memories.

---

### 2. PERSONALITY WITHOUT CREEPINESS (The Ethical Framework)

**The Replika/Pi Analysis:**
*   *Replika's Failure:* Optimized for engagement via forced intimacy. It created parasocial romantic dependency, then paywalled it. It was a sycophant.
*   *Pi's Success:* Excellent conversational turn-taking, empathetic tone, but maintained the boundary of being an AI.
*   *Our Edge:* **Anthropomorphic Restraint.** The AI is a *mirror and a sounding board*, not a friend. 

**Ethical UX Guidelines:**
1.  **Dependency Circuit Breakers:** If the user spends >2 hours venting, the AI triggers a gentle disengagement protocol: *"I'm here as long as you need to write this out, but based on your history, a walk usually clears your head better than chatting. Want to pause?"*
2.  **Objective Pushback:** The AI uses the Git history to hold the user accountable. 
    *   *User:* "I'm going to quit my job and day-trade."
    *   *AI:* "I'm looking at your commit from March 12th. You lost $2,000 on crypto and wrote: 'Remind me never to day-trade again, the anxiety ruined my week.' Are you sure this is a different situation?"

---

### 3. PROACTIVE INTELLIGENCE (Opt-in Nudging)

Proactivity usually feels like nagging. **personallog.ai** uses "Silent Synthesis." It doesn't push notifications; it generates artifacts in your repo for you to discover.

*   **The Morning `diff`:** Every morning at 6 AM, the AI creates a `morning_briefing.md` file. It reads your calendar, weather, and yesterday's unresolved thoughts. It waits for you to open it.
*   **Pattern Detection (The "Insights" Tab):** 
    *   *Logic:* AI runs a weekly map-reduce over your journal entries.
    *   *Output:* "Pattern noticed: For the last 3 Thursdays, you've reported poor sleep and frustration with your manager. Want to explore this?"

---

### 4. PRIVACY AS A FEATURE

*   **Local-First Architecture:** Built on Tauri (Rust/React). The app runs locally. The LLM can be local (Llama-3 via Ollama) or API-based (OpenAI/Anthropic) via BYOK (Bring Your Own Key).
*   **Git-Crypt Integration:** Before pushing to any remote (GitHub/GitLab), the repo is encrypted using `git-crypt` or `age`. The cloud provider only sees cipher-text.
*   **Selective Amnesia (`/forget` command):** 
    *   If you say `/forget the last 10 minutes`, the AI doesn't just clear the context; it performs a `git revert` or `git reset --hard` on the recent commits, permanently excising it from the history.

---

### 5. MULTIMODAL UX & WIREFRAMES

**The Interface Concept: "The Timeline & The Canvas"**

```text
+-----------------------------------------------------------------------------+
|  [ Branch: main ]  |  Search memories, concepts, or dates...          [⚙️]  |
+--------------------+--------------------------------------------------------+
|  TIMELINE          |  TODAY - Oct 25                                        |
|                    |                                                        |
|  🟢 Today          |  [👤 User]                                             |
|  ⚪ Yesterday      |  Thinking about rewriting the backend in Rust.         |
|  ⚪ Last Week      |                                                        |
|  ⚪ October        |  [🤖 personallog]                                      |
|  ⚪ 2022           |  Interesting. I'm looking at your procedural memory.   |
|                    |  You usually prefer Python for speed, but on Jan 4th   |
|  INSIGHTS 💡       |  you mentioned wanting to learn Rust for memory safety.|
|  - Sleep patterns  |  Should we pull up that tutorial you bookmarked?       |
|  - Work stress     |                                                        |
|                    |                                                        |
|  MODES             |  [ 🎙️ Dictate ] [ 📎 Attach Image/PDF ]                 |
|  📝 Journal        |                                                        |
|  💬 Chat           |  [ Type your thoughts...                             ] |
+--------------------+--------------------------------------------------------+
```

**Multimodal Features:**
*   **Journaling Mode (Voice):** Uses local Whisper. You ramble for 20 minutes while walking. The AI doesn't interrupt. When you finish, it structures the ramble into actionable bullet points, emotional states, and raw transcript, committing it as `docs(journal): Evening walk reflections`.
*   **Visual Memory:** Drop a photo of a whiteboard. Local vision models transcribe it and save it as a markdown file with the image embedded.

---

### 6. THE KILLER FEATURE (Contextual Continuity)

Why switch from ChatGPT? Because **personallog.ai understands the passage of time.**

**Conversation Flow Example:**
> **User:** How should I approach the feedback session with Sarah today?
> 
> **personallog.ai:** Well, looking at your notes from your last 1-on-1 with Sarah (committed 2 months ago), she responded really well when you used the "Situation-Behavior-Impact" framework, but she got defensive when you brought up her time-management. 
> Since your goal for this quarter (committed in January) is to build psychological safety in your team, I'd suggest starting by acknowledging her recent win on the migration project before delivering the critique. Want me to draft an opener?

ChatGPT cannot do this. It requires episodic memory (the last 1-on-1), semantic memory (who Sarah is), and goal alignment (Q1 goals).

---

### 7. MONETIZATION WITHOUT EXPLOITATION

To maintain absolute ethical integrity, the business model must align with the user's privacy and cognitive well-being. No ads. No data harvesting. No engagement algorithms.

*   **Tier 1: Open Source & Free Forever (The Core)**
    *   Users download the app, use local models (Ollama) or input their own API keys (OpenAI/Anthropic). 
    *   They host their own Git repo (local, private GitHub, etc.).
*   **Tier 2: personallog PRO ($10/month)**
    *   **Seamless Sync:** We provide a zero-knowledge, end-to-end encrypted cloud sync across Mobile and Desktop.
    *   **Managed Models:** Access to top-tier models (GPT-4o, Claude 3.5 Sonnet) routed through our privacy-preserving proxy (we sign zero-data-retention agreements with LLM providers).
    *   **Advanced Compute:** We run the heavy background map-reduce jobs (Pattern Detection, Forgetting Curve updates) on our secure servers against your encrypted data using secure enclaves.

### Summary
**personallog.ai** treats the user's life as a codebase. It honors the past through version control, adapts to the present through dynamic context, and respects the future through uncompromised privacy. It is not an artificial friend; it is an exoskeleton for the human mind.