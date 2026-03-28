/**
 * Publisher — writes sanitized daily updates to the public repo whenever
 * relevant private-repo files change.
 *
 * Subscribes to GitSync's `post-commit` event. On each commit it checks
 * whether any wiki pages or task files were modified and, if so:
 *   1. Reads the changed wiki pages + all tasks from the private repo
 *   2. Calls Sanitizer.generateDigest() to produce a public Digest
 *   3. Renders the update.md template
 *   4. Writes updates/YYYY-MM-DD.md to the public repo
 *   5. Commits with "📰 Update from <username> - <summary>"
 *
 * Race-condition guard: publisher commits carry the "📰 Update from" prefix.
 * On the `post-commit` event the publisher ignores those messages to avoid
 * infinite loops (private commit → publish → public commit; the public commit
 * is in a different repo so there is no loop, but Brain's auto-commit could
 * fire on memory changes that the publisher itself triggered).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { simpleGit } from "simple-git";
import { Sanitizer } from "./sanitizer.js";
import type { GitSync } from "../git/sync.js";
import type { Task } from "../brain/index.js";
import type { Digest } from "./sanitizer.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/** One entry in updates/index.json — consumed directly by the UI. */
export interface UpdateIndexEntry {
  date:            string;
  streak:          number;
  tags:            string[];
  summary:         string;
  accomplishments: string[];
}

/** Root structure of updates/index.json */
export interface UpdatesIndex {
  /** Sorted newest-first */
  entries:   UpdateIndexEntry[];
  /** ISO timestamp of last rebuild */
  updatedAt: string;
}

export interface PublisherOptions {
  /** Root of the private encrypted repo (source of truth) */
  privateRepoRoot: string;
  /** Root of the public repo where sanitized updates are written */
  publicRepoRoot: string;
  /**
   * Display name used in the commit message.
   * Defaults to "user".
   */
  username?: string;
  /**
   * Absolute path to the update.md Mustache template.
   * Defaults to the bundled template next to this file.
   */
  templatePath?: string;
}

// ─── Commit message sentinel ─────────────────────────────────────────────────

/** Prefix that marks publisher-generated commits — used to skip re-triggering. */
const PUBLISHER_COMMIT_PREFIX = "📰 Update from";

// ─── Publisher ────────────────────────────────────────────────────────────────

export class Publisher {
  private privateRepoRoot: string;
  private publicRepoRoot: string;
  private username: string;
  private templatePath: string;
  private sanitizer: Sanitizer;
  /** Prevents overlapping publish runs if commits arrive rapidly. */
  private busy = false;

  constructor(options: PublisherOptions, sync: GitSync) {
    this.privateRepoRoot = options.privateRepoRoot;
    this.publicRepoRoot  = options.publicRepoRoot;
    this.username        = options.username ?? "user";
    this.templatePath    = options.templatePath ?? this.defaultTemplatePath();
    this.sanitizer       = new Sanitizer();

    sync.on("post-commit", (message, files) => {
      void this.onPostCommit(message, files);
    });
  }

  // ---------------------------------------------------------------------------
  // Event handler
  // ---------------------------------------------------------------------------

