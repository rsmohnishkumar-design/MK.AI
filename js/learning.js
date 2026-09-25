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
import { learn, lookup } from "./brain.js";

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
  return researchMore(question);
}

// --- More free, open sources (no key, and they allow other sites to read them) ---

async function getJson(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
const stripHtml = (html) => html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const firstSentences = (text, max = 480) => {
  let out = "";
  for (const s of text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text]) {
    if ((out + s).length > max && out) break;
    out += s;
  }
  return out.trim();
};

// A summary from any Wikipedia (Simple English, Tamil…)
async function wikiSummary(host, topic) {
  const search = await getJson(`https://${host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&srlimit=1&format=json&origin=*`);
  const title = search?.query?.search?.[0]?.title;
  if (!title) return null;
  const page = await getJson(`https://${host}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  return page?.extract && page.type !== "disambiguation" ? firstSentences(page.extract) : null;
}

// "meaning of serendipity", "define ubiquitous", "what does quaint mean"
async function wiktionary(question) {
  const m = question.toLowerCase().match(/^(?:what is the )?(?:meaning of|define|definition of|what does|what is the meaning of)\s+(?:the word\s+)?["']?([a-z-]{2,30})["']?(?:\s+mean)?\??$/);
  if (!m) return null;
  const data = await getJson(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(m[1])}`);
  const senses = (data?.en || []).slice(0, 3).map((p) => {
    const d = (p.definitions || []).map((x) => stripHtml(x.definition || "")).find(Boolean);
    return d ? `- **${p.partOfSpeech}**: ${d}` : null;
  }).filter(Boolean);
  return senses.length ? `**${m[1]}**\n${senses.join("\n")}` : null;
}

// Sources the chat hasn't already tried: Wiktionary, Tamil Wikipedia (for
// questions in Tamil), and Simple English Wikipedia.
export async function researchMore(question) {
  const meaning = await wiktionary(question.trim());
  if (meaning) return { answer: meaning, source: "Wiktionary" };
  if (/[\u0B80-\u0BFF]/.test(question)) {
    const ta = await wikiSummary("ta.wikipedia.org", question.replace(/[?？!]/g, "").trim());
    if (ta) return { answer: ta, source: "Tamil Wikipedia" };
  }
  const core = coreQuery(question);
  if (core && core.split(" ").length <= 6) {
    const simple = await wikiSummary("simple.wikipedia.org", core);
    if (simple) return { answer: simple, source: "Simple English Wikipedia" };
  }
  return null;
}

// Today's most-read Wikipedia articles: learns what people are curious about.
export async function learnTrending(max = 15, onLearned = () => {}) {
  const d = new Date(Date.now() - 86400000); // yesterday's list is complete
  const day = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  const feed = await getJson(`https://en.wikipedia.org/api/rest_v1/feed/featured/${day}`);
  const articles = [feed?.tfa, ...(feed?.mostread?.articles || [])].filter((a) => a?.extract && a.titles?.normalized);
  let learned = 0;
  for (const a of articles) {
    if (learned >= max) break;
    const title = a.titles.normalized;
    if (/^(Main Page|Special:|Deaths in|List of|\d{4} in )/.test(title)) continue;
    const person = /\b(born|actor|actress|singer|player|cricketer|footballer|politician|president|minister|writer|author|rapper|musician|businessman|director|youtuber|athlete)\b/i.test(a.description || "");
    const question = `${person ? "who is" : "what is"} ${title}`;
    const known = await lookup(question).catch(() => null);
    if (known?.memory) continue;
    await learn(question, firstSentences(a.extract), "wikipedia");
    learned++;
    onLearned(question);
  }
  return learned;
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
      const said = (q) => onStatus(`📚 Just learned: ${q.slice(0, 60)}`);
      let n = await learnFromList(night ? 5 : 1, said);
      if (!n && night) {
        const key = "mkai-trending-" + new Date().toDateString();
        let done = false;
        try {
          done = localStorage.getItem(key) === "1";
        } catch {}
        if (!done) {
          onStatus("🌙 Learning mode: reading today's most popular topics…");
          n = await learnTrending(15, said);
          try {
            localStorage.setItem(key, "1");
          } catch {}
        }
      }
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
