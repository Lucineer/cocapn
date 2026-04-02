/**
 * Extract — learn from conversations.
 *
 * After each chat response, extracts facts, decisions, questions,
 * and emotional tone from user messages using simple keyword matching.
 * Saves extracted facts to memory automatically.
 */
import type { Memory } from './memory.js';
export interface Extraction {
    facts: Array<{
        key: string;
        value: string;
    }>;
    decisions: string[];
    questions: string[];
    tone: 'positive' | 'negative' | 'neutral';
}
/** Extract learnings from a user message and auto-save facts to memory. */
export declare function extract(message: string, memory: Memory, userId?: string): Extraction;
//# sourceMappingURL=extract.d.ts.map