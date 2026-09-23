import { GoogleGenAI } from "@google/genai";

// The AI brain: Gemini reads the live search results (plus the recent
// conversation) and writes a real answer. Without GEMINI_API_KEY the app
// falls back to its original behaviour of showing raw search results.
export const aiEnabled = Boolean(process.env.GEMINI_API_KEY);
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

const client = aiEnabled ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
if (aiEnabled) {
  console.log(`MK.ai: AI answers enabled (${MODEL}).`);
} else {
  console.log("MK.ai: GEMINI_API_KEY not set — showing raw search results only.");
}

const SYSTEM_PROMPT = `You are MK.ai, a helpful, knowledgeable AI assistant.
Answer the user's question directly and clearly, like a knowledgeable friend.
When web search results are provided, use them for current facts and cite them inline as [1], [2] matching their numbers. If the results don't cover the question, answer from your own knowledge.
Write in plain text: short paragraphs, and "- " bullet lists when they help. Do not use markdown headings, tables or bold.
Reply in the same language the user writes in.`;

const MAX_HISTORY_MESSAGES = 12;

// Keep only well-formed, alternating user/assistant turns from the browser,
// converted to Gemini's { role: "user" | "model", parts } shape.
function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  const turns = history
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

  const out = [];
  for (const turn of turns) {
    if (!out.length && turn.role !== "user") continue;
    if (out.length && out[out.length - 1].role === turn.role) {
      out[out.length - 1] = turn;
    } else {
      out.push(turn);
    }
  }
  // The new question is appended as a user turn, so history must end on the assistant.
  if (out.length && out[out.length - 1].role === "user") out.pop();

  return out.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

function formatResults(results) {
  return results
    .map((r) => `[${r.index}] ${r.title}\n${r.link}\n${r.snippet || ""}`.trim())
    .join("\n\n");
}

// results: Google results scraped by the browser. When there are none (e.g.
// Google blocked the headless browser), Gemini searches Google itself.
export async function generateAnswer({ question, history, results }) {
  const hasResults = results.length > 0;
  const userText = hasResults
    ? `Web search results for this question:\n\n${formatResults(results)}\n\nQuestion: ${question}`
    : question;

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [...cleanHistory(history), { role: "user", parts: [{ text: userText }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      ...(hasResults ? {} : { tools: [{ googleSearch: {} }] }),
    },
  });

  const answer = (response.text || "").trim();

  let sources = results;
  if (!hasResults) {
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const seen = new Set();
    sources = [];
    for (const chunk of chunks) {
      const web = chunk.web;
      if (!web?.uri || seen.has(web.uri)) continue;
      seen.add(web.uri);
      sources.push({ index: sources.length + 1, title: web.title || web.uri, link: web.uri, snippet: "" });
      if (sources.length >= 6) break;
    }
  }

  return {
    answer: answer || "Sorry, I couldn't answer that — please try rephrasing.",
    sources,
  };
}
