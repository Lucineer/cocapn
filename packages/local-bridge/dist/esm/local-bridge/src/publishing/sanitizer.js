/**
 * Sanitizer — strips private/sensitive content before publishing to public repo.
 *
 * Three operations:
 *   - sanitizeWikiPage(content)  — redact lines/blocks with secrets, internal paths, etc.
 *   - sanitizeTask(task)         — produce a PublicTask with code-heavy descriptions replaced
 *   - generateDigest(tasks, pages) — build a human-readable Digest from sanitized material
 */
// ─── Regex constants ──────────────────────────────────────────────────────────
/** Lines containing sensitive keywords are replaced entirely. */
const SENSITIVE_LINE_RE = /\b(?:password|secret|token|api[_-]?key|private[\s_-]+key|auth[\s_-]*key|access[\s_-]*key|bearer|credential)\b/i;
/** Fenced code blocks (backtick and tilde). */
const BACKTICK_FENCE_RE = /```[^\n]*\n[\s\S]*?```/g;
const TILDE_FENCE_RE = /~~~[^\n]*\n[\s\S]*?~~~/g;
/** Internal / non-routable URL hostnames. */
const INTERNAL_URL_RE = /\bhttps?:\/\/(?:localhost|127(?:\.\d+){3}|0\.0\.0\.0|192\.168(?:\.\d+){2}|10(?:\.\d+){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d+){2}|[a-z0-9-]+\.(?:local|internal|lan))\b(?:[^\s,;'")\`\]]*)?/gi;
/** UNIX home paths like /Users/alice/foo or /home/bob/bar. */
const UNIX_PATH_RE = /\/(?:Users|home)\/[^/\s]+(?:\/[^\s,;'")\`\]]*)?/g;
/** Windows user paths like C:\Users\alice\... */
const WINDOWS_PATH_RE = /[A-Z]:\\Users\\[^\\\s]+(?:\\[^\s,;'")\`\]]*)?/gi;
/** Env-var assignment patterns like FOO=bar or export FOO=bar. */
const ENV_VAR_RE = /(?:^|\n)(?:export\s+)?[A-Z][A-Z0-9_]{2,}=[^\n]*/g;
/** Heuristic: description looks like code if it has many special chars or a fence. */
function looksLikeCode(text) {
    if (/```|~~~/.test(text))
        return true;
    // More than 20 % of non-space chars are "code-y" punctuation
    const stripped = text.replace(/\s/g, "");
    if (stripped.length === 0)
        return false;
    const codeChars = (stripped.match(/[{}()[\];=<>|&!$#@^~]/g) ?? []).length;
    return codeChars / stripped.length > 0.2;
}
// ─── Sanitizer ────────────────────────────────────────────────────────────────
export class Sanitizer {
    /**
     * Redact a full wiki-page markdown string.
     *
     * Order of operations:
     *   1. Strip fenced code blocks (replaced with `[code block removed]`)
     *   2. Replace internal URLs
     *   3. Replace UNIX/Windows home paths
     *   4. Replace env-var assignments
     *   5. Drop any line that still contains a sensitive keyword
     */
    sanitizeWikiPage(content) {
        let out = content;
        // 1. Fenced code blocks
        out = out
            .replace(BACKTICK_FENCE_RE, "[code block removed]")
            .replace(TILDE_FENCE_RE, "[code block removed]");
        // 2. Internal URLs
        out = out.replace(INTERNAL_URL_RE, "[internal URL removed]");
        // 3. UNIX / Windows home paths
        out = out
            .replace(UNIX_PATH_RE, "[path removed]")
            .replace(WINDOWS_PATH_RE, "[path removed]");
        // 4. Env-var assignments (inline or at line start)
        out = out.replace(ENV_VAR_RE, (m) => {
            // preserve the leading newline if present
            const prefix = m.startsWith("\n") ? "\n" : "";
            return `${prefix}[env var removed]`;
        });
        // 5. Line-level sensitive keyword filter
        out = out
            .split("\n")
            .map((line) => SENSITIVE_LINE_RE.test(line) ? "[redacted]" : line)
            .join("\n");
        return out;
    }
    /**
     * Produce a PublicTask from a private Task.
     *
     * - id, title, status, createdAt are passed through unchanged
     * - description is sanitized; if it looks like code it is fully replaced
     */
    sanitizeTask(task) {
        let description = task.description;
        if (looksLikeCode(description)) {
            description = "[implementation details removed]";
        }
        else {
            // Apply the same pipeline as wiki pages (minus multi-line fences —
            // task descriptions are usually single-line or short paragraphs)
            description = description
                .replace(BACKTICK_FENCE_RE, "[code block removed]")
                .replace(TILDE_FENCE_RE, "[code block removed]")
                .replace(INTERNAL_URL_RE, "[internal URL removed]")
                .replace(UNIX_PATH_RE, "[path removed]")
                .replace(WINDOWS_PATH_RE, "[path removed]")
                .replace(ENV_VAR_RE, (m) => {
                const prefix = m.startsWith("\n") ? "\n" : "";
                return `${prefix}[env var removed]`;
            });
            if (SENSITIVE_LINE_RE.test(description)) {
                description = "[redacted]";
            }
        }
        return {
            id: task.id,
            title: task.title,
            status: task.status,
            createdAt: task.createdAt,
            description,
        };
    }
    /**
     * Generate a high-level Digest from sanitized tasks and wiki pages.
     *
     * - summary: how many tasks done vs active
     * - accomplishments: titles of done tasks (sanitized)
     * - learnings: unique heading-level lines from wiki pages (sanitized, max 5)
     * - streakDay: true when at least one task was completed
     */
    generateDigest(tasks, wikiPages) {
        const publicTasks = tasks.map((t) => this.sanitizeTask(t));
        const done = publicTasks.filter((t) => t.status === "done");
        const active = publicTasks.filter((t) => t.status === "active");
        const summary = done.length === 0 && active.length === 0
            ? "No tasks recorded."
            : `${done.length} task${done.length !== 1 ? "s" : ""} completed, ` +
                `${active.length} in progress.`;
        const accomplishments = done.map((t) => t.title);
        // Extract unique first-level headings from sanitized wiki pages
        const learnings = [];
        for (const raw of wikiPages) {
            const sanitized = this.sanitizeWikiPage(raw);
            for (const line of sanitized.split("\n")) {
                const m = /^#{1,2}\s+(.+)/.exec(line.trim());
                if (m && m[1] && !learnings.includes(m[1])) {
                    learnings.push(m[1]);
                    if (learnings.length >= 5)
                        break;
                }
            }
            if (learnings.length >= 5)
                break;
        }
        return {
            summary,
            accomplishments,
            learnings,
            streakDay: done.length > 0,
        };
    }
}
//# sourceMappingURL=sanitizer.js.map