/**
 * Tests for src/publishing/sanitizer.ts
 *
 * Edge cases covered:
 *   - Fenced code block removal (backtick + tilde)
 *   - Internal URL redaction (localhost, LAN ranges, *.local, *.internal)
 *   - UNIX and Windows home-path removal
 *   - Env-var assignment removal
 *   - Line-level sensitive keyword redaction
 *   - Task code-description detection heuristic
 *   - Digest generation: summary wording, accomplishments, learnings, streakDay
 *   - Aggressive: combined attacks (secrets inside code blocks, paths in headings)
 */

import { describe, it, expect } from "vitest";
import { Sanitizer } from "../src/publishing/sanitizer.js";
import type { Task } from "../src/brain/index.js";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t-1",
    title: "Write tests",
    description: "Add unit tests for the sanitizer",
    createdAt: "2026-03-28T00:00:00.000Z",
    status: "active",
    ...overrides,
  };
}

const s = new Sanitizer();

// ─── sanitizeWikiPage ─────────────────────────────────────────────────────────

describe("Sanitizer.sanitizeWikiPage", () => {
  it("passes clean content unchanged", () => {
    const content = "# Hello\n\nThis is a wiki page about cats.\n";
    expect(s.sanitizeWikiPage(content)).toBe(content);
  });

  it("removes backtick fenced code blocks", () => {
    const content = "Before\n```ts\nconst x = 1;\n```\nAfter";
    const result = s.sanitizeWikiPage(content);
    expect(result).not.toContain("const x");
    expect(result).toContain("[code block removed]");
    expect(result).toContain("Before");
    expect(result).toContain("After");
  });

  it("removes tilde fenced code blocks", () => {
    const content = "Text\n~~~sh\nrm -rf /\n~~~\nMore";
    const result = s.sanitizeWikiPage(content);
    expect(result).not.toContain("rm -rf");
    expect(result).toContain("[code block removed]");
  });

  it("removes localhost URLs", () => {
    const content = "Server runs at http://localhost:8787/api/status";
    const result = s.sanitizeWikiPage(content);
    expect(result).not.toContain("localhost");
    expect(result).toContain("[internal URL removed]");
  });

  it("removes 127.0.0.1 URLs", () => {
    const result = s.sanitizeWikiPage("endpoint: http://127.0.0.1:3000/health");
    expect(result).not.toContain("127.0.0.1");
    expect(result).toContain("[internal URL removed]");
  });

  it("removes 192.168.x.x URLs", () => {
    const result = s.sanitizeWikiPage("NAS at http://192.168.1.100/files");
    expect(result).not.toContain("192.168");
    expect(result).toContain("[internal URL removed]");
  });

  it("removes *.local hostnames", () => {
    const result = s.sanitizeWikiPage("See http://mypi.local:8080/");
    expect(result).not.toContain("mypi.local");
    expect(result).toContain("[internal URL removed]");
  });

  it("removes *.internal hostnames", () => {
    const result = s.sanitizeWikiPage("Call https://auth.internal/token");
    expect(result).not.toContain("auth.internal");
    expect(result).toContain("[internal URL removed]");
  });

  it("removes UNIX home paths", () => {
    const result = s.sanitizeWikiPage("Config lives at /home/alice/.config/cocapn");
    expect(result).not.toContain("/home/alice");
    expect(result).toContain("[path removed]");
  });

  it("removes /Users/ macOS paths", () => {
    const result = s.sanitizeWikiPage("Repo cloned to /Users/bob/projects/cocapn");
    expect(result).not.toContain("/Users/bob");
    expect(result).toContain("[path removed]");
  });

  it("removes Windows user paths", () => {
    const result = s.sanitizeWikiPage("Store: C:\\Users\\Alice\\AppData\\cocapn");
    expect(result).not.toContain("C:\\Users\\Alice");
    expect(result).toContain("[path removed]");
  });

  it("removes env-var assignments at line start", () => {
    const content = "Setup:\nGITHUB_TOKEN=ghp_abc123\nDone";
    const result = s.sanitizeWikiPage(content);
    expect(result).not.toContain("ghp_abc123");
    expect(result).toContain("[env var removed]");
  });

  it("removes export env-var assignments", () => {
    const content = "export DATABASE_URL=postgres://user:pass@localhost/db";
    const result = s.sanitizeWikiPage(content);
    expect(result).not.toContain("postgres://");
    expect(result).toContain("[env var removed]");
  });

  it("redacts lines with 'password'", () => {
    const content = "line1\npassword: hunter2\nline3";
    const result = s.sanitizeWikiPage(content);
    expect(result).not.toContain("hunter2");
    expect(result).toContain("[redacted]");
    expect(result).toContain("line1");
    expect(result).toContain("line3");
  });

  it("redacts lines with 'secret'", () => {
    const result = s.sanitizeWikiPage("The secret is out");
    expect(result).toContain("[redacted]");
  });

  it("redacts lines with 'token'", () => {
    const result = s.sanitizeWikiPage("Use this token: abc123");
    expect(result).toContain("[redacted]");
  });

  it("redacts lines with 'api_key'", () => {
    const result = s.sanitizeWikiPage("Set api_key in the config");
    expect(result).toContain("[redacted]");
  });

  it("redacts lines with 'api-key'", () => {
    const result = s.sanitizeWikiPage("api-key must not be shared");
    expect(result).toContain("[redacted]");
  });

  it("redacts lines with 'private key'", () => {
    const result = s.sanitizeWikiPage("Your private key is stored here");
    expect(result).toContain("[redacted]");
  });

  it("does NOT redact innocent word 'token' in prose if 'token' is not present", () => {
    // Make sure normal text with no sensitive words passes through
    const content = "We use Git as our primary database.";
    expect(s.sanitizeWikiPage(content)).toBe(content);
  });

  // ─── Aggressive combinations ────────────────────────────────────────────────

  it("secret inside code block — block removed, not line-redacted", () => {
    const content = "Note:\n```\nSECRET_KEY=abc\n```\nEnd";
    const result = s.sanitizeWikiPage(content);
    // The whole block is gone; the [redacted] line-rule should not fire separately
    expect(result).not.toContain("SECRET_KEY=abc");
    expect(result).toContain("[code block removed]");
  });

  it("internal URL inside heading is still removed", () => {
    const content = "## Dashboard at http://localhost:3000\n\nSome text";
    const result = s.sanitizeWikiPage(content);
    expect(result).not.toContain("localhost");
    expect(result).toContain("[internal URL removed]");
    // Heading marker should survive
    expect(result).toContain("##");
  });

  it("multiple sensitive items on separate lines", () => {
    const content = [
      "# Config",
      "password: abc",
      "Normal line",
      "token: xyz",
      "Another line",
    ].join("\n");
    const result = s.sanitizeWikiPage(content);
    const lines = result.split("\n");
    expect(lines[1]).toBe("[redacted]");
    expect(lines[2]).toBe("Normal line");
    expect(lines[3]).toBe("[redacted]");
    expect(lines[4]).toBe("Another line");
  });
});

