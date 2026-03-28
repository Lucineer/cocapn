/**
 * MagazineLayout — masonry grid of daily update cards.
 *
 * Data flows in from the parent (App or the updates panel hook).
 * Each card shows: date, streak badge, summary, tag chips, accomplishments.
 * A "Live" indicator appears in the toolbar when the bridge is connected.
 *
 * Layout: CSS multi-column (no external masonry lib needed).
 *   - mobile:  1 column
 *   - sm:      2 columns
 *   - lg:      3 columns
 */

import { useBridgeContext } from "@/contexts/BridgeContext.js";
import { StreakBadge } from "@/components/StreakBadge.js";
import type { UpdateEntry } from "@/types/updates.js";

// ─── Live indicator ───────────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="flex items-center gap-1.5 text-xs text-success">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
      </span>
      Live
    </span>
  );
}

// ─── Tag chip ─────────────────────────────────────────────────────────────────

function TagChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-2 text-text-muted border border-border">
      {tag}
    </span>
  );
}

// ─── Update card ─────────────────────────────────────────────────────────────

interface UpdateCardProps {
  entry: UpdateEntry;
}

function UpdateCard({ entry }: UpdateCardProps) {
  const { date, streak, tags, summary, accomplishments } = entry;

  // Format date as "Mar 28, 2026"
  const displayDate = (() => {
    try {
      return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day:   "numeric",
        year:  "numeric",
      });
    } catch {
      return date;
    }
  })();

  return (
    <article className="bg-surface border border-border rounded-skin p-4 flex flex-col gap-3">
      {/* Date + streak */}
      <div className="flex items-center justify-between gap-2">
        <time
          dateTime={date}
          className="text-xs font-mono text-text-muted"
        >
          {displayDate}
        </time>
        {streak > 0 && <StreakBadge streak={streak} />}
      </div>

      {/* Summary */}
      <p className="text-sm text-text leading-relaxed">{summary}</p>

      {/* Accomplishments */}
      {accomplishments.length > 0 && (
        <ul className="flex flex-col gap-1">
          {accomplishments.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-xs text-text-muted"
            >
              <span className="text-primary mt-0.5 shrink-0">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
          {tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      )}
    </article>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ error }: { error: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-text-muted">
      <div className="text-4xl opacity-20">📰</div>
      {error ? (
        <>
          <p className="text-sm font-semibold text-text">No updates found</p>
          <p className="text-xs text-center max-w-xs">
            The public repo doesn't have an <code className="font-mono text-primary">updates/index.json</code> yet.
            Enable the <strong>auto-publisher</strong> module to start generating daily updates.
          </p>
        </>
      ) : (
        <p className="text-sm">No updates yet — keep shipping!</p>
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={[
            "break-inside-avoid mb-4",
            "bg-surface border border-border rounded-skin p-4",
            "animate-pulse",
          ].join(" ")}
          style={{ height: 100 + (i % 3) * 40 }}
        />
      ))}
    </div>
  );
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

interface ToolbarProps {
  count: number;
  loading: boolean;
  onRefresh: () => void;
}

function Toolbar({ count, loading, onRefresh }: ToolbarProps) {
  const bridge = useBridgeContext();

  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-surface shrink-0">
      <span className="text-sm font-semibold text-text">Updates</span>
      {count > 0 && (
        <span className="text-xs text-text-muted">{count} entr{count === 1 ? "y" : "ies"}</span>
      )}
      <div className="flex-1" />
      {bridge.status === "connected" && <LiveDot />}
      <button
        onClick={onRefresh}
        disabled={loading}
        className={[
          "text-xs px-3 py-1 rounded-skin border border-border",
          "text-text-muted hover:text-text hover:border-border/80 transition-colors",
          "disabled:opacity-40",
        ].join(" ")}
        aria-label="Refresh updates"
      >
        {loading ? "Loading…" : "Refresh"}
      </button>
    </div>
  );
}

// ─── MagazineLayout ───────────────────────────────────────────────────────────

export interface MagazineLayoutProps {
  entries: UpdateEntry[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  className?: string;
}

export function MagazineLayout({
  entries,
  loading = false,
  error = null,
  onRefresh,
  className = "",
}: MagazineLayoutProps) {
  return (
    <div className={`flex flex-col h-full overflow-hidden bg-bg ${className}`}>
      <Toolbar
        count={entries.length}
        loading={loading}
        onRefresh={onRefresh ?? (() => undefined)}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {loading && entries.length === 0 ? (
            <Skeleton />
          ) : entries.length === 0 ? (
            <EmptyState error={error} />
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
              {entries.map((entry) => (
                <div key={entry.date} className="break-inside-avoid mb-4">
                  <UpdateCard entry={entry} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
