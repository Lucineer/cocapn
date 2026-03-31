#!/usr/bin/env python3
"""
Cocapn Memory Strategy Simulation
===================================
Simulates 4 memory strategies over 30 days / 1000 conversations.
Compares: growth rate, recall accuracy, write/read performance, conflict resolution.

Usage: python3 scripts/simulate-memory.py
Output: docs/simulations/memory-strategies.md
"""

import json
import os
import random
import time
import hashlib
from dataclasses import dataclass, field
from typing import Optional

# ── Configuration ──────────────────────────────────────────────────────────

DAYS = 30
CONVERSATIONS = 1000
SEED = 42
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'docs', 'simulations')

random.seed(SEED)

# Simulated fact categories with typical sizes
FACT_TEMPLATES = [
    "user.preference.{key} = {value}",
    "project.decision.{id} = {rationale}",
    "error.pattern.{hash} = {fix}",
    "conversation.summary.{date}.{idx} = {summary}",
    "relationship.{entity} = {context}",
    "workflow.{name}.{step} = {action}",
]

CONVERSATION_TOPICS = [
    "debugging TypeScript type error in bridge.ts",
    "discussing architecture for fleet coordination",
    "implementing memory persistence layer",
    "reviewing soul.md personality parameters",
    "setting up WebSocket JSON-RPC server",
    "analyzing git history for repo understanding",
    "configuring DeepSeek API integration",
    "building web UI chat interface",
    "testing memory recall accuracy",
    "designing plugin system architecture",
    "writing integration tests for brain module",
    "optimizing file walk performance",
    "discussing two-repo model tradeoffs",
    "implementing A2A protocol handlers",
    "reviewing security JWT implementation",
    "setting up Docker deployment",
    "configuring Cloudflare Workers",
    "building template installer",
    "analyzing code patterns in codebase",
    "discussing vertical customization strategy",
]


# ── Data Structures ────────────────────────────────────────────────────────

@dataclass
class WriteResult:
    ms: float
    success: bool
    conflict: bool = False

@dataclass
class ReadResult:
    ms: float
    found: bool
    accuracy: float  # 0-1, how relevant

@dataclass
class StrategyResult:
    name: str
    total_writes: int = 0
    total_reads: int = 0
    write_time_ms: float = 0.0
    read_time_ms: float = 0.0
    recalls_attempted: int = 0
    recalls_successful: int = 0
    recall_accuracy_sum: float = 0.0
    max_file_size_kb: float = 0.0
    total_size_kb: float = 0.0
    file_count: int = 1
    conflicts_detected: int = 0
    conflicts_resolved: int = 0
    growth_over_time: list = field(default_factory=list)


# ── Base Simulation ────────────────────────────────────────────────────────

class MemorySimulator:
    """Base class for memory strategy simulations."""

    def __init__(self, name: str):
        self.name = name
        self.result = StrategyResult(name=name)
        self.data = {}

    def simulate_write(self, key: str, value: str, day: int) -> WriteResult:
        raise NotImplementedError

    def simulate_read(self, key: str, age_days: int) -> ReadResult:
        raise NotImplementedError

    def simulate_conflict(self, key: str) -> bool:
        raise NotImplementedError

    def record_growth(self, day: int):
        pass


# ── Strategy A: Flat JSON ─────────────────────────────────────────────────

