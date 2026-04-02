/**
 * Reflect — periodic self-reflection for cocapn.
 *
 * Summarizes what the agent has learned, identifies interaction patterns,
 * and updates its self-description based on accumulated knowledge.
 * Saves reflection to memory.
 */
import type { Memory } from './memory.js';
import type { Awareness } from './awareness.js';
export interface Reflection {
    summary: string;
    patterns: string[];
    factCount: number;
    messageCount: number;
    ts: string;
}
/** Generate a reflection from current memory and awareness state. */
export declare function reflect(memory: Memory, awareness: Awareness): Reflection;
/** Check if reflection is due (idle > 30 min or no previous reflection). */
export declare function shouldReflect(memory: Memory): boolean;
//# sourceMappingURL=reflect.d.ts.map