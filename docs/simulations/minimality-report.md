# Cocapn Seed — Minimality Analysis

**Date:** 2026-03-31
**Analyzed:** packages/seed/src/

## Overview

| Metric | Value |
|--------|-------|
| Total files | 8 |
| Total lines | 1202 |
| Code lines | 938 |
| Comment lines | 104 |
| Blank lines | 160 |
| Exported functions | 9 |
| Classes | 3 |
| Imports | 51 |

## Per-File Breakdown

| File | Total | Code | Comments | Blank | Functions | Exports |
|------|-------|------|----------|-------|-----------|---------|
| index.ts | 287 | 233 | 21 | 33 | 0 | 0 |
| web.ts | 252 | 181 | 38 | 33 | 1 | 1 |
| awareness.ts | 224 | 180 | 15 | 29 | 0 | 1 |
| llm.ts | 151 | 120 | 11 | 20 | 0 | 1 |
| memory.ts | 128 | 87 | 19 | 22 | 0 | 1 |
| git.ts | 83 | 71 | 0 | 12 | 5 | 5 |
| chat.ts | 40 | 35 | 0 | 5 | 1 | 1 |
| soul.ts | 37 | 31 | 0 | 6 | 2 | 2 |

## Function Analysis

| Function | File | Lines | Exported | Used | Tested | Status |
|----------|------|-------|----------|------|--------|--------|
| chat | chat.ts:5 | 36 | Yes | Yes | Yes | OK |
| perceive | git.ts:14 | 21 | Yes | Yes | Yes | OK |
| narrate | git.ts:36 | 14 | Yes | Yes | Yes | OK |
| log | git.ts:51 | 8 | Yes | Yes | Yes | OK |
| stats | git.ts:60 | 20 | Yes | Yes | Yes | OK |
| diff | git.ts:81 | 3 | Yes | Yes | Yes | OK |
| loadSoul | soul.ts:13 | 21 | Yes | Yes | Yes | OK |
| soulToSystemPrompt | soul.ts:35 | 3 | Yes | Yes | Yes | OK |
| startWebServer | web.ts:64 | 132 | Yes | Yes | Yes | OK |

## Class Methods

| Method | Class | File | Lines | Used | Tested | Status |
|--------|-------|------|-------|------|--------|--------|
| perceive | Awareness | awareness.ts:41 | 17 | Yes | Yes | OK |
| narrate | Awareness | awareness.ts:60 | 17 | Yes | Yes | OK |
| getName | Awareness | awareness.ts:80 | 7 | Yes | **No** | UNTESTED |
| getDescription | Awareness | awareness.ts:88 | 7 | Yes | **No** | UNTESTED |
| getBirthDate | Awareness | awareness.ts:96 | 8 | Yes | **No** | UNTESTED |
| getCommitCount | Awareness | awareness.ts:105 | 7 | Yes | **No** | UNTESTED |
| getLastCommitTime | Awareness | awareness.ts:113 | 8 | Yes | **No** | UNTESTED |
| getBranch | Awareness | awareness.ts:122 | 7 | Yes | **No** | UNTESTED |
| getAuthors | Awareness | awareness.ts:130 | 8 | Yes | **No** | UNTESTED |
| getRecentActivity | Awareness | awareness.ts:139 | 10 | Yes | **No** | UNTESTED |
| inferFeeling | Awareness | awareness.ts:150 | 15 | Yes | **No** | UNTESTED |
| detectLanguages | Awareness | awareness.ts:166 | 14 | Yes | **No** | UNTESTED |
| countFiles | Awareness | awareness.ts:181 | 5 | Yes | **No** | UNTESTED |
| walkDir | Awareness | awareness.ts:187 | 21 | Yes | **No** | UNTESTED |
| fn | Awareness | awareness.ts:203 | 3 | Yes | **No** | UNTESTED |
| readJson | Awareness | awareness.ts:209 | 3 | Yes | **No** | UNTESTED |
| formatAge | Awareness | awareness.ts:213 | 11 | Yes | **No** | UNTESTED |
| chat | DeepSeek | llm.ts:56 | 21 | Yes | Yes | OK |
| fetchAPI | DeepSeek | llm.ts:122 | 29 | Yes | **No** | UNTESTED |
| clearTimeout | DeepSeek | llm.ts:148 | 4 | **No** | **No** | DEAD |
| recent | Memory | memory.ts:51 | 3 | Yes | Yes | OK |
| addMessage | Memory | memory.ts:56 | 8 | Yes | Yes | OK |
| setFact | Memory | memory.ts:66 | 4 | **No** | Yes | DEAD |
| getFact | Memory | memory.ts:72 | 3 | **No** | Yes | DEAD |
| formatContext | Memory | memory.ts:77 | 7 | Yes | Yes | OK |
| formatFacts | Memory | memory.ts:86 | 5 | Yes | Yes | OK |
| clear | Memory | memory.ts:93 | 4 | Yes | Yes | OK |
| search | Memory | memory.ts:99 | 9 | Yes | Yes | OK |
| load | Memory | memory.ts:111 | 13 | Yes | Yes | OK |
| save | Memory | memory.ts:125 | 3 | Yes | Yes | OK |
| writeFileSync | Memory | memory.ts:126 | 3 | Yes | Yes | OK |

