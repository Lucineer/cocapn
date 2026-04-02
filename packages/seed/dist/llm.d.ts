/**
 * LLM — Multi-provider chat completions via OpenAI-compatible API.
 *
 * Supports: DeepSeek, OpenAI, Ollama, and any OpenAI-compatible endpoint.
 * Zero dependencies. Uses only the global fetch API (Node 18+).
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface ChatResponse {
    content: string;
    model: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
}
export interface StreamChunk {
    type: 'content' | 'done' | 'error';
    text?: string;
    error?: string;
}
export interface LLMConfig {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}
export declare function detectOllama(): Promise<{
    model: string;
} | null>;
export declare class LLM {
    private apiKey;
    private baseUrl;
    private model;
    private temperature;
    private maxTokens;
    private timeout;
    constructor(config?: LLMConfig);
    /** Non-streaming chat completion */
    chat(messages: ChatMessage[]): Promise<ChatResponse>;
    /** Streaming chat completion */
    chatStream(messages: ChatMessage[]): AsyncGenerator<StreamChunk>;
    private fetchAPI;
}
/** @deprecated Use LLM instead */
export declare const DeepSeek: typeof LLM;
//# sourceMappingURL=llm.d.ts.map