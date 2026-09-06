<div align="center">

# XS

**Intelligence, with a point of view.**

A chatbot landing page backed by a real LLM — not a scripted demo.

[![Live](https://img.shields.io/badge/live-xs--chatbot.vercel.app-black?style=flat-square)](https://xs-chatbot.vercel.app/)
[![Node](https://img.shields.io/badge/node-24.x-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Deployed on Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[**Live Demo**](https://xs-chatbot.vercel.app/) · [Architecture](#architecture) · [Running Locally](#running-it-locally) · [Deploying](#deploying)

</div>

---

## Overview

XS is a personal project built to explore a question: what does a product page look like when the "talk to us" widget isn't fake?

Most landing-page chat demos are a `setTimeout` and a hardcoded array. XS routes every message through a real backend to Groq, with an automatic fallback to Gemini if the primary model is unavailable — the same failover pattern a production AI feature would need, built at zero hosting cost.

## Features

- **Scroll-choreographed frontend** — a hero sequence and a background film scrubbed by scroll position (GSAP + ScrollTrigger), no framework, no build step
- **A chat widget that actually thinks** — "Ask XS" hits a real LLM, not a canned-reply loop
- **Automatic provider failover** — Groq first; if it errors or rate-limits, Gemini answers instead, transparently
- **Abuse-resistant by default** — per-visitor sliding-window rate limiting (Upstash Redis) protects the free API quota from bursts
- **Zero infrastructure cost** — one Vercel project serves the static site and the API together; every dependency (Groq, Gemini, Upstash) runs on a free tier

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | HTML / CSS / vanilla JS, GSAP for scroll animation |
| Backend | Node.js + Express, MVC-style layering |
| Primary LLM | Groq — `llama-3.1-8b-instant` |
| Fallback LLM | Google Gemini — `gemini-3.8-flash` (Interactions API) |
| Rate limiting | Upstash Redis, sliding window |
| Hosting | Vercel — static frontend + serverless function, single deploy |

## Architecture

Frontend and backend share one domain — static files from `public/`, the API from a single serverless function at `api/chat.js` — so there's no CORS, no separate backend host, nothing extra to run.

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

**`POST /api/chat`**

```jsonc
// request
{ "message": "What can XS do?" }

// success
{ "reply": "..." }

// error
{ "error": "invalid_request" | "rate_limited" | "llm_unavailable" | "server_error" }
```

## Running it Locally

```bash
npm install
cp .env.example .env.local   # fill in the four values below
vercel dev                   # serves public/ and /api together
```

## Environment Variables

Get each of these free, then drop them into `.env.local`:

| Variable | Where to get it |
|---|---|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys |
| `GEMINI_API_KEY` | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) — free tier |
| `UPSTASH_REDIS_REST_URL` | [console.upstash.com](https://console.upstash.com) → create a free Redis database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | same database, REST API section |

## Deploying

1. Push to GitHub.
2. On [vercel.com](https://vercel.com) → New Project → import the repo → framework preset **Other** (zero-config).
3. Project Settings → Environment Variables → add all four keys above for **Production**, **Preview**, and **Development**.
4. Push to `main` — Vercel deploys automatically.

## Testing

```bash
npm test   # Groq → Gemini fallback logic, 3 tests
```

**Manual go-live checklist:**

- [ ] Send a real chat message on the live URL — confirm a real (non-canned) reply
- [ ] Send 11 messages within 60 seconds — confirm the 11th is rate-limited
- [ ] Temporarily break `GROQ_API_KEY` in Vercel, redeploy — confirm Gemini answers instead; restore the key, redeploy
- [ ] Scroll the full page — confirm the hero, background film, and manifesto reveal all still animate

## License

MIT © [Brixsonn](https://github.com/dooddles07)
