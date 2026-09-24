// Free AI services MK.ai can use with a key the admin saves in the vault.
// All speak the same OpenAI-style chat API, so one client handles them all.
// Each service's model list is checked once per session, and the preferred
// models it actually offers are used in order (for OpenRouter, only free ones).

export const PROVIDERS = [
  {
    id: "groq",
    name: "Groq",
    signup: "console.groq.com → API Keys → Create API Key",
    chatUrl: "https://api.groq.com/openai/v1/chat/completions",
    modelsUrl: "https://api.groq.com/openai/v1/models",
    prefer: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b", "llama-3.1-8b-instant"],
    searchModels: ["groq/compound-mini"],
    extraBody: (model) => (model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
  },
  {
    id: "cerebras",
    name: "Cerebras",
    signup: "cloud.cerebras.ai → API Keys",
    chatUrl: "https://api.cerebras.ai/v1/chat/completions",
    modelsUrl: "https://api.cerebras.ai/v1/models",
    prefer: ["gpt-oss-120b", "llama-3.3-70b", "qwen-3-32b", "llama3.1-8b"],
    extraBody: (model) => (model.startsWith("gpt-oss") ? { reasoning_effort: "low" } : {}),
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    signup: "openrouter.ai → Sign in (GitHub works) → Keys → Create Key",
    chatUrl: "https://openrouter.ai/api/v1/chat/completions",
    modelsUrl: "https://openrouter.ai/api/v1/models",
    freeOnly: true, // only models that cost nothing (their ids end in ":free")
    prefer: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "deepseek/deepseek-chat-v3-0324:free",
      "google/gemma-3-27b-it:free",
      "qwen/qwen3-235b-a22b:free",
      "mistralai/mistral-small-3.2-24b-instruct:free",
    ],
    extraHeaders: { "X-Title": "MK.ai" },
  },
  {
    id: "github",
    name: "GitHub Models",
    signup: "github.com/settings/personal-access-tokens/new → Permissions → Models: Read-only → Generate",
    chatUrl: "https://models.github.ai/inference/chat/completions",
    modelsUrl: "https://models.github.ai/catalog/models",
    prefer: ["openai/gpt-4.1-mini", "openai/gpt-4o-mini", "meta/llama-3.3-70b-instruct", "openai/gpt-4.1-nano"],
  },
];

export const providerById = (id) => PROVIDERS.find((p) => p.id === id);

// Settings field that holds each provider's key (Firestore settings/ai).
export const keyField = (provider) => `${provider.id}Key`;

function httpError(status, message) {
  const err = new Error(message || `HTTP ${status}`);
  err.customErrorData = { status };
  return err;
}

async function errorMessage(res) {
  try {
    const body = await res.json();
    return body?.error?.message || body?.message || JSON.stringify(body).slice(0, 200);
  } catch {
    return res.statusText || "";
  }
}

// Lists the model ids a key can use. Throws with the service's own message
// when the key is wrong, so the vault can say so before saving it.
export async function listModels(provider, key) {
  const res = await fetch(provider.modelsUrl, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw httpError(res.status, `${provider.name}: [${res.status}] ${await errorMessage(res)}`);
  const body = await res.json();
  const items = Array.isArray(body) ? body : body.data || [];
  return items
    .filter((m) => {
      if (!provider.freeOnly) return true;
      const p = m.pricing;
      return m.id?.endsWith(":free") || (p && Number(p.prompt) === 0 && Number(p.completion) === 0);
    })
    .map((m) => m.id)
    .filter(Boolean);
}

// Preferred models first, then (if none of those exist) a few likely chat models.
export function chooseModels(provider, available) {
  if (!available?.length) return provider.prefer;
  const set = new Set(available);
  const preferred = provider.prefer.filter((m) => set.has(m));
  if (preferred.length) return preferred;
  return available
    .filter((id) => /llama|gpt|qwen|deepseek|gemma|mistral|phi/i.test(id) && !/guard|embed|whisper|tts|vision|audio|image/i.test(id))
    .slice(0, 4);
}

// Streams one chat answer. onText(rawTextSoFar) is called as it arrives.
// Resolves { text, complete }: complete is false when the answer stopped early.
// timeoutMs limits the wait for the answer to start, and any pause after that,
// so long answers (like code) can take as long as they need.
export async function streamChat(provider, key, model, messages, onText, timeoutMs) {
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), timeoutMs);
  const stillAlive = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), timeoutMs);
  };
  try {
    const res = await fetch(provider.chatUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(provider.extraHeaders || {}),
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.6,
        max_tokens: 4096,
        ...(provider.extraBody ? provider.extraBody(model) : {}),
      }),
    });
    if (!res.ok) throw httpError(res.status, `${provider.name} ${model}: [${res.status}] ${await errorMessage(res)}`);

    // Server-sent events: lines of "data: {json}", ending with "data: [DONE]".
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let finish = null;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      stillAlive();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let event;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }
        if (event.error) throw httpError(500, `${provider.name} ${model}: ${event.error.message || "stream error"}`);
        finish = event.choices?.[0]?.finish_reason || finish;
        const piece = event.choices?.[0]?.delta?.content || "";
        if (piece) {
          text += piece;
          onText(text);
        }
      }
    }
    return { text, complete: finish === "stop" || finish === null };
  } catch (err) {
    if (err.name === "AbortError") {
      throw httpError(504, `${provider.name} ${model}: timeout — no reply for ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// One short non-streaming request, for the check page.
export async function quickChat(provider, key, model) {
  const res = await fetch(provider.chatUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(provider.extraHeaders || {}) },
    body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with just: OK" }], max_tokens: 20 }),
  });
  if (!res.ok) throw httpError(res.status, `[${res.status}] ${await errorMessage(res)}`);
  const body = await res.json();
  return (body.choices?.[0]?.message?.content || "").trim();
}
