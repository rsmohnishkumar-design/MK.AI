// The Training room (admin vault): MK.ai learns by analysing what people
// give it: the questions they ask, bulk question/answer lists, and documents.
// Pure helpers here are shared with the chat (documents are used to answer).

import { keywords } from "./words.js";

// --- Bulk answers -------------------------------------------------------------

// Reads question/answer pairs from pasted text or a .txt/.csv file. Accepts
//   Q: …  A: …         (blocks, answers may span lines)
//   question | answer  (one per line; a tab works too)
//   "question","answer" (CSV)
export function parsePairs(text) {
  const clean = (s) => s.replace(/\s+\n/g, "\n").trim();
  const pairs = [];
  const qLine = /^\s*(?:q|question|ques)\s*[:.)\-]\s*/i;
  const aLine = /^\s*(?:a|answer|ans)\s*[:.)\-]\s*/i;
  const lines = text.split(/\r?\n/);
  if (lines.some((l) => qLine.test(l))) {
    // "question | answer" lines can sit between Q:/A: blocks: take them out first.
    const blockText = lines.filter((l) => qLine.test(l) || aLine.test(l) || !/\||\t/.test(l)).join("\n");
    const re = /(?:^|\n)\s*(?:q|question|ques)\s*[:.)\-]\s*([\s\S]*?)\n\s*(?:a|answer|ans)\s*[:.)\-]\s*([\s\S]*?)(?=\n\s*(?:q|question|ques)\s*[:.)\-]|$)/gi;
    for (const m of blockText.matchAll(re)) pairs.push([clean(m[1]), clean(m[2])]);
  }
  // One pair per line: "question | answer", a tab, or CSV.
  for (const line of lines) {
    if (qLine.test(line) || aLine.test(line)) continue;
    let q;
    let a;
    if (line.includes("|") || line.includes("\t")) {
      const i = line.search(/\||\t/);
      [q, a] = [line.slice(0, i), line.slice(i + 1)];
    } else if (/^\s*"/.test(line)) {
      const cells = [...line.matchAll(/"((?:[^"]|"")*)"|([^,]+)/g)].map((m) => (m[1] ?? m[2] ?? "").replace(/""/g, '"'));
      [q, a] = [cells[0], cells.slice(1).join(", ")];
    } else continue;
    pairs.push([String(q).trim(), String(a ?? "").trim()]);
  }
  return pairs
    .filter(([q, a]) => q && a && !/^(q|question)$/i.test(q))
    .map(([q, a]) => ({ question: q.slice(0, 1000), answer: a.slice(0, 20000) }));
}

// --- Documents ------------------------------------------------------------------

// Splits a document into passages of about `size` characters, on paragraph
// and sentence boundaries, so each one can be found and quoted on its own.
export function chunkText(text, size = 900) {
  const paragraphs = text.replace(/\r/g, "").split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  const pieces = [];
  for (const p of paragraphs) {
    if (p.length <= size) pieces.push(p);
    else {
      let current = "";
      for (const sentence of p.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [p]) {
        if ((current + sentence).length > size && current) {
          pieces.push(current.trim());
          current = "";
        }
        current += sentence;
      }
      if (current.trim()) pieces.push(current.trim());
    }
  }
  const chunks = [];
  let current = "";
  for (const piece of pieces) {
    if ((current + "\n\n" + piece).length > size && current) {
      chunks.push(current);
      current = piece;
    } else current = current ? `${current}\n\n${piece}` : piece;
  }
  if (current) chunks.push(current);
  return chunks.map((c) => c.slice(0, 4000));
}

export const chunkKeywords = (text) => keywords(text).slice(0, 300);

// How well a passage covers a question's key words (0..1).
export function passageScore(question, passageKeywords) {
  const words = keywords(question);
  if (!words.length) return 0;
  const set = new Set(passageKeywords);
  return words.filter((w) => set.has(w)).length / words.length;
}

// --- Learning from users ----------------------------------------------------------

const SKIP_MODES = new Set(["local", "creator", "file", "taught", "knowledge"]);

// Groups the activity log into distinct questions and finds what MK.ai should
// learn: questions it couldn't answer, and questions people ask again and again.
export function analyseActivity(rows, knownQuestions = []) {
  const known = new Set(knownQuestions.map((q) => keywords(q).sort().join(" ")));
  const groups = new Map();
  const modes = {};
  const topicCount = new Map();
  for (const row of rows) {
    const question = String(row.question || "").trim();
    if (!question) continue;
    modes[row.mode] = (modes[row.mode] || 0) + 1;
    if (SKIP_MODES.has(row.mode)) continue;
    const words = keywords(question);
    words.forEach((w) => w.length > 2 && !/^\d+$/.test(w) && topicCount.set(w, (topicCount.get(w) || 0) + 1));
    const key = [...words].sort().join(" ") || question.toLowerCase();
    const g = groups.get(key) || { question, count: 0, unknown: 0, people: new Set(), key };
    g.count += 1;
    if (row.mode === "unknown") g.unknown += 1;
    if (row.email) g.people.add(row.email);
    groups.set(key, g);
  }
  const list = [...groups.values()].filter((g) => !known.has(g.key));
  const needs = list
    .filter((g) => g.unknown > 0 || g.count >= 2)
    .sort((a, b) => b.unknown - a.unknown || b.count - a.count)
    .map((g) => ({ question: g.question, count: g.count, unknown: g.unknown, people: g.people.size }));
  const topics = [...topicCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  return { total: rows.length, distinct: groups.size, modes, needs, topics };
}

// --- Asking the AI to write answers ---------------------------------------------------

// Pulls a JSON array of {q, a} out of an AI reply (it may add words around it).
export function readPairsJson(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const items = JSON.parse(text.slice(start, end + 1));
    return items
      .map((it) => ({ question: String(it.q ?? it.question ?? "").trim(), answer: String(it.a ?? it.answer ?? "").trim() }))
      .filter((p) => p.question && p.answer);
  } catch {
    return [];
  }
}

export const QA_FROM_DOCUMENT = (count) =>
  `Read the document and write up to ${count} useful question-and-answer pairs that students or users are likely to ask about it. ` +
  `Each answer must be correct according to the document, complete, and 1 to 4 sentences. ` +
  `Reply with ONLY a JSON array like [{"q":"…","a":"…"}], nothing else.`;

export const TEXT_FROM_DOCUMENT =
  "Copy out the full text of this document as plain text, keeping paragraphs. Don't summarise and don't add anything.";
