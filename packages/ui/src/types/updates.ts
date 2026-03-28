// ─── Updates feed types ───────────────────────────────────────────────────────
// These mirror the index.json produced by the auto-publisher module.

export interface UpdateEntry {
  /** ISO date string: "2026-03-28" */
  date: string;
  /** Consecutive-day streak count (1 = today only) */
  streak: number;
  /** Short keyword tags extracted from accomplishment titles */
  tags: string[];
  /** Human-readable summary e.g. "2 tasks completed, 1 in progress." */
  summary: string;
  /** Titles of completed tasks (already sanitized) */
  accomplishments: string[];
}

export interface UpdatesIndex {
  /** Sorted newest-first */
  entries: UpdateEntry[];
  /** ISO timestamp of last index rebuild */
  updatedAt: string;
}
