// MK.ai's built-in knowledge base: thousands of checked answers on school and
// general-knowledge topics that ship with the app (data/kb/*.json) and are
// answered instantly, with no outside service. Each pack is
//   { "topic": "…", "entries": [["question", "answer", ["other ways to ask", …]], …] }
// and data/kb/index.json lists the packs.

import { keywords, sameWord } from "./words.js";

const BASE = new URL("../data/kb/", import.meta.url);

let entries = [];
const byWord = new Map(); // key word → indexes of entries whose phrasings use it
let loading = null;

// "c++" and "c#" would lose their symbols and look like plain "c"
const prep = (text) => text.replace(/c\+\+/gi, " cpp ").replace(/c#/gi, " csharp ");
const numbersIn = (text) => (text.match(/\d+(?:\.\d+)?/g) || []).sort().join(",");

// Builds the search index from pack objects (also used by the tests).
export function addPacks(packs) {
  for (const pack of packs) {
    for (const [q, a, alts = []] of pack.entries) {
      const phrasings = [q, ...alts].map((p) => ({ words: keywords(prep(p)), numbers: numbersIn(prep(p)) }));
      const index = entries.push({ q, a, topic: pack.topic, phrasings }) - 1;
      for (const p of phrasings) {
        for (const w of p.words) {
          if (!byWord.has(w)) byWord.set(w, new Set());
          byWord.get(w).add(index);
        }
      }
    }
  }
  return entries.length;
}

export function loadKnowledge() {
  loading ||= (async () => {
    const index = await (await fetch(new URL("index.json", BASE))).json();
    const packs = await Promise.all(
      index.packs.map((name) => fetch(new URL(name, BASE)).then((r) => (r.ok ? r.json() : null)).catch(() => null))
    );
    addPacks(packs.filter(Boolean));
  })().catch((err) => {
    loading = null; // try again next time (e.g. after coming back online)
    throw err;
  });
  return loading;
}

export const knowledgeSize = () => entries.length;

function score(words, phrasing) {
  const other = phrasing.words;
  if (!words.length || !other.length) return 0;
  // An exact word counts a little more than a near-miss typo ("kingston" vs "kingstown").
  const shared = words.reduce((n, w) => n + (other.includes(w) ? 1 : other.some((x) => sameWord(w, x)) ? 0.9 : 0), 0);
  const jaccard = shared / (words.length + other.length - shared);
  const containment = shared / Math.min(words.length, other.length);
  // Every word of the shorter one must be there, and most of both.
  return jaccard >= 0.5 ? 0.5 * jaccard + 0.5 * containment : 0;
}

// The best entry for a question, or null. Pure lookup once loaded.
export function bestEntry(question, minScore = 0.8) {
  const words = keywords(prep(question));
  if (!words.length) return null;
  const numbers = numbersIn(prep(question));
  const candidates = new Set();
  for (const w of words) for (const i of byWord.get(w) || []) candidates.add(i);
  let best = null;
  for (const i of candidates) {
    for (const p of entries[i].phrasings) {
      if (p.numbers !== numbers) continue;
      const s = score(words, p);
      if (s >= minScore && (!best || s > best.score)) best = { entry: entries[i], score: s };
    }
  }
  return best && { question: best.entry.q, answer: best.entry.a, topic: best.entry.topic, score: best.score };
}

export async function knowledgeAnswer(question) {
  try {
    await loadKnowledge();
  } catch (err) {
    console.warn("Couldn't load the knowledge base:", err);
    return null;
  }
  return bestEntry(question);
}
