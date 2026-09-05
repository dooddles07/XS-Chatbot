# XS Chat Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake canned-reply chat widget with a real Groq/Gemini-backed chat API, deployed live on Vercel at zero cost.

**Architecture:** Node/Express backend in `backend/` (Routes → Controllers → Services, no `models/` — nothing persisted), exposed to Vercel as a single serverless function at `api/chat.js`. Frontend static files move unchanged into `public/` so Vercel's zero-config static deploy serves them alongside `/api`.

**Tech Stack:** Node.js, Express, groq-sdk, @google/generative-ai, @upstash/ratelimit, @upstash/redis, Vercel (hosting + serverless functions), Node's built-in `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-05-chat-backend-design.md`

## Global Constraints

- Zero cost only: Vercel Hobby tier, free Groq key, free Gemini key, Upstash free tier — no paid add-ons.
- Stateless backend — no database, no accounts, no saved history. Single-turn requests only.
- Backend folder layout is Routes(`api/`) → Controllers → Services → Middleware/Config; no `models/` directory.
- All 4 env vars (`GROQ_API_KEY`, `GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) validated at startup in `backend/config/env.js`, fail fast if missing.
- No `dotenv`, no `cors`, no extra test framework — `vercel dev` loads `.env.local` natively; frontend and API are same-origin; `node --test` covers the one non-trivial branch.
- `backend/app.js` matches requests by method only (`app.post('*', ...)`), not by path, to sidestep Vercel's inconsistent `req.url` rewriting for functions under `/api`.

---

### Task 1: Move frontend into `public/`

**Files:**
- Move: `index.html` → `public/index.html`
- Move: `app.js` → `public/app.js`
- Move: `styles.css` → `public/styles.css`
- Move: `assets/` → `public/assets/`

**Interfaces:** None — pure file move, no code changes. `index.html`, `app.js`, `styles.css` all reference each other and `assets/xs-bg.mp4`/`assets/xs-bg-poster.jpg` with root-relative paths, which keep working identically inside `public/`.

- [ ] **Step 1: Move the files**

```bash
mkdir public
git mv index.html public/index.html
git mv app.js public/app.js
git mv styles.css public/styles.css
git mv assets public/assets
```

- [ ] **Step 2: Verify the site still serves correctly**

Run: `cd public && python -m http.server 5599`
Open `http://localhost:5599` in a browser.
Expected: page loads exactly as before — hero intro plays, background video scrubs on scroll, manifesto word-reveal works, chat widget still shows canned replies (not rewired yet, that's Task 6).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: move frontend into public/ for Vercel static deploy"
```

---

### Task 2: Project scaffold — package.json, env validation, gitignore

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `backend/config/env.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `backend/config/env.js` exports `{ GROQ_API_KEY, GEMINI_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN }` (all strings), throws `Error('Missing required env var: <NAME>')` at require-time if any is unset.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "xs-chatbot",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "dev": "vercel dev",
    "test": "node --test backend/services"
  },
  "dependencies": {
    "express": "^4.19.2",
    "groq-sdk": "^0.7.0",
    "@google/generative-ai": "^0.21.0",
    "@upstash/ratelimit": "^2.0.3",
    "@upstash/redis": "^1.34.0"
  },
  "devDependencies": {
    "vercel": "^37.4.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 3: Create `backend/config/env.js`**

```js
const REQUIRED = [
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN'
];

REQUIRED.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
});

module.exports = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN
};
```

- [ ] **Step 4: Create `.env.example`**

```
GROQ_API_KEY=
GEMINI_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- [ ] **Step 5: Update `.gitignore`**

```
.claude/
node_modules/
.env.local
.vercel
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json backend/config/env.js .env.example .gitignore
git commit -m "chore: scaffold package.json and env validation"
```

---

### Task 3: Groq and Gemini service wrappers

**Files:**
- Create: `backend/services/groq.service.js`
- Create: `backend/services/gemini.service.js`

**Interfaces:**
- Consumes: `backend/config/env.js` → `GROQ_API_KEY`, `GEMINI_API_KEY`
- Produces: `groq.service.js` exports `{ reply(message: string): Promise<string> }`. `gemini.service.js` exports the identical shape `{ reply(message: string): Promise<string> }`. Both throw on API failure — callers handle that.

- [ ] **Step 1: Create `backend/services/groq.service.js`**

```js
const Groq = require('groq-sdk');
const { GROQ_API_KEY } = require('../config/env');

const client = new Groq({ apiKey: GROQ_API_KEY });

async function reply(message) {
  const completion = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      {
        role: 'system',
        content: 'You are XS, a sharp, concise strategic thinking partner. Keep replies under 3 sentences.'
      },
      { role: 'user', content: message }
    ]
  });
  return completion.choices[0].message.content;
}

