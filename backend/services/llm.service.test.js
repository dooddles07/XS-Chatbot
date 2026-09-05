process.env.GROQ_API_KEY ??= 'test-key';
process.env.GEMINI_API_KEY ??= 'test-key';
process.env.UPSTASH_REDIS_REST_URL ??= 'https://example.com';
process.env.UPSTASH_REDIS_REST_TOKEN ??= 'test-token';

const test = require('node:test');
const assert = require('node:assert/strict');
const groqService = require('./groq.service');
const geminiService = require('./gemini.service');
const { getReply } = require('./llm.service');

test('falls back to gemini when groq throws', async (t) => {
  t.mock.method(groqService, 'reply', async () => { throw new Error('groq down'); });
  t.mock.method(geminiService, 'reply', async () => 'gemini reply');

  const result = await getReply('hi');
  assert.equal(result, 'gemini reply');
});

test('propagates error when both providers throw', async (t) => {
  t.mock.method(groqService, 'reply', async () => { throw new Error('groq down'); });
  t.mock.method(geminiService, 'reply', async () => { throw new Error('gemini down'); });

  await assert.rejects(() => getReply('hi'), /gemini down/);
});

test('returns groq reply directly when groq succeeds', async (t) => {
  t.mock.method(groqService, 'reply', async () => 'groq reply');
  t.mock.method(geminiService, 'reply', async () => { throw new Error('should not be called'); });

  const result = await getReply('hi');
  assert.equal(result, 'groq reply');
});
