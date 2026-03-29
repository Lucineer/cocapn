/**
 * LLM Module — barrel exports.
 *
 * Provides direct LLM provider integration for the bridge.
 * Supports DeepSeek, OpenAI, and Anthropic with streaming,
 * fallback chains, and cost tracking.
 */

export type {
  LLMProvider,
  ProviderConfig,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ChatChunk,
} from './provider.js';

export { DeepSeekProvider } from './deepseek.js';
export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { LLMRouter } from './router.js';
export type { LLMRouterConfig } from './router.js';
