# XS

**Intelligence, with a point of view.**

XS is a scroll-driven landing page for an AI chatbot, backed by a real LLM instead of a scripted demo. Built as a personal project — animated frontend, a small Node/Express API, and a zero-cost hosting setup with automatic failover between two LLM providers.

🔗 **Live:** [xs-chatbot.vercel.app](https://xs-chatbot.vercel.app/)

## What it does

- Scroll-choreographed hero with a scrubbed background video (GSAP + ScrollTrigger)
- A working chat widget ("Ask XS") that talks to a real LLM — not canned replies
- If the primary model is down or rate-limited, it silently falls back to a second provider instead of erroring out
- Per-visitor rate limiting so a burst of traffic can't drain the free API quota

## How it's built

| Layer | Choice |
|---|---|
| Frontend | Plain HTML/CSS/JS, GSAP for scroll animation — no framework, no build step |
| Backend | Node.js + Express, MVC-style (`controllers/` → `services/` → `middleware/`) |
| Primary LLM | Groq (`llama-3.1-8b-instant`) |
| Fallback LLM | Google Gemini (`gemini-3.8-flash`, Interactions API) |
| Rate limiting | Upstash Redis (sliding window, per IP) |
| Hosting | Vercel — static frontend + serverless API, one deploy, zero cost |

Frontend and backend are served from the same domain (`public/` for static files, `api/` for the one serverless function), so there's no CORS, no separate backend host, and no infrastructure to manage.

## Architecture

```
public/          → static site (index.html, app.js, styles.css, assets)
api/chat.js      → Vercel serverless entrypoint
backend/
  app.js         → Express app
  controllers/   → request validation, response shaping
  services/      → Groq + Gemini clients, fallback orchestration
  middleware/    → rate limiting, error handling
  config/        → env var validation
```

`POST /api/chat` takes `{ "message": string }` and returns `{ "reply": string }`, or a typed error (`invalid_request`, `rate_limited`, `llm_unavailable`, `server_error`).

## Running it locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the four values (see below).
3. `vercel dev` — serves `public/` and `/api` together.

## Getting free API keys

- **Groq:** console.groq.com → API Keys → create key → `GROQ_API_KEY`
- **Gemini:** aistudio.google.com/app/apikey → create key (free tier) → `GEMINI_API_KEY`
- **Upstash Redis:** console.upstash.com → create free Redis database → REST URL/token → `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`

## Deploying

1. Push to GitHub.
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
