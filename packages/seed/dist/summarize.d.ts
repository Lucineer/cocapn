/**
 * Summarize — conversation summarization for long sessions.
 *
 * After 20+ messages, summarizes the conversation:
 *   - Key topics discussed
 *   - Decisions made
 *   - Facts learned
 *   - Questions left unanswered
 *
 * Saves summary to memory, clears old messages to prevent context overflow.
 */
import type { Memory } from './memory.js';
export interface Summary {
    topics: string[];
    decisions: string[];
    factsLearned: Array<[string, string]>;
    unansweredQuestions: string[];
    messageRange: {
        from: number;
        to: number;
    };
}
/** Check if summarization is needed. */
export declare function shouldSummarize(memory: Memory): boolean;
/** Summarize the conversation and compact memory. */
export declare function summarize(memory: Memory): Summary;
//# sourceMappingURL=summarize.d.ts.map