class FlatJSONSimulator(MemorySimulator):
    """All facts in one memory.json file. Current cocapn approach."""

    def __init__(self):
        super().__init__("A: Flat JSON (current)")
        self.facts = {}
        self.messages = []

    def simulate_write(self, key: str, value: str, day: int) -> WriteResult:
        # Write = serialize entire JSON, append to file
        self.facts[key] = value
        msg = {"role": "user", "content": f"discussing {key}", "ts": day}
        self.messages.append(msg)

        # Performance: O(n) where n = total entries
        size = len(json.dumps({"facts": self.facts, "messages": self.messages}))
        write_ms = 0.1 + (size / 10000) * 0.5  # grows with file size

        # Conflict: last-write-wins, always succeeds
        conflict = random.random() < 0.02  # 2% conflict rate at scale
        if conflict:
            self.result.conflicts_detected += 1
            self.result.conflicts_resolved += 1  # last-write-wins always resolves

        self.result.total_writes += 1
        self.result.write_time_ms += write_ms
        return WriteResult(ms=write_ms, success=True, conflict=conflict)

    def simulate_read(self, key: str, age_days: int) -> ReadResult:
        # Read = load entire JSON, scan for key
        size = len(json.dumps({"facts": self.facts, "messages": self.messages}))
        read_ms = 0.05 + (size / 10000) * 0.3

        found = key in self.facts
        # Accuracy degrades slightly with size (noise from other entries)
        accuracy = 1.0 if found else 0.0
        if found and len(self.facts) > 500:
            accuracy = max(0.7, 1.0 - (len(self.facts) / 5000))

        self.result.total_reads += 1
        self.result.recalls_attempted += 1
        if found:
            self.result.recalls_successful += 1
        self.result.recall_accuracy_sum += accuracy
        self.result.read_time_ms += read_ms
        return ReadResult(ms=read_ms, found=found, accuracy=accuracy)

    def simulate_conflict(self, key: str) -> bool:
        # Flat JSON has no conflict detection — last-write-wins silently
        return False

    def record_growth(self, day: int):
        size = len(json.dumps({"facts": self.facts, "messages": self.messages}))
        self.result.growth_over_time.append((day, size / 1024))
        self.result.max_file_size_kb = max(self.result.max_file_size_kb, size / 1024)
        self.result.total_size_kb = size / 1024


# ── Strategy B: Daily Files ───────────────────────────────────────────────

class DailyFilesSimulator(MemorySimulator):
    """One file per day: memory/2026-03-31.md"""

    def __init__(self):
        super().__init__("B: Daily Files")
        self.daily_data = {}  # day -> {facts, messages}
        self.file_count = 0

    def simulate_write(self, key: str, value: str, day: int) -> WriteResult:
        if day not in self.daily_data:
            self.daily_data[day] = {"facts": {}, "messages": []}
            self.file_count += 1

        self.daily_data[day]["facts"][key] = value
        self.daily_data[day]["messages"].append({"content": f"discussing {key}"})

        # Write = append to today's file only
        day_size = len(json.dumps(self.daily_data[day]))
        write_ms = 0.1 + (day_size / 10000) * 0.2  # smaller file = faster

        conflict = random.random() < 0.01
        if conflict:
            self.result.conflicts_detected += 1
            self.result.conflicts_resolved += 1

        self.result.total_writes += 1
        self.result.write_time_ms += write_ms
        return WriteResult(ms=write_ms, success=True, conflict=conflict)

    def simulate_read(self, key: str, age_days: int) -> ReadResult:
        # Read = search across daily files, newest first
        read_ms = 0.05
        found = False
        accuracy = 0.0

        # Must search up to N files to find old fact
        files_to_search = min(age_days + 1, len(self.daily_data))
        read_ms += files_to_search * 0.08  # each file open costs ~0.08ms

        for d in sorted(self.daily_data.keys(), reverse=True):
            if key in self.daily_data[d]["facts"]:
                found = True
                accuracy = 1.0 if age_days <= 7 else max(0.6, 1.0 - (age_days / 60))
                break

        self.result.total_reads += 1
        self.result.recalls_attempted += 1
        if found:
            self.result.recalls_successful += 1
        self.result.recall_accuracy_sum += accuracy
        self.result.read_time_ms += read_ms
        return ReadResult(ms=read_ms, found=found, accuracy=accuracy)

    def simulate_conflict(self, key: str) -> bool:
        return random.random() < 0.005

    def record_growth(self, day: int):
        total = sum(len(json.dumps(d)) for d in self.daily_data.values())
        max_daily = max(len(json.dumps(d)) for d in self.daily_data.values())
        self.result.growth_over_time.append((day, total / 1024))
        self.result.max_file_size_kb = max_daily / 1024
        self.result.total_size_kb = total / 1024
        self.result.file_count = len(self.daily_data)


# ── Strategy C: Semantic Chunks ───────────────────────────────────────────

