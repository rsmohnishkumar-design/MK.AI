// Answers simple knowledge questions ("what is photosynthesis?", "who is
// APJ Abdul Kalam?") from Wikipedia's free public API: no account, no key.

const TRIGGER =
  /^(?:what|who|where)\s+(?:is|was|are|were)\s+(?:an?\s+|the\s+)?(.+)|^(?:tell me about|explain|define|describe|meaning of|what does)\s+(?:an?\s+|the\s+)?(.+?)(?:\s+mean)?$|^(?:who invented|who discovered|who founded|who wrote)\s+(.+)/;

// Words that make a question about now or about the user, which Wikipedia can't answer.
const SKIP = /\b(your|you|my|me|i|today|now|current|latest|weather|price|time|date)\b/;

function topicOf(question) {
  const q = question
    .toLowerCase()
    .replace(/[?!.]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  const m = q.match(TRIGGER);
  if (!m) return null;
  const topic = (m[1] || m[2] || m[3] || "").trim();
  if (!topic || topic.length > 80 || SKIP.test(topic)) return null;
  // "who invented the telephone" → search the whole question for better results.
  return m[3] ? q : topic;
}

async function getJson(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// First two or three sentences, trimmed to a friendly length.
function shorten(text) {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  let out = "";
  for (const s of sentences) {
    if ((out + s).length > 480 && out) break;
    out += s;
  }
  return out.trim();
}

export function looksLikeKnowledgeQuestion(question) {
  return topicOf(question) !== null;
}

export async function wikiAnswer(question) {
  const topic = topicOf(question);
  if (!topic) return null;

  const search = await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&srlimit=1&format=json&origin=*`
  );
  const title = search?.query?.search?.[0]?.title;
  if (!title) return null;

  const page = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  if (!page?.extract || page.type === "disambiguation") return null;
  return { answer: shorten(page.extract), title: page.title };
}
