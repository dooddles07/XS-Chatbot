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