## Import Analysis

| Import | From | File | Used | Usages | Status |
|--------|------|------|------|--------|--------|

**Used imports:** 51/51

## Dead Code Summary

| Category | Count |
|----------|-------|
| Dead functions (never called) | 3 |
| Untested functions | 17 |
| Unused imports | 0 |

### Dead Functions
- `clearTimeout`
- `setFact`
- `getFact`

### Untested Functions
- `getName`
- `getDescription`
- `getBirthDate`
- `getCommitCount`
- `getLastCommitTime`
- `getBranch`
- `getAuthors`
- `getRecentActivity`
- `inferFeeling`
- `detectLanguages`
- `countFiles`
- `walkDir`
- `fn`
- `readJson`
- `formatAge`
- `fetchAPI`
- `clearTimeout`

## Minimum Viable Seed

### Essential Files

| File | Purpose | Code Lines | Removable? |
|------|---------|------------|------------|
| awareness.ts | Self-perception (the paradigm) | 180 | No |
| chat.ts | Utility/support | 35 | Yes |
| git.ts | Utility/support | 71 | Yes |
| index.ts | CLI entry point, wires everything together | 233 | No |
| llm.ts | DeepSeek API client (core capability) | 120 | No |
| memory.ts | Persistent memory (core capability) | 87 | No |
| soul.ts | Personality loading (the paradigm) | 31 | No |
| web.ts | Web interface (dual interface) | 181 | No |

### Line Count Summary

| Metric | Lines |
|--------|-------|
| Current total | 1202 |
| Current code | 938 |
| Essential files code | 832 |
| Minimum viable seed | ~832 lines |
| Bloat (non-essential) | 106 lines (11%) |

### What Can Be Removed Without Breaking Tests

**git.ts** (71 code lines)
- `git()` helper: duplicated by `execSync` calls in awareness.ts
- `perceive()`: overlaps with `Awareness.perceive()`
- `narrate()`: overlaps with `Awareness.narrate()`
- Status: **Potentially dead** — awareness.ts has its own git integration

**chat.ts** (35 code lines)
- `chat()` function: largely duplicated by `terminalChat()` in index.ts
- Status: **Deduplication candidate** — index.ts has its own REPL

### Deduplication Opportunities

1. **git.ts vs awareness.ts**: Both implement git introspection. Merge into one.
2. **chat.ts vs index.ts**: Both implement REPL chat. One is enough.
3. **Type definitions**: Some types are defined but never referenced outside their file.

### Verdict

The seed is **1202 lines** total, **938 lines** of code.
The absolute minimum viable seed is **~832 lines** of code.
Current bloat: **106 lines** (11% of code).

The seed is remarkably lean. The main opportunities are:
1. Remove or merge `git.ts` (duplicates awareness.ts git logic)
2. Remove or merge `chat.ts` (duplicates index.ts REPL logic)
3. Inline small type definitions to reduce file count

No functions are truly dead — all exports are used by `index.ts`. The seed is well-factored.
