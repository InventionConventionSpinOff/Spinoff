// Tests for worker/groq-proxy.js (the Cloudflare Worker that holds the Groq key).
// global fetch is replaced with a mock, so nothing leaves this machine.
// Run with: bash tests/run.sh   (or: node --test tests/worker.test.mjs)
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const SRC = new URL('../worker/groq-proxy.js', import.meta.url);
let worker;
try { worker = (await import(SRC.href)).default; }
catch {   // older Node without module detection: load the source as an ES module
  const code = await readFile(SRC, 'utf8');
  worker = (await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))).default;
}

const ORIGIN = 'https://inventionconventionspinoff.github.io';
const ENV = { GROQ_API_KEY: 'test-secret-not-real' };
const realFetch = globalThis.fetch;
let calls;
beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'stub reply' } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

function req(body, { origin = ORIGIN, method = 'POST', raw } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin) headers.Origin = origin;
  return new Request('https://spinoff-ai.example.workers.dev/', {
    method, headers, body: method === 'POST' ? (raw !== undefined ? raw : JSON.stringify(body)) : undefined,
  });
}
const msgs = (...contents) => contents.map(c => ({ role: 'user', content: c }));

test('allowed origin is forwarded with the secret and the fixed model', async () => {
  const res = await worker.fetch(req({
    model: 'some-other-model', temperature: 2, max_completion_tokens: 99999,
    messages: [{ role: 'system', content: 'be nice', extra: 'dropped' }, { role: 'user', content: 'hi' }],
  }), ENV);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.deepEqual(await res.json(), { choices: [{ message: { content: 'stub reply' } }] });
  assert.equal(calls.length, 1);
  const c = calls[0];
  assert.equal(c.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(c.init.method, 'POST');
  assert.equal(c.init.headers.Authorization, 'Bearer ' + ENV.GROQ_API_KEY);
  assert.equal(c.body.model, 'openai/gpt-oss-120b');
  assert.equal(c.body.temperature, 0.7);
  assert.equal(c.body.max_completion_tokens, 1512, 'capped at MAX_TOKENS + REASONING_TOKENS');
  assert.deepEqual(c.body.messages, [{ role: 'system', content: 'be nice' }, { role: 'user', content: 'hi' }]);
});

test('token request defaults to 1000 and smaller requests pass through', async () => {
  await worker.fetch(req({ messages: msgs('a') }), ENV);
  await worker.fetch(req({ messages: msgs('a'), max_completion_tokens: 812 }), ENV);
  assert.deepEqual(calls.map(c => c.body.max_completion_tokens), [1000, 812]);
});

test('upstream errors are passed back with CORS headers', async () => {
  globalThis.fetch = async () => new Response('{"error":{"message":"rate limited"}}', { status: 429 });
  const res = await worker.fetch(req({ messages: msgs('a') }), ENV);
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal((await res.json()).error.message, 'rate limited');
});

test('other origins, a missing origin and non-POST methods get 403', async () => {
  for (const r of [req({ messages: msgs('a') }, { origin: 'https://evil.example' }),
                   req({ messages: msgs('a') }, { origin: 'http://inventionconventionspinoff.github.io' }),
                   req({ messages: msgs('a') }, { origin: null }),
                   req(null, { method: 'GET' })]) {
    const res = await worker.fetch(r, ENV);
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN, 'never echoes a foreign origin');
  }
  assert.equal(calls.length, 0);
});

test('OPTIONS preflight is answered without calling Groq', async () => {
  const res = await worker.fetch(req(null, { method: 'OPTIONS' }), ENV);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.match(res.headers.get('Access-Control-Allow-Methods'), /POST/);
  assert.match(res.headers.get('Access-Control-Allow-Headers'), /Content-Type/);
  assert.equal(calls.length, 0);
});

test('malformed or oversized requests get 400 and never reach Groq', async () => {
  const bad = [
    ['invalid JSON', { raw: '{nope' }],
    ['JSON null', { raw: 'null' }],
    ['no messages', {}],
    ['messages not an array', { messages: 'hi' }],
    ['empty messages', { messages: [] }],
    ['null message', { messages: [null] }],
    ['bad role', { messages: [{ role: 'tool', content: 'x' }] }],
    ['non-string content', { messages: [{ role: 'user', content: { text: 'x' } }] }],
    ['missing content', { messages: [{ role: 'user' }] }],
    ['31 messages', { messages: msgs(...Array(31).fill('x')) }],
    ['over 20000 characters', { messages: msgs('x'.repeat(15000), 'y'.repeat(5001)) }],
  ];
  for (const [name, b] of bad) {
    const res = await worker.fetch(b.raw !== undefined ? req(null, { raw: b.raw }) : req(b), ENV);
    assert.equal(res.status, 400, name);
    assert.ok((await res.json()).error.message, name + ' has an error message');
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN, name + ' keeps CORS');
  }
  assert.equal(calls.length, 0);
});

test('limits are inclusive: 30 messages and 20000 characters are accepted', async () => {
  const res1 = await worker.fetch(req({ messages: msgs(...Array(30).fill('x')) }), ENV);
  const res2 = await worker.fetch(req({ messages: msgs('x'.repeat(15000), 'y'.repeat(5000)) }), ENV);
  assert.equal(res1.status, 200);
  assert.equal(res2.status, 200);
  assert.equal(calls.length, 2);
});
