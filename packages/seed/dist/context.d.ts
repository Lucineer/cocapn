/**
 * Context — smart context window builder for cocapn.
 *
 * Builds the LLM system prompt with prioritized sections:
 *   1. soul.md personality (always)
 *   2. recent 5 messages (always)
 *   3. relevant facts (keyword match against user message)
 *   4. git awareness (if asked about repo)
 *   5. older messages (fill remaining budget)
 *
 * Max budget: ~4000 tokens (~6 chars/token → ~24000 chars).
 */
import type { Soul } from './soul.js';
import type { Memory } from './memory.js';
import type { Awareness } from './awareness.js';
export interface ContextOptions {
    soul: Soul;
    memory: Memory;
    awareness: Awareness;
    userMessage: string;
    reflectionSummary?: string;
}
/** Build a smart, budget-aware system prompt. */
export declare function buildContext(opts: ContextOptions): string;
//# sourceMappingURL=context.d.ts.map