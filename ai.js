import { GoogleGenAI } from "@google/genai";

// The AI brain: Gemini writes the answers, searching Google itself whenever a
// question needs fresh facts. Without GEMINI_API_KEY the app falls back to its
// original behaviour of showing raw search results from the headless browser.
export const aiEnabled = Boolean(process.env.GEMINI_API_KEY);
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
const EMBED_DIMENSIONS = 768;

const client = aiEnabled ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
if (aiEnabled) {
  console.log(`MK.ai: AI answers enabled (${MODEL}).`);
} else {
  console.log("MK.ai: GEMINI_API_KEY not set — showing raw search results only.");
}

const SYSTEM_PROMPT = `You are MK.ai, a helpful, knowledgeable AI assistant.
Answer the user's question directly and clearly, like a knowledgeable friend. Use Google Search whenever the question needs current or specific facts.
Give only the answer: never mention your sources, search results, websites or citations, and never write reference numbers like [1].
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

// A list of numbers describing the meaning of `text`, used to match
// questions that are worded differently. Returns null if unavailable.
export async function embed(text) {
  if (!aiEnabled) return null;
  try {
    const res = await client.models.embedContent({
      model: EMBED_MODEL,
      contents: text.slice(0, 2000),
      config: { taskType: "SEMANTIC_SIMILARITY", outputDimensionality: EMBED_DIMENSIONS },
    });
    const values = res.embeddings?.[0]?.values;
    return Array.isArray(values) && values.length ? values : null;
  } catch (err) {
    console.warn("Embedding failed:", err.message);
    return null;
  }
}

export async function generateAnswer({ question, history, knowledge }) {
  const note = knowledge ? knowledgeNote(knowledge) : "";
  const userText = note ? `${note}\n\nQuestion: ${question}` : question;

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [...cleanHistory(history), { role: "user", parts: [{ text: userText }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ googleSearch: {} }],
    },
  });

  // Belt and braces: strip any citation markers the model adds anyway.
  const answer = (response.text || "").replace(/\s?\[\d+(?:,\s*\d+)*\]/g, "").trim();
  return answer || null;
}
