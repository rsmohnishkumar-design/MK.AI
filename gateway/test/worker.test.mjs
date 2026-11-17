// Tests for the Nova Gateway, run with plain Node 20+ (no packages): node gateway/test/worker.test.mjs
// Google's keys, Firestore and the AI services are all faked, so nothing leaves this computer.
import worker, { verifyIdToken, takeQuota, cleanMessages, LIMITS, _resetKeyCache } from "../src/worker.js";

const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (e) {
    results.push(["FAIL", `${name} — ${e.message}`]);
  }
};
const assert = (c, m) => {
  if (!c) throw new Error(m || "assertion failed");
};

// --- a fake Google signing key and token maker ---
const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pub = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "test-kid", use: "sig" };
const b64u = (bytes) => Buffer.from(bytes).toString("base64url");
async function token(claims, { kid = "test-kid", key = pair.privateKey } = {}) {
  const h = b64u(JSON.stringify({ alg: "RS256", kid, typ: "JWT" }));
  const p = b64u(JSON.stringify(claims));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64u(new Uint8Array(sig))}`;
}
const now = Math.floor(Date.now() / 1000);
const good = (sub = "user123", extra = {}) => ({ iss: "https://securetoken.google.com/mkai-c042b", aud: "mkai-c042b", sub, iat: now - 10, exp: now + 3600, email: `${sub}@test.com`, ...extra });

// --- fakes ---
function kv() {
  const m = new Map();
  return { get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => void m.set(k, v), _m: m };
}
const calls = [];
function fakeFetch({ tier = "trial", providerStatus = {} } = {}) {
  return async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("securetoken@system")) return new Response(JSON.stringify({ keys: [pub] }), { headers: { "cache-control": "max-age=3600" } });
    if (String(url).includes("firestore.googleapis.com")) return new Response(JSON.stringify({ fields: { tier: { stringValue: tier } } }));
    if (String(url).includes("google_search") || (init.body && String(init.body).includes("google_search")))
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Chennai is the capital of Tamil Nadu." }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://en.wikipedia.org/wiki/Chennai", title: "Chennai - Wikipedia" } }] } }] }));
    for (const [id, status] of Object.entries(providerStatus)) if (String(url).includes(id)) return new Response("{}", { status });
    if (String(url).includes("/chat/completions")) {
      const sse = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" there"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
      return new Response(sse, { headers: { "content-type": "text/event-stream" } });
    }
    return new Response("not found", { status: 404 });
  };
}
const env = (over = {}) => ({ FIREBASE_PROJECT: "mkai-c042b", ALLOWED_ORIGINS: "https://mkai-c042b.web.app", QUOTA: kv(), GROQ_KEY: "secret-groq", GEMINI_KEY: "secret-gemini", ...over });
const req = (path, body, { tok, origin = "https://mkai-c042b.web.app", method = "POST" } = {}) =>
  new Request(`https://gw.test${path}`, { method, headers: { Origin: origin, "content-type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: method === "POST" ? JSON.stringify(body) : undefined });
const ctx = { waitUntil: (p) => p };

// --- token checks ---
await check("accepts a valid Firebase token", async () => {
  const u = await verifyIdToken(await token(good()), "mkai-c042b", fakeFetch());
  assert(u.uid === "user123");
});
await check("rejects a token for another project", async () => {
  let threw = false;
  try { await verifyIdToken(await token(good("x", { aud: "other" })), "mkai-c042b", fakeFetch()); } catch { threw = true; }
  assert(threw);
});
await check("rejects an expired token", async () => {
  let threw = false;
  try { await verifyIdToken(await token(good("x", { exp: now - 3600 })), "mkai-c042b", fakeFetch()); } catch { threw = true; }
  assert(threw);
});
await check("rejects a token signed with a different key", async () => {
  const other = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  let threw = false;
  try { await verifyIdToken(await token(good(), { key: other.privateKey }), "mkai-c042b", fakeFetch()); } catch { threw = true; }
  assert(threw);
});

