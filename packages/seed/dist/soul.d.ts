export interface Soul {
    name: string;
    tone: string;
    model: string;
    body: string;
    theme?: string;
    avatar?: string;
}
export declare function loadSoul(soulPath: string): Soul;
export declare function soulToSystemPrompt(soul: Soul): string;
/**
 * Build a full system prompt combining soul, awareness, facts, and reflection.
 * This is the enhanced prompt that makes the agent actually smart.
 */
export declare function buildFullSystemPrompt(soul: Soul, awarenessNarration: string, formattedFacts: string, reflectionSummary?: string): string;
/**
 * Build an A2A-aware system prompt for when another agent is visiting.
 * Adds context about visiting agents and privacy constraints.
 */
export declare function buildA2ASystemPrompt(soul: Soul, visitingAgentName: string, visitingAgentUrl?: string): string;
//# sourceMappingURL=soul.d.ts.map