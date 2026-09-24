// MK.ai's own reading: finds the sentences in a text that answer a question,
// and summarises a text by picking its most central sentences. No outside AI.

import { keywords } from "./words.js";

export function sentencesOf(text) {
  return (
    text
      .replace(/\r/g, "")
      .split(/\n\s*\n|\n(?=\s*[-•*\d]+[.)]?\s)/)
      .flatMap((block) => block.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [])
      .map((s) => s.trim())
      .filter((s) => s.length > 2)
  );
}

// What kind of answer a question wants, and how to spot it in a sentence.
const ANSWER_SHAPES = [
  [/^how (tall|high|long|far|deep|wide|big|heavy)\b|\b(height|length|distance|depth|elevation|weight|area)\b/i, /\d[\d,.]*\s*(m|km|cm|mm|ft|feet|metres?|meters?|miles?|kg|tonnes?|square|sq|°)\b/i],
  [/^when\b|\b(what year|which year|founded|born|built|independence)\b/i, /\b(1\d{3}|20\d{2})\b|\b(century|january|february|march|april|may|june|july|august|september|october|november|december)\b/i],
  [/^how (many|much)\b|\b(population|number of|how old|age)\b/i, /\d/],
  [/^where\b/i, /\b(in|at|near|located|lies|border|capital|situated)\b/i],
  [/^who\b/i, /\b(is|was) (a|an|the)\b|\b[A-Z][a-z]+ [A-Z][a-z]+/],
];
// A sentence starting with "It/Its/He/She/They…" is about the previous sentence's subject.
const CONTINUES = /^(it|its|it's|he|his|she|her|they|their|this|these)\b/i;

// The sentences (in their original order) that answer the question best, or
// null when nothing in the text is about it.
export function bestSentences(question, text, max = 3) {
  const words = keywords(question);
  if (!words.length) return null;
  const need = words.length <= 2 ? 1 : Math.ceil(words.length / 2);
  const shape = ANSWER_SHAPES.find(([asks]) => asks.test(question.trim()))?.[1];
  let carried = 0;
  const scored = sentencesOf(text).map((sentence, i) => {
    const have = new Set(keywords(sentence));
    const own = words.filter((w) => have.has(w)).length;
    const hits = CONTINUES.test(sentence) ? Math.max(own, carried) : own;
    carried = Math.max(own, CONTINUES.test(sentence) ? carried : 0);
    return { sentence, i, hits, score: hits + (shape && shape.test(sentence) ? 1.5 : 0) };
  });
  // Only the sentences that match best; long questions allow one word less.
  const top = Math.max(0, ...scored.map((s) => s.hits));
  const bar = Math.max(need, top - (words.length >= 4 ? 1 : 0));
  const best = scored.filter((s) => s.hits >= bar).sort((a, b) => b.score - a.score || a.i - b.i).slice(0, max);
  if (!best.length) return null;
  return best.sort((a, b) => a.i - b.i).map((s) => s.sentence).join(" ");
}

// A short summary: the sentences that share the most words with the rest of
// the text, kept in order.
export function summarise(text, max = 5) {
  const sentences = sentencesOf(text);
  if (sentences.length <= max) return sentences.join(" ");
  const freq = new Map();
  const words = sentences.map((s) => keywords(s));
  words.flat().forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
  return sentences
    .map((sentence, i) => ({
      sentence,
      i,
      score: words[i].reduce((sum, w) => sum + (freq.get(w) - 1), 0) / Math.sqrt(words[i].length || 1) + (i === 0 ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map((s) => s.sentence)
    .join(" ");
}

const WANTS_SUMMARY = /\b(summar|overview|what is (this|it) about|what's (this|it) about|explain (this|the) (file|document|notes)|main points|key points|tl;?dr)/i;
export const wantsSummary = (question) => WANTS_SUMMARY.test(question);
