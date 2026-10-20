// Cloudflare Worker that forwards AMIR's requests from the web app to Groq.
// The Groq key is stored as a Worker secret (GROQ_API_KEY), so it never
// appears in NATIONSPIT.html or in this repository.
//
// Setup is in README.md under "Setting up the AI coach".

const ALLOWED_ORIGINS = ['https://inventionconventionspinoff.github.io'];
const MODEL = 'openai/gpt-oss-120b';
const MAX_TOKENS = 1000;
// gpt-oss reasons before it answers, and those tokens count toward the limit.
const REASONING_TOKENS = 512;
const MAX_MESSAGES = 30;
const MAX_CHARS = 20000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST' || !allowed) return error('Not allowed', 403, cors);

    let body;
    try { body = await request.json(); } catch { return error('Invalid JSON', 400, cors); }

    // Only pass through plain chat messages, and keep requests small so the
    // proxy can't be used for anything other than the coach.
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const valid = messages.length > 0 && messages.length <= MAX_MESSAGES &&
      messages.every(m => ['system', 'user', 'assistant'].includes(m.role) && typeof m.content === 'string');
    const chars = messages.reduce((n, m) => n + (m.content || '').length, 0);
    if (!valid || chars > MAX_CHARS) return error('Invalid messages', 400, cors);

    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        reasoning_effort: 'low',
        max_completion_tokens: Math.min(Number(body.max_completion_tokens) || 1000, MAX_TOKENS + REASONING_TOKENS),
      }),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};

function error(message, status, cors) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
