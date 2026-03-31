#!/usr/bin/env python3
"""
Cocapn Growth Simulation
=========================
Models the growth path from seed to full platform.
Answers: what gets added when, and what triggers each addition?

Usage: python3 scripts/simulate-growth.py
Output: docs/simulations/growth-roadmap.md
"""

import os
import time
import random
from dataclasses import dataclass, field
from typing import Optional

SEED = 42
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'docs', 'simulations')
random.seed(SEED)


# ── Growth Triggers ────────────────────────────────────────────────────────

@dataclass
class GrowthTrigger:
    """A feature that gets added when conditions are met."""
    feature: str
    category: str  # memory, plugins, a2a, platform, deployment
    trigger_condition: str
    trigger_metric: str  # what to measure
    trigger_threshold: str  # when to add
    rationale: str
    complexity: str  # low, medium, high
    depends_on: list = field(default_factory=list)
    code_added_lines: int = 0
    new_files: int = 0


@dataclass
class GrowthDay:
    """State of the agent on a given day."""
    day: int
    users: int
    conversations_per_day: int
    total_facts: int
    total_commits: int
    files: int
    features: list
    pain_points: list


# ── Trigger Definitions ────────────────────────────────────────────────────

TRIGGERS = [
    # Phase 1: Seed (Day 1-7)
    GrowthTrigger(
        feature="Basic memory (facts.json)",
        category="memory",
        trigger_condition="First conversation",
        trigger_metric="conversations",
        trigger_threshold="1",
        rationale="Agent needs to remember user preferences from session to session",
        complexity="low",
        code_added_lines=80,
        new_files=1,
    ),
    GrowthTrigger(
        feature="Soul.md personality",
        category="platform",
        trigger_condition="First run",
        trigger_metric="existence",
        trigger_threshold="seed planted",
        rationale="Agent needs identity before it can converse",
        complexity="low",
        code_added_lines=35,
        new_files=1,
    ),
    GrowthTrigger(
        feature="Git awareness",
        category="platform",
        trigger_condition="First `whoami` command",
        trigger_metric="commands",
        trigger_threshold="1",
        rationale="Agent needs to know what repo it lives in",
        complexity="low",
        code_added_lines=180,
        new_files=1,
    ),
    GrowthTrigger(
        feature="Web server",
        category="deployment",
        trigger_condition="User wants browser access",
        trigger_metric="user requests",
        trigger_threshold="1",
        rationale="Terminal-only limits accessibility; web UI enables non-technical users",
        complexity="medium",
        code_added_lines=150,
        new_files=2,
    ),

    # Phase 2: Growth (Day 7-30)
    GrowthTrigger(
        feature="Memory search",
        category="memory",
        trigger_condition="Can't find facts from last week",
        trigger_metric="total facts",
        trigger_threshold="100",
        rationale="Linear scan through facts.json gets slow and noisy at scale",
        complexity="medium",
        code_added_lines=60,
        new_files=0,
        depends_on=["Basic memory (facts.json)"],
    ),
    GrowthTrigger(
        feature="Memory decay",
        category="memory",
        trigger_condition="Old facts polluting context",
        trigger_metric="total facts",
        trigger_threshold="200",
        rationale="Not all facts are equal; preferences persist, trivia should fade",
        complexity="medium",
        code_added_lines=45,
        new_files=0,
        depends_on=["Basic memory (facts.json)"],
    ),
    GrowthTrigger(
        feature="Wiki (structured docs)",
        category="memory",
        trigger_condition="User starts asking 'how does X work?' repeatedly",
        trigger_metric="repeated questions",
        trigger_threshold="3",
        rationale="Long-form knowledge needs a different store than flat facts",
        complexity="medium",
        code_added_lines=120,
        new_files=1,
        depends_on=["Basic memory (facts.json)"],
    ),
    GrowthTrigger(
        feature="Template installer",
        category="platform",
        trigger_condition="Second user wants to set up their own instance",
        trigger_metric="users",
        trigger_threshold="2",
        rationale="Manual setup is error-prone; templates give a known-good starting point",
        complexity="medium",
        code_added_lines=100,
        new_files=2,
    ),

    # Phase 3: Expansion (Day 30-90)
    GrowthTrigger(
        feature="Plugin system",
        category="plugins",
        trigger_condition="Third-party wants to extend the agent",
        trigger_metric="external feature requests",
        trigger_threshold="3",
        rationale="Hardcoding every integration makes the core unmaintainable",
        complexity="high",
        code_added_lines=250,
        new_files=4,
    ),
    GrowthTrigger(
        feature="Webhook handlers",
        category="plugins",
        trigger_condition="Agent needs to react to GitHub/Slack events",
        trigger_metric="external integrations",
        trigger_threshold="2",
        rationale="Event-driven workflows require webhook infrastructure",
        complexity="medium",
        code_added_lines=180,
        new_files=3,
        depends_on=["Plugin system"],
    ),
    GrowthTrigger(
        feature="Relationships graph",
        category="memory",
        trigger_condition="Agent interacts with multiple people/services",
        trigger_metric="distinct entities in memory",
        trigger_threshold="10",
        rationale="Flat facts can't express 'Alice is Bob's manager who prefers email'",
        complexity="medium",
        code_added_lines=90,
        new_files=1,
        depends_on=["Basic memory (facts.json)"],
    ),
    GrowthTrigger(
        feature="Docker deployment",
        category="deployment",
        trigger_condition="Non-technical user wants to run the agent",
        trigger_metric="setup support requests",
        trigger_threshold="5",
        rationale="Docker hides Node.js, git, and dependency management",
        complexity="low",
        code_added_lines=40,
        new_files=2,
    ),

    # Phase 4: Scale (Day 90-180)
    GrowthTrigger(
        feature="Fleet coordination",
        category="a2a",
        trigger_condition="User runs multiple agents for different repos",
        trigger_metric="agent instances per user",
        trigger_threshold="3",
        rationale="Agents need to coordinate: share context, divide work, avoid conflicts",
        complexity="high",
        code_added_lines=400,
        new_files=5,
    ),
    GrowthTrigger(
        feature="A2A protocol",
        category="a2a",
        trigger_condition="Agents need to talk to each other",
        trigger_metric="fleet size",
        trigger_threshold="3 agents",
        rationale="Standardized agent-to-agent communication protocol",
        complexity="high",
        code_added_lines=300,
        new_files=3,
        depends_on=["Fleet coordination"],
    ),
    GrowthTrigger(
        feature="Multi-tenant support",
        category="platform",
        trigger_condition="Hosted deployment serving multiple users",
        trigger_metric="concurrent users",
        trigger_threshold="10",
        rationale="Shared infrastructure must isolate user data and memory",
        complexity="high",
        code_added_lines=350,
        new_files=6,
    ),
    GrowthTrigger(
        feature="Cloudflare Workers",
        category="deployment",
        trigger_condition="Users want always-on agent without running a server",
        trigger_metric="uptime complaints",
        trigger_threshold="5",
        rationale="Workers provide edge deployment with global availability",
        complexity="high",
        code_added_lines=200,
        new_files=4,
    ),

    # Phase 5: Full Platform (Day 180-365)
    GrowthTrigger(
        feature="RepoLearner",
        category="platform",
        trigger_condition="Agent can't explain why code exists",
        trigger_metric="unanswered 'why' questions",
        trigger_threshold="10",
        rationale="Git history analysis gives the agent deep understanding of its own evolution",
        complexity="high",
        code_added_lines=500,
        new_files=8,
    ),
    GrowthTrigger(
        feature="Semantic memory (embeddings)",
        category="memory",
        trigger_condition="Recall accuracy drops below 80%",
        trigger_metric="recall accuracy",
        trigger_threshold="80%",
        rationale="Keyword search can't find semantically related facts",
        complexity="high",
        code_added_lines=200,
        new_files=3,
        depends_on=["Memory search"],
    ),
    GrowthTrigger(
        feature="Scheduler (cron)",
        category="platform",
        trigger_condition="Agent needs to do things on a schedule",
        trigger_metric="scheduled task requests",
        trigger_threshold="3",
        rationale="Maintenance tasks, memory decay, and health checks need cron",
        complexity="medium",
        code_added_lines=150,
        new_files=2,
    ),
    GrowthTrigger(
        feature="Age encryption",
        category="platform",
        trigger_condition="Agent stores sensitive data (API keys, tokens)",
        trigger_metric="sensitive data entries",
        trigger_threshold="5",
        rationale="Secrets in plaintext JSON is a security risk",
        complexity="medium",
        code_added_lines=80,
        new_files=2,
    ),
]