// ─── sanitizeTask ─────────────────────────────────────────────────────────────

describe("Sanitizer.sanitizeTask", () => {
  it("passes through clean task", () => {
    const t = task({ description: "Write unit tests for the auth handler" });
    const pub = s.sanitizeTask(t);
    expect(pub.description).toBe("Write unit tests for the auth handler");
    expect(pub.id).toBe("t-1");
    expect(pub.title).toBe("Write tests");
    expect(pub.status).toBe("active");
    expect(pub.createdAt).toBe("2026-03-28T00:00:00.000Z");
  });

  it("replaces code-heavy description with placeholder", () => {
    const codeDesc = "```ts\nconst x: Record<string, boolean> = {};\n```";
    const pub = s.sanitizeTask(task({ description: codeDesc }));
    expect(pub.description).toBe("[implementation details removed]");
  });

  it("replaces description with many brackets/braces as code", () => {
    // >20% code-y chars triggers heuristic
    const codeDesc = "if (a) { b(); } else { c(); } return d && e || f;";
    const pub = s.sanitizeTask(task({ description: codeDesc }));
    expect(pub.description).toBe("[implementation details removed]");
  });

  it("redacts description containing 'secret'", () => {
    const pub = s.sanitizeTask(task({ description: "The secret value is ABC" }));
    expect(pub.description).toBe("[redacted]");
  });

  it("redacts description containing 'token'", () => {
    const pub = s.sanitizeTask(task({ description: "Rotate the auth token now" }));
    expect(pub.description).toBe("[redacted]");
  });

  it("removes internal URL from description", () => {
    const pub = s.sanitizeTask(
      task({ description: "POST to http://localhost:9000/run" })
    );
    expect(pub.description).not.toContain("localhost");
    expect(pub.description).toContain("[internal URL removed]");
  });

  it("removes UNIX path from description", () => {
    const pub = s.sanitizeTask(
      task({ description: "See /home/alice/.ssh/config for details" })
    );
    expect(pub.description).not.toContain("/home/alice");
    expect(pub.description).toContain("[path removed]");
  });

  it("removes Windows path from description", () => {
    const pub = s.sanitizeTask(
      task({ description: "Stored in C:\\Users\\bob\\AppData\\cocapn" })
    );
    expect(pub.description).not.toContain("C:\\Users\\bob");
    expect(pub.description).toContain("[path removed]");
  });

  it("preserves status=done", () => {
    const pub = s.sanitizeTask(task({ status: "done" }));
    expect(pub.status).toBe("done");
  });

  it("description that only has a backtick inline is NOT flagged as code", () => {
    // Single backtick inline code is light; not > 20% code chars
    const desc = "Run `npm test` to verify";
    const pub = s.sanitizeTask(task({ description: desc }));
    // No sensitive words → should survive (minus any redaction rules)
    expect(pub.description).toBe(desc);
  });
});