class SemanticChunkSimulator(MemorySimulator):
    """Embedding-based retrieval with chunked storage."""

    def __init__(self):
        super().__init__("C: Semantic Chunks")
        self.chunks = {}  # chunk_id -> {text, embedding_hash, keywords}
        self.index = {}   # keyword -> [chunk_ids]

    def _hash_embedding(self, text: str) -> str:
        return hashlib.md5(text.encode()).hexdigest()[:8]

    def _extract_keywords(self, text: str) -> list:
        words = text.lower().replace(".", " ").split()
        return [w for w in words if len(w) > 3][:5]

    def simulate_write(self, key: str, value: str, day: int) -> WriteResult:
        # Write = compute embedding + store chunk + update index
        chunk_id = f"chunk_{len(self.chunks)}"
        keywords = self._extract_keywords(f"{key} {value}")
        emb_hash = self._hash_embedding(f"{key}:{value}")

        self.chunks[chunk_id] = {
            "text": f"{key} = {value}",
            "embedding_hash": emb_hash,
            "keywords": keywords,
            "day": day,
        }

        for kw in keywords:
            if kw not in self.index:
                self.index[kw] = []
            self.index[kw].append(chunk_id)

        # Embedding computation is expensive
        write_ms = 1.5 + random.uniform(0.5, 2.0)  # 1.5-3.5ms for embedding

        conflict = random.random() < 0.005
        if conflict:
            self.result.conflicts_detected += 1
            self.result.conflicts_resolved += 1

        self.result.total_writes += 1
        self.result.write_time_ms += write_ms
        return WriteResult(ms=write_ms, success=True, conflict=conflict)

    def simulate_read(self, key: str, age_days: int) -> ReadResult:
        # Read = embed query + search index + cosine similarity ranking
        query_keywords = self._extract_keywords(key)

        # Index lookup + ranking
        read_ms = 0.3 + random.uniform(0.2, 0.8)  # embedding query
        read_ms += len(self.chunks) * 0.001  # ranking cost

        # Search through index
        candidates = set()
        for kw in query_keywords:
            if kw in self.index:
                candidates.update(self.index[kw])

        found = len(candidates) > 0
        # Semantic search has high recall but may return slightly wrong results
        accuracy = 0.95 if found else 0.0
        if found and len(self.chunks) > 500:
            accuracy = max(0.8, 0.95 - (len(self.chunks) / 3000))

        self.result.total_reads += 1
        self.result.recalls_attempted += 1
        if found:
            self.result.recalls_successful += 1
        self.result.recall_accuracy_sum += accuracy
        self.result.read_time_ms += read_ms
        return ReadResult(ms=read_ms, found=found, accuracy=accuracy)

    def simulate_conflict(self, key: str) -> bool:
        return random.random() < 0.003

    def record_growth(self, day: int):
        total = len(json.dumps({"chunks": self.chunks, "index": self.index}))
        self.result.growth_over_time.append((day, total / 1024))
        self.result.max_file_size_kb = total / 1024
        self.result.total_size_kb = total / 1024
        self.result.file_count = 1  # single index + chunk store


# ── Strategy D: Git-Native ────────────────────────────────────────────────

class GitNativeSimulator(MemorySimulator):
    """Commit messages + file diffs as memory. Git is the database."""

    def __init__(self):
        super().__init__("D: Git-Native")
        self.commits = []  # [{message, diff_size, files_changed}]
        self.total_diff_size = 0

    def simulate_write(self, key: str, value: str, day: int) -> WriteResult:
        # Write = git add + git commit
        diff_size = len(value) + random.randint(50, 500)
        self.commits.append({
            "message": f"memory: store {key}",
            "diff_size": diff_size,
            "files_changed": random.randint(1, 3),
            "day": day,
        })
        self.total_diff_size += diff_size

        # Git write = staging + commit object creation
        write_ms = 2.0 + random.uniform(1.0, 5.0)  # git is slower for writes

        conflict = random.random() < 0.01  # merge conflicts
        if conflict:
            self.result.conflicts_detected += 1
            # Git conflicts require manual resolution 30% of the time
            if random.random() < 0.7:
                self.result.conflicts_resolved += 1

        self.result.total_writes += 1
        self.result.write_time_ms += write_ms
        return WriteResult(ms=write_ms, success=True, conflict=conflict)

    def simulate_read(self, key: str, age_days: int) -> ReadResult:
        # Read = git log --grep + git show
        read_ms = 0.5  # base git log cost

        # Search through commit history
        read_ms += len(self.commits) * 0.002  # linear scan

        # Git search is imprecise — depends on commit message quality
        found = False
        for commit in self.commits:
            if key.split(".")[0] in commit["message"]:
                found = True
                break

        # Accuracy depends on commit message discipline
        accuracy = 0.0
        if found:
            accuracy = 0.85  # good but not perfect (message may not contain full context)
            if age_days > 14:
                accuracy = max(0.5, 0.85 - (age_days / 100))
        else:
            # Might miss if key doesn't appear in commit message
            accuracy = 0.3  # partial match possible via git log -S

        self.result.total_reads += 1
        self.result.recalls_attempted += 1
        if found:
            self.result.recalls_successful += 1
        self.result.recall_accuracy_sum += accuracy
        self.result.read_time_ms += read_ms
        return ReadResult(ms=read_ms, found=found, accuracy=accuracy)

    def simulate_conflict(self, key: str) -> bool:
        return random.random() < 0.01

    def record_growth(self, day: int):
        # Git objects are compressed; .git directory grows
        git_size = self.total_diff_size * 0.4  # git compresses ~60%
        self.result.growth_over_time.append((day, git_size / 1024))
        self.result.max_file_size_kb = git_size / 1024
        self.result.total_size_kb = git_size / 1024
        self.result.file_count = len(self.commits)


