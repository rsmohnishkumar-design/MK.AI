import {
  collection,
  query,
  where,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  increment,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { embed, closeness } from "./meaning.js";

// ---------------------------------------------------------------------------
// Word matching. Each stored question keeps a list of its keywords, so the
// database can hand back only the few entries that share words with a new
// question instead of everything. Those candidates are then scored by how
// much of their meaning-carrying words overlap, forgiving small typos.
// ---------------------------------------------------------------------------
const STOPWORDS = new Set(
  (
    "a an the is are was were be been am do does did of to in on at for by with from and or but " +
    "what whats who whom which when where why how can could would should will shall may might " +
    "i me my you your it its this that these those tell please about there their they them " +
    "give explain know want need some any much many"
  ).split(" ")
);

function normalize(str) {
  return str.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function stem(word) {
  if (word.length > 5 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 4 && word.endsWith("es") && /(sh|ch|x|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function keywords(str) {
  const words = normalize(str)
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stem);
  return [...new Set(words)];
}

function editDistanceAtMostOne(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function sameWord(a, b) {
  return a === b || (a.length >= 5 && b.length >= 5 && editDistanceAtMostOne(a, b));
}

function overlap(questionA, questionB) {
  const a = keywords(questionA);
  const b = keywords(questionB);
  if (!a.length || !b.length) return null;
  const shared = a.filter((w) => b.some((x) => sameWord(w, x))).length;
  return { jaccard: shared / (a.length + b.length - shared), containment: shared / Math.min(a.length, b.length) };
}

// 0..1: blends "share most of their words" with "one contains the other".
export function similarity(questionA, questionB) {
  const o = overlap(questionA, questionB);
  if (!o) return normalize(questionA) === normalize(questionB) ? 1 : 0;
  return 0.5 * o.jaccard + 0.5 * o.containment;
}

// Neural memory: the same meaning in different words ("how tall is Everest" /
// "height of Mount Everest"). Guards keep look-alikes apart: the questions
// must share at least half their key words and mention the same numbers.
const MEANING_SAME = 0.88;
const numbersIn = (q) => (q.match(/\d+(?:\.\d+)?/g) || []).sort().join(",");
function sameMeaning(question, candidate) {
  if (!(candidate.meaning >= MEANING_SAME)) return false;
  const o = overlap(question, candidate.entry.question);
  return !!o && o.containment >= 0.5 && numbersIn(question) === numbersIn(candidate.entry.question);
}
function bestByMeaning(question, list, usable = () => true) {
  return list
    .filter((c) => usable(c.entry) && sameMeaning(question, c))
    .sort((x, y) => y.meaning - x.meaning)[0];
}
async function addMeaning(question, list) {
  if (!list.length) return;
  try {
    const vecs = await embed([question, ...list.map((c) => c.entry.question)]);
    if (vecs) list.forEach((c, i) => (c.meaning = closeness(vecs[0], vecs[i + 1])));
  } catch (err) {
    console.warn("Neural memory failed:", err);
  }
}

// ---------------------------------------------------------------------------
// When a stored answer is reused as-is. Upvoted answers are trusted a bit
// more; answers people voted down are never reused.
// ---------------------------------------------------------------------------
const THRESHOLD = { vault: 0.7, learned: 0.82, related: 0.34 };
const LEARNED_MAX_AGE_DAYS = 45;

export function votes(entry) {
  const values = Object.values(entry.voters || {});
  return {
    up: values.filter((v) => v === "up").length,
    down: values.filter((v) => v === "down").length,
  };
}

function isBad(entry) {
  const { up, down } = votes(entry);
  return down > up;
}

function isUsable(entry) {
  if (isBad(entry) || entry.timeSensitive) return false;
  if (votes(entry).up > 0) return true; // confirmed good answers don't expire
  const created = entry.createdAt?.toMillis ? entry.createdAt.toMillis() : Date.now();
  return (Date.now() - created) / 86400000 < LEARNED_MAX_AGE_DAYS;
}

// Questions whose answer changes over time shouldn't be answered from memory.
const TIME_SENSITIVE =
  /\b(today|tonight|tomorrow|yesterday|now|current(ly)?|latest|recent(ly)?|this (week|month|year)|news|weather|price|rate|score|stock|live|trending|upcoming|20\d\d)\b/i;
export function isTimeSensitive(question) {
  return TIME_SENSITIVE.test(question);
}

// Follow-ups like "what about its population?" depend on the conversation.
const FOLLOW_UP = /\b(it|its|he|she|him|her|his|they|them|their|this|that|these|those|there|same|more|else)\b/i;
const FOLLOW_UP_START = /^(and|so|but|also|then|what about|how about|why|how come|really|tell me more|continue|go on)\b/i;
export function dependsOnContext(question, history) {
  if (!history.length) return false;
  const q = question.trim();
  // A lone word like "why?" or "more" only makes sense with the conversation.
  return FOLLOW_UP.test(q) || FOLLOW_UP_START.test(q) || q.split(/\s+/).length === 1;
}

async function candidates(collectionName, question) {
  const words = keywords(question).slice(0, 30); // Firestore allows up to 30 values here
  if (!words.length) return [];
  const snap = await getDocs(
    query(collection(db, collectionName), where("keywords", "array-contains-any", words), limit(30))
  );
  return snap.docs
    .map((d) => ({ id: d.id, collection: collectionName, ...d.data() }))
    .map((entry) => ({ entry, score: similarity(question, entry.question) }))
    .sort((x, y) => y.score - x.score);
}

// Looks up the vault and learned memory together (one read each).
// Passages from documents the admin taught in the Training room, best first:
// those containing most of the question's key words.
async function documentPassages(question) {
  const words = keywords(question).slice(0, 30);
  if (!words.length) return [];
  try {
    const snap = await getDocs(
      query(collection(db, "knowledge"), where("keywords", "array-contains-any", words), limit(20))
    );
    return snap.docs
      .map((d) => {
        const passage = d.data();
        const have = new Set(passage.keywords || []);
        return { title: passage.title, text: passage.text, score: words.filter((w) => have.has(w)).length / words.length };
      })
      .filter((p) => p.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  } catch (err) {
    console.warn("Couldn't read the taught documents:", err);
    return [];
  }
}

export async function lookup(question) {
  const [vault, learned, docs] = await Promise.all([
    candidates("vault", question),
    candidates("learned", question),
    documentPassages(question),
  ]);
  await addMeaning(question, [...vault, ...learned]);

  let memory = null;
  let similarTo = null;
  const byMeaning = (c) => {
    memory = c.entry;
    if (normalize(c.entry.question) !== normalize(question)) similarTo = c.entry.question;
  };
  // "…in 2001" and "…in 2011" are different questions, whatever the words.
  const sameNumbers = (c) => numbersIn(question) === numbersIn(c.entry.question);
  if (vault[0] && vault[0].score >= THRESHOLD.vault && sameNumbers(vault[0])) {
    memory = vault[0].entry;
  } else if (bestByMeaning(question, vault)) {
    byMeaning(bestByMeaning(question, vault));
  } else if (!isTimeSensitive(question)) {
    const best = learned.find(({ entry }) => isUsable(entry));
    const bar = best ? THRESHOLD.learned - Math.min(votes(best.entry).up, 3) * 0.03 : 1;
    if (best && best.score >= bar && sameNumbers(best)) memory = best.entry;
    else {
      const close = bestByMeaning(question, learned, isUsable);
      if (close) byMeaning(close);
    }
  }
  if (memory && similarTo) memory = { ...memory, similarTo };

  // Related knowledge handed to the AI, plus one similar answer people disliked.
  // Neural closeness counts too, a little below an equal word match.
  const rank = (c) => Math.max(c.score, (c.meaning ?? 0) - 0.25);
  const good = [];
  const bad = [];
  for (const c of [...vault, ...learned].sort((x, y) => rank(y) - rank(x))) {
    const { entry } = c;
    if (rank(c) < THRESHOLD.related) break;
    if (entry.collection === "learned" && isBad(entry)) {
      if (!bad.length) bad.push(entry);
    } else if (good.length < 3 && !(entry.collection === "learned" && entry.timeSensitive)) {
      good.push({ ...entry, curated: entry.collection === "vault" });
    }
  }

  return { memory, knowledge: { good, bad, docs } };
}

// source: "ai", "wikipedia" or "taught" (a person typed the answer).
export async function learn(question, answer, source = "ai") {
  const ref = await addDoc(collection(db, "learned"), {
    source,
    question: question.slice(0, 1000),
    answer: answer.slice(0, 20000),
    keywords: keywords(question).slice(0, 50),
    timeSensitive: isTimeSensitive(question),
    uses: 1,
    voters: {},
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    lastUsedAt: serverTimestamp(),
  });
  return ref.id;
}

export function markUsed(entryId) {
  return updateDoc(doc(db, "learned", entryId), { uses: increment(1), lastUsedAt: serverTimestamp() });
}

// One vote per person per answer; voting again changes it.
export function vote(entryId, direction) {
  return updateDoc(doc(db, "learned", entryId), { [`voters.${auth.currentUser.uid}`]: direction });
}

export function logActivity(question, mode) {
  return addDoc(collection(db, "activity"), {
    question: question.slice(0, 1000),
    mode,
    uid: auth.currentUser.uid,
    email: auth.currentUser.email,
    createdAt: serverTimestamp(),
  }).catch(() => {}); // logging should never break the chat
}