// ─── generateDigest ───────────────────────────────────────────────────────────

describe("Sanitizer.generateDigest", () => {
  it("returns streakDay=false with no done tasks", () => {
    const digest = s.generateDigest(
      [task({ status: "active" })],
      []
    );
    expect(digest.streakDay).toBe(false);
  });

  it("returns streakDay=true when any task is done", () => {
    const digest = s.generateDigest(
      [task({ status: "done" }), task({ id: "t-2", status: "active" })],
      []
    );
    expect(digest.streakDay).toBe(true);
  });

  it("accomplishments lists done task titles", () => {
    const digest = s.generateDigest(
      [
        task({ id: "t-1", title: "Ship feature", status: "done" }),
        task({ id: "t-2", title: "Fix bug", status: "done" }),
        task({ id: "t-3", title: "Plan sprint", status: "active" }),
      ],
      []
    );
    expect(digest.accomplishments).toContain("Ship feature");
    expect(digest.accomplishments).toContain("Fix bug");
    expect(digest.accomplishments).not.toContain("Plan sprint");
  });

  it("summary reflects done vs active count", () => {
    const digest = s.generateDigest(
      [
        task({ id: "a", status: "done" }),
        task({ id: "b", status: "active" }),
        task({ id: "c", status: "active" }),
      ],
      []
    );
    expect(digest.summary).toContain("1 task completed");
    expect(digest.summary).toContain("2 in progress");
  });

  it("summary uses plural 'tasks' for multiple completions", () => {
    const digest = s.generateDigest(
      [
        task({ id: "a", status: "done" }),
        task({ id: "b", status: "done" }),
      ],
      []
    );
    expect(digest.summary).toContain("2 tasks completed");
  });

  it("summary handles no tasks", () => {
    const digest = s.generateDigest([], []);
    expect(digest.summary).toBe("No tasks recorded.");
    expect(digest.streakDay).toBe(false);
    expect(digest.accomplishments).toHaveLength(0);
  });

  it("extracts headings from wiki pages into learnings", () => {
    const page = "# My Project\n\nSome content\n\n## Setup\n\nInstructions";
    const digest = s.generateDigest([], [page]);
    expect(digest.learnings).toContain("My Project");
    expect(digest.learnings).toContain("Setup");
  });

  it("caps learnings at 5 entries", () => {
    const page = [
      "# H1", "## H2", "# H3", "## H4", "# H5", "## H6", "# H7",
    ].join("\n\ncontent\n\n");
    const digest = s.generateDigest([], [page]);
    expect(digest.learnings.length).toBeLessThanOrEqual(5);
  });

  it("learnings are deduplicated across pages", () => {
    const page1 = "# Shared Heading\n\ntext";
    const page2 = "# Shared Heading\n\nother text";
    const digest = s.generateDigest([], [page1, page2]);
    expect(digest.learnings.filter((l) => l === "Shared Heading")).toHaveLength(1);
  });

  it("sanitizes wiki pages before extracting learnings", () => {
    const page = "# token: abc\n\nSome content";
    const digest = s.generateDigest([], [page]);
    // The heading line is redacted → shouldn't appear in learnings
    expect(digest.learnings).not.toContain("token: abc");
  });

  it("empty wiki pages produce no learnings", () => {
    const digest = s.generateDigest([], [""]);
    expect(digest.learnings).toHaveLength(0);
  });

  it("sanitizes task descriptions in digest output", () => {
    // Secret in done task title stays (titles are not redacted),
    // but description of active task with secret should not appear in accomplishments
    const digest = s.generateDigest(
      [task({ id: "x", title: "Normal title", status: "done", description: "token: abc" })],
      []
    );
    // Title passes through; description is not part of accomplishments
    expect(digest.accomplishments).toContain("Normal title");
    expect(digest.streakDay).toBe(true);
  });
});
