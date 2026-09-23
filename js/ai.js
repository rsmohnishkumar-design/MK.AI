import { getGenerativeModel } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js";
import { ai } from "./firebase.js";
import { GEMINI_MODEL } from "../firebase-config.js";

const SYSTEM_PROMPT = `You are MK.ai, a helpful, knowledgeable AI assistant.
Answer the user's question directly and clearly, like a knowledgeable friend. Use Google Search whenever the question needs current or specific facts.
Give only the answer: never mention your sources, search results, websites or citations, and never write reference numbers like [1].
Write in plain text: short paragraphs, and "- " bullet lists when they help. Do not use markdown headings, tables or bold.
Reply in the same language the user writes in.`;

let model = null;
function getModel() {
  if (!model) {
    model = getGenerativeModel(ai, {
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ googleSearch: {} }],
    });
  }
  return model;
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

  const result = await getModel().generateContent({ contents });
  const response = result.response;
  // Belt and braces: strip any citation markers the model adds anyway.
  const answer = (response.text() || "").replace(/\s?\[\d+(?:,\s*\d+)*\]/g, "").trim();

  // Google requires showing its search suggestions whenever an answer used Google Search.
  const searchSuggestions =
    response.candidates?.[0]?.groundingMetadata?.searchEntryPoint?.renderedContent || null;

  return { answer, searchSuggestions };
}

export function aiErrorMessage(err) {
  const status = err?.customErrorData?.status;
  const text = `${err?.code || ""} ${err?.message || ""}`;
  if (status === 429 || /quota|resource.exhausted|429/i.test(text)) {
    return "MK.ai is getting a lot of questions right now — please try again in a minute.";
  }
  if (/api-not-enabled|not been used|disabled/i.test(text)) {
    return "The AI isn't switched on in Firebase yet — the admin needs to enable Firebase AI Logic (see the README).";
  }
  if (!navigator.onLine) return "You're offline — connect to the internet to ask.";
  return "The AI couldn't answer that right now — please try again.";
}
