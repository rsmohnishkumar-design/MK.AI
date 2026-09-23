import { getGenerativeModel } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js";
import { ai } from "./firebase.js";
import { GEMINI_MODEL } from "../firebase-config.js";

const SYSTEM_PROMPT = `You are MK.ai, a helpful, knowledgeable AI assistant.
Answer the user's question directly and clearly, like a knowledgeable friend. Use Google Search whenever the question needs current or specific facts.
Give only the answer: never mention your sources, search results, websites or citations, and never write reference numbers like [1].
Write in plain text: short paragraphs, and "- " bullet lists when they help. Do not use markdown headings, tables or bold.
Reply in the same language the user writes in.`;

// Tried in order. New free projects sometimes have no allowance for Google
// Search or for a particular model, so a quota or "model not found" refusal
// falls through to the next option instead of failing outright.
const ATTEMPTS = [
  { model: GEMINI_MODEL, search: true },
  { model: GEMINI_MODEL, search: false },
  { model: "gemini-flash-lite-latest", search: false },
];

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

function errorText(err) {
  return `${err?.code || ""} ${err?.message || ""}`;
}

// Quota, missing-model and "search not allowed" refusals are worth retrying differently.
function worthRetrying(err) {
  const status = err?.customErrorData?.status;
  return [400, 403, 404, 429].includes(status) || /quota|resource.exhausted|not found|not supported/i.test(errorText(err));
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
export async function askGemini(question, history, knowledge) {
  const note = knowledgeNote(knowledge);
  const contents = [
    ...history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    { role: "user", parts: [{ text: note ? `${note}\n\nQuestion: ${question}` : question }] },
  ];

  let response = null;
  let lastError = null;
  for (const attempt of ATTEMPTS) {
    try {
      response = (await getModel(attempt).generateContent({ contents })).response;
      break;
    } catch (err) {
      lastError = err;
      console.warn(`Gemini (${attempt.model}, search ${attempt.search ? "on" : "off"}) failed:`, err);
      if (!worthRetrying(err) || /app.?check|deactivated|api-not-enabled|not been used/i.test(errorText(err))) break;
    }
  }
  if (!response) throw lastError;
  // Belt and braces: strip any citation markers the model adds anyway.
  const answer = (response.text() || "").replace(/\s?\[\d+(?:,\s*\d+)*\]/g, "").trim();

  // Google requires showing its search suggestions whenever an answer used Google Search.
  const searchSuggestions =
    response.candidates?.[0]?.groundingMetadata?.searchEntryPoint?.renderedContent || null;

  return { answer, searchSuggestions };
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
  if (status === 429 || /quota|resource.exhausted/i.test(text)) {
    return "The AI's free limit was reached — please try again later." + detail;
  }
  if (!navigator.onLine) return "You're offline — connect to the internet to ask.";
  return "The AI couldn't answer that right now — please try again." + detail;
}
