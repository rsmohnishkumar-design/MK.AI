import { getGenerativeModel } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { ai, db } from "./firebase.js";
import { GEMINI_MODELS, GROQ_MODELS, GROQ_SEARCH_MODELS } from "../firebase-config.js";

// Answers come from Groq first (free, no card, large daily limits) when the
// admin has saved a Groq API key in the vault, then from Gemini through
// Firebase as a backup. Every option that fails for quota, overload, timeout
// or retirement is skipped for a while, so questions don't waste requests.

const BASE_PROMPT = `You are MK.ai, a helpful, knowledgeable AI assistant.
Answer the user's question directly and clearly, like a knowledgeable friend.
Give only the answer: never mention your sources, search results, websites or citations, and never write reference numbers like [1].
Write in plain text: short paragraphs, and "- " bullet lists when they help. Do not use markdown headings, tables or bold.
Reply in the same language the user writes in.`;
const SEARCH_PROMPT = `${BASE_PROMPT}
Search the web whenever the question needs current or specific facts.`;
const NO_SEARCH_PROMPT = `${BASE_PROMPT}
If the question needs very recent information you may not have, give your best answer and briefly say it may be out of date.`;

// Give up on one attempt after this long and try the next.
const TIMEOUT_MS = 20000;

// Greetings and small talk don't need a web search, which only adds seconds.
const SMALL_TALK =
  /^(hi+|hey+|hello+|hii+|yo|sup|thanks?|thank you|thx|ok(ay)?|cool|nice|great|bye|good (morning|afternoon|evening|night)|how are you|who are you|what'?s up)[\s!.?]*$/i;
// Questions whose answer depends on what's happening now.
const NEEDS_FRESH =
  /\b(today|tonight|tomorrow|yesterday|now|current(ly)?|latest|recent(ly)?|this (week|month|year)|news|weather|price|rate|score|stock|live|trending|upcoming|20\d\d)\b/i;

// Strip citation markers and any <think> blocks some models emit.
function clean(text) {
  return text
    .replace(/<think>[\s\S]*?(<\/think>|$)/gi, "")
    .replace(/\s?\[\d+(?:,\s*\d+)*\]/g, "")
    .trim();
}

function errorText(err) {
  return `${err?.code || ""} ${err?.message || ""}`;
}

function statusOf(err) {
  return err?.customErrorData?.status;
}

// Overload, timeout, quota, missing-model and "feature not allowed" failures
// are worth retrying with the next option.
function worthRetrying(err) {
  return (
    [400, 401, 403, 404, 413, 429, 500, 502, 503, 504].includes(statusOf(err)) ||
    /overloaded|unavailable|timeout|abort|quota|rate.?limit|resource.exhausted|not found|not supported|decommissioned|failed to fetch|network/i.test(
      errorText(err)
    )
  );
}

// ---------------------------------------------------------------------------
// Cooldowns, remembered in this browser across reloads.
// ---------------------------------------------------------------------------
const COOLDOWN_KEY = "mkai-ai-cooldowns";
function loadCooldowns() {
  try {
    return JSON.parse(localStorage.getItem(COOLDOWN_KEY)) || {};
  } catch {
    return {};
  }
}
function saveCooldowns(cooldowns) {
  try {
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns));
  } catch {}
}
function cooldownFor(err) {
  const status = statusOf(err);
  const text = errorText(err);
  if (status === 404 || /no longer available|not found|decommissioned|does not exist/i.test(text)) return 7 * 24 * 3600e3;
  if (status === 401) return 10 * 60e3; // bad key: try again after it's fixed
  if (/overloaded|unavailable/i.test(text) || [500, 502, 503].includes(status)) return 2 * 60e3;
  if (status === 429 || /quota|rate.?limit|resource.exhausted/i.test(text)) return 30 * 60e3;
  if (/timeout|abort/i.test(text)) return 2 * 60e3;
  return 0;
}
function coolDown(attempt, err) {
  const ms = cooldownFor(err);
  if (!ms) return;
  const cooldowns = loadCooldowns();
  cooldowns[attempt.key] = Date.now() + ms;
  saveCooldowns(cooldowns);
}
function available(attempts) {
  const cooldowns = loadCooldowns();
  const ready = attempts.filter((a) => !(cooldowns[a.key] > Date.now()));
  // If everything is cooling down, try them all anyway rather than refusing.
  return ready.length ? ready : attempts;
}