module.exports = { reply };
```

- [ ] **Step 2: Create `backend/services/gemini.service.js`**

```js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_API_KEY } = require('../config/env');

const client = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function reply(message) {
  const result = await model.generateContent(message);
  return result.response.text();
}

module.exports = { reply };
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/groq.service.js backend/services/gemini.service.js
git commit -m "feat: add Groq and Gemini service wrappers"
```

---

### Task 4: LLM fallback orchestration (TDD)

**Files:**
- Create: `backend/services/llm.service.js`
- Test: `backend/services/llm.service.test.js`

**Interfaces:**
- Consumes: `groqService.reply(message)`, `geminiService.reply(message)` from Task 3
- Produces: `llm.service.js` exports `{ getReply(message: string): Promise<string> }` — tries Groq first, falls back to Gemini if Groq throws, propagates the error if both throw.

- [ ] **Step 1: Write the failing test**

```js
// backend/services/llm.service.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `llm.service.js` does not exist yet (`Cannot find module './llm.service'`).

- [ ] **Step 3: Write minimal implementation**

```js
// backend/services/llm.service.js
const groqService = require('./groq.service');
const geminiService = require('./gemini.service');

async function getReply(message) {
  try {
    return await groqService.reply(message);
  } catch (err) {
    console.warn('groq failed, falling back to gemini:', err.message);
    return await geminiService.reply(message);
  }
}

module.exports = { getReply };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add backend/services/llm.service.js backend/services/llm.service.test.js
git commit -m "feat: add Groq-to-Gemini fallback with tests"
```

---

### Task 5: Wire controller, middleware, Express app, Vercel entrypoint

**Files:**
- Create: `backend/controllers/chat.controller.js`
- Create: `backend/middleware/rateLimit.middleware.js`
- Create: `backend/middleware/error.middleware.js`
- Create: `backend/app.js`
- Create: `api/chat.js`

**Interfaces:**
- Consumes: `llm.service.js` → `getReply(message)`; `backend/config/env.js` → Upstash creds
- Produces: `backend/app.js` exports a ready-to-use Express `app`; `api/chat.js` is the Vercel function entrypoint.

- [ ] **Step 1: Create `backend/controllers/chat.controller.js`**

```js
const { getReply } = require('../services/llm.service');

async function handleChat(req, res) {
  const message = req.body && req.body.message;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  try {
    const reply = await getReply(message.trim());
    res.status(200).json({ reply });
  } catch (err) {
    console.error('llm_unavailable:', err.message);
    res.status(502).json({ error: 'llm_unavailable' });
  }
}

module.exports = { handleChat };
```

- [ ] **Step 2: Create `backend/middleware/rateLimit.middleware.js`**

```js
const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');
const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = require('../config/env');

const ratelimit = new Ratelimit({
  redis: new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN }),
  limiter: Ratelimit.slidingWindow(10, '60 s')
});

async function rateLimit(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
  const { success, reset } = await ratelimit.limit(ip);
  if (!success) {
    return res.status(429).json({
      error: 'rate_limited',
      retryAfter: Math.ceil((reset - Date.now()) / 1000)
    });
  }
  next();
}

module.exports = rateLimit;
```

- [ ] **Step 3: Create `backend/middleware/error.middleware.js`**

```js
function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).json({ error: 'server_error' });
}

module.exports = errorHandler;
```

- [ ] **Step 4: Create `backend/app.js`**

```js
require('./config/env');
const express = require('express');
const rateLimit = require('./middleware/rateLimit.middleware');
const { handleChat } = require('./controllers/chat.controller');
const errorHandler = require('./middleware/error.middleware');

const app = express();
app.use(express.json());
app.post('*', rateLimit, handleChat);
app.use(errorHandler);

module.exports = app;
```

- [ ] **Step 5: Create `api/chat.js`**

```js
module.exports = require('../backend/app');
```