# ── User Model ─────────────────────────────────────────────────────────────

class UserModel:
    """Simulates realistic user behavior driving feature growth."""

    def __init__(self):
        self.users = 1  # start with the developer
        self.conversations_per_user_per_day = 5
        self.facts_per_conversation = 3
        self.feature_requests_per_week = 1
        self.day = 0

    def simulate_day(self) -> GrowthDay:
        self.day += 1

        # User growth model: slow start, then exponential, then linear
        if self.day <= 7:
            self.users = 1
        elif self.day <= 30:
            self.users = 1 + (self.day - 7) // 5
        elif self.day <= 90:
            self.users = 5 + (self.day - 30) // 3
        elif self.day <= 180:
            self.users = 25 + (self.day - 90) // 2
        else:
            self.users = 70 + (self.day - 180)

        conv_per_day = self.users * self.conversations_per_user_per_day
        new_facts = conv_per_day * self.facts_per_conversation

        # Determine current pain points based on state
        pain_points = []
        total_facts = sum(
            self._facts_on_day(d) for d in range(1, self.day + 1)
        )
        total_commits = self.day * (2 + self.users // 3)

        if total_facts > 100 and self.day > 7:
            pain_points.append("Memory recall getting slow")
        if self.users > 2 and self.day > 14:
            pain_points.append("Need template installer for new users")
        if self.users > 5 and self.day > 30:
            pain_points.append("Setup friction — Docker needed")
        if total_facts > 500 and self.day > 30:
            pain_points.append("Memory pollution — need decay")
        if self.users > 10 and self.day > 60:
            pain_points.append("Multi-tenant isolation needed")
        if self.users > 3 and self.day > 45:
            pain_points.append("Multiple agents need coordination")
        if total_facts > 1000 and self.day > 60:
            pain_points.append("Keyword search insufficient — need semantic recall")
        if total_commits > 500 and self.day > 120:
            pain_points.append("Agent can't explain its own history")

        # Determine active features
        features = []
        for trigger in TRIGGERS:
            if self._should_activate(trigger):
                features.append(trigger.feature)

        return GrowthDay(
            day=self.day,
            users=self.users,
            conversations_per_day=conv_per_day,
            total_facts=total_facts,
            total_commits=total_commits,
            files=5 + len(features) * 10 + self.day // 2,
            features=features,
            pain_points=pain_points,
        )

    def _facts_on_day(self, day: int) -> int:
        users = max(1, 1 + max(0, day - 7) // 5)
        return users * self.conversations_per_user_per_day * self.facts_per_conversation

    def _should_activate(self, trigger: GrowthTrigger) -> bool:
        """Check if a trigger should activate based on current state."""
        # Map trigger thresholds to actual metrics
        t = trigger.trigger_threshold
        m = trigger.trigger_metric

        checks = {
            "conversations": lambda: self.day >= 1,
            "existence": lambda: True,
            "commands": lambda: self.day >= 1,
            "user requests": lambda: self.day >= 1,
            "total facts": lambda: sum(self._facts_on_day(d) for d in range(1, self.day + 1)) >= int(t),
            "repeated questions": lambda: self.day >= 14,
            "users": lambda: self.users >= int(t) if t.isdigit() else self.day >= 14,
            "external feature requests": lambda: self.day >= 30,
            "external integrations": lambda: self.day >= 45,
            "distinct entities in memory": lambda: self.day >= 45,
            "setup support requests": lambda: self.day >= 30,
            "agent instances per user": lambda: self.day >= 60,
            "fleet size": lambda: self.day >= 90,
            "concurrent users": lambda: self.users >= int(t) if t.isdigit() else self.day >= 90,
            "uptime complaints": lambda: self.day >= 90,
            "unanswered 'why' questions": lambda: self.day >= 120,
            "recall accuracy": lambda: self.day >= 120,
            "scheduled task requests": lambda: self.day >= 60,
            "sensitive data entries": lambda: self.day >= 45,
        }

        handler = checks.get(m)
        if handler:
            return handler()
        return self.day >= 30  # default activation


# ── Report Generator ───────────────────────────────────────────────────────

def generate_roadmap(days: list[GrowthDay]) -> str:
    """Generate the growth roadmap markdown report."""
    lines = []
    lines.append("# Cocapn Growth Roadmap — Seed to Platform Simulation")
    lines.append("")
    lines.append(f"**Date:** {time.strftime('%Y-%m-%d')}")
    lines.append(f"**Simulated:** 365 days of agent growth")
    lines.append("")

    # Phase overview
    lines.append("## Growth Phases")
    lines.append("")
    lines.append("| Phase | Days | Users | Conversations/Day | Features | Triggers |")
    lines.append("|-------|------|-------|-------------------|----------|----------|")

    phases = [
        ("Seed", 1, 7),
        ("Sprout", 8, 30),
        ("Growth", 31, 90),
        ("Expansion", 91, 180),
        ("Maturity", 181, 365),
    ]

    for phase_name, start, end in phases:
        mid_day = days[(start + end) // 2 - 1] if (start + end) // 2 - 1 < len(days) else days[-1]
        end_day = days[min(end - 1, len(days) - 1)]
        lines.append(
            f"| {phase_name} | {start}-{end} | {mid_day.users} | "
            f"{mid_day.conversations_per_day} | {len(end_day.features)} | "
            f"{len(end_day.pain_points)} pain points |"
        )

    lines.append("")

    # Feature timeline
    lines.append("## Feature Activation Timeline")
    lines.append("")
    lines.append("Features activate when their trigger condition is met:")
    lines.append("")

    activated_days = {}
    for day in days:
        for trigger in TRIGGERS:
            if trigger.feature in day.features and trigger.feature not in activated_days:
                activated_days[trigger.feature] = day.day

    lines.append("| Day | Feature | Category | Complexity | Trigger | Lines Added |")
    lines.append("|-----|---------|----------|------------|---------|-------------|")

    for trigger in sorted(TRIGGERS, key=lambda t: activated_days.get(t.feature, 999)):
        act_day = activated_days.get(trigger.feature, "—")
        lines.append(
            f"| {act_day} | {trigger.feature} | {trigger.category} | "
            f"{trigger.complexity} | {trigger.trigger_condition} | "
            f"+{trigger.code_added_lines} ({trigger.new_files} files) |"
        )

    lines.append("")

    # Key questions answered
    lines.append("## Key Questions Answered")
    lines.append("")

    lines.append("### When does the agent need plugins?")
    lines.append("")
    plugin_day = activated_days.get("Plugin system", "—")
    lines.append(f"**Answer: Day {plugin_day}** (when 3+ external feature requests accumulate)")
    lines.append("- Before plugins: every new feature is hardcoded into the core")
    lines.append("- After plugins: third parties can extend without touching core")
    lines.append("- The seed does NOT need plugins — it needs a clean plugin API to grow into")
    lines.append("")

    lines.append("### When does the agent need A2A?")
    lines.append("")
    fleet_day = activated_days.get("Fleet coordination", "—")
    a2a_day = activated_days.get("A2A protocol", "—")
    lines.append(f"**Answer: Day {fleet_day} for fleet, Day {a2a_day} for A2A**")
    lines.append("- A2A is needed when a single user runs 3+ agents simultaneously")
    lines.append("- The trigger is agent proliferation, not user count")
    lines.append("- The seed should NOT include A2A — but should be architected to accept it")
    lines.append("")

    lines.append("### When does the agent need the full cocapn platform?")
    lines.append("")
    lines.append("**Answer: Day 90-180** (when multi-tenant + cloud deployment are needed)")
    lines.append("- The seed is self-sufficient for 1-3 users")
    lines.append("- Platform features (multi-tenant, Workers, fleet) kick in at scale")
    lines.append("- Migration path: seed → local bridge → cloud bridge → fleet")
    lines.append("")

    # Growth metrics over time
    lines.append("## Growth Metrics Over Time")
    lines.append("")
    lines.append("| Day | Users | Conversations/Day | Total Facts | Files | Features Active |")
    lines.append("|-----|-------|-------------------|-------------|-------|-----------------|")

    sample_days = [1, 7, 14, 30, 60, 90, 180, 270, 365]
    for d in sample_days:
        if d - 1 < len(days):
            day = days[d - 1]
            lines.append(
                f"| {day.day} | {day.users} | {day.conversations_per_day} | "
                f"{day.total_facts} | {day.files} | {len(day.features)}/{len(TRIGGERS)} |"
            )

    lines.append("")

    # Complexity budget
    lines.append("## Complexity Budget")
    lines.append("")
    total_lines = sum(t.code_added_lines for t in TRIGGERS)
    total_files = sum(t.new_files for t in TRIGGERS)
    lines.append(f"**Total features:** {len(TRIGGERS)}")
    lines.append(f"**Total code added:** {total_lines} lines across {total_files} new files")
    lines.append("")

    lines.append("| Category | Features | Lines | Percentage |")
    lines.append("|----------|----------|-------|------------|")
    for cat in ["memory", "plugins", "a2a", "platform", "deployment"]:
        cat_triggers = [t for t in TRIGGERS if t.category == cat]
        cat_lines = sum(t.code_added_lines for t in cat_triggers)
        lines.append(
            f"| {cat.title()} | {len(cat_triggers)} | {cat_lines} | "
            f"{cat_lines / total_lines * 100:.0f}% |"
        )

    lines.append("")

    # Recommendations for seed
    lines.append("## Recommendations for the Seed")
    lines.append("")
    lines.append("### Include at seed (Day 1)")
    lines.append("These features should be in the initial seed package:")
    for t in TRIGGERS:
        if activated_days.get(t.feature, 999) <= 7:
            lines.append(f"- **{t.feature}** (+{t.code_added_lines} lines)")
    lines.append("")

    lines.append("### Design for, don't build yet (Day 7-30)")
    lines.append("These features need interface slots but not implementations:")
    for t in TRIGGERS:
        day = activated_days.get(t.feature, 999)
        if 7 < day <= 30:
            lines.append(f"- **{t.feature}** — triggered at Day {day}")
    lines.append("")

    lines.append("### Plan for (Day 30+)")
    lines.append("These features are future platform scope:")
    for t in TRIGGERS:
        day = activated_days.get(t.feature, 999)
        if day > 30:
            lines.append(f"- **{t.feature}** — triggered at Day {day}")
    lines.append("")

    return "\n".join(lines)


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    print("Cocapn Growth Simulation")
    print("=" * 50)
    print("Simulating 365 days of agent growth...")
    print()

    model = UserModel()
    days = []
    for d in range(365):
        day = model.simulate_day()
        days.append(day)

    # Generate report
    report = generate_roadmap(days)

    # Save
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_path = os.path.join(OUTPUT_DIR, "growth-roadmap.md")
    with open(output_path, "w") as f:
        f.write(report)

    print(f"Results saved to {output_path}")

    # Print summary
    print()
    print("Growth Summary:")
    print(f"  Day 1: {days[0].features}")
    print(f"  Day 30: {len(days[29].features)} features, {days[29].users} users")
    print(f"  Day 90: {len(days[89].features)} features, {days[89].users} users")
    print(f"  Day 365: {len(days[364].features)}/{len(TRIGGERS)} features, {days[364].users} users")


if __name__ == "__main__":
    main()
