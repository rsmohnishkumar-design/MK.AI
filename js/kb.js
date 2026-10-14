// MK.ai's built-in knowledge base: thousands of checked answers on school and
// general-knowledge topics that ship with the app (data/kb/*.json) and are
// answered instantly, with no outside service. Each pack is
//   { "topic": "…", "entries": [["question", "answer", ["other ways to ask", …]], …] }
// and data/kb/index.json lists the packs.

import { keywords, sameWord } from "./words.js";
import { embed, closeness } from "./meaning.js";

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
  return bestEntry(question) || (await meaningEntry(question));
}

// Search by meaning (embeddings): when the words differ ("how tall is
// Everest" / "height of Mount Everest"), the entries sharing the most words
// are compared by their meaning vectors. Only once the neural model is ready.
const MEANING_MATCH = 0.86;
export async function meaningEntry(question, min = MEANING_MATCH) {
  const words = keywords(prep(question));
  if (!words.length || !entries.length) return null;
  const numbers = numbersIn(prep(question));
  const shared = new Map();
  for (const w of words) for (const i of byWord.get(w) || []) shared.set(i, (shared.get(i) || 0) + 1);
  const top = [...shared]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([i]) => entries[i])
    .filter((e) => e.phrasings.some((p) => p.numbers === numbers));
  if (!top.length) return null;
  let vecs = null;
  try {
    vecs = await embed([question, ...top.map((e) => e.q)]);
  } catch (err) {
    console.warn("Meaning search failed:", err);
  }
  if (!vecs) return null;
  let best = null;
  top.forEach((e, i) => {
    const c = closeness(vecs[0], vecs[i + 1]);
    if (!best || c > best.score) best = { entry: e, score: c };
  });
  return best && best.score >= min ? { question: best.entry.q, answer: best.entry.a, topic: best.entry.topic, score: best.score, byMeaning: true } : null;
}

// Other entries about the same thing, for Deep think's "Related" list.
// Rare words count most, so "capital of France" finds France's currency and
// language rather than other countries' capitals.
export function relatedEntries(question, exclude = null, n = 2) {
  const words = keywords(prep(question));
  if (!words.length) return [];
  const idf = (w) => Math.log((entries.length + 1) / ((byWord.get(w)?.size || 0) + 1));
  const total = words.reduce((s, w) => s + idf(w), 0);
  // Related entries must share the question's rarest word ("france", "gandhi").
  const rarest = words.reduce((best, w) => (idf(w) > idf(best) ? w : best), words[0]);
  if ((byWord.get(rarest)?.size || 0) > 25) return [];
  const rare = [rarest];
  const scored = new Map();
  for (const w of rare) {
    for (const i of byWord.get(w) || []) {
      const e = entries[i];
      if (e.q === exclude || scored.has(i)) continue;
      const own = new Set(e.phrasings.flatMap((p) => p.words));
      const s = words.filter((x) => own.has(x)).reduce((sum, x) => sum + idf(x), 0) / total;
      if (s >= 0.4) scored.set(i, s);
    }
  }
  return [...scored]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([i]) => ({ question: entries[i].q, answer: entries[i].a }));
}

// "Did you mean …?": swaps misspelt words for the closest word MK.ai knows
// (up to 2 letters different), and returns the corrected question only when
// the knowledge base then has an answer for it.
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
export function spellFix(question) {
  const words = question.toLowerCase().match(/[a-z]+/g) || [];
  let changed = false;
  const fixed = question.toLowerCase().replace(/[a-z]+/g, (w) => {
    if (w.length < 4 || byWord.has(w)) return w;
    let best = null;
    for (const known of byWord.keys()) {
      if (known[0] !== w[0] || !/^[a-z]+$/.test(known)) continue;
      const d = distance(w, known);
      if (d <= (w.length >= 7 ? 2 : 1) && (!best || d < best.d || (d === best.d && byWord.get(known).size > byWord.get(best.w).size))) best = { w: known, d };
    }
    if (!best) return w;
    changed = true;
    return best.w;
  });
  if (!changed || !words.length) return null;
  const hit = bestEntry(fixed);
  return hit ? { question: fixed, hit } : null;
}