- [ ] **Step 6: Local end-to-end verification**

Copy `.env.example` to `.env.local` and fill in real free-tier keys (Groq, Gemini, Upstash — see Task 7 go-live steps for where to get them).

Run: `npm run dev`

In another terminal:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What can XS do?"}'
```
Expected: `200` with `{"reply": "<real LLM text>"}`.

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":""}'
```
Expected: `400 {"error":"invalid_request"}`.

- [ ] **Step 7: Commit**

```bash
git add backend/controllers backend/middleware backend/app.js api/chat.js
git commit -m "feat: wire chat controller, rate limiting, and Vercel entrypoint"
```

---

### Task 6: Rewire frontend to call the real API

**Files:**
- Modify: `public/app.js:16-23` (delete), `public/app.js:43-58` (rewrite)

**Interfaces:**
- Consumes: `POST /api/chat` → `{ message: string }` request, `{ reply: string }` / `{ error: string, retryAfter?: number }` response (from Task 5)

- [ ] **Step 1: Delete the canned replies array**

In `public/app.js`, delete lines 16-23:
```js
  var replies = [
    "Good start. What outcome would make this obviously worth it?",
    "Say the version you're afraid to say. That's usually the real brief.",
    "Strip it to one sentence. If it survives, we build it.",
    "Here's the sharper question: what happens if you do nothing?",
    "Name the constraint. Constraints are where the interesting shape comes from."
  ];
  var replyIndex = 0;
```

- [ ] **Step 2: Rewrite `ask()` (was lines 43-58) to call the real API**

```js
  function ask(text) {
    if (!text.trim()) return;
    bubble(text.trim(), 'me');

    var typing = document.createElement('div');
    typing.className = 'msg msg--bot';
    typing.innerHTML = '<p><span class="dots"><i></i><i></i><i></i></span></p>';
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text.trim() })
    })
      .then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      })
      .then(function (result) {
        typing.remove();
        if (result.ok) {
          bubble(result.data.reply, 'bot');
        } else if (result.status === 429) {
          bubble("Slow down a second.", 'bot');
        } else {
          bubble("XS is having a moment — try again.", 'bot');
        }
      })
      .catch(function () {
        typing.remove();
        bubble("XS is having a moment — try again.", 'bot');
      });
  }
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`
Open `http://localhost:3000`, scroll to "Ask XS", send a message.
Expected: typing dots show, then a real (non-canned) LLM reply appears. Click a suggestion chip too — same real-reply behavior.

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat: replace canned chat replies with real LLM API calls"
```

---

### Task 7: README and go-live

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```md
# XS Chatbot

Static landing page with a real Groq/Gemini-backed chat widget, deployed on Vercel at zero cost.

## Local development

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the four values (see below).
3. `npm run dev` — serves `public/` and `/api` together via `vercel dev`.

## Getting free API keys

- **Groq:** console.groq.com → API Keys → create key → `GROQ_API_KEY`
- **Gemini:** aistudio.google.com/app/apikey → create key (free tier) → `GEMINI_API_KEY`
- **Upstash Redis:** console.upstash.com → create free Redis database → REST URL/token → `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`

## Deploying

1. Push this repo to GitHub (already done).
2. vercel.com → New Project → import the repo → framework preset "Other" (zero-config).
3. Project Settings → Environment Variables → add all four keys above for Production, Preview, and Development.
4. Push to `main` — Vercel auto-deploys.

## Testing

`npm test` runs the Groq→Gemini fallback tests.

Manual production checklist:
- Send a real chat message on the live URL, confirm a real reply.
- Send 11 messages within 60 seconds, confirm the 11th is rate-limited.
- Temporarily break `GROQ_API_KEY` in Vercel, redeploy, confirm Gemini fallback answers; restore the key, redeploy.
- Scroll the full page, confirm animations still play.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and go-live steps"
```

---

## Post-plan: go-live (manual, outside this repo)

1. Create free Groq API key at console.groq.com
2. Create free Gemini API key at aistudio.google.com
3. Create free Upstash Redis database at console.upstash.com
4. Import repo into a new Vercel project (framework preset "Other")
5. Add all 4 env vars in Vercel Project Settings for Production + Preview + Development
6. Push to `main` — Vercel deploys automatically
7. Run the production verification checklist from `README.md`
