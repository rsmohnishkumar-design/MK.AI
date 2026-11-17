# Nova Gateway (Cloudflare Worker)

Keeps the AI service keys on a server, checks that each request comes from a
signed-in Nova AI user, and enforces usage limits on the server. Built for
Cloudflare Workers' free plan (no card needed for the free plan; check current limits).

Tested: `node gateway/test/worker.test.mjs` (14 tests: token checks, CORS, key never
returned, fallback, per-minute and daily limits, research sources, size limits).

## Set up (owner only — needs your Cloudflare account)

1. Make a Cloudflare account and install Wrangler on a computer: `npm i -g wrangler`, then `wrangler login`.
2. `cd gateway` and create the usage store: `wrangler kv namespace create QUOTA`. Put the printed id in `wrangler.toml`.
3. Make NEW keys in each AI service (the old ones were readable by users and must be replaced), then add them:
   `wrangler secret put GEMINI_KEY` (and GROQ_KEY, CEREBRAS_KEY, OPENROUTER_KEY, GITHUB_KEY as you have them).
4. `wrangler deploy`. Note the URL (like `https://nova-gateway.<you>.workers.dev`).
5. Put that URL in `firebase-config.js` → `GATEWAY_URL`, then make Nova AI live.
6. In the vault, delete the old keys from the AI settings, and revoke them in each service.

## Endpoints (all POST, `Authorization: Bearer <Firebase ID token>`)

- `/v1/chat` `{ messages }` → OpenAI-style streaming answer (header `x-nova-model` says which model).
- `/v1/research` `{ question }` → `{ text, sources: [{ title, url }] }` (Gemini + Google Search).
- `/v1/image` `{ prompt }` → `{ dataUrl }` (Gemini image model).
- `/v1/health` → which services have keys (no secrets).

Limits are in `src/worker.js` (`LIMITS`). Logs contain only a short user id prefix, route, status and model — never questions, answers or keys.
