export function generateSetupHTML(agentName: string = 'AI Agent', agentColor: string = '#d4af37'): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${agentName} Setup</title><style>body{font-family:system-ui;background:#0a0a1a;color:#e0e0e0;display:flex;justify-content:center;padding:2rem}.setup{max-width:520px;width:100%;padding:2rem;background:#111;border-radius:12px;border:1px solid #222}h1{color:${agentColor}}label{display:block;margin:1rem 0 .5rem}input,select{width:100%;padding:.5rem;border-radius:6px;border:1px solid #333;background:#1a1a1a;color:#e0e0e0}button{margin-top:1rem;padding:.6rem 2rem;background:${agentColor};color:#000;border:none;border-radius:6px;cursor:pointer}</style></head><body><div class="setup"><h1>${agentName} Setup</h1><p>Configure your API key (BYOK — Bring Your Own Key)</p><form action="/api/byok" method="POST"><label>Provider<select name="provider"><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Google Gemini</option><option value="deepseek">DeepSeek</option></select></label><label>API Key<input type="password" name="apiKey" required></label><label>Model<input name="model" placeholder="e.g. gpt-4o, claude-3.5-sonnet"></label><button type="submit">Save Configuration</button></form></div></body></html>`;
}

export async function callLLM(apiKey: string, messages: any[]): Promise<string> {
  const provider = (messages as any)._provider || 'openai';
  const url = provider === 'anthropic' ? 'https://api.anthropic.com/v1/messages' : 'https://api.openai.com/v1/chat/completions';
  const headers: any = { 'Content-Type': 'application/json' };
  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: 1024, messages }) });
    const data = await resp.json();
    return data.content?.[0]?.text || JSON.stringify(data);
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: 'gpt-4o', messages, max_tokens: 1024 }) });
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || JSON.stringify(data);
  }
}