# ── Simulation Runner ─────────────────────────────────────────────────────

def run_simulation(sim: MemorySimulator) -> StrategyResult:
    """Run 1000 conversations over 30 days for a given strategy."""
    facts_stored = []  # [(key, value, day_stored)]

    conv_per_day = CONVERSATIONS // DAYS

    for day in range(1, DAYS + 1):
        for conv in range(conv_per_day):
            # Store a fact
            topic = random.choice(CONVERSATION_TOPICS)
            key_parts = topic.split()[:3]
            key = ".".join(key_parts).lower().replace(" ", "_")
            key += f".d{day}c{conv}"
            value = f"Discussed {topic} on day {day}, conversation {conv}. Conclusion: {random.choice(['proceed', 'defer', 'investigate', 'approved', 'rejected'])}"

            sim.simulate_write(key, value, day)
            facts_stored.append((key, value, day))

            # Occasionally recall a past fact
            if random.random() < 0.3 and facts_stored:
                past_fact = random.choice(facts_stored)
                age = day - past_fact[2]
                sim.simulate_read(past_fact[0], age)

            # Simulate concurrent write conflict
            if random.random() < 0.05:
                sim.simulate_conflict(key)

        sim.record_growth(day)

    return sim.result


def format_results(results: list[StrategyResult]) -> str:
    """Format simulation results as Markdown."""
    lines = []
    lines.append("# Memory Strategy Simulation Results")
    lines.append("")
    lines.append(f"**Simulated:** {CONVERSATIONS} conversations over {DAYS} days")
    lines.append(f"**Date:** {time.strftime('%Y-%m-%d')}")
    lines.append("")

    # Performance table
    lines.append("## Performance Comparison")
    lines.append("")
    lines.append("| Strategy | Avg Write (ms) | Avg Read (ms) | Recall Rate | Avg Accuracy | Max Size (KB) | Conflicts |")
    lines.append("|----------|---------------|---------------|-------------|-------------|---------------|-----------|")

    for r in results:
        avg_write = r.write_time_ms / r.total_writes if r.total_writes else 0
        avg_read = r.read_time_ms / r.total_reads if r.total_reads else 0
        recall_rate = r.recalls_successful / r.recalls_attempted * 100 if r.recalls_attempted else 0
        avg_accuracy = r.recall_accuracy_sum / r.recalls_attempted if r.recalls_attempted else 0
        conflict_rate = r.conflicts_detected / r.total_writes * 100 if r.total_writes else 0

        lines.append(
            f"| {r.name} | {avg_write:.2f} | {avg_read:.2f} | "
            f"{recall_rate:.1f}% | {avg_accuracy:.2f} | {r.max_file_size_kb:.1f} | "
            f"{r.conflicts_detected} ({conflict_rate:.1f}%) |"
        )

    lines.append("")

    # Growth over time
    lines.append("## Memory Growth (KB over 30 days)")
    lines.append("")
    lines.append("| Day | " + " | ".join(r.name.split(":")[0].strip() for r in results) + " |")
    lines.append("|-----|" + "|".join(["--------"] * len(results)) + "|")

    sample_days = [1, 5, 10, 15, 20, 25, 30]
    for day in sample_days:
        values = []
        for r in results:
            # Find closest day in growth data
            growth = [g for g in r.growth_over_time if g[0] == day]
            if growth:
                values.append(f"{growth[0][1]:.1f}")
            else:
                values.append("—")
        lines.append(f"| {day} | " + " | ".join(values) + " |")

    lines.append("")

    # Characteristics
    lines.append("## Strategy Characteristics")
    lines.append("")

    chars = [
        ("A: Flat JSON", [
            "**Pros:** Simplest implementation. O(1) key lookup. Single file. No dependencies.",
            "**Cons:** Grows unbounded. O(n) write at scale. No conflict detection. Hard to shard.",
            "**Best for:** Seeds, personal projects, <500 conversations.",
            "**Breakdown at:** ~2000 facts / ~500KB — write latency exceeds 25ms.",
        ]),
        ("B: Daily Files", [
            "**Pros:** Natural sharding. Easy to archive old days. Parallel writes to different days.",
            "**Cons:** Cross-day queries are slow. File proliferation (30+ files/month). Hard to find facts.",
            "**Best for:** Activity logging, journals, append-heavy workloads.",
            "**Breakdown at:** ~5000 facts — cross-day recall requires scanning too many files.",
        ]),
        ("C: Semantic Chunks", [
            "**Pros:** Best recall accuracy. Similarity search finds related facts. Scales to millions.",
            "**Cons:** Expensive writes (embedding). Requires vector index. Complex implementation.",
            "**Best for:** Knowledge bases, long-term agents, >10K conversations.",
            "**Breakdown at:** Scales well — main cost is embedding computation, not storage.",
        ]),
        ("D: Git-Native", [
            "**Pros:** Zero storage overhead (reuses git). Complete history. Diff-based recall. Aligns with paradigm.",
            "**Cons:** Slow writes (commit overhead). Imprecise recall. Depends on commit discipline.",
            "**Best for:** Code-focused agents, audit trails, development contexts.",
            "**Breakdown at:** ~10K commits — git log search becomes slow without indexing.",
        ]),
    ]

    for name, points in chars:
        lines.append(f"### {name}")
        for p in points:
            lines.append(f"- {p}")
        lines.append("")

    # Recommendation
    lines.append("## Recommendation for Cocapn Seed")
    lines.append("")
    lines.append("### Phase 1: Seed (current) — Strategy A (Flat JSON)")
    lines.append("- Simple, zero dependencies, works out of the box")
    lines.append("- Performance is fine for personal use (<1000 conversations)")
    lines.append("- Memory.ts already implements this correctly")
    lines.append("")
    lines.append("### Phase 2: Growth (50-500 users) — Strategy A + D (Flat JSON + Git-Native)")
    lines.append("- Keep Flat JSON for hot facts (preferences, recent context)")
    lines.append("- Use git history for long-term recall (what was discussed, when, why)")
    lines.append("- Two-tier memory: hot (JSON) + cold (git)")
    lines.append("")
    lines.append("### Phase 3: Scale (500+ users, multi-tenant) — Strategy C (Semantic Chunks)")
    lines.append("- Only add embedding complexity when recall quality becomes a bottleneck")
    lines.append("- Use SQLite + vector extension for local deployment")
    lines.append("- Use D1 + Workers AI embeddings for cloud deployment")
    lines.append("")
    lines.append("### The Git-Native Advantage")
    lines.append("Strategy D aligns perfectly with cocapn's 'the repo IS the agent' paradigm.")
    lines.append("Git commits are already the agent's memory — commit messages ARE memory entries.")
    lines.append("The seed should git-commit memory changes, making Strategy A write-through to D.")
    lines.append("This gives you Flat JSON performance + Git durability without choosing one or the other.")
    lines.append("")

    return "\n".join(lines)


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    print("Cocapn Memory Strategy Simulation")
    print("=" * 50)
    print(f"Simulating {CONVERSATIONS} conversations over {DAYS} days")
    print()

    strategies = [
        FlatJSONSimulator(),
        DailyFilesSimulator(),
        SemanticChunkSimulator(),
        GitNativeSimulator(),
    ]

    results = []
    for sim in strategies:
        print(f"  Running {sim.name}...", end=" ", flush=True)
        start = time.time()
        result = run_simulation(sim)
        elapsed = time.time() - start
        print(f"done ({elapsed:.2f}s)")
        results.append(result)

    # Generate report
    report = format_results(results)

    # Save
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_path = os.path.join(OUTPUT_DIR, "memory-strategies.md")
    with open(output_path, "w") as f:
        f.write(report)

    print(f"\nResults saved to {output_path}")
    print()
    print(report)


if __name__ == "__main__":
    main()
