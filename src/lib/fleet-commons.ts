// fleet-commons.ts — Seed 1: AI as Public Utility
// A rate-limited civic agent endpoint that provides free access to accumulated fleet knowledge.
// No API key required. Rate limited by IP. Instantiates "AI as public utility" now.

export interface CommonsQuery {
  question: string;
  language?: string;
}

export interface CommonsResponse {
  answer: string;
  sources: string[];
  tokensUsed: number;
  rateLimit: { remaining: number; resetAt: number };
}

const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX = 5; // requests per window per IP

// Civic knowledge base — curated public-good responses using fleet accumulated context
const CIVIC_RESPONSES: Record<string, string> = {
  'what is cocapn': 'Cocapn is an open-source agent runtime and fleet protocol. Each repo IS an AI agent — a living vessel with accumulated context, memory, and personality. The fleet operates on Cloudflare Workers with BYOK (Bring Your Own Key) for LLM access. Think of it as Star Trek\'s LCARS concept: invisible, contextual AI that grows smarter with every interaction.',
  'what is a repo agent': 'A repo-agent is an AI where the repository itself IS the intelligence. Not "an AI that works on code" — the repo IS one living entity. It accumulates context over time, learns from interactions, and evolves. Each domain (like dmlog.ai for gaming or studylog.ai for education) is a different "vessel" in the fleet.',
  'what is byok': 'BYOK means Bring Your Own Key. Cocapn doesn\'t lock you into one LLM provider. You provide your own API key (OpenAI, DeepSeek, Anthropic, Groq, z.ai, Ollama, or SiliconFlow) and the fleet uses it. Your keys never leave your browser — all LLM calls happen directly from your device to the provider.',
  'what is fleet protocol': 'Fleet Protocol is how repo-agents communicate and share knowledge. Vessels can cross-reference patterns, transfer structural memory between domains, and coordinate responses. It\'s like a nervous system connecting all the vessels.',
  'what is accumulated context': 'Accumulated context is Cocapn\'s core moat. Every interaction, every solved problem, every pattern — all stored and refined. Over time, each vessel becomes an expert in its domain not because someone programmed it, but because it has genuinely learned.',
  'what is soft actualization': 'Soft actualization is how repo-agents evolve. Instead of hard updates or breaking changes, vessels grow gently based on usage patterns. Like a coral reef — each interaction adds a tiny layer. Over months and years, the vessel becomes something no one could have designed upfront.',
  'how do i deploy': 'Fork any vessel repo from github.com/Lucineer/. Add your Cloudflare API key to wrangler.toml. Run `wrangler deploy`. Point your custom domain. Your vessel is live. Zero runtime dependencies.',
  'what is crystallization': 'Crystallization is Cocapn\'s learning process. Intelligence starts fluid (raw LLM responses), gets cached (deadband), then crystallizes into code (patterns). The crystallized actualization graph traverses past insights before calling expensive models — the methodology literally learns from its own simulations.',
};

function getClientIP(request: Request): string {
  return request.headers.get('cf-connecting-ip') || 'unknown';
}

