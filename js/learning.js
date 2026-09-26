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
  where,
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
  if (/[\u0B80-\u0BFF]{2,}/.test(q)) return true; // Tamil
  if (!/[a-z]{3,}/.test(q)) return false; // "270814"
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

const PERSON = /\b(born|died|actor|actress|singer|player|cricketer|footballer|politician|president|minister|writer|author|poet|rapper|musician|businessman|businesswoman|director|youtuber|athlete|scientist|physicist|chemist|mathematician|philosopher|emperor|king|queen|leader|activist|inventor|painter|composer)\b/i;
const SKIP_TITLE = /^(Main Page|Special:|Deaths in|List of|Lists of|\d{4} in |Index of|Outline of)/;

// Learns one Wikipedia article as "what is X" / "who is X", unless MK.ai
// already knows it. Returns the question when it learned something new.
// Titles already learned (on this device), so the same topic is never saved twice
const DONE_KEY = "mkai-learned-titles";
function doneTitles() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function markDone(title) {
  const done = doneTitles();
  done.add(title.toLowerCase());
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...done].slice(-5000)));
  } catch {}
}
// Is this exact question already in shared memory (from any device)?
async function alreadyLearned(question) {
  const snap = await getDocs(query(collection(db, "learned"), where("question", "==", question), limit(1))).catch(() => null);
  return !!snap && !snap.empty;
}

async function learnArticle(title, description, extract) {
  if (!title || !extract || SKIP_TITLE.test(title)) return null;
  if (doneTitles().has(title.toLowerCase())) return null;
  const question = `${PERSON.test(description || "") ? "who is" : "what is"} ${title}`;
  const other = question.startsWith("who") ? `what is ${title}` : `who is ${title}`;
  const skip =
    (await knowledgeAnswer(question).catch(() => null)) ||
    (await alreadyLearned(question)) ||
    (await alreadyLearned(other)) ||
    (await lookup(question).catch(() => null))?.memory;
  markDone(title);
  if (skip) return null;
  await learn(question, firstSentences(extract), "wikipedia");
  return question;
}

const dayPath = (daysAgo) => {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
};

// Wikipedia's most-read articles (yesterday, or `daysAgo` days back): what people are curious about.
export async function learnTrending(max = 15, onLearned = () => {}, daysAgo = 1) {
  const feed = await getJson(`https://en.wikipedia.org/api/rest_v1/feed/featured/${dayPath(daysAgo)}`);
  const articles = [feed?.tfa, ...(feed?.mostread?.articles || [])].filter((a) => a?.extract && a.titles?.normalized);
  let learned = 0;
  for (const a of articles) {
    if (learned >= max) break;
    const q = await learnArticle(a.titles.normalized, a.description, a.extract);
    if (q) {
      learned++;
      onLearned(q);
    }
  }
  return learned;
}

// The 1,000 most important topics on Wikipedia ("vital articles"): a
// curriculum MK.ai works through a few at a time. The list and how far it
// has got are kept on this device.
const CURRICULUM_KEY = "mkai-curriculum";
async function curriculum() {
  try {
    const saved = JSON.parse(localStorage.getItem(CURRICULUM_KEY) || "null");
    if (saved?.titles?.length) return saved;
  } catch {}
  const titles = [];
  let cont = "";
  for (let page = 0; page < 4; page++) {
    const data = await getJson(
      `https://en.wikipedia.org/w/api.php?action=query&titles=Wikipedia:Vital_articles/Level/3&prop=links&plnamespace=0&pllimit=max&format=json&origin=*${cont ? `&plcontinue=${encodeURIComponent(cont)}` : ""}`
    );
    const links = Object.values(data?.query?.pages || {})[0]?.links || [];
    titles.push(...links.map((l) => l.title));
    cont = data?.continue?.plcontinue;
    if (!cont) break;
  }
  const plan = { titles: titles.sort(() => Math.random() - 0.5), next: 0 };
  try {
    localStorage.setItem(CURRICULUM_KEY, JSON.stringify(plan));
  } catch {}
  return plan;
}

export async function learnCurriculum(max = 5, onLearned = () => {}) {
  const plan = await curriculum();
  let learned = 0;
  let checked = 0;
  while (learned < max && checked < max * 4 && plan.next < plan.titles.length) {
    const title = plan.titles[plan.next++];
    checked++;
    const page = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
    if (!page?.extract || page.type === "disambiguation") continue;
    const q = await learnArticle(page.title, page.description, page.extract);
    if (q) {
      learned++;
      onLearned(q);
    }
  }
  try {
    localStorage.setItem(CURRICULUM_KEY, JSON.stringify(plan));
  } catch {}
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
        // The list is done: popular topics from the last week (once each per
        // night), then the curriculum of important topics.
        const key = "mkai-trending-" + new Date().toDateString();
        let daysDone = 0;
        try {
          daysDone = Number(localStorage.getItem(key)) || 0;
        } catch {}
        if (daysDone < 7) {
          onStatus("🌙 Learning mode: reading the week's most popular topics…");
          n = await learnTrending(10, said, daysDone + 1);
          try {
            localStorage.setItem(key, String(daysDone + 1));
          } catch {}
        }
        if (!n) {
          onStatus("🌙 Learning mode: studying important topics…");
          n = await learnCurriculum(5, said);
        }
      }
      if (!n) onStatus(night ? "🌙 Learning mode: all caught up for now" : "");
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