// --- the Worker end to end ---
await check("refuses requests without sign-in (401)", async () => {
  const r = await worker.fetch(req("/v1/chat", { messages: [{ role: "user", content: "hi" }] }), env(), ctx, fakeFetch());
  assert(r.status === 401, `got ${r.status}`);
});
await check("refuses other websites (CORS 403)", async () => {
  const r = await worker.fetch(req("/v1/chat", {}, { tok: await token(good()), origin: "https://evil.example" }), env(), ctx, fakeFetch());
  assert(r.status === 403, `got ${r.status}`);
});
await check("streams a chat answer and never returns the key", async () => {
  calls.length = 0;
  const r = await worker.fetch(req("/v1/chat", { messages: [{ role: "user", content: "hi" }] }, { tok: await token(good()) }), env(), ctx, fakeFetch());
  const text = await r.text();
  assert(r.status === 200 && text.includes("Hello") && text.includes("there"), `status ${r.status}`);
  assert(!text.includes("secret-groq") && !JSON.stringify([...r.headers]).includes("secret-groq"), "key leaked");
  const provider = calls.find((c) => c.url.includes("groq"));
  assert(provider && provider.init.headers.Authorization === "Bearer secret-groq", "key not used server-side");
});
await check("falls back to the next service when one is down", async () => {
  calls.length = 0;
  const r = await worker.fetch(req("/v1/chat", { messages: [{ role: "user", content: "hi" }] }, { tok: await token(good("fb")) }), env(), ctx, fakeFetch({ providerStatus: { "api.groq.com": 503 } }));
  assert(r.status === 200, `got ${r.status}`);
  assert(r.headers.get("x-nova-model").startsWith("gemini"), r.headers.get("x-nova-model"));
});
await check("blocks accounts without access (403)", async () => {
  const r = await worker.fetch(req("/v1/chat", { messages: [{ role: "user", content: "hi" }] }, { tok: await token(good("nobody")) }), env(), ctx, fakeFetch({ tier: "none" }));
  assert(r.status === 403, `got ${r.status}`);
});
await check("enforces the per-minute limit on the server (429)", async () => {
  const e = env();
  const t = await token(good("busy"));
  let last;
  for (let i = 0; i <= LIMITS.trial.perMinute; i++) last = await worker.fetch(req("/v1/chat", { messages: [{ role: "user", content: "hi" }] }, { tok: t }), e, ctx, fakeFetch());
  assert(last.status === 429, `got ${last.status}`);
});
await check("enforces the daily limit on the server", async () => {
  const e = env();
  await e.QUOTA.put(`use:daily:${new Date().toISOString().slice(0, 10)}`, JSON.stringify({ requests: LIMITS.trial.perDay, tokens: 0 }));
  const q = await takeQuota(e, "daily", "trial");
  assert(!q.ok && q.status === 429);
});
await check("research returns sources", async () => {
  const r = await worker.fetch(req("/v1/research", { question: "capital of Tamil Nadu" }, { tok: await token(good("r")) }), env(), ctx, fakeFetch());
  const b = await r.json();
  assert(r.status === 200 && b.sources.length === 1 && b.sources[0].url.includes("wikipedia"), JSON.stringify(b));
});
await check("rejects badly formed messages", async () => {
  let threw = false;
  try { cleanMessages([{ role: "hacker", content: "x" }]); } catch { threw = true; }
  assert(threw);
});
await check("rejects oversized requests (413)", async () => {
  const big = "x".repeat(250000);
  const r = await worker.fetch(req("/v1/chat", { messages: [{ role: "user", content: big }] }, { tok: await token(good("big")) }), env(), ctx, fakeFetch());
  assert(r.status === 413, `got ${r.status}`);
});

_resetKeyCache();
for (const [r, n] of results) console.log(r, n);
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
