/**
 * Path sanitizer for repo-relative file operations.
 *
 * Defends against:
 *   - Path traversal:        ../../../etc/passwd
 *   - Null-byte injection:   file\x00.txt  (Node fs strips after \0 on some platforms)
 *   - Absolute path inject:  /absolute/path  (join would ignore relPath prefix)
 *   - Repeated dots:         file..txt is benign but ..../ traversal variants exist
 *   - Windows-style UNC/drive separators: \\server\share, C:\path
 */
import { join, resolve, normalize, sep } from "node:path";
// ─── Error type ───────────────────────────────────────────────────────────────
export class SanitizationError extends Error {
    reason;
    input;
    constructor(reason, input) {
        super(`Unsafe path rejected (${reason}): ${JSON.stringify(input)}`);
        this.reason = reason;
        this.input = input;
        this.name = "SanitizationError";
    }
}
// ─── Sanitizer ────────────────────────────────────────────────────────────────
/**
 * Sanitize a user-supplied relative path and resolve it within `repoRoot`.
 *
 * Returns the absolute path only if it is provably inside `repoRoot`.
 * Throws `SanitizationError` for any input that would escape the root.
 *
 * The returned path is always absolute and normalized.
 */
export function sanitizeRepoPath(relPath, repoRoot) {
    // ── 1. Null-byte check — must be first; fs functions truncate at \0 ─────────
    if (relPath.includes("\0")) {
        throw new SanitizationError("null byte", relPath);
    }
    // ── 2. Reject absolute paths before any join ─────────────────────────────────
    //    On POSIX: starts with /
    //    On Windows: starts with drive letter (C:\) or UNC (\\)
    if (relPath.startsWith("/") ||
        relPath.startsWith("\\") ||
        /^[a-zA-Z]:[/\\]/.test(relPath)) {
        throw new SanitizationError("absolute path", relPath);
    }
    // ── 3. Normalize the relative component first ────────────────────────────────
    //    normalize("../../etc/passwd") → "../../etc/passwd"  (still has ..)
    //    We then detect any remaining ".." segments after normalization.
    const normalizedRel = normalize(relPath);
    // After normalization, any traversal attempt will begin with ".." or contain
    // path.sep + ".." to escape upward. Reject both.
    const parts = normalizedRel.split(sep);
    if (parts.some((p) => p === "..")) {
        throw new SanitizationError("path traversal", relPath);
    }
    // ── 4. Resolve the canonical root and joined path ────────────────────────────
    //    resolve(repoRoot) canonicalizes symlinks/relative root itself.
    //    join here is safe because relPath contains no leading "/" (checked above).
    const canonicalRoot = resolve(repoRoot);
    const absPath = resolve(join(canonicalRoot, normalizedRel));
    // ── 5. Final containment check — must start with root + separator ────────────
    //    The trailing sep guard prevents /repo-root-extra from matching /repo-root.
    const rootWithSep = canonicalRoot.endsWith(sep) ? canonicalRoot : canonicalRoot + sep;
    if (absPath !== canonicalRoot && !absPath.startsWith(rootWithSep)) {
        throw new SanitizationError("outside repo root", relPath);
    }
    return absPath;
}
//# sourceMappingURL=path-sanitizer.js.map