import Anthropic from "@anthropic-ai/sdk";

// The AI brain: Claude reads the live search results (plus the recent
// conversation) and writes a real answer. Without ANTHROPIC_API_KEY the app
// falls back to its original behaviour of showing raw search results.
export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

const client = aiEnabled ? new Anthropic() : null;
if (aiEnabled) {
  console.log(`MK.ai: AI answers enabled (${MODEL}).`);
} else {
  console.log("MK.ai: ANTHROPIC_API_KEY not set — showing raw search results only.");
}

const SYSTEM_PROMPT = `You are MK.ai, a helpful, knowledgeable AI assistant.
Answer the user's question directly and clearly, like a knowledgeable friend.
When web search results are provided, use them for current facts and cite them inline as [1], [2] matching their numbers. If the results don't cover the question, answer from your own knowledge.
Write in plain text: short paragraphs, and "- " bullet lists when they help. Do not use markdown headings, tables or bold.
Reply in the same language the user writes in.`;

const MAX_HISTORY_MESSAGES = 12;
const MAX_TURNS = 4; // continuations allowed when a server-side web search pauses

// Keep only well-formed, alternating user/assistant turns from the browser.
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
  return out;
}

function formatResults(results) {
  return results
    .map((r) => `[${r.index}] ${r.title}\n${r.link}\n${r.snippet || ""}`.trim())
    .join("\n\n");
}

// results: Google results scraped by the browser. When there are none (e.g.
// Google blocked the headless browser), Claude searches the web itself.
export async function generateAnswer({ question, history, results }) {
  const hasResults = results.length > 0;
  const userContent = hasResults
    ? `Web search results for this question:\n\n${formatResults(results)}\n\nQuestion: ${question}`
    : question;

  const messages = [...cleanHistory(history), { role: "user", content: userContent }];
  const tools = hasResults ? [] : [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }];

  const webSources = [];
  let response;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      ...(tools.length ? { tools } : {}),
      messages,
    });

    for (const block of response.content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r.type === "web_search_result" && !webSources.some((s) => s.link === r.url)) {
            webSources.push({ title: r.title, link: r.url });
          }
        }
      }
    }

    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }

  if (response.stop_reason === "refusal") {
    return {
      answer: "Sorry, I can't help with that request.",
      sources: [],
    };
  }

  const answer = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const sources = hasResults
    ? results
    : webSources.slice(0, 6).map((s, i) => ({ index: i + 1, snippet: "", ...s }));

  return { answer: answer || "I couldn't come up with an answer — please try rephrasing.", sources };
}