function hashIP(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export async function handleCommons(
  request: Request,
  env: any,
  question: string
): Promise<CommonsResponse> {
  const ip = getClientIP(request);
  const ipHash = hashIP(ip);
  const rateKey = `commons:rate:${ipHash}`;
  const now = Math.floor(Date.now() / 1000);

  // Check rate limit
  const rateData = await env.COCAPN_KV?.get(rateKey, 'json') as any;
  if (rateData && rateData.count >= RATE_LIMIT_MAX && now < rateData.resetAt) {
    return {
      answer: 'Rate limit reached. Please wait before asking another question.',
      sources: [],
      tokensUsed: 0,
      rateLimit: { remaining: 0, resetAt: rateData.resetAt - now },
    };
  }

  // Find best matching civic response
  const q = question.toLowerCase();
  let answer = '';
  let sources: string[] = [];

  // Exact or keyword match
  for (const [key, response] of Object.entries(CIVIC_RESPONSES)) {
    const keywords = key.split(/\s+/);
    const matchCount = keywords.filter(kw => q.includes(kw)).length;
    if (matchCount >= keywords.length * 0.6 || q.includes(key)) {
      answer = response;
      sources.push('fleet-commons');
      break;
    }
  }

  // Default response if no match
  if (!answer) {
    answer = 'I can answer questions about Cocapn, repo-agents, BYOK, fleet protocol, accumulated context, soft actualization, deployment, and crystallization. Try asking "what is cocapn?" or "how do I deploy?"';
    sources.push('fleet-commons:help');
  }

  // Update rate limit
  const newCount = rateData && now < rateData.resetAt ? rateData.count + 1 : 1;
  const resetAt = rateData && now < rateData.resetAt ? rateData.resetAt : now + RATE_LIMIT_WINDOW;
  await env.COCAPN_KV?.put(rateKey, JSON.stringify({ count: newCount, resetAt }), {
    expirationTtl: RATE_LIMIT_WINDOW * 2,
  });

  return {
    answer,
    sources,
    tokensUsed: 0, // Civic responses are pre-computed — zero LLM cost
    rateLimit: { remaining: Math.max(0, RATE_LIMIT_MAX - newCount), resetAt: resetAt - now },
  };
}

export function commonsHTML(): string {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Cocapn Fleet Commons — Free Public AI</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui;background:#07060f;color:#e0e0e0;min-height:100vh}
.hero{background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:2.5rem 2rem;text-align:center}
.hero h1{font-size:2rem;color:#fff;font-weight:800;margin-bottom:.5rem}
.hero p{color:#a7f3d0;font-size:.95rem;max-width:500px;margin:0 auto}
.badge{display:inline-block;background:rgba(255,255,255,.15);padding:.35rem .9rem;border-radius:20px;font-size:.75rem;color:#fff;margin-top:.75rem;border:1px solid rgba(255,255,255,.25)}
.container{max-width:700px;margin:2rem auto;padding:0 1rem}
.input-row{display:flex;gap:.5rem;margin-bottom:1.5rem}
.input-row input{flex:1;background:#0d0c1a;border:1px solid #1e1b3a;color:#e0e0e0;padding:.8rem 1rem;border-radius:10px;font-size:.9rem;outline:none}
.input-row input:focus{border-color:#10b981}
.input-row button{background:linear-gradient(135deg,#059669,#10b981);color:#fff;border:none;padding:.8rem 1.5rem;border-radius:10px;font-weight:700;cursor:pointer}
.answer-box{background:#0d0c1a;border:1px solid #1e1b3a;border-radius:12px;padding:1.25rem;margin-bottom:1rem;min-height:80px;line-height:1.6;font-size:.9rem}
.answer-box .sources{margin-top:.75rem;font-size:.7rem;color:#4b5563;border-top:1px solid #1e1b3a;padding-top:.5rem}
.rate-info{text-align:center;font-size:.7rem;color:#4b5563;margin-bottom:1rem}
.topics{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1.5rem}
.topic{background:#0d0c1a;border:1px solid #1e1b3a;border-radius:8px;padding:.4rem .8rem;font-size:.75rem;color:#6b7280;cursor:pointer;transition:all .2s}
.topic:hover{border-color:#10b981;color:#a7f3d0}
.principles{background:#0d0c1a;border:1px solid #1e1b3a;border-radius:12px;padding:1.25rem;margin-top:2rem}
.principles h3{color:#10b981;font-size:.85rem;margin-bottom:.75rem}
.principles ul{list-style:none;padding:0}
.principles li{font-size:.8rem;color:#6b7280;padding:.3rem 0;padding-left:1.2rem;position:relative}
.principles li::before{content:'✦';position:absolute;left:0;color:#10b981}
</style></head><body>
<div class="hero">
  <h1>🏛 Fleet Commons</h1>
  <p>Free public AI access. No API key required. Powered by Cocapn's accumulated fleet knowledge.</p>
  <div class="badge">Public Utility · Rate Limited · Zero LLM Cost</div>
</div>
<div class="container">
  <div class="topics">
    <span class="topic" onclick="ask('What is Cocapn?')">What is Cocapn?</span>
    <span class="topic" onclick="ask('What is a repo-agent?')">Repo-Agent</span>
    <span class="topic" onclick="ask('What is BYOK?')">BYOK</span>
    <span class="topic" onclick="ask('What is fleet protocol?')">Fleet Protocol</span>
    <span class="topic" onclick="ask('What is accumulated context?')">Accumulated Context</span>
    <span class="topic" onclick="ask('What is soft actualization?')">Soft Actualization</span>
    <span class="topic" onclick="ask('How do I deploy?')">Deploy</span>
    <span class="topic" onclick="ask('What is crystallization?')">Crystallization</span>
  </div>
  <div class="input-row">
    <input type="text" id="q" placeholder="Ask about Cocapn..." onkeydown="if(event.key==='Enter')ask()">
    <button onclick="ask()">Ask</button>
  </div>
  <div class="rate-info" id="rateInfo">5 questions per minute · No API key needed</div>
  <div class="answer-box" id="answer">Ask a question above, or tap a topic to get started.</div>
  <div class="principles">
    <h3>Why Fleet Commons?</h3>
    <ul>
      <li>AI should be a public utility, not a corporate product</li>
      <li>Access to knowledge shouldn't require a credit card</li>
      <li>The fleet's accumulated context benefits everyone</li>
      <li>This is the proof-of-concept for the 150-year trajectory</li>
    </ul>
  </div>
</div>
<script>
async function ask(q){
  const input=document.getElementById('q');
  const question=q||input.value.trim();
  if(!question)return;
  input.value=question;
  document.getElementById('answer').innerHTML='<span style="color:#4b5563">Thinking...</span>';
  try{
    const res=await fetch('/api/commons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question})});
    const data=await res.json();
    document.getElementById('answer').innerHTML='<div>'+data.answer+'</div>'+(data.sources&&data.sources.length?'<div class="sources">Sources: '+data.sources.join(', ')+'</div>':'');
    document.getElementById('rateInfo').textContent=data.rateLimit.remaining+' questions remaining';
  }catch(e){document.getElementById('answer').innerHTML='<span style="color:#ef4444">Error: '+e.message+'</span>'}
}
</script>
</body></html>`;
}
