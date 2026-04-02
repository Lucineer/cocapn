/**
 * cocapn chat — Interactive terminal chat with the cocapn agent.
 *
 * Connects to the bridge at localhost:<port>/api/chat, streams responses
 * via SSE, and stores history in ~/.cocapn/chat-history.jsonl.
 */
import { Command } from "commander";
export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
}
export interface ChatHistory {
    messages: ChatMessage[];
    mode: "public" | "private";
    startedAt: string;
}
/**
 * Parse an SSE stream from the bridge.
 * The bridge sends `data: {"content": "...", "done": false}` lines.
 * When `done: true`, the stream ends.
 */
export declare function parseSSEStream(response: Response, onChunk: (text: string) => void, onDone: () => void, onError: (err: Error) => void): Promise<void>;
export declare function exportConversation(messages: ChatMessage[], format: "json" | "md"): string;
export declare function createChatCommand(): Command;
//# sourceMappingURL=chat.d.ts.map