  private async onPostCommit(message: string, files: string[]): Promise<void> {
    // Skip our own commits to avoid re-triggering.
    if (message.startsWith(PUBLISHER_COMMIT_PREFIX)) return;
    // Skip concurrent runs.
    if (this.busy) return;

    // Only act when wiki pages or task files are involved.
    const wikiFiles = files.filter(
      (f) => f.startsWith("cocapn/wiki/") && f.endsWith(".md")
    );
    const taskFiles = files.filter(
      (f) => f.startsWith("cocapn/tasks/") && f.endsWith(".md")
    );

    if (wikiFiles.length === 0 && taskFiles.length === 0) return;

    this.busy = true;
    try {
      await this.publish([...wikiFiles, ...taskFiles]);
    } catch (err) {
      console.error("[publisher] Error during publish:", err);
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Core publish flow (also callable directly for manual / test triggers)
  // ---------------------------------------------------------------------------

  /**
   * Build and write a daily update entry to the public repo.
   *
   * @param changedFiles - Repo-relative paths of wiki/task files that changed
   *   in the triggering commit. Wiki pages are read and passed to generateDigest.
   *   If empty, digest is built from tasks only.
   */
  async publish(changedFiles: string[] = []): Promise<void> {
    // Separate wiki pages from task files
    const changedWikiFiles = changedFiles.filter(
      (f) => f.startsWith("cocapn/wiki/") && f.endsWith(".md")
    );

    // Read changed wiki page contents
    const wikiPages = changedWikiFiles
      .map((f) => {
        try {
          return readFileSync(join(this.privateRepoRoot, f), "utf8");
        } catch {
          return "";
        }
      })
      .filter(Boolean);

    // Read all tasks from private repo
    const tasks = this.readTasks();

    // Build sanitized digest
    const digest = this.sanitizer.generateDigest(tasks, wikiPages);

    // Render template
    const date         = todayIso();
    const streakCount  = this.countStreak();
    const tags         = extractTags(digest);
    const content      = this.renderTemplate(date, streakCount, tags, digest);

    // Write update file
    const updatesDir  = join(this.publicRepoRoot, "updates");
    mkdirSync(updatesDir, { recursive: true });
    const updatePath  = join(updatesDir, `${date}.md`);
    writeFileSync(updatePath, content, "utf8");

    // Maintain updates/index.json for the UI
    this.upsertIndex({ date, streak: streakCount, tags, summary: digest.summary, accomplishments: digest.accomplishments });

    // Commit to public repo
    const commitMsg = `${PUBLISHER_COMMIT_PREFIX} ${this.username} - ${digest.summary}`;
    try {
      const git = simpleGit(this.publicRepoRoot);
      await git.add(join("updates", `${date}.md`));
      await git.add(join("updates", "index.json"));
      await git.commit(commitMsg);
    } catch {
      // Non-fatal: file is written; commit may fail if nothing changed (same-day duplicate).
    }
  }

  // ---------------------------------------------------------------------------
  // Template rendering
  // ---------------------------------------------------------------------------

  /**
   * Render the update.md template using simple `{{placeholder}}` substitution.
   * Supports `{{#accomplishments}}...{{.}}...{{/accomplishments}}` loops.
   */
  private renderTemplate(
    date: string,
    streakCount: number,
    tags: string[],
    digest: Digest
  ): string {
    let tmpl: string;
    try {
      tmpl = readFileSync(this.templatePath, "utf8");
    } catch {
      tmpl = fallbackTemplate();
    }

    // Render accomplishments loop
    tmpl = tmpl.replace(
      /\{\{#accomplishments\}\}([\s\S]*?)\{\{\/accomplishments\}\}/g,
      (_match, inner: string) =>
        digest.accomplishments.length === 0
          ? ""
          : digest.accomplishments
              .map((a) => inner.replace(/\{\{\.\}\}/g, a).trimEnd())
              .join("\n") + "\n"
    );

    // Scalar substitutions
    return tmpl
      .replace(/\{\{date\}\}/g,         date)
      .replace(/\{\{streakCount\}\}/g,  String(streakCount))
      .replace(/\{\{tags\}\}/g,         tags.join(", "))
      .replace(/\{\{summary\}\}/g,      digest.summary);
  }

  // ---------------------------------------------------------------------------
  // Streak calculation
  // ---------------------------------------------------------------------------

  /**
   * Count how many consecutive days (ending today) the public repo has an
   * update file.  Returns 0 when the streak is broken.
   */
  private countStreak(): number {
    const updatesDir = join(this.publicRepoRoot, "updates");
    if (!existsSync(updatesDir)) return 0;

    let existing: Set<string>;
    try {
      existing = new Set(
        readdirSync(updatesDir)
          .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
          .map((f) => f.replace(/\.md$/, ""))
      );
    } catch {
      return 0;
    }

    // Today's file hasn't been written yet, so count starts at 1 (for today)
    // then walk backwards through prior days.
    let count = 1;
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1); // start from yesterday
    for (let i = 0; i < 365; i++) {
      const key = d.toISOString().slice(0, 10);
      if (!existing.has(key)) break;
      count++;
      d.setUTCDate(d.getUTCDate() - 1);
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Task reading (local — no Brain dep to keep module self-contained)
  // ---------------------------------------------------------------------------

  private readTasks(): Task[] {
    const tasksDir = join(this.privateRepoRoot, "cocapn", "tasks");
    if (!existsSync(tasksDir)) return [];

    const tasks: Task[] = [];
    try {
      for (const file of readdirSync(tasksDir)) {
        if (!file.endsWith(".md")) continue;
        try {
          const content = readFileSync(join(tasksDir, file), "utf8");
          const task = parseTaskFile(file, content);
          if (task) tasks.push(task);
        } catch {
          // skip unreadable
        }
      }
    } catch {
      return [];
    }

    return tasks.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  // ---------------------------------------------------------------------------
  // Index maintenance
  // ---------------------------------------------------------------------------

  /**
   * Upsert entry into `updates/index.json` (creates the file if missing).
   * Entries are kept sorted newest-first; same-date entries are replaced.
   */
  private upsertIndex(entry: UpdateIndexEntry): void {
    const indexPath = join(this.publicRepoRoot, "updates", "index.json");
    let index: UpdatesIndex = { entries: [], updatedAt: new Date().toISOString() };

    if (existsSync(indexPath)) {
      try {
        const raw = readFileSync(indexPath, "utf8");
        index = JSON.parse(raw) as UpdatesIndex;
      } catch {
        // Corrupted or missing — start fresh
      }
    }

    // Replace any existing entry for the same date, then prepend the new one
    index.entries = [
      entry,
      ...index.entries.filter((e) => e.date !== entry.date),
    ].sort((a, b) => b.date.localeCompare(a.date));

    index.updatedAt = new Date().toISOString();

    writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n", "utf8");
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private defaultTemplatePath(): string {
    // When imported from the local-bridge package, look for the template in the
    // co-located module package.  Falls back to inline template if missing.
    return join(
      // __dirname equivalent for ESM — resolved at build time; fallback safe
      new URL("../../publishing/templates/update.md", import.meta.url).pathname
    );
  }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function extractTags(digest: Digest): string[] {
  const words = [digest.summary, ...digest.accomplishments]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4);
  // Deduplicate, keep first 5
  return [...new Set(words)].slice(0, 5);
}

function parseTaskFile(filename: string, content: string): Task | null {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (!titleMatch) return null;

  const title       = titleMatch[1]!.trim();
  const createdMatch = content.match(/^created:\s*(.+)$/m);
  const statusMatch  = content.match(/^status:\s*(active|done)$/m);

  const id          = filename.replace(/\.md$/, "");
  const createdAt   = createdMatch?.[1]?.trim() ?? new Date(0).toISOString();
  const status: Task["status"] = statusMatch?.[1] === "done" ? "done" : "active";

  const lines        = content.split("\n");
  const titleLineIdx = lines.findIndex((l) => /^#\s/.test(l));
  const sepIdx       = lines.findIndex((l, i) => i > titleLineIdx && l.startsWith("---"));
  const descLines    = lines.slice(titleLineIdx + 1, sepIdx === -1 ? undefined : sepIdx);
  const description  = descLines.join("\n").trim();

  return { id, title, description, createdAt, status };
}

function fallbackTemplate(): string {
  return [
    "---",
    "date: {{date}}",
    "streak: {{streakCount}}",
    "tags: {{tags}}",
    "---",
    "",
    "## Today",
    "{{summary}}",
    "",
    "### Shipped",
    "{{#accomplishments}}",
    "- {{.}}",
    "{{/accomplishments}}",
    "",
  ].join("\n");
}
