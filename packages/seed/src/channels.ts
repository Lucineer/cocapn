/**
 * Channels — messaging channel connectors for the cocapn seed.
 *
 * Supported channels:
 *   - Telegram: webhook handler (POST /api/telegram/webhook)
 *   - Generic webhook: POST /api/webhook (any JSON source)
 *   - Email: parse incoming email headers + body
 *
 * Each channel: receive → normalize → call agent → respond
 */

import type { LLM } from './llm.js';
import type { Memory } from './memory.js';
import type { Soul } from './soul.js';

export interface ChannelMessage {
  channel: 'telegram' | 'webhook' | 'email';
  from: string;
  text: string;
  ts: string;
  raw: Record<string, unknown>;
}

export interface ChannelResponse {
  text: string;
  replyTo?: Record<string, unknown>;
}

function normalizeTelegram(body: Record<string, unknown>): ChannelMessage | null {
  const msg = body.message as Record<string, unknown> | undefined;
  if (!msg) return null;
  const from = (msg.from as Record<string, unknown>) ?? {};
  const text = (msg.text as string) ?? '';
  if (!text) return null;
  return { channel: 'telegram', from: String(from.username ?? from.id ?? 'unknown'), text, ts: new Date((msg.date as number ?? 0) * 1000).toISOString(), raw: body };
}

function normalizeWebhook(body: Record<string, unknown>): ChannelMessage | null {
  const text = (body.text as string) ?? (body.message as string) ?? '';
  if (!text) return null;
  return { channel: 'webhook', from: String(body.from ?? body.user ?? 'unknown'), text, ts: body.ts ? String(body.ts) : new Date().toISOString(), raw: body };
}

function normalizeEmail(headers: Record<string, string>, bodyText: string): ChannelMessage | null {
  if (!bodyText.trim()) return null;
  return { channel: 'email', from: headers.from ?? 'unknown', text: bodyText, ts: headers.date ?? new Date().toISOString(), raw: { headers, body: bodyText } };
}

export async function handleChannelMessage(
  channel: ChannelMessage, llm: LLM, systemPrompt: string,
): Promise<ChannelResponse> {
  const messages = [
    { role: 'system' as const, content: systemPrompt + `\n[Message from ${channel.channel} user: ${channel.from}]` },
    { role: 'user' as const, content: channel.text },
  ];
  const reply = await llm.chat(messages);
  const text = reply.content ?? '';
  if (channel.channel === 'telegram') {
    return { text, replyTo: { method: 'sendMessage', chat_id: (channel.raw.message as Record<string, unknown>)?.chat, text } };
  }
  return { text };
}

export const normalizers = { telegram: normalizeTelegram, webhook: normalizeWebhook, email: normalizeEmail };
