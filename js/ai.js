import { getGenerativeModel } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js";
import { ai } from "./firebase.js";
import { GEMINI_MODELS } from "../firebase-config.js";

const SYSTEM_PROMPT = `You are MK.ai, a helpful, knowledgeable AI assistant.
Answer the user's question directly and clearly, like a knowledgeable friend. Use Google Search whenever the question needs current or specific facts.
Give only the answer: never mention your sources, search results, websites or citations, and never write reference numbers like [1].
Write in plain text: short paragraphs, and "- " bullet lists when they help. Do not use markdown headings, tables or bold.
Reply in the same language the user writes in.`;

// Tried in order: the first model with Google Search, then every model
// without it. An overloaded, slow, over-quota or missing model falls through
// to the next option instead of failing outright.
const ATTEMPTS = [
  { model: GEMINI_MODELS[0], search: true },
  ...GEMINI_MODELS.map((model) => ({ model, search: false })),
];

// Give up on one attempt after this long and try the next (the SDK default is 3 minutes).
const TIMEOUT_MS = 20000;

const models = new Map();
function getModel({ model, search }) {
  const key = `${model}|${search}`;
  if (!models.has(key)) {
    models.set(
      key,
      getGenerativeModel(ai, {
        model,
        systemInstruction: SYSTEM_PROMPT,
        ...(search ? { tools: [{ googleSearch: {} }] } : {}),
      })
    );
  }
  return models.get(key);
}

// Greetings and small talk don't need a web search, which only adds seconds.
const SMALL_TALK =
  /^(hi+|hey+|hello+|hii+|yo|sup|thanks?|thank you|thx|ok(ay)?|cool|nice|great|bye|good (morning|afternoon|evening|night)|how are you|who are you|what'?s up)[\s!.?]*$/i;
function needsSearch(question) {
  return !SMALL_TALK.test(question.trim());
}

// Strip citation markers the model sometimes adds anyway.
function clean(text) {
  return text.replace(/\s?\[\d+(?:,\s*\d+)*\]/g, "").trim();
}

function errorText(err) {
  return `${err?.code || ""} ${err?.message || ""}`;
}

// Overload, timeout, quota, missing-model and "search not allowed" failures
// are worth retrying with the next option.
function worthRetrying(err) {
  const status = err?.customErrorData?.status;
  return (
    [400, 403, 404, 429, 500, 503, 504].includes(status) ||
    /overloaded|unavailable|timeout|quota|resource.exhausted|not found|not supported/i.test(errorText(err))
  );
}

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

// history: [{ role: "user" | "assistant", content }], oldest first, ending on "assistant".
// onText(textSoFar) is called as the answer streams in.
export async function askGemini(question, history, knowledge, onText = () => {}) {
  const note = knowledgeNote(knowledge);
  const contents = [
    ...history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    { role: "user", parts: [{ text: note ? `${note}\n\nQuestion: ${question}` : question }] },
  ];

  const attempts = needsSearch(question) ? ATTEMPTS : ATTEMPTS.filter((a) => !a.search);
  let lastError = null;
  for (const attempt of attempts) {
    let text = "";
    try {
      return await streamAnswer(getModel(attempt), contents, (t) => {
        text = t;
        onText(t);
      });
    } catch (err) {
      lastError = err;
      console.warn(`Gemini (${attempt.model}, search ${attempt.search ? "on" : "off"}) failed:`, err);
      // Some networks drop streaming connections: ask again the ordinary way.
      if (!text && isNetworkDrop(err)) {
        try {
          return await wholeAnswer(getModel(attempt), contents, onText);
        } catch (err2) {
          lastError = err2;
          console.warn("Non-streaming retry failed too:", err2);
        }
      }
      // Once part of the answer is on screen, starting over would be confusing.
      if (text || !worthRetrying(lastError) || /app.?check|deactivated|api-not-enabled|not been used/i.test(errorText(lastError))) break;
    }
  }
  throw lastError;
}

function isNetworkDrop(err) {
  return /failed to fetch|network|load failed|connection/i.test(errorText(err));
}

// Google requires showing its search suggestions whenever an answer used Google Search.
function suggestionsOf(response) {
  return response.candidates?.[0]?.groundingMetadata?.searchEntryPoint?.renderedContent || null;
}

async function streamAnswer(model, contents, onText) {
  const result = await model.generateContentStream({ contents }, { timeout: TIMEOUT_MS });
  let text = "";
  for await (const chunk of result.stream) {
    try {
      text += chunk.text() || "";
    } catch {} // a chunk with no text part
    if (text) onText(clean(text));
  }
  const response = await result.response;
  return { answer: clean(text), searchSuggestions: suggestionsOf(response) };
}

async function wholeAnswer(model, contents, onText) {
  const { response } = await model.generateContent({ contents }, { timeout: TIMEOUT_MS });
  const answer = clean(response.text() || "");
  if (answer) onText(answer);
  return { answer, searchSuggestions: suggestionsOf(response) };
}

export function aiErrorMessage(err) {
  const status = err?.customErrorData?.status;
  const text = errorText(err);
  // Google's own wording, shortened, so problems can be diagnosed from a screenshot.
  const reason = `${err?.customErrorData?.errorDetails?.[0]?.reason || ""} ${err?.message || ""}`;
  const detail = `\n\n(${reason
    .replace(/Error fetching from \S+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220)})`;

  if (/app.?check|deactivated/i.test(text)) {
    return "The AI is waiting for App Check to be set up in Firebase — the admin needs to finish that step (see the README)." + detail;
  }
  if (/api-not-enabled|not been used|disabled/i.test(text)) {
    return "The AI isn't switched on in Firebase yet — the admin needs to enable Firebase AI Logic (see the README)." + detail;
  }
  if (/overloaded|unavailable/i.test(text) || status === 503) {
    return "Google's free AI is overloaded right now — please try again in a few minutes." + detail;
  }
  if (status === 429 || /quota|resource.exhausted/i.test(text)) {
    return "The AI's free limit was reached — please try again later." + detail;
  }
  if (!navigator.onLine) return "You're offline — connect to the internet to ask.";
  if (/abort|timeout|timed out/i.test(text)) {
    return "The AI took too long to answer — please try again." + detail;
  }
  return "The AI couldn't answer that right now — please try again." + detail;
}
