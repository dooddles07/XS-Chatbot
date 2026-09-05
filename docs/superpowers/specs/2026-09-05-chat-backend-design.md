# XS Chat Backend — Design Spec

## Goal

Replace fake canned-reply chat widget with real LLM backend (Groq primary,
Gemini fallback), rate-limited, deployed live at zero cost.

## Current state

Repo root: static site only.
- `index.html` — landing page, includes `#askCard`/`#chatLog`/`#chatForm` widget
- `app.js:16-23` — hardcoded `replies` array
- `app.js:43-58` — `ask()` cycles canned replies after 900ms setTimeout, no network call
- `styles.css`, `assets/xs-bg.mp4`, `assets/xs-bg-poster.jpg`
- GSAP 3.13.0 + ScrollTrigger via CDN `<script>` in `index.html`
- No package.json, no backend, no env config, no deploy config, no README
- Git remote exists, `main` pushed

## Decisions

- Backend: Node.js + Express
- Hosting: Vercel serverless functions (frontend + backend, one deploy)
- Persistence: none — stateless single-turn proxy, no DB, no accounts
- LLM: Groq primary; on Groq throw/rate-limit, fall back to Gemini
- Rate limiting: Upstash Redis free tier (serverless has no reliable
  in-memory state across invocations/cold starts)
- Zero cost: Vercel Hobby, free Groq key, free Gemini key, Upstash free tier

## Folder structure

Use Vercel's `public/` static-root convention instead of a custom
`frontend/` + `vercel.json`. Vercel's zero-config static deploy serves the
whole repo root except `/api`; anything not meant to be public (backend
source) must live outside `public/`. Moving the current frontend files into
`public/` as-is preserves their root-relative paths
(`href="styles.css"`, `src="assets/xs-bg.mp4"`) — no code changes, no risk
to the GSAP scroll setup.

```
XS Chatbot v2/
├── public/
│   ├── index.html
│   ├── app.js                     # ask() rewritten to call /api/chat
│   ├── styles.css
│   └── assets/
│       ├── xs-bg.mp4
│       └── xs-bg-poster.jpg
├── api/
│   └── chat.js                    # re-exports backend/app.js for Vercel
├── backend/
│   ├── app.js                     # Express instance + one route
│   ├── controllers/
│   │   └── chat.controller.js
│   ├── services/
│   │   ├── llm.service.js         # Groq -> Gemini fallback
│   │   ├── groq.service.js
│   │   └── gemini.service.js
│   ├── middleware/
│   │   ├── rateLimit.middleware.js
│   │   └── error.middleware.js
│   └── config/
│       └── env.js                 # validates 4 env vars at startup
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

No `models/` directory — nothing persisted, nothing to model. Add one only
if real persistence (history/accounts) is later requested.

Routing note: Vercel's Node runtime accepts an exported Express app from a
file under `/api`, but whether it presents `req.url` as `/api/chat` or `/`
is inconsistent across setups. With exactly one route, match by method only
(`app.post('*', ...)`) instead of path, to sidestep the ambiguity.

## API contract

`POST /api/chat`
- Request: `{ "message": string }` — single-turn, no history threading (UI
  doesn't accumulate one either)
- Success: `200 { "reply": string }`
- Errors:
  - `400 { "error": "invalid_request" }` — empty/missing message (validated
    in controller, trust boundary)
  - `429 { "error": "rate_limited", "retryAfter": <seconds> }`
  - `502 { "error": "llm_unavailable" }` — both providers failed
  - `500 { "error": "server_error" }` — uncaught, never leak stack traces

## Fallback logic

```js
async function getReply(message) {
  try { return await groqService.reply(message); }
  catch (err) {
    console.warn('groq failed, falling back to gemini:', err.message);
    return await geminiService.reply(message);
  }
}
```
Controller catches a final throw → 502.

## Rate limiting

`@upstash/ratelimit` + `@upstash/redis`, `Ratelimit.slidingWindow(10, "60 s")`,
identifier from `x-forwarded-for` header (Vercel sets reliably). Runs before
controller so limited requests never touch LLM quota.

## Env vars

`GROQ_API_KEY`, `GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`. `backend/config/env.js` validates all four at
startup, throws if any missing. Local dev: `.env.local` (gitignored),
loaded natively by `vercel dev` — no `dotenv` dependency. Production: same
four set in Vercel Project Settings (or auto-injected via Upstash Vercel
Marketplace integration).

## Dependencies

`express`, `groq-sdk`, `@google/generative-ai`, `@upstash/ratelimit`,
`@upstash/redis`. Dev: `vercel` CLI. Test: Node's built-in `node --test`,
no external test framework.

## Testing

One test worth writing: `backend/services/llm.service.test.js` — mock both
provider services, assert (a) Gemini is called when Groq throws, (b) error
propagates when both throw. Only non-trivial branch in the backend.

Manual end-to-end checklist before calling it done:
1. Real chat message on live URL → genuine (non-canned) reply
2. >10 messages within 60s → 11th gets 429
3. Break `GROQ_API_KEY` temporarily → confirm Gemini fallback answers
4. Full page scroll → hero, background-film scrub, manifesto reveal still animate

## Go-live steps (zero cost)

1. Groq key — console.groq.com
2. Gemini key — aistudio.google.com (free tier)
3. Upstash Redis — console.upstash.com free DB, or via Vercel Marketplace
   integration (auto-injects env vars)
4. Vercel project — import pushed GitHub repo, framework preset "Other",
   zero-config (no build command/output dir override needed)
5. Set all 4 env vars in Vercel Project Settings (Production + Preview + Dev)
6. Push to `main` — repo-linked Vercel project auto-deploys, no GitHub
   Actions needed
