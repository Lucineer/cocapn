/**
 * StreakBadge — displays a flame icon + consecutive-day count.
 *
 * Color gradient tied to streak length:
 *   1–3  days → yellow  (warming up)
 *   4–7  days → orange  (heating up)
 *   8–14 days → deep orange (on fire)
 *   15+  days → red     (🔥 legendary)
 */

interface StreakBadgeProps {
  streak: number;
  className?: string;
}

function colorClasses(streak: number): string {
  if (streak >= 15) return "text-red-500 bg-red-500/10 border-red-500/20";
  if (streak >= 8)  return "text-orange-500 bg-orange-500/10 border-orange-500/20";
  if (streak >= 4)  return "text-orange-400 bg-orange-400/10 border-orange-400/20";
  return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
}

function tooltip(streak: number): string {
  if (streak === 1) return "1 day streak! Keep shipping!";
  return `${streak} day streak! Keep shipping!`;
}

/** Inline SVG flame — no icon-library dep needed. */
function FlameIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Path approximates a flame silhouette */}
      <path d="M12 2C8.5 6 7 9 9 12c-2.5-1-3-3-3-3C4 13 5 17 8 19c-1 0-2-.5-2-.5C7.5 21.5 10 23 12 23s4.5-1.5 6-4.5c0 0-1 .5-2 .5 3-2 4-6 2-9 0 0-.5 2-3 3 2-3 .5-6.5-3-11z" />
    </svg>
  );
}

export function StreakBadge({ streak, className = "" }: StreakBadgeProps) {
  if (streak <= 0) return null;

  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
        "text-xs font-semibold border",
        colorClasses(streak),
        className,
      ].join(" ")}
      title={tooltip(streak)}
      aria-label={tooltip(streak)}
    >
      <FlameIcon className="w-3 h-3 shrink-0" />
      {streak}
    </span>
  );
}
