/**
 * Context Management — adaptive context assembly and conversation tracking.
 *
 * This module provides three key components for intelligent agent context management:
 *
 * 1. TaskComplexityClassifier — heuristics-based complexity detection
 *    Classifies incoming messages by complexity (trivial/simple/moderate/complex)
 *    and determines appropriate context budget levels.
 *
 * 2. ContextAssembler — dynamic context assembly
 *    Builds agent context payloads based on budget levels, integrating repo maps,
 *    brain facts, skill context, and file contents as needed.
 *
 * 3. ConversationTracker — conversation-aware routing state
 *    Maintains conversation state across turns to enable intelligent routing
 *    and module continuation.
 */
export { TaskComplexityClassifier, } from './classifier.js';
export { ContextAssembler, } from './assembler.js';
export { ConversationTracker, } from './conversation.js';
//# sourceMappingURL=index.js.map