// MK.ai teaches itself, with no outside AI and no keys.
// - Questions it couldn't answer go on a shared learning list ("unknown").
// - Whenever a signed-in MK.ai page sits idle, it researches one of them
//   (its knowledge base, then Wikipedia) and saves what it finds to memory.
// - Learning mode (2:00–5:30 at night, or started from the vault) works
//   through the whole list and keeps the screen awake.
// A browser has to be open for this: MK.ai has no server of its own.

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  updateDoc,
  deleteDoc,
  increment,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { knowledgeAnswer } from "./kb.js";
import { wikiAnswer, wikiFind } from "./wiki.js";
import { coreQuery } from "./deepthink.js";
import { learn } from "./brain.js";

const MAX_TRIES = 5; // after this the question waits for a person to teach it
const IDLE_MS = 90000; // how long a page must be quiet before it researches
const NIGHT = { from: 2 * 60, to: 5 * 60 + 30 }; // minutes after midnight

// Keyboard mashing and bare numbers aren't worth learning
export function worthLearning(question) {
  const q = question.trim().toLowerCase();
  if (q.length < 4 || q.length > 300) return false;
  if (/(.)\1{3,}/.test(q)) return false; // "faaaaah"
  if (!/[a-z஀-௿]{3,}/.test(q)) return false; // "270814"
  const words = q.match(/[a-z]+/g) || [];
  return words.some((w) => w.length >= 3 && /[aeiouy]/.test(w));
}

// Puts a question it couldn't answer on the learning list
export function noteUnknown(question) {
  if (!auth.currentUser || !worthLearning(question)) return Promise.resolve();
  return addDoc(collection(db, "unknown"), {
    question: question.trim().slice(0, 500),
    tries: 0,
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  }).catch(() => {});
}

// Finds an answer without any outside AI: the knowledge base, then Wikipedia
// (as asked, then with just the key words).
export async function research(question) {
  const known = await knowledgeAnswer(question).catch(() => null);
  if (known?.answer) return { answer: known.answer, source: "my knowledge base" };
  const core = coreQuery(question);
  const wiki =
    (await wikiAnswer(question).catch(() => null)) ||
    (await wikiFind(question).catch(() => null)) ||
    (core && core !== question.toLowerCase() ? await wikiFind(core).catch(() => null) : null);
  if (wiki?.answer) return { answer: wiki.answer, source: "Wikipedia" };
  return null;
}

export function isNight(date = new Date()) {
  const m = date.getHours() * 60 + date.getMinutes();
  return m >= NIGHT.from && m < NIGHT.to;
}

// Researches up to `count` questions from the list. Returns how many it learned.
export async function learnFromList(count, onLearned = () => {}) {
  const snap = await getDocs(query(collection(db, "unknown"), orderBy("createdAt"), limit(40)));
  let learned = 0;
  let done = 0;
  for (const d of snap.docs) {
    if (done >= count) break;
    const { question, tries = 0 } = d.data();
    if (tries >= MAX_TRIES) continue;
    done++;
    const found = await research(question);
    if (found) {
      await learn(question, found.answer, "wikipedia");
      await deleteDoc(d.ref).catch(() => {});
      learned++;
      onLearned(question, found.source);
    } else {
      await updateDoc(doc(db, "unknown", d.id), { tries: increment(1), lastTriedAt: serverTimestamp() }).catch(() => {});
    }
  }
  return learned;
}

// Runs in the background of an open MK.ai page.
// canLearn(): whether this account may write to memory right now.
// onStatus(text): shows what it's doing ("" when quiet).
export function startAutoLearner({ canLearn, onStatus = () => {}, forceNight = () => false }) {
  let lastActivity = Date.now();
  let busy = false;
  let wakeLock = null;
  const touch = () => (lastActivity = Date.now());
  for (const ev of ["keydown", "pointerdown", "touchstart"]) addEventListener(ev, touch, { passive: true });

  const keepAwake = async (on) => {
    try {
      if (on && !wakeLock && navigator.wakeLock && document.visibilityState === "visible") {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => (wakeLock = null));
      } else if (!on && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch {}
  };

  const tick = async () => {
    if (busy || !auth.currentUser || !navigator.onLine || !canLearn()) return;
    const night = isNight() || forceNight();
    const idle = Date.now() - lastActivity > IDLE_MS;
    keepAwake(night);
    if (!night && !idle) return onStatus("");
    busy = true;
    try {
      onStatus(night ? "🌙 Learning mode: studying…" : "📚 Learning while you're away…");
      const n = await learnFromList(night ? 5 : 1, (q) => onStatus(`📚 Just learned: ${q.slice(0, 60)}`));
      if (!n) onStatus(night ? "🌙 Learning mode: nothing new to learn right now" : "");
    } catch (err) {
      console.warn("Self-learning:", err);
      onStatus("");
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(tick, 30000);
  setTimeout(tick, 5000);
  return () => {
    clearInterval(timer);
    keepAwake(false);
  };
}
