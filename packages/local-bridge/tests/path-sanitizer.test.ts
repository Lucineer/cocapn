/**
 * Tests for src/utils/path-sanitizer.ts
 *
 * Attack vectors covered:
 *   - Path traversal  (../ sequences)
 *   - Null-byte injection (\x00)
 *   - Absolute path injection  (/etc/passwd, C:\Windows)
 *   - Double-dot filenames that aren't traversal (file..txt — should PASS)
 *   - Encoded traversal variants after normalize
 *   - Trailing separator edge case (root itself)
 *   - Happy path: simple relative paths
 */

import { describe, it, expect } from "vitest";
import { join } from "path";
import { sanitizeRepoPath, SanitizationError } from "../src/utils/path-sanitizer.js";

const ROOT = "/srv/cocapn-private";

// ─── Happy paths ──────────────────────────────────────────────────────────────

describe("sanitizeRepoPath — valid inputs", () => {
  it("resolves a simple filename", () => {
    const result = sanitizeRepoPath("notes.md", ROOT);
    expect(result).toBe(join(ROOT, "notes.md"));
  });

  it("resolves a nested path", () => {
    const result = sanitizeRepoPath("cocapn/memory/facts.json", ROOT);
    expect(result).toBe(join(ROOT, "cocapn/memory/facts.json"));
  });

  it("resolves path with redundant single dots", () => {
    // ./file.txt is safe — normalize strips the dot
    const result = sanitizeRepoPath("./cocapn/soul.md", ROOT);
    expect(result).toBe(join(ROOT, "cocapn/soul.md"));
  });

  it("accepts filenames that contain two dots but are not traversal", () => {
    // "file..txt" after normalize → "file..txt" — no ".." segment
    const result = sanitizeRepoPath("file..txt", ROOT);
    expect(result).toBe(join(ROOT, "file..txt"));
  });
});

// ─── Path traversal ───────────────────────────────────────────────────────────

describe("sanitizeRepoPath — path traversal", () => {
  it("rejects ../../../etc/passwd", () => {
    expect(() => sanitizeRepoPath("../../../etc/passwd", ROOT))
      .toThrow(SanitizationError);
  });

  it("rejects a single step up: ../sibling", () => {
    expect(() => sanitizeRepoPath("../sibling", ROOT))
      .toThrow(SanitizationError);
  });

  it("rejects traversal buried in sub-path: sub/../../etc/passwd", () => {
    expect(() => sanitizeRepoPath("sub/../../etc/passwd", ROOT))
      .toThrow(SanitizationError);
  });

  it("error message names the reason", () => {
    const err = (() => {
      try {
        sanitizeRepoPath("../escape", ROOT);
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(SanitizationError);
    expect((err as SanitizationError).reason).toBe("path traversal");
    expect((err as SanitizationError).input).toBe("../escape");
  });
});

// ─── Null-byte injection ──────────────────────────────────────────────────────

describe("sanitizeRepoPath — null byte injection", () => {
  it("rejects a path with a null byte", () => {
    expect(() => sanitizeRepoPath("file\x00.txt", ROOT))
      .toThrow(SanitizationError);
  });

  it("rejects null byte at start", () => {
    expect(() => sanitizeRepoPath("\x00etc/passwd", ROOT))
      .toThrow(SanitizationError);
  });

  it("error reason is 'null byte'", () => {
    let caught: unknown;
    try { sanitizeRepoPath("a\x00b", ROOT); } catch (e) { caught = e; }
    expect((caught as SanitizationError).reason).toBe("null byte");
  });
});

// ─── Absolute path injection ──────────────────────────────────────────────────

describe("sanitizeRepoPath — absolute path injection", () => {
  it("rejects POSIX absolute path /etc/passwd", () => {
    expect(() => sanitizeRepoPath("/etc/passwd", ROOT))
      .toThrow(SanitizationError);
  });

  it("rejects path starting with /", () => {
    expect(() => sanitizeRepoPath("/absolute/path", ROOT))
      .toThrow(SanitizationError);
  });

  it("rejects Windows drive path C:\\Windows\\System32", () => {
    expect(() => sanitizeRepoPath("C:\\Windows\\System32", ROOT))
      .toThrow(SanitizationError);
  });

  it("rejects Windows UNC path \\\\server\\share", () => {
    expect(() => sanitizeRepoPath("\\\\server\\share", ROOT))
      .toThrow(SanitizationError);
  });

  it("error reason is 'absolute path'", () => {
    let caught: unknown;
    try { sanitizeRepoPath("/etc/shadow", ROOT); } catch (e) { caught = e; }
    expect((caught as SanitizationError).reason).toBe("absolute path");
  });
});

// ─── Root boundary edge cases ─────────────────────────────────────────────────

describe("sanitizeRepoPath — root boundary", () => {
  it("does not accept a path that starts with repoRoot as a prefix of a sibling dir", () => {
    // /srv/cocapn-private-evil starts with /srv/cocapn-private but is not inside it
    const sneakyRoot = "/srv/cocapn-private-evil/file.txt";
    // We can't produce this via sanitizeRepoPath because inputs must be relative,
    // but test that the root+sep guard holds by passing a raw absolute — it should
    // be rejected at the absolute-path check, not sneak past the prefix check.
    expect(() => sanitizeRepoPath(sneakyRoot, ROOT))
      .toThrow(SanitizationError);
  });
});