// ---------------------------------------------------------------------------
// Groq: OpenAI-compatible API, called straight from the browser with the key
// the admin saved in the vault (Firestore settings/ai, readable by members).
// ---------------------------------------------------------------------------
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// A saved key is kept for the session; "no key" is re-checked every few
// minutes so a key the admin adds is picked up without a reload.
let groqKeyCache = { value: null, checkedAt: 0 };
async function groqKey() {
  if (groqKeyCache.value || Date.now() - groqKeyCache.checkedAt < 5 * 60e3) return groqKeyCache.value;
  let value = null;
  try {
    const snap = await getDoc(doc(db, "settings", "ai"));
    value = (snap.exists() && snap.data().groqKey) || null;
  } catch {}
  groqKeyCache = { value, checkedAt: Date.now() };
  return value;
}

function httpError(status, message) {
  const err = new Error(message || `HTTP ${status}`);
  err.customErrorData = { status };
  return err;
}

async function groqAnswer(model, messages, key, onText) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.6,
        max_completion_tokens: 2048,
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
      }),
    });
    if (!res.ok) {
      let message = "";
      try {
        message = (await res.json())?.error?.message || "";
      } catch {}
      throw httpError(res.status, `Groq ${model}: [${res.status}] ${message}`);
    }

    // Server-sent events: lines of "data: {json}", ending with "data: [DONE]".
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
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
        if (event.error) throw httpError(500, `Groq ${model}: ${event.error.message || "stream error"}`);
        const piece = event.choices?.[0]?.delta?.content || "";
        if (piece) {
          text += piece;
          const shown = clean(text);
          if (shown) onText(shown);
        }
      }
    }
    return { answer: clean(text), searchSuggestions: null };
  } catch (err) {
    if (err.name === "AbortError") throw httpError(504, `Groq ${model}: timeout — no answer in ${TIMEOUT_MS / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Gemini through Firebase AI Logic.
// ---------------------------------------------------------------------------
const geminiModels = new Map();
function geminiModel(model, search) {
  const key = `${model}|${search}`;
  if (!geminiModels.has(key)) {
    geminiModels.set(
      key,
      getGenerativeModel(ai, {
        model,
        systemInstruction: search ? SEARCH_PROMPT : NO_SEARCH_PROMPT,
        ...(search ? { tools: [{ googleSearch: {} }] } : {}),
      })
    );
  }
  return geminiModels.get(key);
}

// Google requires showing its search suggestions whenever an answer used Google Search.
function suggestionsOf(response) {
  return response.candidates?.[0]?.groundingMetadata?.searchEntryPoint?.renderedContent || null;
}

async function geminiAnswer(model, search, contents, onText) {
  const m = geminiModel(model, search);
  let text = "";
  try {
    const result = await m.generateContentStream({ contents }, { timeout: TIMEOUT_MS });
    for await (const chunk of result.stream) {
      try {
        text += chunk.text() || "";
      } catch {} // a chunk with no text part
      if (text) onText(clean(text));
    }
    const response = await result.response;
    return { answer: clean(text), searchSuggestions: suggestionsOf(response) };
  } catch (err) {
    // Some networks drop streaming connections: ask again the ordinary way.
    if (!text && /failed to fetch|network|load failed|connection/i.test(errorText(err))) {
      const { response } = await m.generateContent({ contents }, { timeout: TIMEOUT_MS });
      const answer = clean(response.text() || "");
      if (answer) onText(answer);
      return { answer, searchSuggestions: suggestionsOf(response) };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------

// Turns what MK.ai already knows into context for the new answer.
function knowledgeNote({ good = [], bad = [] }) {
  const parts = [];
  if (good.length) {
    parts.push(
      "Things you have learned before that may help (curated ones are verified by the admin — follow them):\n" +
        good
          .map((e) => `- ${e.curated ? "(curated) " : ""}Q: ${e.question}\n  A: ${e.answer.slice(0, 1500)}`)
          .join("\n")
    );
  }
  if (bad.length) {
    parts.push(
      "A user marked this earlier answer to a similar question as unhelpful — do better this time:\n" +
        bad.map((e) => `Q: ${e.question}\nA: ${e.answer.slice(0, 1500)}`).join("\n")
    );
  }
  return parts.join("\n\n");
}

// The ordered list of things to try for this question.
async function plan(question) {
  const key = await groqKey();
  const smallTalk = SMALL_TALK.test(question.trim());
  const fresh = !smallTalk && NEEDS_FRESH.test(question);
  const attempts = [];

  if (key) {
    const groq = (model, search) => ({
      key: `groq:${model}`,
      run: (ctx, onText) => groqAnswer(model, ctx.messages(search), key, onText),
    });
    if (fresh) GROQ_SEARCH_MODELS.forEach((m) => attempts.push(groq(m, true)));
    GROQ_MODELS.forEach((m) => attempts.push(groq(m, false)));
  }

  const gemini = (model, search) => ({
    key: search ? "gemini:google-search" : `gemini:${model}`,
    run: (ctx, onText) => geminiAnswer(model, search, ctx.contents, onText),
  });
  if (!smallTalk && (fresh || !key)) attempts.push(gemini(GEMINI_MODELS[0], true));
  GEMINI_MODELS.forEach((m) => attempts.push(gemini(m, false)));

  return available(attempts);
}

// history: [{ role: "user" | "assistant", content }], oldest first, ending on "assistant".
// onText(textSoFar) is called as the answer streams in.
export async function askGemini(question, history, knowledge, onText = () => {}) {
  const note = knowledgeNote(knowledge);
  const userText = note ? `${note}\n\nQuestion: ${question}` : question;
  const ctx = {
    contents: [
      ...history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      { role: "user", parts: [{ text: userText }] },
    ],
    messages: (search) => [
      { role: "system", content: search ? SEARCH_PROMPT : NO_SEARCH_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userText },
    ],
  };

  let lastError = null;
  for (const attempt of await plan(question)) {
    let text = "";
    try {
      const result = await attempt.run(ctx, (t) => {
        text = t;
        onText(t);
      });
      if (result.answer) return result;
      throw httpError(500, `${attempt.key}: empty answer`);
    } catch (err) {
      lastError = err;
      console.warn(`${attempt.key} failed:`, err);
      coolDown(attempt, err);
      // Once part of the answer is on screen, starting over would be confusing.
      if (text || !worthRetrying(err)) break;
    }
  }
  throw lastError;
}

export function aiErrorMessage(err) {
  const status = statusOf(err);
  const text = errorText(err);
  // The provider's own wording, shortened, so problems can be diagnosed from a screenshot.
  const reason = `${err?.customErrorData?.errorDetails?.[0]?.reason || ""} ${err?.message || ""}`;
  const detail = `\n\n(${reason
    .replace(/Error fetching from \S+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220)})`;

  if (/app.?check|deactivated/i.test(text)) {
    return "The AI is waiting for App Check to be set up in Firebase — the admin needs to finish that step (see the README)." + detail;
  }
  if (/api-not-enabled|not been used/i.test(text)) {
    return "The AI isn't switched on in Firebase yet — the admin needs to enable Firebase AI Logic (see the README)." + detail;
  }
  if (/overloaded|unavailable/i.test(text) || status === 503) {
    return "The AI services are overloaded right now — please try again in a few minutes." + detail;
  }
  if (status === 429 || /quota|rate.?limit|resource.exhausted/i.test(text)) {
    return "Today's free AI allowance is used up — MK.ai can still answer questions it has learned. Please try again later." + detail;
  }
  if (!navigator.onLine) return "You're offline — connect to the internet to ask.";
  if (/abort|timeout|timed out/i.test(text)) {
    return "The AI took too long to answer — please try again." + detail;
  }
  return "The AI couldn't answer that right now — please try again." + detail;
}
